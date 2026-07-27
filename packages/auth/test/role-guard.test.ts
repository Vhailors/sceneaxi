import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  digestSessionToken,
  requireAuthenticated,
  requireRole,
  resolveAdminIdentity,
  sessionTokenMatches,
} from "@sceneaxi/auth";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: guards check the identity's runtime provenance,
// so a structurally identical `{ email, source }` literal is refused.
const admin = adminResolution.value;

const principal = (overrides: {
  role?: string;
  source?: string;
  surface?: string;
  disabled?: boolean;
  emailVerified?: boolean;
  expiresAt?: string;
} = {}) =>
  ({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId: "usr_01",
      email:
        overrides.role === "user"
          ? "crew@example.com"
          : "captain@example.com",
      emailVerified: overrides.emailVerified ?? true,
      disabled: overrides.disabled ?? false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId: "usr_01",
      role: overrides.role ?? "admin",
      source: overrides.source ?? "admin-env",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_01",
      userId: "usr_01",
      surface: overrides.surface ?? "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: overrides.expiresAt ?? "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("token-01"),
    },
  }) as unknown;

describe("requireRole", () => {
  it("allows an admin principal sourced from the environment", () => {
    const result = requireRole(principal(), "admin", { now: NOW, admin });
    expect(result.ok).toBe(true);
  });

  it("refuses a user principal at an admin guard", () => {
    const result = requireRole(
      principal({ role: "user", source: "default-user" }),
      "admin",
      { now: NOW, admin },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.roleNotPermitted);
  });

  it("refuses an admin role whose source is not the environment", () => {
    const result = requireRole(
      principal({ role: "admin", source: "default-user" }),
      "admin",
      { now: NOW, admin },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The contract itself rejects that combination, so it never reaches the
    // role comparison.
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
  });

  it("has no role hierarchy — admin does not satisfy a user guard", () => {
    const result = requireRole(principal(), "user", { now: NOW, admin });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.roleNotPermitted);
  });

  it("refuses an unknown required role rather than guessing", () => {
    const result = requireRole(principal(), "superadmin" as never, { now: NOW, admin });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.roleUnknown);
  });

  it("refuses a missing or malformed principal", () => {
    for (const value of [undefined, null, {}, "admin", { user: {} }]) {
      const result = requireRole(value, "admin", { now: NOW, admin });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
    }
  });

  it("refuses a disabled user even at the admin role", () => {
    const result = requireRole(principal({ disabled: true }), "admin", {
      now: NOW,
      admin,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userDisabled);
  });

  it("refuses an admin principal whose email is unverified", () => {
    const result = requireRole(
      principal({ emailVerified: false }),
      "admin",
      { now: NOW, admin },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminEmailUnverified);
  });

  it("still allows an ordinary principal whose email is unverified", () => {
    const result = requireRole(
      principal({ role: "user", source: "default-user", emailVerified: false }),
      "user",
      { now: NOW, admin },
    );
    expect(result.ok).toBe(true);
  });

  it("refuses an expired session", () => {
    const result = requireRole(
      principal({ expiresAt: "2026-07-25T09:59:59Z" }),
      "admin",
      { now: NOW, admin },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
  });

  it("refuses a session whose surface does not match the guard", () => {
    const result = requireRole(principal({ surface: "site" }), "admin", {
      now: NOW,
      surface: "web-shell",
          admin,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionSurfaceMismatch);
  });

  it("refuses a Kids session non-overridably, even for admin", () => {
    for (const options of [
      { now: NOW, admin },
      { now: NOW, surface: "kids" as const, admin },
    ]) {
      const result = requireRole(principal({ surface: "kids" }), "admin", options);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);
    }
  });

  it("refuses without a finite clock — expiry cannot be checked", () => {
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = requireRole(principal(), "admin", { now, admin });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.clockInvalid);
    }
  });
});

describe("requireAuthenticated", () => {
  it("allows any valid principal regardless of role", () => {
    expect(requireAuthenticated(principal(), { now: NOW, admin }).ok).toBe(true);
    expect(
      requireAuthenticated(principal({ role: "user", source: "default-user" }), {
        now: NOW,
        admin,
      }).ok,
    ).toBe(true);
  });

  it("still refuses disabled, expired, and Kids principals", () => {
    expect(
      requireAuthenticated(principal({ disabled: true }), { now: NOW, admin }).ok,
    ).toBe(false);
    expect(
      requireAuthenticated(principal({ expiresAt: "2026-07-25T09:00:01Z" }), {
        now: NOW,
        admin,
      }).ok,
    ).toBe(false);
    expect(
      requireAuthenticated(principal({ surface: "kids" }), { now: NOW, admin }).ok,
    ).toBe(false);
  });
});

describe("session token digests", () => {
  it("produces a 64-character lowercase hex digest", () => {
    expect(digestSessionToken("token-01")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the right token and rejects a wrong one", () => {
    const digest = digestSessionToken("token-01");
    expect(sessionTokenMatches("token-01", digest)).toBe(true);
    expect(sessionTokenMatches("token-02", digest)).toBe(false);
  });

  it("rejects a malformed stored digest without throwing", () => {
    for (const stored of ["", "nope", "A".repeat(64), "a".repeat(63), 42, null]) {
      expect(sessionTokenMatches("token-01", stored)).toBe(false);
    }
  });

  it("rejects an empty or non-string presented token", () => {
    const digest = digestSessionToken("token-01");
    for (const token of ["", 42, null, undefined, {}]) {
      expect(sessionTokenMatches(token, digest)).toBe(false);
    }
  });
});
