import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutHandler } from "../src/app/api/checkout/checkout-handler.js";
import type { SiteCheckoutHandoff, SiteResult } from "@sceneaxi/site-kit";

const origin = "https://fixture.test";

const valid = "packId=starter-100&attempt=fixture_attempt_123456";

const encoder = new TextEncoder();

const cleanup: (() => void)[] = [];

// Drain native stream/form parsing promise jobs without sleeping or advancing time.
async function flush() { for (let i = 0; i < 40; i++) await Promise.resolve(); }

function fixture(result: SiteResult<SiteCheckoutHandoff> = {
  ok: true, value: { intentId: "fixture-intent", redirectUrl: "https://checkout.fixture.test/session", mode: "test" },
}) {
  const session = vi.fn(async () => "carried-session");
  const principal = vi.fn(async () => ({ ok: true as const, value: { user: { userId: "verified-user" } } }));
  const createCheckout = vi.fn(async () => result);

  const plane = vi.fn((token: string | null) => {
    expect(token).toBe("carried-session");

    return { wired: { billing: true }, identity: { resolvePrincipal: principal }, billing: { createCheckout } };
  });

  const handler = createCheckoutHandler({
    environment: () => ({ NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: origin }),
    readRequestSignals: request => ({ formOrigin: { requestUrl: request.url, origin: request.headers.get("origin"), fetchSite: request.headers.get("sec-fetch-site") } }),
    readSessionToken: session, plane, log: () => {},
    json: (payload, options) => Response.json(payload, options), redirect: (url, status) => Response.redirect(url, status),
  });

  return { handler, session, plane, principal, createCheckout };
}

function request(stream: ReadableStream<Uint8Array>, signal?: AbortSignal, accept = "application/json") {
  // Genuine Request and native stream; substitute only body to avoid Node-only duplex typing.
  const init: RequestInit = { method: "POST", body: valid,
    headers: { origin, host: "untrusted.test", accept, "content-type": "application/x-www-form-urlencoded" } };

  if (signal !== undefined) init.signal = signal;

  const value = new Request(`${origin}/api/checkout`, init);

  Object.defineProperty(value, "body", { value: stream });

  return value;
}

function body(bytes?: Uint8Array, cancel: () => void | Promise<void> = () => {}, close = false) {
  let enqueue: (bytes: Uint8Array) => void = () => { throw new Error("stream not started"); };

  let finish: () => void = () => { throw new Error("stream not started"); };

  const cancelled = vi.fn(cancel);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      enqueue = value => controller.enqueue(value);
      finish = () => controller.close();
      cleanup.push(() => controller.error(new Error("fixture cleanup")));

      if (bytes) controller.enqueue(bytes);

      if (close) controller.close();
    }, cancel: cancelled,
  });

  return { stream, cancelled, enqueue, finish };
}

function observe(h: ReturnType<typeof fixture>, r: Request) {
  let response: Response | undefined;

  const pending = h.handler(r).then(value => { response = value;

 return value; });

  return { pending, response: () => response };
}

async function invalid(response: Response | undefined, h: ReturnType<typeof fixture>) {
  expect(response?.status).toBe(400);
  expect(await response?.json()).toMatchObject({ ok: false, reason: "BILLING_CHECKOUT_REQUEST_INVALID" });
  expect(h.session).not.toHaveBeenCalled(); expect(h.plane).not.toHaveBeenCalled();
  expect(h.principal).not.toHaveBeenCalled(); expect(h.createCheckout).not.toHaveBeenCalled();
}

beforeEach(() => vi.useFakeTimers());

