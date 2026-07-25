/**
 * SceneAxi identity contracts (v1) — User, Session, RoleAssignment, Principal.
 *
 * Two shapes here are load-bearing and deliberate:
 *
 * 1. `User` carries **no role field**. A role can never ride on a record that a
 *    client can write, so `admin` is structurally unclaimable from the outside.
 *    Roles live on `RoleAssignment`, which only the server derives.
 * 2. `Session` stores a token **digest**, never a raw token, so a leaked
 *    session row cannot be replayed as a credential.
 *
 * `IDENTITY_SURFACES` includes `"kids"` so it can be *refused* by name. Kids
 * never shares identity with another surface — see docs/auth-credits.md.
 *
 * Behavior (guards, admin resolution, session verification) lives in
 * @sceneaxi/auth; this module is contracts only.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isDateTime,
  isNonEmptyString,
  isPlainRecord,
  refuseWith,
  type ContractRefuse,
} from "./record-validation.js";

/** Contract major version for the identity plane. */
export const IDENTITY_SCHEMA_VERSION = 1 as const;

export const USER_KIND = "sceneaxi.user" as const;
export const SESSION_KIND = "sceneaxi.session" as const;
export const ROLE_ASSIGNMENT_KIND = "sceneaxi.role-assignment" as const;

/** The complete role vocabulary. There is no third role and no role hierarchy. */
export const IDENTITY_ROLES = Object.freeze(["admin", "user"] as const);

/**
 * How a role was arrived at. `admin-env` is the *only* source that may yield
 * `admin`, and it reads a single captain email from the environment.
 */
export const ROLE_SOURCES = Object.freeze([
  "admin-env",
  "default-user",
] as const);

/**
 * Surfaces that may hold a SceneAxi session. `kids` is enumerated so the
 * identity port can name its refusal; it is never served.
 */
export const IDENTITY_SURFACES = Object.freeze([
  "web-shell",
  "desktop-shell",
  "site",
  "kids",
] as const);

/** The Kids surface, refused everywhere by name. */
export const KIDS_IDENTITY_SURFACE = "kids" as const;

/**
 * Property names that would carry a client-asserted role. Any of these on an
 * inbound payload is a refusal, not a field to ignore: silently dropping a
 * `role` claim would make a privilege-escalation attempt look like success.
 */
export const CLIENT_ROLE_CLAIM_KEYS = Object.freeze([
  "role",
  "roles",
  "isAdmin",
  "admin",
] as const);

export const IDENTITY_REFUSE_CODES = Object.freeze({
  notObject: "IDENTITY_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "IDENTITY_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "IDENTITY_KIND_MISMATCH",
  missingProperty: "IDENTITY_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "IDENTITY_UNEXPECTED_PROPERTY",
  invalidProperty: "IDENTITY_PROPERTY_INVALID",
  userRoleFieldForbidden: "IDENTITY_USER_ROLE_FIELD_FORBIDDEN",
  sessionExpiryNotAfterIssue: "IDENTITY_SESSION_EXPIRY_NOT_AFTER_ISSUE",
} as const);

export type IdentityRefuseCode =
  (typeof IDENTITY_REFUSE_CODES)[keyof typeof IDENTITY_REFUSE_CODES];

export type IdentityRole = (typeof IDENTITY_ROLES)[number];
export type RoleSource = (typeof ROLE_SOURCES)[number];
export type IdentitySurface = (typeof IDENTITY_SURFACES)[number];

/** An identity record. Deliberately role-free — see the module header. */
export type User = {
  readonly schemaVersion: typeof IDENTITY_SCHEMA_VERSION;
  readonly kind: typeof USER_KIND;
  readonly userId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly disabled: boolean;
  readonly createdAt: string;
};

/** A server-derived role. Never accepted from a client payload. */
export type RoleAssignment = {
  readonly schemaVersion: typeof IDENTITY_SCHEMA_VERSION;
  readonly kind: typeof ROLE_ASSIGNMENT_KIND;
  readonly userId: string;
  readonly role: IdentityRole;
  readonly source: RoleSource;
  readonly assignedAt: string;
};

/** A session bound to exactly one surface, holding only a token digest. */
export type Session = {
  readonly schemaVersion: typeof IDENTITY_SCHEMA_VERSION;
  readonly kind: typeof SESSION_KIND;
  readonly sessionId: string;
  readonly userId: string;
  readonly surface: IdentitySurface;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly tokenDigest: string;
};

/** The only shape a role guard accepts. Assembled server-side. */
export type Principal = {
  readonly user: User;
  readonly role: RoleAssignment;
  readonly session: Session;
};

