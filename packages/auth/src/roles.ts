/**
 * Role derivation and fail-closed role guards.
 *
 * A role is always *derived* here from a user record plus the single admin
 * identity resolved from the environment. Nothing in this module reads a role
 * off an inbound payload, which is what makes `admin` structurally
 * unclaimable rather than merely validated.
 *
 * There is no role hierarchy: `requireRole` is an exact match. A guard that
 * should accept any signed-in principal uses `requireAuthenticated` instead, so
 * "admin also counts as a user" never has to be inferred.
 */

import {
  isEpochMilliseconds,
  isIdentityRole,
  snapshotPlainRecord,
  validatePrincipal,
  type IdentityRole,
  type IdentitySurface,
  type Principal,
  type RoleAssignment,
  type RoleSource,
  type User,
} from "@sceneaxi/schemas";
import {
  hasAdminIdentityProvenance,
  normalizeEmail,
  type AdminIdentity,
} from "./admin.js";
import { hasPrincipalProvenance } from "./principal-provenance.js";
import {
  AUTH_REFUSE_REASONS,
  authOk,
  authRefuse,
  type AuthRefuse,
  type AuthResult,
} from "./refusals.js";

export type ResolveRoleInput = Readonly<{
  user: User;
  admin: AdminIdentity;
  /** Epoch milliseconds; injected so role stamps are deterministic. */
  now: number;
}>;

/**
 * Derive the role for a user. Returns `admin` only when the user's email
 * matches the single environment-resolved admin identity after normalization.
 *
 * This is arithmetic, not a trust boundary, so it checks no provenance: its
 * answer is exactly as trustworthy as the identity handed in, and it cannot
 * refuse — it returns a `RoleAssignment`. Every path that *acts* on a role
 * re-derives it behind a guard, which does check provenance, so a role assigned
 * here against a hand-built identity opens nothing.
 */
export function resolveRole(input: ResolveRoleInput): RoleAssignment {
  const isAdmin = normalizeEmail(input.user.email) === input.admin.email;
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.role-assignment" as const,
    userId: input.user.userId,
    role: isAdmin ? ("admin" as const) : ("user" as const),
    source: isAdmin ? ("admin-env" as const) : ("default-user" as const),
    assignedAt: new Date(input.now).toISOString(),
  });
}

/**
 * The extra precondition admin elevation carries beyond matching the configured
 * email: the stored SceneAxi user record must mark that email verified.
 *
 * It lives beside `resolveRole` because every path that can produce or accept an
 * `admin` role has to apply the same predicate — sign-in, session assembly, the
 * persisted bootstrap, and the guards — and a second copy is how one of them
 * ends up elevating an identity the others refuse. Returns the named refusal, or
 * `undefined` when the user is not the admin or the admin email is verified.
 */
export function refuseUnverifiedAdmin(
  user: Readonly<{ email: string; emailVerified: boolean }>,
  adminEmail: string,
): AuthRefuse | undefined {
  if (normalizeEmail(user.email) !== adminEmail) return undefined;
  if (user.emailVerified) return undefined;
  return authRefuse(
    AUTH_REFUSE_REASONS.adminEmailUnverified,
    "The configured admin email is not verified in the SceneAxi user record; admin elevation refuses.",
  );
}

export type GuardOptions = Readonly<{
  /** Epoch milliseconds. Required — a guard with no clock cannot check expiry. */
  now: number;
  /**
   * The single environment-resolved admin identity. Required — the guard
   * re-derives the role from the principal's user record against this identity,
   * so a structurally valid principal carrying a fabricated `admin` role can
   * never satisfy a guard.
   *
   * It must be the value `resolveAdminIdentity` issued, not merely a value of
   * that shape: the guard checks its runtime provenance. Prefer
   * `createRoleGuards(resolveAdminIdentity(env))`, which removes the argument
   * altogether.
   */
  admin: AdminIdentity;
  /** When given, the principal's session must belong to this surface. */
  surface?: IdentitySurface;
}>;

/**
 * Checks every principal must pass regardless of the role being demanded.
 * Ordered so the cheapest structural refusals happen before anything else, and
 * so the Kids refusal cannot be reached around.
 */