afterEach(async () => {
  for (const release of cleanup.splice(0)) release();
  await flush(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});

describe("real checkout reader bounds", () => {
  it("already-aborted request refuses before acquiring or reading its stream", async () => {
    const h = fixture(), b = body(encoder.encode(valid), () => {}, true), abort = new AbortController();
    abort.abort(); const getReader = vi.spyOn(b.stream, "getReader");
    await invalid(await h.handler(request(b.stream, abort.signal)), h);
    expect(getReader).not.toHaveBeenCalled(); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("abort terminates hanging read, cancels once, unlocks and removes timer/listener", async () => {
    const h = fixture(), b = body(), abort = new AbortController(), r = request(b.stream, abort.signal);
    const add = vi.spyOn(r.signal, "addEventListener"), remove = vi.spyOn(r.signal, "removeEventListener");
    const out = observe(h, r); await flush(); expect(out.response()).toBeUndefined();
    abort.abort(); await flush(); await invalid(out.response(), h);
    expect(b.cancelled).toHaveBeenCalledTimes(1); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0]?.[1]); await out.pending;
  });
  it("abort wins even when a queued read is already fulfilled", async () => {
    const h = fixture(), b = body(encoder.encode(valid), () => {}, true), abort = new AbortController();
    const out = observe(h, request(b.stream, abort.signal)); abort.abort(); await flush();
    await invalid(out.response(), h); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0); await out.pending;
  });
  it("zero-byte hanging read refuses at total 5000ms deadline, not before", async () => {
    const h = fixture(), b = body(), r = request(b.stream);
    const add = vi.spyOn(r.signal, "addEventListener"), remove = vi.spyOn(r.signal, "removeEventListener");
    const out = observe(h, r); await vi.advanceTimersByTimeAsync(4999); expect(out.response()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1); await invalid(out.response(), h);
    expect(b.cancelled).toHaveBeenCalledTimes(1); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0]?.[1]); await out.pending;
  });
  it("partial bytes do not reset overall deadline", async () => {
    const h = fixture(), b = body(encoder.encode("packId=starter-100&")), out = observe(h, request(b.stream));
    await vi.advanceTimersByTimeAsync(4000); b.enqueue(encoder.encode("attempt=fixture_")); await flush();
    await vi.advanceTimersByTimeAsync(999); expect(out.response()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1); await invalid(out.response(), h);
    expect(b.cancelled).toHaveBeenCalledTimes(1); expect(b.stream.locked).toBe(false); await out.pending;
  });
  it.each(["pending", "rejected"])("oversize refusal does not await %s cancellation", async kind => {
    let release: () => void = () => {};

    const cancelled = kind === "pending" ? new Promise<void>(resolve => { release = resolve; }) : undefined;
    cleanup.push(() => release());
    const h = fixture(), b = body(new Uint8Array(8193), () => cancelled ?? Promise.reject(new Error("transport cancellation failed")));
    const out = observe(h, request(b.stream)); await flush(); await invalid(out.response(), h);
    expect(b.cancelled).toHaveBeenCalledTimes(1); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    release(); await out.pending;
  });
  it("abort refusal also does not await hanging cancellation", async () => {
    let release: () => void = () => {};

    const cancellation = new Promise<void>(resolve => { release = resolve; }); cleanup.push(() => release());
    const h = fixture(), b = body(undefined, () => cancellation), abort = new AbortController();
    const out = observe(h, request(b.stream, abort.signal)); abort.abort(); await flush(); await invalid(out.response(), h);
    expect(b.stream.locked).toBe(false); expect(b.cancelled).toHaveBeenCalledTimes(1); release(); await out.pending;
  });
  it("read error refuses and releases lock and deadline", async () => {
    const h = fixture(), b = body(), out = observe(h, request(b.stream)); cleanup[0]?.();
    await flush(); await invalid(out.response(), h); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0); await out.pending;
  });
  it("multi-chunk form completed at 4999ms succeeds and clears its deadline", async () => {
    const h = fixture(), b = body(encoder.encode("packId=starter-100&")), out = observe(h, request(b.stream));
    await vi.advanceTimersByTimeAsync(4999); expect(out.response()).toBeUndefined();
    b.enqueue(encoder.encode("attempt=fixture_attempt_123456")); b.finish();
    const response = await out.pending;
    expect(response.status).toBe(303); expect(h.createCheckout).toHaveBeenCalledTimes(1);
    expect(b.stream.locked).toBe(false); expect(b.cancelled).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1); expect(b.cancelled).not.toHaveBeenCalled();
  });
  it("8192-byte cumulative bound spans multiple chunks", async () => {
    const h = fixture(), b = body(new Uint8Array(4096)), out = observe(h, request(b.stream));
    await flush(); expect(out.response()).toBeUndefined(); b.enqueue(new Uint8Array(4097));
    await flush(); await invalid(out.response(), h);
    expect(b.cancelled).toHaveBeenCalledTimes(1); expect(b.stream.locked).toBe(false); await out.pending;
  });
  it("deadline refusal cannot hang on cancellation and preserves HTML presentation", async () => {
    let release: () => void = () => {};

    const cancellation = new Promise<void>(resolve => { release = resolve; }); cleanup.push(() => release());
    const h = fixture(), b = body(undefined, () => cancellation), out = observe(h, request(b.stream, undefined, "text/html"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(out.response()?.status).toBe(303);
    expect(out.response()?.headers.get("location")).toBe("/pricing?reason=BILLING_CHECKOUT_REQUEST_INVALID");
    expect(h.session).not.toHaveBeenCalled(); expect(h.createCheckout).not.toHaveBeenCalled();
    expect(b.cancelled).toHaveBeenCalledTimes(1); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    release(); await out.pending;
  });
  it.each([valid, `${valid}${" ".repeat(8192 - encoder.encode(valid).byteLength)}`])("valid bounded body %# authorizes verified user and cleans up", async value => {
    const h = fixture(), b = body(encoder.encode(value), () => {}, true), abort = new AbortController(), r = request(b.stream, abort.signal);
    const add = vi.spyOn(r.signal, "addEventListener"), remove = vi.spyOn(r.signal, "removeEventListener");
    const response = await h.handler(r);
    expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("https://checkout.fixture.test/session");
    expect(h.principal).toHaveBeenCalledWith({ surface: "site", sessionToken: "carried-session" });
    expect(h.createCheckout).toHaveBeenCalledWith({ userId: "verified-user", packId: "starter-100",
      successUrl: `${origin}/account?checkout=success`, cancelUrl: `${origin}/pricing?checkout=cancelled`,
      idempotencyKey: "pack:starter-100:user:verified-user:attempt:fixture_attempt_123456" });
    expect(b.cancelled).not.toHaveBeenCalled(); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0]?.[1]);
    abort.abort(); await vi.advanceTimersByTimeAsync(5000); expect(b.cancelled).not.toHaveBeenCalled();
  });
  it.each([`${valid}&attempt=duplicate`, `${valid}&userId=forged`, "packId=starter-100"])("ambiguous/forged/incomplete form %# refuses before authority", async value => {
    const h = fixture(), b = body(encoder.encode(value), () => {}, true);
    await invalid(await h.handler(request(b.stream)), h); expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("hostile origin refuses before looking at hanging body", async () => {
    const h = fixture(), b = body(), r = request(b.stream); r.headers.set("origin", "https://evil.test");
    const getReader = vi.spyOn(b.stream, "getReader"); const response = await h.handler(r);
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(getReader).not.toHaveBeenCalled(); expect(h.session).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["application/json", "text/html"])("valid bounded read preserves durable budget presentation for %s", async accept => {
    const h = fixture({ ok: false, reason: "BILLING_CHECKOUT_RATE_LIMITED", message: "Budget reached." });
    const b = body(encoder.encode(valid), () => {}, true), response = await h.handler(request(b.stream, undefined, accept));
    expect(h.createCheckout).toHaveBeenCalledTimes(1);

    if (accept === "application/json") {
      expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("300");
      expect(await response.json()).toMatchObject({ reason: "BILLING_CHECKOUT_RATE_LIMITED" });
    } else { expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("/pricing?reason=BILLING_CHECKOUT_RATE_LIMITED"); }

    expect(b.stream.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});
