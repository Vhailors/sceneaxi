/**
 * Privileged OpenAI-compatible chat-completions transport for desktop BYOK.
 *
 * This module is Electron-only. It owns the live HTTPS call, the host allow
 * list, and the PRC-endpoint refusal required by the locked DeepSeek adoption
 * decision. Core packages stay offline; tests inject fixture transports.
 */
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  type ModelDescriptor,
  type JsonValue,
} from "@sceneaxi/schemas";
import { DesktopByoRunnerRefusal } from "../lib/byo-configuration.js";
import { DESKTOP_BYO_CONFIGURATION_REFUSALS } from "../lib/byo-configuration-contract.js";
import type { ProviderKeyAccess } from "../lib/byo-configuration.js";

function isDesktopObject<Value>(value: Value): value is Value & (object | null) {
  return typeof value === "object";
}

function isDesktopText<Value>(value: Value): value is Value & string {
  return typeof value === "string";
}

export const DESKTOP_OPENCODE_API_BASE = "https://opencode.ai/zen/v1";

const COMPLETE_TIMEOUT_MS = 45_000;

/** Complete-only 2048-token responses are bounded before decoding/JSON parse. */
const MAX_RESPONSE_BYTES = 256 * 1024;

export const DESKTOP_DEEPSEEK_MODEL = Object.freeze({
  model: "deepseek-v4-flash",
  provider: "opencode",
  quantization: "v4-flash",
  version: "2026-08-14",
}) satisfies ModelDescriptor;

const ALLOWED_HOSTS = Object.freeze(["opencode.ai"]);

const REFUSED_HOSTS = Object.freeze([
  "api.deepseek.com",
  "www.deepseek.com",
  "chat.deepseek.com",
  "deepseek.com",
]);

export function extractCompletionJsonDocument(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  return (fenced?.[1] ?? trimmed).trim();
}

function refusedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return REFUSED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function allowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return ALLOWED_HOSTS.some((allowed) => host === allowed);
}

function completionText(payload: JsonValue): string | null {
  if (!isDesktopObject(payload) || payload === null || !("choices" in payload)) return null;
  const choices = payload.choices;

  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: JsonValue = choices[0];

  if (!isDesktopObject(first) || first === null || !("message" in first)) return null;
  const message = first.message;

  return isDesktopObject(message) && message !== null && "content" in message && isDesktopText(message.content)
    ? message.content
    : null;
}

async function boundedCompletionPayload(response: Response, signal: AbortSignal): Promise<JsonValue> {
  const length = response.headers.get("content-length");

  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    void response.body?.cancel();
    throw new Error("Completion response exceeds the byte budget.");
  }

  if (response.body === null) throw new Error("Completion response body is absent.");
  const reader = response.body.getReader();
  let abort: (() => void) | undefined;

  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(Object.assign(new Error("Completion timed out."), { name: "TimeoutError" }));
    signal.addEventListener("abort", abort, { once: true });

    if (signal.aborted) abort();
  });

  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;

    while (true) {
      const chunk = await Promise.race([reader.read(), interrupted]);

      if (chunk.done) break;
      bytes += chunk.value.byteLength;

      if (bytes > MAX_RESPONSE_BYTES) throw new Error("Completion response exceeds the byte budget.");
      chunks.push(chunk.value);
    }

    const body = new Uint8Array(bytes);
    let offset = 0;

    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }

    // SAFETY: Fatal UTF-8 decoding and JSON.parse reject invalid encodings and syntax; successful parsing produces only JSON values.
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as JsonValue;
  } catch (cause) {
    void reader.cancel().catch(() => {});
    throw cause;
  } finally {
    if (abort !== undefined) signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export function createDesktopOpenCodeLiveTransport(input: Readonly<{
  credential: ProviderKeyAccess;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}>): Readonly<{
  complete(prompt: string, model: ModelDescriptor): Promise<string>;
}> {
  const apiBase = input.apiBase ?? DESKTOP_OPENCODE_API_BASE;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? COMPLETE_TIMEOUT_MS;

  return Object.freeze({
    async complete(prompt: string, model: ModelDescriptor) {
      let url: URL;

      try {
        url = new URL("chat/completions", apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
      } catch {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged DeepSeek transport received an invalid API base.",
        );
      }

      if (refusedHost(url.hostname)) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The DeepSeek PRC endpoint is refused; desktop BYOK uses the named OpenCode path only.",
        );
      }

      if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
          (url.port !== "" && url.port !== "443") || !allowedHost(url.hostname)) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged DeepSeek transport refused an unnamed host.",
        );
      }

      try {
        const signal = AbortSignal.timeout(timeoutMs);

        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${input.credential.read()}`,
            "content-type": "application/json",
            accept: "application/json",
            "user-agent": "SceneAxi-Desktop/0.0.0 (Linux; BYOK complete-only)",
          },
          body: JSON.stringify({
            model: model.model,
            temperature: 0,
            max_tokens: 2048,
            messages: [{ role: "user", content: prompt }],
          }),
          redirect: "error",
          signal,
        });

        if (!response.ok || response.redirected) {
          void response.body?.cancel();
          throw new Error("The completion request was refused.");
        }

        const payload = await boundedCompletionPayload(response, signal);
        const text = completionText(payload);

        if (text === null || text.trim().length === 0) throw new Error("Completion text is absent.");

        return extractCompletionJsonDocument(text);
      } catch (cause) {
        const timedOut =
          cause instanceof Error &&
          (cause.name === "TimeoutError" || cause.name === "AbortError");

        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          timedOut
            ? "Flash did not finish in time. Press Send again, or try a shorter prompt."
            : "Flash could not be reached. Check the network and press Send again.",
        );
      }

    },
  });
}

export function desktopOpenCodeCompleteResponse(text: string) {
  return Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    operation: "complete" as const,
    text,
    finishReason: "stop" as const,
  });
}