function checkPrincipal(
  principal: unknown,
  options: GuardOptions,
): AuthResult<Principal> {
  const checkedOptions = snapshotPlainRecord(options);
  if (
    checkedOptions === undefined ||
    !isEpochMilliseconds(checkedOptions["now"])
  ) {
    return authRefuse(
      AUTH_REFUSE_REASONS.clockInvalid,
      "A role guard requires valid epoch milliseconds; expiry cannot be checked without them.",
    );
  }

  const adminRecord = snapshotPlainRecord(checkedOptions["admin"]);
  if (
    adminRecord === undefined ||
    typeof adminRecord["email"] !== "string" ||
    adminRecord["email"].length === 0
  ) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminIdentityUnresolved,
      "A role guard requires the single resolved admin identity, so the role can be re-derived rather than trusted off the principal.",
    );
  }

  // Shape is not provenance. `{ email, source }` is a public type, so a caller
  // who supplied both the principal and this option would otherwise be
  // answering the guard's own question: name your own address here and the
  // guard derives `admin` for you. Only the identity `resolveAdminIdentity`
  // issued from the environment counts, checked by object identity — a spread,
  // clone, or JSON round-trip of a real one is a different object and refuses.
  if (!hasAdminIdentityProvenance(checkedOptions["admin"])) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminIdentityUnproven,
      "The supplied admin identity was not issued by resolveAdminIdentity; a hand-built or copied identity cannot decide who is admin.",
    );
  }
  const adminEmail = adminRecord["email"];

  const validated = validatePrincipal(principal);
  if (!validated.ok) {
    return authRefuse(
      AUTH_REFUSE_REASONS.principalInvalid,
      `The principal is not a valid identity principal (${validated.code}): ${validated.message}`,
    );
  }
  // Shape is not authentication. A principal's public structure can be built
  // or copied by any in-process caller, so only the exact object recorded by
  // identity-port issuance may reach an authorization decision.
  if (!hasPrincipalProvenance(principal)) {
    return authRefuse(
      AUTH_REFUSE_REASONS.principalUnproven,
      "The supplied principal was not issued by createIdentityPort; a hand-built or copied principal cannot authorize an identity.",
    );
  }

  // A guard is not an issuance authority: it hands back the exact witnessed
  // object it was given, never `validated.value`, which is always a fresh frozen
  // copy carrying no provenance. So a guard's own result still satisfies
  // `hasPrincipalProvenance` and passes a subsequent guard.
  const value: Principal = principal;

  // The role is *derived* here, never trusted off the inbound principal: a
  // structurally valid principal carrying a fabricated `admin` role and
  // `admin-env` source must not reach an admin-only path. The principal's
  // claimed role must match the role this user would actually receive.
  const derivedIsAdmin =
    normalizeEmail(value.user.email) === adminEmail;
  const derivedRole: IdentityRole = derivedIsAdmin ? "admin" : "user";
  const derivedSource: RoleSource = derivedIsAdmin
    ? "admin-env"
    : "default-user";
  if (value.role.role !== derivedRole || value.role.source !== derivedSource) {
    return authRefuse(
      AUTH_REFUSE_REASONS.principalInvalid,
      "The principal's role is not the role derived from its user record and the configured admin identity; a fabricated role is refused.",
    );
  }

  if (value.session.surface === "kids") {
    return authRefuse(
      AUTH_REFUSE_REASONS.kidsSurfaceDenied,
      "Kids never shares identity with another SceneAxi surface; the session is refused.",
    );
  }

  if (
    checkedOptions["surface"] !== undefined &&
    value.session.surface !== checkedOptions["surface"]
  ) {
    return authRefuse(
      AUTH_REFUSE_REASONS.sessionSurfaceMismatch,
      `The session belongs to the '${value.session.surface}' surface, not '${String(checkedOptions["surface"])}'.`,
    );
  }

  if (value.user.disabled) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userDisabled,
      "The user is disabled; every role guard refuses, including admin.",
    );
  }

  const unverifiedAdmin = refuseUnverifiedAdmin(value.user, adminEmail);
  if (unverifiedAdmin !== undefined) return unverifiedAdmin;

  if (Date.parse(value.session.expiresAt) <= checkedOptions["now"]) {
    return authRefuse(
      AUTH_REFUSE_REASONS.sessionExpired,
      "The session has expired.",
    );
  }

  return authOk(value);
}

