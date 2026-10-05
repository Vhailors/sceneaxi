import { isJsonObject, parseUnambiguousJson } from '@sceneaxi/schemas';
import type { OpenRouterTransport, OpenRouterTransportRequest } from './index.js';

function isFetch(value: unknown): value is typeof fetch { return typeof value === 'function'; }

function isCredential<Value>(value: Value): value is Value & string { return typeof value === 'string'; }

/** Explicit deployment capability, not an ambient credential reader. No caller-controlled URL. */
export type OpenRouterLiveTransportOptions = Readonly<{
  enabled?: boolean;
  apiKey: () => string | undefined;
  fetch: typeof fetch;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

/** Live I/O exists only when a deployment deliberately admits this capability.
 * Version/quantization are caller-pinned policy; upstream confirms model, not a
 * signed version/quantization attestation. Never retry uncertain network failures.
 */
export function createOpenRouterLiveTransport(options: OpenRouterLiveTransportOptions): OpenRouterTransport {
  const timeoutMs = options.timeoutMs ?? 15_000;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 || !isFetch(options.fetch)) {
    throw new Error('OPENROUTER_TRANSPORT_CONFIGURATION_INVALID');
  }

  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return async (request) => {
    if (options.enabled !== true) throw new Error('OPENROUTER_LIVE_DISABLED');

    if (request.provider.allow_fallbacks !== false || request.temperature !== 0 || request.model !== request.modelDescriptor.model || request.modelDescriptor.provider !== 'openrouter') {
      throw new Error('OPENROUTER_REQUEST_MODEL_NOT_PINNED');
    }

    const payload: LiveRequestPayload = { model: request.model, messages: request.messages, provider: request.provider, temperature: request.temperature, seed: request.seed };

      if (request.tools !== undefined) payload.tools = request.tools;
      const body = JSON.stringify(payload);

    if (new TextEncoder().encode(body).byteLength > 65_536) throw new Error('OPENROUTER_REQUEST_BOUNDS');
    let key: string | undefined;

    try { key = options.apiKey(); } catch { throw new Error('OPENROUTER_CREDENTIAL_UNAVAILABLE'); }

    if (!isCredential(key) || key.length < 1 || key.length > 8192 || /\s/.test(key)) throw new Error('OPENROUTER_CREDENTIAL_UNAVAILABLE');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const abort = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const expired = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { abort.abort(); reject(new Error('OPENROUTER_TRANSPORT_FAILED')); }, timeoutMs);
      });

      let response: Response | undefined;
      let failure = "OPENROUTER_TRANSPORT_FAILED";

      try {
        response = await Promise.race([options.fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body, redirect: 'error', cache: 'no-store', signal: abort.signal,
        }), expired]);

        if (!response.ok) {
          const retryAfter = Number(response.headers.get('retry-after'));

          if ([429, 502, 503].includes(response.status) && attempt < 2) {
            await response.body?.cancel();
            clearTimeout(timer);
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(2000, retryAfter * 1000) : 250 * (attempt + 1));
            continue;
          }

          throw new Error('OPENROUTER_TRANSPORT_FAILED');
        }

        const advertised = Number(response.headers.get('content-length'));

        if (advertised > 262_144 || response.body === null) throw new Error('OPENROUTER_RESPONSE_BOUNDS');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = []; let size = 0;

        try {
          while (true) {
            const part = await Promise.race([reader.read(), expired]);

            if (part.done) break;
            size += part.value.byteLength;

            if (size > 262_144) throw new Error('OPENROUTER_RESPONSE_BOUNDS');
            chunks.push(part.value);
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }

        const bytes = new Uint8Array(size); let offset = 0;

        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }

        const parsed = parseUnambiguousJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

        if (!parsed.ok || !isJsonObject(parsed.value)) throw new Error('OPENROUTER_RESPONSE_INVALID');

        if (parsed.value['model'] !== request.model) throw new Error('OPENROUTER_RESPONSE_MODEL_MISMATCH');

        return Object.freeze({ response: parsed.value, executedModel: Object.freeze({ ...request.modelDescriptor }) });
      } catch (error) {
        const named = error instanceof Error ? error.message : '';

        if (['OPENROUTER_RESPONSE_BOUNDS', 'OPENROUTER_RESPONSE_INVALID', 'OPENROUTER_RESPONSE_MODEL_MISMATCH'].includes(named)) failure = named;
      } finally {
        clearTimeout(timer);
        abort.abort();

        if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
      }

      throw new Error(failure);
    }

    throw new Error('OPENROUTER_TRANSPORT_FAILED');
  };
}

type LiveRequestPayload = { model: string; messages: OpenRouterTransportRequest["messages"]; provider: OpenRouterTransportRequest["provider"]; temperature: 0; seed: number; tools?: OpenRouterTransportRequest["tools"] };
