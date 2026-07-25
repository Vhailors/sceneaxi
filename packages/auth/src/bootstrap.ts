/**
 * The admin bootstrap path.
 *
 * Marking the captain as admin is a *derivation*, not a grant: the role comes
 * from `SCENEAXI_ADMIN_EMAIL` every time it is resolved. This module exists so a
 * deployment can also persist that single assignment (the database has a partial
 * unique index allowing at most one admin row), and so the act of doing it is
 * planned, reviewed, and refused when ambiguous — rather than being an
 * UPDATE someone runs by hand.
 */

import type { RoleAssignment, User } from "@sceneaxi/schemas";
import {
  resolveAdminIdentity,
  type AdminIdentity,
  type EnvLike,
} from "./admin.js";
import { resolveRole } from "./roles.js";
import {
  AUTH_REFUSE_REASONS,
  authOk,
  authRefuse,
  type AuthResult,
} from "./refusals.js";

export type AdminBootstrapPlan = Readonly<{
  admin: AdminIdentity;
  /** The one role assignment to persist. Never more than one. */
  assignment: RoleAssignment;
}>;

export type PlanAdminBootstrapInput = Readonly<{
  env: EnvLike;
  /** Known users; exactly one must match the admin email. */
  users: ReadonlyArray<User>;
  /** Epoch milliseconds, injected for deterministic stamps. */
  now: number;
}>;

/**
 * Plan the single admin assignment, or refuse with a named reason.
 *
 * Refuses when the admin email matches no user (nothing to mark) and when it
 * matches more than one (the store is ambiguous, and picking one would be a
 * guess about who the captain is).
 */
export function planAdminBootstrap(
  input: PlanAdminBootstrapInput,
): AuthResult<AdminBootstrapPlan> {
  const admin = resolveAdminIdentity(input.env);
  if (!admin.ok) return admin;

  if (!Number.isFinite(input.now)) {
    return authRefuse(
      AUTH_REFUSE_REASONS.clockInvalid,
      "The admin bootstrap requires a finite epoch-millisecond clock.",
    );
  }

  const matches = input.users.filter(
    (user) => user.email.trim().toLowerCase() === admin.value.email,
  );
  if (matches.length === 0) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userNotFound,
      "No user matches the configured admin email; the captain must sign up before being marked admin.",
    );
  }
  if (matches.length > 1) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminMultipleIdentities,
      "More than one stored user carries the configured admin email; the bootstrap refuses rather than guessing.",
    );
  }

  const captain = matches[0];
  if (captain === undefined) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userNotFound,
      "No user matches the configured admin email.",
    );
  }
  if (captain.disabled) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userDisabled,
      "The configured admin user is disabled; the bootstrap refuses.",
    );
  }

  const assignment = resolveRole({
    user: captain,
    admin: admin.value,
    now: input.now,
  });
  if (assignment.role !== "admin") {
    // Unreachable by construction (the email matched), and a refusal rather
    // than an assertion so a future edit cannot turn it into a silent grant.
    return authRefuse(
      AUTH_REFUSE_REASONS.principalInvalid,
      "The bootstrap derived a non-admin role for the configured admin email.",
    );
  }

  return authOk(Object.freeze({ admin: admin.value, assignment }));
}
