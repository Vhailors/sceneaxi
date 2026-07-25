/**
 * Every named refusal this package can produce.
 *
 * The reason type deliberately *includes* `AuthRefuseReason`: when a role guard
 * refuses, billing surfaces that exact reason rather than flattening it into a
 * generic "not permitted". A caller needs to be able to tell
 * `KIDS_IDENTITY_SURFACE_DENIED` from `AUTH_SESSION_EXPIRED`.
 *
 * The map is frozen and exhaustive on purpose: the refuse-matrix regression
 * enumerates it and asserts each reason is reachable.
 */

import type { AuthRefuseReason } from "@sceneaxi/auth";

export const BILLING_REFUSE_REASONS = Object.freeze({
  // --- ledger integrity ---
  requestInvalid: "CREDIT_REQUEST_INVALID",
  ledgerStateInvalid: "CREDIT_LEDGER_STATE_INVALID",
  ledgerOrderInvalid: "CREDIT_LEDGER_ORDER_INVALID",
  entryInvalid: "CREDIT_ENTRY_INVALID",
  deltaSignMismatch: "CREDIT_DELTA_SIGN_MISMATCH",
  balanceInsufficient: "CREDIT_BALANCE_INSUFFICIENT",
  idempotencyConflict: "CREDIT_IDEMPOTENCY_KEY_CONFLICT",
  clockInvalid: "CREDIT_CLOCK_INVALID",

  // --- accounts and metering ---
  accountUnknown: "CREDIT_ACCOUNT_UNKNOWN",
  accountNotOwned: "CREDIT_ACCOUNT_NOT_OWNED",
  amountInvalid: "CREDIT_AMOUNT_INVALID",
  storeFailed: "CREDIT_STORE_FAILED",
} as const);

export type BillingRefuseReason =
  | (typeof BILLING_REFUSE_REASONS)[keyof typeof BILLING_REFUSE_REASONS]
  | AuthRefuseReason;

export type BillingRefuse = Readonly<{
  ok: false;
  reason: BillingRefuseReason;
  message: string;
}>;

export type BillingOk<Value> = Readonly<{ ok: true; value: Value }>;

export type BillingOutcome<Value> = BillingOk<Value> | BillingRefuse;

export function billingRefuse(
  reason: BillingRefuseReason,
  message: string,
): BillingRefuse {
  return Object.freeze({ ok: false, reason, message });
}

export function billingOk<Value>(value: Value): BillingOk<Value> {
  return Object.freeze({ ok: true, value });
}
