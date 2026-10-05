import { afterEach, describe, expect, it, vi } from "vitest";
import { ok, type SitePrincipal } from "@sceneaxi/site-kit";

const state = vi.hoisted(() => ({ handles: vi.fn(), principal: vi.fn() }));
vi.mock("../src/lib/identity-plane.js", () => ({
  IDENTITY_PLANE_DOC: "fixture", IDENTITY_PLANE_PENDING_NOTE: "fixture", BILLING_PLANE_PENDING_NOTE: "fixture",
  classifyUmbrellaPlane: vi.fn(),
  umbrellaPlaneHandles: state.handles,
  createUmbrellaIdentityPlane: () => ({ identity: { resolvePrincipal: state.principal } }),
}));
import * as route from "../src/app/api/auth/own-session/route.js";
import { umbrellaRequestAuthority } from "../src/lib/request-authority.js";
import { createOwnSessionHandler } from "../src/provider/own-session.js";
const origin = "https://umbrella.example.invalid";
const principal: SitePrincipal = { user: { userId: "user", email: "user@example.invalid", emailVerified: true, disabled: false }, role: "user", session: { sessionId: "session", userId: "user", surface: "site", issuedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" } };
const request = () => new Request(origin + "/api/auth/own-session", { headers: { origin, "x-sceneaxi-session": "session.secret", "x-forwarded-host": "unknown.example.invalid" } });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("actual own-session raw deployment origin before authority/key reads", () => {
  it.each([origin + "/path", origin + "?query=x", origin + "#fragment", "https://user:pass@umbrella.example.invalid", " " + origin + " ", "", "https://127.0.0.1", "https://umbrella.local"])('refuses raw %s before handles/principal', async raw => {
    vi.stubEnv("NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN", raw);
    state.handles.mockReturnValue({ verifyFormOrigin: () => ok(origin) });
    state.principal.mockResolvedValue(ok(principal));
    expect(umbrellaRequestAuthority().verifyFormOrigin({ origin })).toMatchObject({ reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(state.handles).not.toHaveBeenCalled();
    const response = await route.GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ version: 1, ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.handles).not.toHaveBeenCalled();
    expect(state.principal).not.toHaveBeenCalled();
  });
  it("missing private deployment configuration refuses instead of trusting request Host", async () => {
    vi.stubEnv("NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN", undefined);
    const response = await route.GET(request());
    expect(response.status).toBe(403);
    expect(state.handles).not.toHaveBeenCalled();
    expect(state.principal).not.toHaveBeenCalled();
  });
  it("injecting a normalizing verifier cannot bypass missing raw origin configuration", async () => {
    const verifyFormOrigin = vi.fn(() => ok(origin));
    const plane = vi.fn(() => ({ identity: { resolvePrincipal: state.principal } }));
    const response = await createOwnSessionHandler({ verifyFormOrigin, plane })(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ version: 1, ok: false, reason: "SITE_REQUEST_CROSS_ORIGIN" });
    expect(verifyFormOrigin).not.toHaveBeenCalled();
    expect(plane).not.toHaveBeenCalled();
  });
  it("canonical configured origin preserves the authoritative public session", async () => {
    vi.stubEnv("NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN", origin);
    state.handles.mockReturnValue({ verifyFormOrigin: () => ok(origin) });
    state.principal.mockResolvedValue(ok(principal));
    const response = await route.GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1, ok: true, value: principal });
    expect(state.principal).toHaveBeenCalledTimes(1);
  });
});
