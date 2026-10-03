import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIdentityPlane, ok, SITE_SESSION_HEADER, verifySiteFormOrigin,
  type SitePrincipal, type SiteIdentityAdapter, type SiteFormOriginSignals,
} from "@sceneaxi/site-kit";
import { createOwnSessionHandler, createOwnSessionRouteRegistration, type OwnSessionAuthority } from "../src/provider/own-session.js";

import { verifyLoginRequestOrigin } from "../src/lib/login-flow.js";
import * as deployedRoute from "../src/app/api/auth/own-session/route.js";

type RouteState = { authority?: OwnSessionAuthority };

const routeState: RouteState = {};

const route = createOwnSessionRouteRegistration(() => {
  if (routeState.authority === undefined) throw new Error("private-facade-error");

  return routeState.authority;
});

const ORIGIN = "https://umbrella.example.invalid";

const principal: SitePrincipal = {
  user: { userId: "fixture-user", email: "fixture@example.invalid", emailVerified: true, disabled: false },
  role: "user",
  session: { sessionId: "fixture-session", userId: "fixture-user", surface: "site", issuedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" },
};

const CARRY = "fixture-session.fixture-secret";

function request(overrides: { origin?: string | null; method?: string; query?: string; headers?: Record<string, string>; carry?: string | null; urlOrigin?: string } = {}) {
  const headers = new Headers(overrides.headers);

  if (overrides.origin !== null) headers.set("origin", overrides.origin ?? ORIGIN);

  if (overrides.carry !== null) headers.set(SITE_SESSION_HEADER, overrides.carry ?? CARRY);

  return new Request(`${overrides.urlOrigin ?? ORIGIN}/api/auth/own-session${overrides.query ?? ""}`, { method: overrides.method ?? "GET", headers });
}

function fixture(input: { adapter?: SiteIdentityAdapter; configuredOrigin?: string | null } = {}) {
  const resolve = vi.fn(async () => ok(principal));
  const identity = createIdentityPlane({ adapter: input.adapter ?? { resolvePrincipal: resolve } });
  const plane = vi.fn(() => ({ identity }));
  const verifyFormOrigin = vi.fn((signals: Omit<SiteFormOriginSignals, "configuredOrigin">) => verifySiteFormOrigin({ ...signals, configuredOrigin: input.configuredOrigin === undefined ? ORIGIN : input.configuredOrigin }));
  const authority: OwnSessionAuthority = { plane, verifyFormOrigin };

  return { authority, plane, resolve, verifyFormOrigin, handler: createOwnSessionHandler(authority, { configuredOrigin: () => input.configuredOrigin === undefined ? ORIGIN : input.configuredOrigin }) };
}

async function refusal(response: Response, reason: string, status: number) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ version: 1, ok: false, reason });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("vary")).toBe(`Origin, ${SITE_SESSION_HEADER}`);
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
}

