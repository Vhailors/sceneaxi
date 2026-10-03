import { describe, expect, it, vi } from "vitest";
import { createCatalogServerFetchAdapter, createCatalogServerIdentityPlane, CATALOG_SESSION_MAX_RESPONSE_BYTES } from "../src/catalog-server-fetch.js";
import { resolveCatalogViewer } from "../src/catalog-identity.js";
import { createIdentityPlane, type SiteIdentityPort, type SitePrincipal } from "../src/ports.js";
import { ok, refuse, type SiteResult } from "../src/refusals.js";

const origin = "https://identity.example.test";

const now = "2026-10-02T12:00:00.000Z";

const principal: SitePrincipal = {
  user: { userId: "own-user", email: "own@example.test", emailVerified: true, disabled: false },
  role: "user",
  session: { sessionId: "own-session", userId: "own-user", surface: "site", issuedAt: "2026-10-02T11:00:00.000Z", expiresAt: "2026-10-02T13:00:00.000Z" },
};

type SessionWireFixture = import("@sceneaxi/schemas").JsonValue | SitePrincipal | { version: number; ok: boolean; value?: SitePrincipal | null; reason?: string; message?: string };

const response = (value: SessionWireFixture, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});

const success = () => response({ version: 1, ok: true, value: principal });

const setup = (transport: typeof fetch = vi.fn(async () => success())) => ({
  adapter: createCatalogServerFetchAdapter({ approved: true, configuredOrigin: origin, transport, now: () => now }), transport,
});