export type IdentityValidationOk<Value> = {
  readonly ok: true;
  readonly value: Value;
};

export type IdentityValidationRefuse = ContractRefuse<IdentityRefuseCode>;

export type IdentityValidationResult<Value> =
  | IdentityValidationOk<Value>
  | IdentityValidationRefuse;

/**
 * Digest of a session token: 64 lowercase hex characters (SHA-256). The
 * fixed width is part of the contract so a raw token — which is neither
 * hex-only nor reliably 64 characters — cannot be stored in this field by
 * accident.
 */
const TOKEN_DIGEST_RE = /^[0-9a-f]{64}$/;

/** Opaque server-issued identifier: url-safe, non-empty, bounded. */
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Deliberately conservative address shape: one `@`, a non-empty local part
 * with no whitespace, and a dotted domain. Address *ownership* is Better
 * Auth's job; this only rejects values that cannot be an address at all.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function isIdentityRole(value: unknown): value is IdentityRole {
  return IDENTITY_ROLES.some((role) => role === value);
}

export function isIdentitySurface(value: unknown): value is IdentitySurface {
  return IDENTITY_SURFACES.some((surface) => surface === value);
}

export function isRoleSource(value: unknown): value is RoleSource {
  return ROLE_SOURCES.some((source) => source === value);
}

/** True when a payload carries any client-asserted role property. */
export function claimedRoleKey(value: unknown): string | undefined {
  if (!isPlainRecord(value)) return undefined;
  return CLIENT_ROLE_CLAIM_KEYS.find((key) => Object.hasOwn(value, key));
}

function ok<Value>(value: Value): IdentityValidationOk<Value> {
  return Object.freeze({ ok: true, value });
}

function checkEnvelope(
  value: unknown,
  kind: string,
  label: string,
  required: ReadonlyArray<string>,
): Record<string, unknown> | IdentityValidationRefuse {
  if (!isPlainRecord(value)) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.notObject,
      `A ${label} must be a plain JSON object.`,
    );
  }
  if (value["schemaVersion"] !== IDENTITY_SCHEMA_VERSION) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.schemaVersionMismatch,
      `${label} schemaVersion must be ${IDENTITY_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (value["kind"] !== kind) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.kindMismatch,
      `${label} kind must be "${kind}".`,
    );
  }
  const missing = firstMissingKey(value, required);
  if (missing !== undefined) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.missingProperty,
      `${label} is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, required);
  if (unexpected !== undefined) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.unexpectedProperty,
      `${label} has unexpected property "${unexpected}".`,
    );
  }
  return value;
}

function isRefuse(
  value: Record<string, unknown> | IdentityValidationRefuse,
): value is IdentityValidationRefuse {
  return "ok" in value && value.ok === false;
}

function invalid(detail: string): IdentityValidationRefuse {
  return refuseWith(IDENTITY_REFUSE_CODES.invalidProperty, detail);
}

const USER_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "userId",
  "email",
  "emailVerified",
  "disabled",
  "createdAt",
]);

/** Validate a user record. Refuses any payload carrying a role. */
export function validateUser(value: unknown): IdentityValidationResult<User> {
  const claimed = claimedRoleKey(value);
  if (claimed !== undefined) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.userRoleFieldForbidden,
      `A user record must not carry a role property (found "${claimed}"); roles live on a server-derived role assignment.`,
    );
  }
  const record = checkEnvelope(value, USER_KIND, "user", USER_KEYS);
  if (isRefuse(record)) return record;

  const userId = record["userId"];
  if (typeof userId !== "string" || !IDENTIFIER_RE.test(userId)) {
    return invalid("user userId must be a url-safe identifier of 1-128 chars.");
  }
  const email = record["email"];
  if (!isNonEmptyString(email) || !EMAIL_RE.test(email)) {
    return invalid("user email must be a plausible email address.");
  }
  if (typeof record["emailVerified"] !== "boolean") {
    return invalid("user emailVerified must be a boolean.");
  }
  if (typeof record["disabled"] !== "boolean") {
    return invalid("user disabled must be a boolean.");
  }
  if (!isDateTime(record["createdAt"])) {
    return invalid(
      "user createdAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: IDENTITY_SCHEMA_VERSION,
      kind: USER_KIND,
      userId,
      email,
      emailVerified: record["emailVerified"],
      disabled: record["disabled"],
      createdAt: record["createdAt"],
    }),
  );
}

const ROLE_ASSIGNMENT_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "userId",
  "role",
  "source",
  "assignedAt",
]);