describe("authoritative own-session transport", () => {
  it("returns only bounded versioned public identity using explicit carry and site surface", async () => {
    const f = fixture(); const response = await f.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ok: true, value: principal });
    expect(f.plane).toHaveBeenCalledExactlyOnceWith({ sessionToken: CARRY });
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith({ surface: "site", sessionToken: CARRY });
    expect(f.verifyFormOrigin).toHaveBeenCalledExactlyOnceWith({ origin: ORIGIN });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it.each([null, "https://hostile.example.invalid", `${ORIGIN}/path`, `${ORIGIN}, https://hostile.example.invalid`])("refuses missing/hostile/noncanonical Origin %s before identity", async (origin) => {
    const f = fixture(); await refusal(await f.handler(request({ origin })), "SITE_REQUEST_CROSS_ORIGIN", 403); expect(f.plane).not.toHaveBeenCalled();
  });
  it("refuses unconfigured origin despite same-origin fetch hint and request URL", async () => {
    const f = fixture({ configuredOrigin: null }); await refusal(await f.handler(request({ headers: { "sec-fetch-site": "same-origin" } })), "SITE_REQUEST_CROSS_ORIGIN", 403); expect(f.plane).not.toHaveBeenCalled();
  });
  it("refuses URL aliases and forwarded host spoofing", async () => {
    const f = fixture(); await refusal(await f.handler(request({ urlOrigin: "https://alias.example.invalid", headers: { "x-forwarded-host": "umbrella.example.invalid" } })), "SITE_REQUEST_CROSS_ORIGIN", 403); expect(f.plane).not.toHaveBeenCalled();
  });
  it.each(["POST", "HEAD", "PUT", "OPTIONS", "DELETE"])("refuses %s with no-store and Allow GET before origin/identity", async (method) => {
    const f = fixture(); const response = await f.handler(request({ method })); await refusal(response, "SITE_REQUEST_MALFORMED", 405); expect(response.headers.get("allow")).toBe("GET"); expect(f.verifyFormOrigin).not.toHaveBeenCalled(); expect(f.plane).not.toHaveBeenCalled();
  });
  it.each(["?role=admin", "?roles=user", "?isAdmin=true", "?admin=true"])("denies client claim %s", async (query) => {
    const f = fixture(); await refusal(await f.handler(request({ query })), "ROLE_CLAIM_FROM_CLIENT_DENIED", 403); expect(f.plane).not.toHaveBeenCalled();
  });
  it.each(["?userId=someone-else", "?sessionToken=forged", "?target=https://hostile.example.invalid", "?surface=site"])("refuses unsolicited query %s", async (query) => {
    const f = fixture(); await refusal(await f.handler(request({ query })), "SITE_REQUEST_MALFORMED", 400); expect(f.plane).not.toHaveBeenCalled();
  });
  it.each([{ query: "?surface=kids" }, { headers: { "x-sceneaxi-surface": "kids" } }])("independently denies Kids before dispatch %j", async (options) => {
    const f = fixture(); await refusal(await f.handler(request(options)), "KIDS_SURFACE_DENIED", 403); expect(f.plane).not.toHaveBeenCalled();
  });
  it("denies client role headers", async () => {
    const f = fixture(); await refusal(await f.handler(request({ headers: { "x-sceneaxi-role": "admin" } })), "ROLE_CLAIM_FROM_CLIENT_DENIED", 403); expect(f.plane).not.toHaveBeenCalled();
  });
  it("never uses cookies or Authorization as implicit credentials", async () => {
    const f = fixture(); await refusal(await f.handler(request({ carry: null, headers: { cookie: `sceneaxi.session=${CARRY}`, authorization: `Bearer ${CARRY}` } })), "IDENTITY_SESSION_ABSENT", 401); expect(f.plane).not.toHaveBeenCalled();
  });
  it.each(["invalid", ".secret", "session.", "session.secret,other.token", "x".repeat(4097)])("refuses malformed/oversize carry without verification", async (carry) => {
    const f = fixture(); await refusal(await f.handler(request({ carry })), "SITE_REQUEST_MALFORMED", 400); expect(f.plane).not.toHaveBeenCalled();
  });
  it("preserves named expired refusal but never provider message or secrets", async () => {
    const f = fixture({ adapter: { resolvePrincipal: async () => ({ ok: false, reason: "IDENTITY_SESSION_EXPIRED", message: CARRY }) } }); await refusal(await f.handler(request()), "IDENTITY_SESSION_EXPIRED", 401);
  });
  it("keeps signed-out and unwired distinct", async () => {
    const absent = fixture({ adapter: { resolvePrincipal: async () => ok(null) } }); await refusal(await absent.handler(request()), "IDENTITY_SESSION_ABSENT", 401);
    const identity = createIdentityPlane(); const f = fixture(); await refusal(await createOwnSessionHandler({ ...f.authority, plane: () => ({ identity }) }, { configuredOrigin: () => ORIGIN })(request()), "IDENTITY_PLANE_NOT_WIRED", 503);
  });
  it("catches real verifier exceptions into named unavailable with no private text", async () => {
    const f = fixture({ adapter: { resolvePrincipal: async () => { throw new Error(CARRY); } } }); await refusal(await f.handler(request()), "IDENTITY_PLANE_UNAVAILABLE", 503);
  });
  it("refuses cross-user output through the existing validator", async () => {
    const f = fixture({ adapter: { resolvePrincipal: async () => ok({ ...principal, session: { ...principal.session, userId: "different-user" } }) } }); await refusal(await f.handler(request()), "IDENTITY_ADAPTER_OUTPUT_INVALID", 503);
  });
  it("binds returned session id to explicit carry", async () => {
    const f = fixture({ adapter: { resolvePrincipal: async () => ok({ ...principal, session: { ...principal.session, sessionId: "different-session" } }) } }); await refusal(await f.handler(request()), "IDENTITY_ADAPTER_OUTPUT_INVALID", 503);
  });
  it("projects away private provider fields instead of exposing the identity object", async () => {
    const f = fixture(); const privatePrincipal = { ...principal, provider: { secret: CARRY }, session: { ...principal.session, token: CARRY }, user: { ...principal.user, password: CARRY } };
    const response = await createOwnSessionHandler({ ...f.authority, plane: () => ({ identity: { resolvePrincipal: async () => ok(privatePrincipal) } }) }, { configuredOrigin: () => ORIGIN })(request());
    expect(await response.json()).toEqual({ version: 1, ok: true, value: principal });
  });
  it("preserves only server-derived admin role", async () => {
    const f = fixture({ adapter: { resolvePrincipal: async () => ok({ ...principal, role: "admin" }) } }); expect(await (await f.handler(request())).json()).toEqual({ version: 1, ok: true, value: { ...principal, role: "admin" } });
  });
  it("refuses oversized public fields instead of returning an unbounded principal", async () => {
    const f = fixture({ adapter: { resolvePrincipal: async () => ok({ ...principal, user: { ...principal.user, email: "x".repeat(16385) } }) } }); await refusal(await f.handler(request()), "IDENTITY_ADAPTER_OUTPUT_INVALID", 503);
  });
  it.each([
    "https://localhost", "https://127.0.0.1", "https://[::1]",
    "https://10.0.0.1", "https://192.168.1.1", "https://169.254.169.254",
    "https://[2001:db8::1]", "https://umbrella", "https://umbrella.localhost",
    "https://umbrella.local", "https://umbrella.internal", "https://umbrella.example.invalid.",
    "https://2130706433", "https://0x7f000001",
  ])("denies unsafe HTTPS origin %s even with development permission", async (origin) => {
    const f = fixture({ configuredOrigin: origin });

    for (const allowLoopbackDevelopment of [false, true]) {
      await refusal(await createOwnSessionHandler(f.authority, { allowLoopbackDevelopment, configuredOrigin: () => origin })(request({ origin, urlOrigin: origin })), "SITE_REQUEST_CROSS_ORIGIN", 403);
    }

    expect(f.verifyFormOrigin).not.toHaveBeenCalled();
    expect(f.plane).not.toHaveBeenCalled();
  });
  it("accepts a canonical configured HTTPS DNS origin with a nondefault port", async () => {
    const origin = "https://umbrella.example.invalid:8443";
    const f = fixture({ configuredOrigin: origin });
    expect((await f.handler(request({ origin, urlOrigin: origin }))).status).toBe(200);
  });
  it.each(["http://localhost:49187", "http://127.0.0.1:49187", "http://[::1]:49187"])("allows only explicit canonical HTTP development loopback %s", async (origin) => {
    const f = fixture({ configuredOrigin: origin });
    await refusal(await f.handler(request({ origin, urlOrigin: origin })), "SITE_REQUEST_CROSS_ORIGIN", 403);
    expect((await createOwnSessionHandler(f.authority, { allowLoopbackDevelopment: true, configuredOrigin: () => origin })(request({ origin, urlOrigin: origin }))).status).toBe(200);
  });
  it("requires explicit development-only HTTP loopback permission", async () => {
    const origin = "http://127.0.0.1:49187"; const f = fixture({ configuredOrigin: origin }); const req = () => request({ origin, urlOrigin: origin });
    await refusal(await f.handler(req()), "SITE_REQUEST_CROSS_ORIGIN", 403);
    expect((await createOwnSessionHandler(f.authority, { allowLoopbackDevelopment: true, configuredOrigin: () => origin })(req())).status).toBe(200);
    const remote = "http://remote.example.invalid"; const unsafe = fixture({ configuredOrigin: remote }); await refusal(await createOwnSessionHandler(unsafe.authority, { allowLoopbackDevelopment: true, configuredOrigin: () => remote })(request({ origin: remote, urlOrigin: remote })), "SITE_REQUEST_CROSS_ORIGIN", 403);
  });
});