describe("configured-origin catalog own-session transport", () => {
  it("composed boundary refuses credential accessors and Proxy get traps without reads", async () => {
    const transport = vi.fn(async () => success());
    const plane = createCatalogServerIdentityPlane({ approved: true, configuredOrigin: origin, transport, now: () => now });
    const getter = vi.fn(() => "own-session.secret");
    expect(await plane.identity.resolvePrincipal({ surface: "site", get sessionToken() { return getter(); } })).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(getter).not.toHaveBeenCalled();
    const get = vi.fn(() => { throw new Error("private Proxy read"); });
    const carried: import("../src/ports.js").SiteIdentityRequest = { surface: "site", sessionToken: "own-session.secret" };
    const proxy = new Proxy(carried, { get });
    expect(await plane.identity.resolvePrincipal(proxy)).toMatchObject({ ok: true });
    expect(get).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("captures configured Proxy data without get reads and refuses throwing descriptor traps", async () => {
    const get = vi.fn(() => { throw new Error("private configuration read"); });
    const transport = vi.fn(async () => success());
    const options = new Proxy({ approved: true, configuredOrigin: origin, transport, now: () => now }, { get });
    const plane = createCatalogServerIdentityPlane(options);
    expect(await plane.identity.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ ok: true });
    expect(get).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(1);
    const broken = new Proxy({ approved: true, configuredOrigin: origin, transport }, { getOwnPropertyDescriptor() { throw new Error("private descriptor"); } });
    const refused = createCatalogServerIdentityPlane(broken);
    expect(refused.wired).toBe(false);
    expect(await refused.identity.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("captures deployment options without evaluating origin/credential getters", async () => {
    const getter = vi.fn(() => origin);
    const transport = vi.fn(async () => success());
    const options = { approved: true, get configuredOrigin() { return getter(); }, transport };
    const plane = createCatalogServerIdentityPlane(options);
    expect(plane.wired).toBe(false);
    expect(await plane.identity.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(getter).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it("reads through the real own-session handler seam without a provider or socket", async () => {
    const path = "../../../sites/umbrella/src/provider/own-session.ts";

    const module: { createOwnSessionHandler: (authority: {
      verifyFormOrigin: (signals: { readonly origin?: string | null | undefined }) => SiteResult<string>;
      plane: (input: { readonly sessionToken: string }) => { readonly identity: SiteIdentityPort };
    }, options: { configuredOrigin: () => string }) => (request: Request) => Promise<Response> } = await import(path);

    const verification = vi.fn(async (request: { readonly sessionToken?: string | null }) => request.sessionToken === "own-session.secret" ? ok(principal) : refuse("IDENTITY_SESSION_ABSENT"));

    const handler = module.createOwnSessionHandler({
      verifyFormOrigin: signals => signals.origin === origin ? ok(origin) : refuse("SITE_REQUEST_CROSS_ORIGIN"),
      plane: () => ({ identity: createIdentityPlane({ adapter: { resolvePrincipal: verification }, now: () => now }) }),
    }, { configuredOrigin: () => origin });

    const transport: typeof fetch = vi.fn((url, init) => handler(new Request(url, init)));
    const { adapter } = setup(transport);
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toEqual({ ok: true, value: principal });
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.invalid" })).toMatchObject({ reason: "IDENTITY_SESSION_ABSENT" });
    expect(verification).toHaveBeenCalledTimes(2);
    const hostile = await handler(new Request(origin + "/api/auth/own-session", { headers: { Origin: "https://evil.test", "x-sceneaxi-session": "own-session.secret" } }));
    expect(hostile.status).toBe(403);
    expect(verification).toHaveBeenCalledTimes(2);
  });
  it.each(["catalog-game", "catalog-web"])("real %s composition consumes the one configured adapter", async site => {
    // Runtime import keeps the package's composite rootDir intact; the public
    // structural function contract is still tested by real invocation, not source text.
    const module: { createCatalogRequestIdentityPlane: typeof createCatalogServerIdentityPlane } = await import("../../../sites/" + site + "/src/lib/identity-plane.ts");
    const makePlane = module.createCatalogRequestIdentityPlane;
    const transport = vi.fn(async () => success());
    expect(makePlane().wired).toBe(false);
    const plane = makePlane({ approved: true, configuredOrigin: origin, transport, now: () => now });
    expect(plane.wired).toBe(true);
    expect(await resolveCatalogViewer(plane, "own-session.secret")).toMatchObject({ ok: true, value: principal });
    expect(await resolveCatalogViewer(plane)).toMatchObject({ reason: "IDENTITY_SESSION_ABSENT" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("uses the injected clock across both transport and catalog validation", async () => {
    const historical = { ...principal, session: { ...principal.session, issuedAt: "2000-01-01T00:00:00.000Z", expiresAt: "2000-01-01T02:00:00.000Z" } };
    const plane = createCatalogServerIdentityPlane({ approved: true, configuredOrigin: origin, now: () => "2000-01-01T01:00:00.000Z", transport: vi.fn(async () => response({ version: 1, ok: true, value: historical })) });
    expect(await resolveCatalogViewer(plane, "own-session.secret")).toMatchObject({ ok: true, value: historical });
  });
  it("is absent honestly until configuration is explicitly approved", async () => {
    const transport = vi.fn(async () => success());

    for (const options of [{}, { configuredOrigin: origin }, { approved: true }]) {
      const plane = createCatalogServerIdentityPlane({ ...options, transport });
      expect(plane.wired).toBe(false);
      expect(await resolveCatalogViewer(plane, "own-session.secret")).toMatchObject({ ok: false, reason: "IDENTITY_PLANE_NOT_WIRED" });
    }

    expect(transport).not.toHaveBeenCalled();
  });
  it("forwards only the explicitly carried credential to one immutable target", async () => {
    const { adapter, transport } = setup();
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toEqual({ ok: true, value: principal });
    expect(transport).toHaveBeenCalledTimes(1);
    const call = vi.mocked(transport).mock.calls[0];

    if (call === undefined) throw new Error("expected exactly one real transport call");
    const [url, init] = call;
    expect(url).toBe(origin + "/api/auth/own-session");
    expect(init).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
    expect(new Headers(init?.headers).get("x-sceneaxi-session")).toBe("own-session.secret");
    expect([...new Headers(init?.headers).keys()].sort()).toEqual(["accept", "origin", "x-sceneaxi-session"]);
    expect(new Headers(init?.headers).get("origin")).toBe(origin);
    expect(init?.signal?.aborted).toBe(false);
  });
  it.each(["http://evil.test", "https://user:pass@identity.example.test", "https://identity.example.test/path", "https://identity.example.test?next=evil", "https://identity.example.test#x", "https://127.0.0.1", "https://localhost", "https://[::1]", "https://identity.example.test/", " HTTPS://identity.example.test", "https://identity.example.test:443", "https://2130706433"])("refuses unsafe/noncanonical configured origin %s before transport", async configuredOrigin => {
    const transport = vi.fn(async () => success());
    const adapter = createCatalogServerFetchAdapter({ approved: true, configuredOrigin, transport });
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(transport).not.toHaveBeenCalled();
    expect(createCatalogServerIdentityPlane({ approved: true, configuredOrigin, transport }).wired).toBe(false);
  });
  it("permits loopback HTTP only under explicit development policy", async () => {
    const transport = vi.fn(async () => success());
    const adapter = createCatalogServerFetchAdapter({ approved: true, configuredOrigin: "http://127.0.0.1:49187", allowLoopbackDevelopment: true, transport, now: () => now });
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ ok: true });
    expect(transport).toHaveBeenCalledWith("http://127.0.0.1:49187/api/auth/own-session", expect.any(Object));
  });
  it("never consults transport for Kids or omitted/invalid carry", async () => {
    const { adapter, transport } = setup();
    expect(await adapter.resolvePrincipal({ surface: "kids", sessionToken: "own-session.secret" })).toMatchObject({ reason: "KIDS_SURFACE_DENIED" });

    for (const sessionToken of [undefined, null]) {
      const carry: import("../src/ports.js").SiteIdentityRequest = sessionToken === undefined
        ? { surface: "site" }
        : { surface: "site", sessionToken };

      expect(await adapter.resolvePrincipal(carry)).toMatchObject({ reason: "IDENTITY_SESSION_ABSENT" });
    }

    for (const sessionToken of ["", "a\r\nb", "a b", "no-separator", ".secret", "session.", "x".repeat(4097)]) expect(await adapter.resolvePrincipal({ surface: "site", sessionToken })).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("refuses deep, accessor, role and untrusted Host requests without evaluating getters", async () => {
    const { adapter, transport } = setup();
    const getter = vi.fn(() => "own-session.secret");

    const accessor = { surface: "site" as const, get sessionToken() { return getter(); } };
    expect(await adapter.resolvePrincipal(accessor)).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(getter).not.toHaveBeenCalled();

    for (const credentials of [{ role: "admin" }, '{"user":{"admin":true}}', { nested: { isAdmin: true } }]) expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret", credentials })).toMatchObject({ reason: "ROLE_CLAIM_FROM_CLIENT_DENIED" });

    type NestedCredentials = { nested?: NestedCredentials };

    let deep: NestedCredentials = {};

    for (let i = 0; i < 40; i++) deep = { nested: deep };
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret", credentials: deep })).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret", credentials: { Host: "evil.test" } })).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    { version: 2, ok: true, value: principal }, { version: 1, ok: true, value: null },
    { version: 1, ok: true, value: { ...principal, privateToken: "secret" } },
    { version: 1, ok: true, value: { ...principal, session: { ...principal.session, userId: "other-user" } } },
    { version: 1, ok: false, reason: "ARBITRARY_REASON" },
    { version: 1, ok: false, reason: "IDENTITY_SESSION_ABSENT", message: "private detail" },
  ])("rejects malformed/private/versioned output %#", async wire => {
    const { adapter } = setup(vi.fn(async () => response(wire)));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ ok: false, reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
  });
  it("refuses a replayed response belonging to another carried session", async () => {
    const { adapter } = setup();
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "another-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
  });
  it.each([
    { ...principal, user: { ...principal.user, email: "bad\u0000@example.test" } },
    { ...principal, user: { ...principal.user, email: "x".repeat(321) } },
    { ...principal, user: { ...principal.user, userId: "x".repeat(257) }, session: { ...principal.session, userId: "x".repeat(257) } },
  ])("rejects fields outside the endpoint public projection bounds %#", async value => {
    const { adapter } = setup(vi.fn(async () => response({ version: 1, ok: true, value })));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
  });
  it("validates replay at each read against the current clock", async () => {
    let clock = now;
    const adapter = createCatalogServerFetchAdapter({ approved: true, configuredOrigin: origin, transport: vi.fn(async () => success()), now: () => clock });
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ ok: true });
    clock = "2026-10-02T14:00:00.000Z";
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_SESSION_EXPIRED" });
  });
  it("accepts server-derived admin but refuses a client role claim without dispatch", async () => {
    const transport = vi.fn(async () => response({ version: 1, ok: true, value: { ...principal, role: "admin" } }));
    const { adapter } = setup(transport);
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ ok: true, value: { role: "admin" } });
    const forged = { surface: "site" as const, sessionToken: "own-session.secret", role: "admin" };
    expect(await adapter.resolvePrincipal(forged)).toMatchObject({ reason: "ROLE_CLAIM_FROM_CLIENT_DENIED" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("refuses wrong-status and unrelated-domain refusals", async () => {
    for (const wire of [{ version: 1, ok: false, reason: "IDENTITY_SESSION_ABSENT" }, { version: 1, ok: false, reason: "BILLING_PLANE_UNAVAILABLE" }]) {
      const { adapter } = setup(vi.fn(async () => response(wire, 503)));
      expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
    }
  });
  it("preserves a named refusal but not a mismatched success status", async () => {
    const { adapter } = setup(vi.fn(async () => response({ version: 1, ok: false, reason: "IDENTITY_SESSION_EXPIRED" }, 401)));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_SESSION_EXPIRED" });
    const mismatch = setup(vi.fn(async () => response({ version: 1, ok: true, value: principal }, 401)));
    expect(await mismatch.adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
  });
  it("rejects redirects, wrong media/cache policy and malformed JSON", async () => {
    for (const make of [() => new Response(null, { status: 302, headers: { location: "https://evil.test" } }), () => new Response("{}", { headers: { "content-type": "text/html", "cache-control": "no-store" } }), () => new Response("{}", { headers: { "content-type": "application/json" } }), () => new Response("{", { headers: { "content-type": "application/json", "cache-control": "no-store" } })]) {
      const { adapter } = setup(vi.fn(async () => make()));
      expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
    }
  });
  it("enforces streaming response budget without trusting Content-Length and cancels the stream", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(CATALOG_SESSION_MAX_RESPONSE_BYTES + 1)); }, cancel });
    const { adapter } = setup(vi.fn(async () => new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store", "content-length": "1" } })));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("accepts exact maximum bytes but refuses one more byte", async () => {
    const json = JSON.stringify({ version: 1, ok: true, value: principal });

    for (const [size, expected] of [[CATALOG_SESSION_MAX_RESPONSE_BYTES, true], [CATALOG_SESSION_MAX_RESPONSE_BYTES + 1, false]] as const) {
      const wire = json + " ".repeat(size - new TextEncoder().encode(json).length);
      const { adapter } = setup(vi.fn(async () => new Response(wire, { headers: { "content-type": "application/json", "cache-control": "no-store" } })));
      expect((await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).ok).toBe(expected);
    }
  });
  it("bounds fetch-header and body stalls; aborts and cleans the late stream", async () => {
    let signal: AbortSignal | null | undefined;
    let complete: ((value: Response) => void) | undefined;
    const cancel = vi.fn();

    const transport: typeof fetch = vi.fn((_url, init) => {
      signal = init?.signal;

      return new Promise<Response>(resolve => { complete = resolve; });
    });

    const adapter = createCatalogServerFetchAdapter({ approved: true, configuredOrigin: origin, transport, timeoutMs: 10 });
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_PLANE_UNAVAILABLE" });
    expect(signal?.aborted).toBe(true);
    complete?.(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/json", "cache-control": "no-store" } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(cancel).toHaveBeenCalledTimes(1);
    const bodyCancel = vi.fn();
    const stalled = new ReadableStream<Uint8Array>({ pull() {}, cancel: bodyCancel });
    const bodyAdapter = createCatalogServerFetchAdapter({ approved: true, configuredOrigin: origin, timeoutMs: 10, transport: vi.fn(async () => new Response(stalled, { headers: { "content-type": "application/json", "cache-control": "no-store" } })) });
    expect(await bodyAdapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_PLANE_UNAVAILABLE" });
    expect(bodyCancel).toHaveBeenCalledTimes(1);
  });
  it("bounds declared lengths and rejects invalid UTF-8", async () => {
    for (const length of ["-1", "abc", String(CATALOG_SESSION_MAX_RESPONSE_BYTES + 1)]) {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({ cancel });
      const { adapter } = setup(vi.fn(async () => new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store", "content-length": length } })));
      expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
      expect(cancel).toHaveBeenCalledTimes(1);
    }

    const { adapter } = setup(vi.fn(async () => new Response(new Uint8Array([0xff]), { headers: { "content-type": "application/json", "cache-control": "no-store" } })));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
  });
  it("rejects response URL/redirect substitution even from an injected transport", async () => {
    for (const property of ["url", "redirected"]) {
      const substituted = success();
      Object.defineProperty(substituted, property, { value: property === "url" ? "https://evil.test/api/auth/own-session" : true });
      const { adapter } = setup(vi.fn(async () => substituted));
      expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
    }
  });
  it("classifies an aborted body read as unavailable, never signed out", async () => {
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new DOMException("private fixture failure", "AbortError")); } });
    const { adapter } = setup(vi.fn(async () => new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store" } })));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_PLANE_UNAVAILABLE" });
  });
  it("refuses zero-progress streams without starving its deadline", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array()); }, cancel });
    const { adapter } = setup(vi.fn(async () => new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store" } })));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("snapshots configuration and descriptor data rather than rereading mutable options or Proxy getters", async () => {
    const transport = vi.fn(async () => success());
    const options = { approved: true, configuredOrigin: origin, transport, now: () => now };
    const adapter = createCatalogServerFetchAdapter(options);
    options.configuredOrigin = "https://evil.test";
    options.approved = false;
    const getter = vi.fn(() => "hostile-credential");
    const request = new Proxy({ surface: "site" as const, sessionToken: "own-session.secret" }, { get(_target, key) { return key === "sessionToken" ? getter() : "kids"; } });
    expect(await adapter.resolvePrincipal(request)).toMatchObject({ ok: true });
    expect(getter).not.toHaveBeenCalled();
    const call = transport.mock.calls[0];
    expect(call).toBeDefined();
    expect(transport).toHaveBeenCalledWith(origin + "/api/auth/own-session", expect.objectContaining({ headers: expect.objectContaining({ "x-sceneaxi-session": "own-session.secret" }) }));
  });
  it("turns thrown transport and aborted reads into named unavailability", async () => {
    const { adapter } = setup(vi.fn(async () => { throw new DOMException("sensitive fixture detail", "AbortError"); }));
    expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_PLANE_UNAVAILABLE" });
  });
  it("clears deadline timers on success and invalid output", async () => {
    vi.useFakeTimers();

    try {
      for (const makeResponse of [success, () => response({ version: 2, ok: true, value: principal })]) {
        const { adapter } = setup(vi.fn(async () => makeResponse()));
        await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" });
        expect(vi.getTimerCount()).toBe(0);
      }
    } finally { vi.useRealTimers(); }
  });
  it("cannot execute networking in a browser runtime", async () => {
    const { adapter, transport } = setup();
    vi.stubGlobal("window", {});

    try { expect(await adapter.resolvePrincipal({ surface: "site", sessionToken: "own-session.secret" })).toMatchObject({ reason: "IDENTITY_PLANE_NOT_WIRED" }); }
    finally { vi.unstubAllGlobals(); }

    expect(transport).not.toHaveBeenCalled();
  });
});