/** Allow any valid, enabled, unexpired principal, whatever its role. */
export function requireAuthenticated(
  principal: unknown,
  options: GuardOptions,
): AuthResult<Principal> {
  return checkPrincipal(principal, options);
}

/**
 * Allow only a principal whose derived role is exactly `required`.
 *
 * `checkPrincipal` already re-derived the role against the configured admin, so
 * reaching an admin-guarded path without the environment identity is impossible
 * by derivation, not by convention.
 */
export function requireRole(
  principal: unknown,
  required: IdentityRole,
  options: GuardOptions,
): AuthResult<Principal> {
  if (!isIdentityRole(required)) {
    return authRefuse(
      AUTH_REFUSE_REASONS.roleUnknown,
      `'${String(required)}' is not a SceneAxi role; the guard refuses rather than guessing.`,
    );
  }

  const checked = checkPrincipal(principal, options);
  if (!checked.ok) return checked;

  if (checked.value.role.role !== required) {
    return authRefuse(
      AUTH_REFUSE_REASONS.roleNotPermitted,
      `This action requires the '${required}' role; the principal holds '${checked.value.role.role}'.`,
    );
  }

  return checked;
}

/** What a bound guard still needs per call: the clock, and an optional surface. */
export type BoundGuardOptions = Readonly<{
  /** Epoch milliseconds. */
  now: number;
  /** When given, the principal's session must belong to this surface. */
  surface?: IdentitySurface;
}>;

export type RoleGuards = Readonly<{
  requireAuthenticated(
    principal: unknown,
    options: BoundGuardOptions,
  ): AuthResult<Principal>;
  requireRole(
    principal: unknown,
    required: IdentityRole,
    options: BoundGuardOptions,
  ): AuthResult<Principal>;
}>;

/**
 * Bind role guards to one resolved admin identity: the preferred way to guard.
 *
 * `createRoleGuards(resolveAdminIdentity(env))` takes the *resolution*, not an
 * identity, so the answer to "who is admin" is fixed by the environment at the
 * point the guards are made and is not a parameter any later call site supplies.
 * A refused resolution yields guards that return that same named refusal — the
 * deployment has no admin, so nothing is admin, and the reason survives instead
 * of being flattened.
 *
 * `requireRole`/`requireAuthenticated` remain exported for callers that already
 * hold the resolved identity; they check its provenance, so keeping them costs
 * nothing at the boundary.
 */
export function createRoleGuards(
  resolved: AuthResult<AdminIdentity>,
): RoleGuards {
  const outcome = snapshotPlainRecord(resolved);
  const resolution: AuthResult<AdminIdentity> =
    outcome !== undefined &&
    outcome["ok"] === true &&
    hasAdminIdentityProvenance(outcome["value"])
      ? authOk(outcome["value"])
      : outcome !== undefined &&
          outcome["ok"] === false &&
          typeof outcome["reason"] === "string"
        ? (resolved as AuthRefuse)
        : authRefuse(
            AUTH_REFUSE_REASONS.adminIdentityUnresolved,
            "Role guards were built from something other than a resolveAdminIdentity result; every guard refuses.",
          );

  const bind = (options: BoundGuardOptions): AuthResult<GuardOptions> => {
    if (!resolution.ok) return resolution;
    const record = snapshotPlainRecord(options);
    if (record === undefined) {
      return authRefuse(
        AUTH_REFUSE_REASONS.clockInvalid,
        "A bound role guard requires a plain options object carrying epoch milliseconds.",
      );
    }
    const screened = record as BoundGuardOptions;
    return authOk(
      screened.surface === undefined
        ? { now: screened.now, admin: resolution.value }
        : {
            now: screened.now,
            admin: resolution.value,
            surface: screened.surface,
          },
    );
  };

  return Object.freeze({
    requireAuthenticated(principal, options) {
      const bound = bind(options);
      if (!bound.ok) return bound;
      return requireAuthenticated(principal, bound.value);
    },
    requireRole(principal, required, options) {
      const bound = bind(options);
      if (!bound.ok) return bound;
      return requireRole(principal, required, bound.value);
    },
  });
}
