/**
 * Every named refusal this package can produce.
 *
 * The map is frozen and exhaustive on purpose: the refuse-matrix regression
 * enumerates it and asserts each reason is reachable, so a reason can never be
 * added without a covering case, nor removed while a case still needs it.
 */

export const AUTH_REFUSE_REASONS = Object.freeze({
  // --- single-admin resolution from the environment ---
  adminEmailMissing: "ADMIN_EMAIL_MISSING",
  adminEmailEmpty: "ADMIN_EMAIL_EMPTY",
  adminEmailInvalid: "ADMIN_EMAIL_INVALID",
  adminMultipleIdentities: "ADMIN_MULTIPLE_IDENTITIES_DENIED",
  adminMultiAdminNotAuthorized: "ADMIN_MULTI_ADMIN_NOT_AUTHORIZED",

  // --- wiring, checked per call so a missing dependency can never allow ---
  adapterMissing: "AUTH_ADAPTER_MISSING",
  storeMissing: "AUTH_STORE_MISSING",
  clockInvalid: "AUTH_CLOCK_INVALID",
  adminIdentityUnresolved: "AUTH_ADMIN_IDENTITY_UNRESOLVED",

  // --- inbound request ---
  requestInvalid: "AUTH_REQUEST_ENVELOPE_INVALID",
  roleClaimFromClient: "ROLE_CLAIM_FROM_CLIENT_DENIED",
  surfaceInvalid: "AUTH_SURFACE_INVALID",
  kidsSurfaceDenied: "KIDS_IDENTITY_SURFACE_DENIED",

  // --- adapter and store outcomes ---
  credentialsRejected: "AUTH_CREDENTIALS_REJECTED",
  adapterFailed: "AUTH_ADAPTER_FAILED",
  adapterEnvelopeInvalid: "AUTH_ADAPTER_ENVELOPE_INVALID",
  adapterUserMismatch: "AUTH_ADAPTER_USER_MISMATCH",
  storeFailed: "AUTH_STORE_FAILED",

  // --- identity state ---
  userNotFound: "AUTH_USER_NOT_FOUND",
  userDisabled: "AUTH_USER_DISABLED",
  userRecordInvalid: "AUTH_USER_RECORD_INVALID",
  sessionNotFound: "AUTH_SESSION_NOT_FOUND",
  sessionExpired: "AUTH_SESSION_EXPIRED",
  sessionSurfaceMismatch: "AUTH_SESSION_SURFACE_MISMATCH",
  sessionTokenMismatch: "AUTH_SESSION_TOKEN_MISMATCH",
  sessionRecordInvalid: "AUTH_SESSION_RECORD_INVALID",

  // --- guards ---
  principalInvalid: "AUTH_PRINCIPAL_INVALID",
  roleUnknown: "AUTH_ROLE_UNKNOWN",
  roleNotPermitted: "AUTH_ROLE_NOT_PERMITTED",
} as const);

export type AuthRefuseReason =
  (typeof AUTH_REFUSE_REASONS)[keyof typeof AUTH_REFUSE_REASONS];

export type AuthRefuse = Readonly<{
  ok: false;
  reason: AuthRefuseReason;
  message: string;
}>;

export type AuthOk<Value> = Readonly<{ ok: true; value: Value }>;

export type AuthResult<Value> = AuthOk<Value> | AuthRefuse;

export function authRefuse(
  reason: AuthRefuseReason,
  message: string,
): AuthRefuse {
  return Object.freeze({ ok: false, reason, message });
}

export function authOk<Value>(value: Value): AuthOk<Value> {
  return Object.freeze({ ok: true, value });
}
