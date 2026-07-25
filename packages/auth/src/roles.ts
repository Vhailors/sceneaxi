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
  isIdentityRole,
  validatePrincipal,
  type IdentityRole,
  type IdentitySurface,
  type Principal,
  type RoleAssignment,
  type User,
} from "@sceneaxi/schemas";
import { normalizeEmail, type AdminIdentity } from "./admin.js";
import {
  AUTH_REFUSE_REASONS,
  authOk,
  authRefuse,
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

export type GuardOptions = Readonly<{
  /** Epoch milliseconds. Required — a guard with no clock cannot check expiry. */
  now: number;
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
  if (
    typeof options !== "object" ||
    options === null ||
    !Number.isFinite(options.now)
  ) {
    return authRefuse(
      AUTH_REFUSE_REASONS.clockInvalid,
      "A role guard requires a finite epoch-millisecond clock; expiry cannot be checked without one.",
    );
  }

  const validated = validatePrincipal(principal);
  if (!validated.ok) {
    return authRefuse(
      AUTH_REFUSE_REASONS.principalInvalid,
      `The principal is not a valid identity principal (${validated.code}): ${validated.message}`,
    );
  }
  const value = validated.value;

  if (value.session.surface === "kids") {
    return authRefuse(
      AUTH_REFUSE_REASONS.kidsSurfaceDenied,
      "Kids never shares identity with another SceneAxi surface; the session is refused.",
    );
  }

  if (options.surface !== undefined && value.session.surface !== options.surface) {
    return authRefuse(
      AUTH_REFUSE_REASONS.sessionSurfaceMismatch,
      `The session belongs to the '${value.session.surface}' surface, not '${options.surface}'.`,
    );
  }

  if (value.user.disabled) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userDisabled,
      "The user is disabled; every role guard refuses, including admin.",
    );
  }

  if (Date.parse(value.session.expiresAt) <= options.now) {
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
 * `validatePrincipal` has already refused any `admin` assignment whose source
 * is not `admin-env`, so reaching an admin-guarded path without the environment
 * identity is impossible by contract, not by convention.
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
