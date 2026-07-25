import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_REFUSE_CODES,
  IDENTITY_ROLES,
  IDENTITY_SCHEMA_VERSION,
  IDENTITY_SURFACES,
  KIDS_IDENTITY_SURFACE,
  ROLE_ASSIGNMENT_KIND,
  SESSION_KIND,
  USER_KIND,
  claimedRoleKey,
  validatePrincipal,
  validateRoleAssignment,
  validateSession,
  validateUser,
} from "@sceneaxi/schemas";

const USER = {
  schemaVersion: 1,
  kind: USER_KIND,
  userId: "usr_01",
  email: "captain@example.com",
  emailVerified: true,
  disabled: false,
  createdAt: "2026-07-25T10:00:00Z",
} as const;

const ROLE = {
  schemaVersion: 1,
  kind: ROLE_ASSIGNMENT_KIND,
  userId: "usr_01",
  role: "admin",
  source: "admin-env",
  assignedAt: "2026-07-25T10:00:00Z",
} as const;

/** A record with one required key removed, for missing-property refusals. */
const without = (record: object, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

const SESSION = {
  schemaVersion: 1,
  kind: SESSION_KIND,
  sessionId: "ses_01",
  userId: "usr_01",
  surface: "web-shell",
  issuedAt: "2026-07-25T10:00:00Z",
  expiresAt: "2026-07-26T10:00:00Z",
  tokenDigest: "a".repeat(64),
} as const;

describe("identity vocabulary", () => {
  it("has exactly two roles and no hierarchy", () => {
    expect([...IDENTITY_ROLES]).toEqual(["admin", "user"]);
    expect(Object.isFrozen(IDENTITY_ROLES)).toBe(true);
  });

  it("enumerates the kids surface so it can be refused by name", () => {
    expect(IDENTITY_SURFACES).toContain(KIDS_IDENTITY_SURFACE);
    expect(KIDS_IDENTITY_SURFACE).toBe("kids");
  });

  it("names every client-asserted role property", () => {
    for (const key of ["role", "roles", "isAdmin", "admin"]) {
      expect(claimedRoleKey({ [key]: "admin" })).toBe(key);
    }
    expect(claimedRoleKey({ email: "a@b.co" })).toBeUndefined();
  });
});

describe("validateUser", () => {
  it("accepts a canonical user", () => {
    const result = validateUser(USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("captain@example.com");
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("validates a descriptor snapshot without reading a proxy twice", () => {
    const proxy = new Proxy(USER, {
      get() {
        throw new Error("a later proxy read escaped the snapshot");
      },
    });
    const result = validateUser(proxy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.userId).toBe(USER.userId);
  });

  it("refuses any payload carrying a role — escalation is never silently dropped", () => {
    for (const key of ["role", "roles", "isAdmin", "admin"]) {
      const result = validateUser({ ...USER, [key]: "admin" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(IDENTITY_REFUSE_CODES.userRoleFieldForbidden);
    }
  });

  it("refuses a non-object", () => {
    for (const value of [null, "user", 1, [USER]]) {
      const result = validateUser(value);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(IDENTITY_REFUSE_CODES.notObject);
    }
  });

  it("refuses a prototype-carrying object so an inherited property cannot decide a check", () => {
    const exotic = Object.create({ disabled: false }) as Record<string, unknown>;
    for (const [key, value] of Object.entries(USER)) {
      if (key === "disabled") continue;
      exotic[key] = value;
    }
    const result = validateUser(exotic);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.notObject);
  });

  it("refuses a schemaVersion mismatch rather than migrating", () => {
    const result = validateUser({ ...USER, schemaVersion: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.schemaVersionMismatch);
  });

  it("refuses a kind mismatch", () => {
    const result = validateUser({ ...USER, kind: "sceneaxi.session" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.kindMismatch);
  });

  it("refuses a missing required property", () => {
    const result = validateUser(without(USER, "email"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.missingProperty);
  });

  it("refuses an unknown extra property", () => {
    const result = validateUser({ ...USER, nickname: "cap" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.unexpectedProperty);
  });

  it("refuses an empty email, an implausible email, and a non-boolean flag", () => {
    for (const patch of [
      { email: "" },
      { email: "not-an-address" },
      { email: "two@parts@example.com" },
      { emailVerified: "yes" },
      { disabled: 0 },
    ]) {
      const result = validateUser({ ...USER, ...patch });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect([
        IDENTITY_REFUSE_CODES.invalidProperty,
        IDENTITY_REFUSE_CODES.userRoleFieldForbidden,
      ]).toContain(result.code);
    }
  });

  it("refuses a timezone-less createdAt", () => {
    const result = validateUser({ ...USER, createdAt: "2026-07-25T10:00:00" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.invalidProperty);
  });
});

describe("validateRoleAssignment", () => {
  it("accepts an admin role sourced from the environment", () => {
    const result = validateRoleAssignment(ROLE);
    expect(result.ok).toBe(true);
  });

  it("refuses an admin role from any source other than admin-env", () => {
    const result = validateRoleAssignment({ ...ROLE, source: "default-user" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.invalidProperty);
  });

  it("refuses an unknown role string", () => {
    const result = validateRoleAssignment({ ...ROLE, role: "superadmin" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.invalidProperty);
  });
});

describe("validateSession", () => {
  it("accepts a canonical session", () => {
    const result = validateSession(SESSION);
    expect(result.ok).toBe(true);
  });

  it("refuses a raw token in the digest field", () => {
    for (const tokenDigest of [
      "not-a-digest",
      "A".repeat(64),
      "a".repeat(63),
      "a".repeat(65),
    ]) {
      const result = validateSession({ ...SESSION, tokenDigest });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(IDENTITY_REFUSE_CODES.invalidProperty);
    }
  });

  it("refuses an expiry that is not strictly after issue", () => {
    for (const expiresAt of ["2026-07-25T10:00:00Z", "2026-07-24T10:00:00Z"]) {
      const result = validateSession({ ...SESSION, expiresAt });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(
        IDENTITY_REFUSE_CODES.sessionExpiryNotAfterIssue,
      );
    }
  });

  it("accepts the kids surface as a record while leaving refusal to the port", () => {
    const result = validateSession({ ...SESSION, surface: "kids" });
    expect(result.ok).toBe(true);
  });
});

describe("validatePrincipal", () => {
  it("accepts three records that agree on one user id", () => {
    const result = validatePrincipal({
      user: USER,
      role: ROLE,
      session: SESSION,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.role.role).toBe("admin");
  });

  it("refuses an admin role assignment belonging to another user", () => {
    const result = validatePrincipal({
      user: USER,
      role: { ...ROLE, userId: "usr_02" },
      session: SESSION,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.invalidProperty);
  });

  it("refuses a session belonging to another user", () => {
    const result = validatePrincipal({
      user: USER,
      role: ROLE,
      session: { ...SESSION, userId: "usr_02" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(IDENTITY_REFUSE_CODES.invalidProperty);
  });

  it("refuses missing and unexpected members", () => {
    const missing = validatePrincipal({ user: USER, role: ROLE });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe(IDENTITY_REFUSE_CODES.missingProperty);
    }
    const extra = validatePrincipal({
      user: USER,
      role: ROLE,
      session: SESSION,
      impersonating: "usr_02",
    });
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.code).toBe(IDENTITY_REFUSE_CODES.unexpectedProperty);
    }
  });
});

describe("identity contract version", () => {
  it("is major version 1", () => {
    expect(IDENTITY_SCHEMA_VERSION).toBe(1);
  });

  it("publishes Principal in the versioned JSON Schema artifact", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL("../contracts/identity.schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      oneOf: ReadonlyArray<{ $ref: string }>;
      $defs: Record<string, unknown>;
    };
    expect(schema.oneOf).toContainEqual({ $ref: "#/$defs/principal" });
    expect(schema.$defs["principal"]).toEqual(
      expect.objectContaining({
        required: ["user", "role", "session"],
        additionalProperties: false,
      }),
    );
  });
});