describe("real own-session route registration", () => {
  // The actual route now requires raw deployment configuration before its facade.
  // These authority fixtures therefore carry the same explicit deployment fact.
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN", ORIGIN));
  afterEach(() => vi.unstubAllEnvs());
  it("dispatches the real GET route through the existing configured facade with no URL fallback", async () => {
    const f = fixture();

    const verifyFormOrigin = vi.fn((signals: Omit<SiteFormOriginSignals, "configuredOrigin">) =>
      verifyLoginRequestOrigin({ NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: ORIGIN }, signals));

    routeState.authority = { ...f.authority, verifyFormOrigin };
    expect(route.runtime).toBe(deployedRoute.runtime); expect(route.dynamic).toBe(deployedRoute.dynamic);
    const response = await route.GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ok: true, value: principal });
    expect(verifyFormOrigin).toHaveBeenCalledExactlyOnceWith({ origin: ORIGIN });
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith({ surface: "site", sessionToken: CARRY });
  });
  it("requires actual deployment origin even though the request URL and Origin agree", async () => {
    const f = fixture();
    routeState.authority = { ...f.authority, verifyFormOrigin: signals => verifyLoginRequestOrigin({}, signals) };
    await refusal(await route.GET(request({ headers: { "sec-fetch-site": "same-origin" } })), "SITE_REQUEST_CROSS_ORIGIN", 403);
    expect(f.plane).not.toHaveBeenCalled();
  });
  it("keeps thrown facade errors named and private on the real route", async () => {
    delete routeState.authority;
    await refusal(await route.GET(request()), "IDENTITY_PLANE_UNAVAILABLE", 503);
  });
  it("exports explicit POST/HEAD/OPTIONS/PATCH/PUT/DELETE refusals instead of provider fallback", async () => {
    const f = fixture(); routeState.authority = f.authority;

    for (const [method, handler] of [["POST", route.POST], ["HEAD", route.HEAD], ["OPTIONS", route.OPTIONS], ["PATCH", route.PATCH], ["PUT", route.PUT], ["DELETE", route.DELETE]] satisfies readonly (readonly [string, typeof route.GET])[]) {
      await refusal(await handler(request({ method })), "SITE_REQUEST_MALFORMED", 405);
    }

    expect(f.plane).not.toHaveBeenCalled();
  });
});
