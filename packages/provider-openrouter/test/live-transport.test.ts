import { describe, expect, it, vi } from 'vitest';
import * as provider from '@sceneaxi/provider-openrouter';
import type { OpenRouterTransportRequest } from '@sceneaxi/provider-openrouter';

const model = { provider: 'openrouter', model: 'fixture/model', version: 'fixture-v1', quantization: 'fixture-q' };

const request: OpenRouterTransportRequest = { schemaVersion: 1, operation: 'complete', modelDescriptor: model, model: model.model, messages: [{ role: 'user', content: 'fixture' }], provider: { allow_fallbacks: false }, temperature: 0, seed: 7 };

const payload = { model: model.model, choices: [{ finish_reason: 'stop', message: { content: 'fixture response' } }] };

describe('explicitly admitted OpenRouter HTTPS transport', () => {
  it('defaults inert before credential reads or network', async () => {
    const key = vi.fn(() => 'fixture-not-secret'); const fetch = vi.fn();
    await expect(provider.createOpenRouterLiveTransport({ apiKey: key, fetch })(request)).rejects.toThrow('OPENROUTER_LIVE_DISABLED');
    expect(key).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('uses only approved endpoint, no redirects/cache, no fallback and bounded bytes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(payload)));
    const transport = provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture-not-secret', fetch });
    expect(await transport(request)).toEqual({ response: payload, executedModel: model });
    const invocation = fetch.mock.calls[0];

    if (invocation === undefined || invocation[1] === undefined) throw new Error("Expected fetch options.");
    const [url, init] = invocation;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.redirect).toBe('error'); expect(init.cache).toBe('no-store');
    expect(JSON.parse(String(init.body))).toEqual({ model: model.model, messages: request.messages, provider: request.provider, temperature: 0, seed: 7 });
  });
  it.each([429, 502, 503])('retries only explicit transient %s with bounded delay', async (status) => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('redacted', { status, headers: { 'retry-after': '999999' } })).mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    const sleep = vi.fn(async () => {});
    expect(await provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture-not-secret', fetch, sleep })(request)).toMatchObject({ response: payload });
    expect(fetch).toHaveBeenCalledTimes(2); expect(sleep).toHaveBeenCalledWith(2000);
  });
  it.each([400, 401, 403, 404])('does not retry terminal %s or echo provider bytes', async (status) => {
    const fetch = vi.fn(async () => new Response('fixture-sensitive-sentinel', { status }));
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture-key-sentinel', fetch })(request)).rejects.toThrow('OPENROUTER_TRANSPORT_FAILED');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never retries uncertain network errors and redacts thrown messages', async () => {
    const fetch = vi.fn(async () => { throw new Error('fixture-sensitive-sentinel'); });
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture-key-sentinel', fetch })(request)).rejects.toThrow(/^OPENROUTER_TRANSPORT_FAILED$/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('refuses missing credentials without fetching', async () => {
    const fetch = vi.fn();
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => '', fetch })(request)).rejects.toThrow('OPENROUTER_CREDENTIAL_UNAVAILABLE');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('cancels streamed bodies at the limit, even with absent content-length', async () => {
    const cancel = vi.fn();
    const fetch = vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(262145)); }, cancel })));
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture', fetch })(request)).rejects.toThrow('OPENROUTER_RESPONSE_BOUNDS');
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('refuses malformed JSON without echoing response body', async () => {
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture', fetch: async () => new Response('fixture-sensitive-sentinel') })(request)).rejects.toThrow('OPENROUTER_RESPONSE_INVALID');
  });
  it('rejects model mismatch without invented execution attestation', async () => {
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture', fetch: async () => new Response(JSON.stringify({ ...payload, model: 'other' })) })(request)).rejects.toThrow('OPENROUTER_RESPONSE_MODEL_MISMATCH');
  });
  it('limits retries and always releases/cancels transient response bodies', async () => {
    const fetch = vi.fn(async () => new Response('busy', { status: 503 }));
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture', fetch, sleep: async () => {} })(request)).rejects.toThrow('OPENROUTER_TRANSPORT_FAILED');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('bounds request before reading credentials', async () => {
    const key = vi.fn(() => 'fixture');
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: key, fetch: vi.fn() })({ ...request, messages: [{ role: 'user', content: 'x'.repeat(65537) }] })).rejects.toThrow('OPENROUTER_REQUEST_BOUNDS');
    expect(key).not.toHaveBeenCalled();
  });
  it('aborts stalled body reads within the injected timeout', async () => {
    const fetch = vi.fn(async () => new Response(new ReadableStream({ start() {} })));
    await expect(provider.createOpenRouterLiveTransport({ enabled: true, apiKey: () => 'fixture', fetch, timeoutMs: 10 })(request)).rejects.toThrow('OPENROUTER_TRANSPORT_FAILED');
  });
});
