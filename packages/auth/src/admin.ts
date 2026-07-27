/**
 * Single-admin resolution from the environment.
 *
 * Exactly one captain identity may be admin. That is enforced here rather than
 * in a database row so there is no write path — not an API, not a migration,
 * not an admin panel — that can produce a second admin. Changing the admin
 * means changing an environment variable, which is a deploy-time act.
 *
 * A *plural* variable name is refused outright even when it holds one address:
 * accepting it would quietly normalize multi-admin into the codebase, and
 * multi-admin needs a captain decision this package does not have.
 *
 * `AdminIdentity` also carries **runtime provenance**: only the value this
 * module issues from the environment counts, and only `hasAdminIdentityProvenance`
 * is exported to check it. The shape `{ email, source }` is public, so without
 * that a caller could hand a guard an identity naming their own address and be
 * derived into `admin` by their own argument — the guard would be checking a
 * claim the caller supplied on both sides.
 */

import { createProvenanceWitness } from "@sceneaxi/schemas";
import {
  AUTH_REFUSE_REASONS,
  authOk,
  authRefuse,
  type AuthResult,
} from "./refusals.js";

/** The one variable that names the admin. */
export const ADMIN_EMAIL_ENV_VAR = "SCENEAXI_ADMIN_EMAIL" as const;

/**
 * Plural spellings that must never be honored. Their mere presence refuses, so
 * a well-meaning `SCENEAXI_ADMIN_EMAILS=a@b.co` cannot slip multi-admin in.
 */
export const MULTI_ADMIN_ENV_VARS = Object.freeze([
  "SCENEAXI_ADMIN_EMAILS",
  "SCENEAXI_ADMINS",
] as const);

/** Any of these inside the value means more than one address was supplied. */
const SEPARATOR_RE = /[,;\s]/;

/**
 * Deliberately conservative: one `@`, a non-empty local part, a dotted domain.
 * Proving the address exists is the identity provider's job, not this check's.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export type AdminIdentity = Readonly<{
  /** Trimmed, lowercased address. Comparisons always use this form. */
  email: string;
  source: typeof ADMIN_EMAIL_ENV_VAR;
}>;

/** Env-shaped input. Accepts `process.env` without importing it. */
export type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * The one authority to mint an `AdminIdentity`, held privately here.
 * `resolveAdminIdentity` is the only caller, so "the admin identity" and "the
 * value this module derived from the environment" are the same thing at runtime.
 */
const adminIdentityProvenance = createProvenanceWitness<AdminIdentity>();

/**
 * Whether a value is an `AdminIdentity` this module actually issued.
 *
 * Every guard that re-derives a role against the admin identity must ask this,
 * not merely that the value has an `email`. Checking provenance is safe to
 * export; issuing it is not.
 */
export function hasAdminIdentityProvenance(
  value: unknown,
): value is AdminIdentity {
  return adminIdentityProvenance.holds(value);
}

/** Trim and lowercase, the one normalization every comparison uses. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

/**
 * Resolve the single admin identity, or refuse with a named reason.
 *
 * Fail-closed: every refusal path leaves the caller with no admin at all, which
 * makes the whole identity port refuse rather than silently treating the
 * captain as an ordinary user.
 */
export function resolveAdminIdentity(env: EnvLike): AuthResult<AdminIdentity> {
  for (const plural of MULTI_ADMIN_ENV_VARS) {
    if (Object.hasOwn(env, plural) && env[plural] !== undefined) {
      return authRefuse(
        AUTH_REFUSE_REASONS.adminMultiAdminNotAuthorized,
        `${plural} is set, but multi-admin is not authorized; use ${ADMIN_EMAIL_ENV_VAR} with exactly one address.`,
      );
    }
  }

  const raw = env[ADMIN_EMAIL_ENV_VAR];
  if (raw === undefined) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminEmailMissing,
      `${ADMIN_EMAIL_ENV_VAR} is not set; the identity plane refuses rather than running without an admin.`,
    );
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminEmailEmpty,
      `${ADMIN_EMAIL_ENV_VAR} is empty or whitespace-only.`,
    );
  }
  if (SEPARATOR_RE.test(raw.trim())) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminMultipleIdentities,
      `${ADMIN_EMAIL_ENV_VAR} must name exactly one address; separators were found.`,
    );
  }
  if (!isPlausibleEmail(raw)) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminEmailInvalid,
      `${ADMIN_EMAIL_ENV_VAR} is not a plausible email address.`,
    );
  }

  return authOk(
    adminIdentityProvenance.issue({
      email: normalizeEmail(raw),
      source: ADMIN_EMAIL_ENV_VAR,
    }),
  );
}