/** Validate a server-derived role assignment. */
export function validateRoleAssignment(
  value: unknown,
): IdentityValidationResult<RoleAssignment> {
  const record = checkEnvelope(
    value,
    ROLE_ASSIGNMENT_KIND,
    "role assignment",
    ROLE_ASSIGNMENT_KEYS,
  );
  if (isRefuse(record)) return record;

  const userId = record["userId"];
  if (typeof userId !== "string" || !IDENTIFIER_RE.test(userId)) {
    return invalid(
      "role assignment userId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const role = record["role"];
  if (!isIdentityRole(role)) {
    return invalid(
      `role assignment role must be one of ${IDENTITY_ROLES.join(", ")}.`,
    );
  }
  const source = record["source"];
  if (!isRoleSource(source)) {
    return invalid(
      `role assignment source must be one of ${ROLE_SOURCES.join(", ")}.`,
    );
  }
  if (role === "admin" && source !== "admin-env") {
    return invalid(
      'the admin role may only originate from the "admin-env" source.',
    );
  }
  if (!isDateTime(record["assignedAt"])) {
    return invalid(
      "role assignment assignedAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: IDENTITY_SCHEMA_VERSION,
      kind: ROLE_ASSIGNMENT_KIND,
      userId,
      role,
      source,
      assignedAt: record["assignedAt"],
    }),
  );
}

const SESSION_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "sessionId",
  "userId",
  "surface",
  "issuedAt",
  "expiresAt",
  "tokenDigest",
]);

/** Validate a session record. Refuses a raw token in the digest field. */
export function validateSession(
  value: unknown,
): IdentityValidationResult<Session> {
  const record = checkEnvelope(value, SESSION_KIND, "session", SESSION_KEYS);
  if (isRefuse(record)) return record;

  const sessionId = record["sessionId"];
  if (typeof sessionId !== "string" || !IDENTIFIER_RE.test(sessionId)) {
    return invalid(
      "session sessionId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const userId = record["userId"];
  if (typeof userId !== "string" || !IDENTIFIER_RE.test(userId)) {
    return invalid(
      "session userId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const surface = record["surface"];
  if (!isIdentitySurface(surface)) {
    return invalid(
      `session surface must be one of ${IDENTITY_SURFACES.join(", ")}.`,
    );
  }
  const issuedAt = record["issuedAt"];
  const expiresAt = record["expiresAt"];
  if (!isDateTime(issuedAt)) {
    return invalid(
      "session issuedAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }
  if (!isDateTime(expiresAt)) {
    return invalid(
      "session expiresAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.sessionExpiryNotAfterIssue,
      "session expiresAt must be strictly after issuedAt.",
    );
  }
  const tokenDigest = record["tokenDigest"];
  if (typeof tokenDigest !== "string" || !TOKEN_DIGEST_RE.test(tokenDigest)) {
    return invalid(
      "session tokenDigest must be 64 lowercase hex characters (SHA-256); raw tokens are never stored.",
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: IDENTITY_SCHEMA_VERSION,
      kind: SESSION_KIND,
      sessionId,
      userId,
      surface,
      issuedAt,
      expiresAt,
      tokenDigest,
    }),
  );
}

/**
 * Validate a principal: three valid records that agree on one user id. The
 * cross-field check is the point — a valid user plus a valid admin role
 * assignment for *someone else* must never authorize anything.
 */
export function validatePrincipal(
  value: unknown,
): IdentityValidationResult<Principal> {
  if (!isPlainRecord(value)) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.notObject,
      "A principal must be a plain JSON object.",
    );
  }
  const missing = firstMissingKey(value, ["user", "role", "session"]);
  if (missing !== undefined) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.missingProperty,
      `A principal is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, ["user", "role", "session"]);
  if (unexpected !== undefined) {
    return refuseWith(
      IDENTITY_REFUSE_CODES.unexpectedProperty,
      `A principal has unexpected property "${unexpected}".`,
    );
  }

  const user = validateUser(value["user"]);
  if (!user.ok) return user;
  const role = validateRoleAssignment(value["role"]);
  if (!role.ok) return role;
  const session = validateSession(value["session"]);
  if (!session.ok) return session;

  if (
    role.value.userId !== user.value.userId ||
    session.value.userId !== user.value.userId
  ) {
    return invalid(
      "principal user, role assignment, and session must all name the same userId.",
    );
  }

  return ok(
    Object.freeze({
      user: user.value,
      role: role.value,
      session: session.value,
    }),
  );
}
