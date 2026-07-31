/**
 * The login plane: fail-closed sign-in over an injected adapter.
 *
 * Same discipline as the identity plane it sits beside: Kids and role claims
 * refuse before any adapter dispatch, an unwired plane refuses by name, and the
 * adapter's grant is re-validated as a principal before a site may trust it —
 * so an adapter cannot hand back a session the identity plane would refuse.
 */
import { describe, expect, it } from "vitest";
import {
  createLoginPlane,
  ok,
  refuse,
  type SiteLoginAdapter,
  type SiteLoginGrant,
} from "@sceneaxi/site-kit";

const NOW = "2026-07-25T12:00:00.000Z";
const now = () => NOW;

const grant = (overrides: Record<string, unknown> = {}): SiteLoginGrant =>
  ({
    principal: {
      user: {
        userId: "user-1",
        email: "crew@example.com",
        emailVerified: true,
        disabled: false,
        ...(overrides["user"] as Record<string, unknown> | undefined),
      },
      role: "user",
      session: {
        sessionId: "session-1",
        userId: "user-1",
        surface: "site",
        issuedAt: "2026-07-25T11:00:00.000Z",
        expiresAt: "2026-07-25T13:00:00.000Z",
        ...(overrides["session"] as Record<string, unknown> | undefined),
      },
    },
    sessionCredential: "session-1.tok-crew",
    ...(overrides["grant"] as Record<string, unknown> | undefined),
  }) as SiteLoginGrant;

const adapterReturning = (value: unknown): SiteLoginAdapter => ({
  async signIn() {
    return ok(value as SiteLoginGrant);
  },
});

const REQUEST = { surface: "site", email: "crew@example.com", password: "pw" } as const;

describe("createLoginPlane", () => {
  it("returns the validated grant for a well-formed adapter answer", async () => {
    const result = await createLoginPlane({ now, adapter: adapterReturning(grant()) }).signIn(
      REQUEST,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.principal.user.userId).toBe("user-1");
    expect(result.value.principal.role).toBe("user");
    expect(result.value.sessionCredential).toBe("session-1.tok-crew");
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("refuses Kids before the adapter is consulted", async () => {
    let dispatched = false;
    const adapter: SiteLoginAdapter = {
      async signIn() {
        dispatched = true;
        return ok(grant());
      },
    };
    const result = await createLoginPlane({ now, adapter }).signIn({
      surface: "kids",
      email: "kid@example.com",
      password: "pw",
    });
    expect(result).toMatchObject({ ok: false, reason: "KIDS_SURFACE_DENIED" });
    expect(dispatched).toBe(false);
  });

  it("refuses a client role claim beside the credentials, before dispatch", async () => {
    let dispatched = false;
    const adapter: SiteLoginAdapter = {
      async signIn() {
        dispatched = true;
        return ok(grant());
      },
    };
    for (const key of ["role", "roles", "admin", "isAdmin"]) {
      const result = await createLoginPlane({ now, adapter }).signIn({
        ...REQUEST,
        [key]: "admin",
      } as never);
      expect(result).toMatchObject({ ok: false, reason: "ROLE_CLAIM_FROM_CLIENT_DENIED" });
    }
    expect(dispatched).toBe(false);
  });

  it("refuses unexpected properties and unknown surfaces", async () => {
    const plane = createLoginPlane({ now, adapter: adapterReturning(grant()) });
    expect(await plane.signIn({ ...REQUEST, extra: 1 } as never)).toMatchObject({
      ok: false,
      reason: "SITE_REQUEST_MALFORMED",
    });
    expect(
      await plane.signIn({ ...REQUEST, surface: "mobile" } as never),
    ).toMatchObject({ ok: false, reason: "SITE_SURFACE_UNKNOWN" });
    expect(await plane.signIn(null as never)).toMatchObject({
      ok: false,
      reason: "SITE_REQUEST_MALFORMED",
    });
  });

  it("refuses empty credentials without touching the adapter", async () => {
    let dispatched = false;
    const adapter: SiteLoginAdapter = {
      async signIn() {
        dispatched = true;
        return ok(grant());
      },
    };
    const plane = createLoginPlane({ now, adapter });
    for (const [email, password] of [
      ["", "pw"],
      ["   ", "pw"],
      ["crew@example.com", ""],
    ] as const) {
      expect(await plane.signIn({ surface: "site", email, password })).toMatchObject({
        ok: false,
        reason: "LOGIN_CREDENTIALS_REQUIRED",
      });
    }
    expect(dispatched).toBe(false);
  });

  it("refuses by name while unwired, and when the adapter throws", async () => {
    expect(await createLoginPlane({ now }).signIn(REQUEST)).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
    const throwing: SiteLoginAdapter = {
      async signIn() {
        throw new Error("provider down");
      },
    };
    expect(await createLoginPlane({ now, adapter: throwing }).signIn(REQUEST)).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_UNAVAILABLE",
    });
  });

  it("passes a canonical adapter refusal through and rejects a non-canonical one", async () => {
    const rejecting: SiteLoginAdapter = {
      async signIn() {
        return refuse("LOGIN_CREDENTIALS_REJECTED");
      },
    };
    expect(await createLoginPlane({ now, adapter: rejecting }).signIn(REQUEST)).toMatchObject({
      ok: false,
      reason: "LOGIN_CREDENTIALS_REJECTED",
    });

    const offRegistry: SiteLoginAdapter = {
      async signIn() {
        return { ok: false, reason: "SOMETHING_ELSE", message: "?" } as never;
      },
    };
    expect(
      await createLoginPlane({ now, adapter: offRegistry }).signIn(REQUEST),
    ).toMatchObject({ ok: false, reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
  });

  it("re-validates the granted principal like the identity plane would", async () => {
    const cases: ReadonlyArray<[Record<string, unknown>, string]> = [
      [{ user: { disabled: true } }, "IDENTITY_USER_DISABLED"],
      [{ session: { expiresAt: "2026-07-25T11:30:00.000Z" } }, "IDENTITY_SESSION_EXPIRED"],
      [{ session: { surface: "web-shell" } }, "IDENTITY_SESSION_SURFACE_MISMATCH"],
      [{ grant: { principal: null } }, "IDENTITY_ADAPTER_OUTPUT_INVALID"],
    ];
    for (const [overrides, reason] of cases) {
      const result = await createLoginPlane({
        now,
        adapter: adapterReturning(grant(overrides)),
      }).signIn(REQUEST);
      expect(result).toMatchObject({ ok: false, reason });
    }
  });

  it("refuses a credential a cookie cannot faithfully carry", async () => {
    for (const sessionCredential of ["", "has space", "semi;colon", "line\nbreak", 42]) {
      const result = await createLoginPlane({
        now,
        adapter: adapterReturning(grant({ grant: { sessionCredential } })),
      }).signIn(REQUEST);
      expect(result).toMatchObject({ ok: false, reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" });
    }
  });
});
