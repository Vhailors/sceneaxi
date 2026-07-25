import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  MULTI_ADMIN_ENV_VARS,
  normalizeEmail,
  planAdminBootstrap,
  resolveAdminIdentity,
  resolveRole,
  type EnvLike,
} from "@sceneaxi/auth";

const CAPTAIN = "captain@example.com";
const NOW = Date.parse("2026-07-25T10:00:00Z");

const user = (email: string, overrides: Record<string, unknown> = {}) =>
  ({
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId: `usr_${email.replace(/[^a-z0-9]/gi, "")}`,
    email,
    emailVerified: true,
    disabled: false,
    createdAt: "2026-07-25T09:00:00Z",
    ...overrides,
  }) as never;

describe("resolveAdminIdentity", () => {
  it("resolves and normalizes exactly one admin email", () => {
    const result = resolveAdminIdentity({
      [ADMIN_EMAIL_ENV_VAR]: "  CAPTAIN@Example.COM  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe(CAPTAIN);
    expect(result.value.source).toBe(ADMIN_EMAIL_ENV_VAR);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("refuses when the variable is absent", () => {
    const result = resolveAdminIdentity({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminEmailMissing);
  });

  it("refuses an empty or whitespace-only value", () => {
    for (const value of ["", "   ", "\t\n"]) {
      const result = resolveAdminIdentity({ [ADMIN_EMAIL_ENV_VAR]: value });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminEmailEmpty);
    }
  });

  it("refuses a syntactically invalid address", () => {
    for (const value of ["not-an-address", "@example.com", "cap@", "cap@host"]) {
      const result = resolveAdminIdentity({ [ADMIN_EMAIL_ENV_VAR]: value });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminEmailInvalid);
    }
  });

  it("refuses more than one address however it is separated", () => {
    for (const value of [
      "a@example.com,b@example.com",
      "a@example.com;b@example.com",
      "a@example.com b@example.com",
    ]) {
      const result = resolveAdminIdentity({ [ADMIN_EMAIL_ENV_VAR]: value });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminMultipleIdentities);
    }
  });

  it("refuses a plural variable outright, even holding one valid address", () => {
    for (const plural of MULTI_ADMIN_ENV_VARS) {
      const result = resolveAdminIdentity({
        [ADMIN_EMAIL_ENV_VAR]: CAPTAIN,
        [plural]: CAPTAIN,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(
        AUTH_REFUSE_REASONS.adminMultiAdminNotAuthorized,
      );
    }
  });

  it("ignores a plural variable that is present but undefined", () => {
    const env: EnvLike = {
      [ADMIN_EMAIL_ENV_VAR]: CAPTAIN,
      SCENEAXI_ADMIN_EMAILS: undefined,
    };
    expect(resolveAdminIdentity(env).ok).toBe(true);
  });
});

describe("resolveRole", () => {
  const admin = { email: CAPTAIN, source: ADMIN_EMAIL_ENV_VAR } as const;

  it("returns admin only for the resolved admin identity", () => {
    const role = resolveRole({ user: user(CAPTAIN), admin, now: NOW });
    expect(role.role).toBe("admin");
    expect(role.source).toBe("admin-env");
  });

  it("matches the admin after normalization", () => {
    const role = resolveRole({ user: user("CAPTAIN@Example.com"), admin, now: NOW });
    expect(role.role).toBe("admin");
  });

  it("returns user for every other address", () => {
    for (const email of [
      "crew@example.com",
      "captain@other.com",
      "captain+alias@example.com",
    ]) {
      const role = resolveRole({ user: user(email), admin, now: NOW });
      expect(role.role).toBe("user");
      expect(role.source).toBe("default-user");
    }
  });

  it("stamps a deterministic assignedAt from the injected clock", () => {
    const role = resolveRole({ user: user(CAPTAIN), admin, now: NOW });
    expect(role.assignedAt).toBe("2026-07-25T10:00:00.000Z");
  });
});

describe("planAdminBootstrap", () => {
  const env = { [ADMIN_EMAIL_ENV_VAR]: CAPTAIN };

  it("plans exactly one admin assignment", () => {
    const result = planAdminBootstrap({
      env,
      users: [user(CAPTAIN), user("crew@example.com")],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assignment.role).toBe("admin");
    expect(result.value.assignment.source).toBe("admin-env");
    expect(result.value.admin.email).toBe(CAPTAIN);
  });

  it("refuses when no user carries the admin email", () => {
    const result = planAdminBootstrap({
      env,
      users: [user("crew@example.com")],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userNotFound);
  });

  it("refuses an ambiguous store rather than guessing which captain is real", () => {
    const result = planAdminBootstrap({
      env,
      users: [
        user(CAPTAIN),
        { ...(user(CAPTAIN) as unknown as object), userId: "usr_dupe" } as never,
      ],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminMultipleIdentities);
  });

  it("refuses a disabled admin user", () => {
    const result = planAdminBootstrap({
      env,
      users: [user(CAPTAIN, { disabled: true })],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userDisabled);
  });

  it("refuses a non-finite clock", () => {
    const result = planAdminBootstrap({
      env,
      users: [user(CAPTAIN)],
      now: Number.NaN,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.clockInvalid);
  });

  it("propagates an unresolvable admin identity", () => {
    const result = planAdminBootstrap({
      env: {},
      users: [user(CAPTAIN)],
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adminEmailMissing);
  });
});

describe("normalizeEmail", () => {
  it("is the one normalization every comparison uses", () => {
    expect(normalizeEmail("  Cap@Example.COM ")).toBe("cap@example.com");
  });
});
