/**
 * Credit metering: the debit path for SceneAxi-hosted usage.
 *
 * Two product rules are enforced here rather than at call sites, so no surface
 * can forget them:
 *
 * - **Admin is never debited.** The captain has an unlimited allowance, so an
 *   admin principal returns `metered: false` and the ledger is untouched. That
 *   is reported explicitly instead of being faked with a zero-credit entry,
 *   which would pollute the ledger with meaningless rows.
 * - **A principal may only spend its own account.** Ownership is checked against
 *   the account record, not inferred from the caller passing the right state.
 */

import { requireAuthenticated } from "@sceneaxi/auth";
import {
  isEpochMilliseconds,
  snapshotPlainRecord,
  type CreditLedgerEntry,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import {
  appendCreditEntry,
  deriveEntryId,
  type LedgerState,
} from "./ledger.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

export type MeterCreditsRequest = Readonly<{
  principal: unknown;
  state: LedgerState;
  /** Positive integer credits to burn. */
  amount: number;
  reason: string;
  idempotencyKey: string;
  /** Epoch milliseconds. */
  now: number;
  /** When given, the principal's session must belong to this surface. */
  surface?: IdentitySurface | undefined;
}>;

export type MeterOutcome = Readonly<{
  state: LedgerState;
  /** False when an admin's unlimited allowance applied and nothing was charged. */
  metered: boolean;
  entry?: CreditLedgerEntry | undefined;
  balance: number;
  replayed: boolean;
}>;

/** Debit an account for metered usage, or refuse without partial application. */
export function meterCredits(
  request: MeterCreditsRequest,
): BillingOutcome<MeterOutcome> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A metering request must be a plain object.",
    );
  }
  const screened = record as MeterCreditsRequest;
  const { principal, state, amount, reason, idempotencyKey, now, surface } =
    screened;

  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "Metering requires valid epoch milliseconds.",
    );
  }
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.amountInvalid,
      "A metered amount must be a positive safe integer number of credits.",
    );
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "Metering requires a non-empty reason so every debit is attributable.",
    );
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "Metering requires a non-empty idempotency key.",
    );
  }
  const stateRecord = snapshotPlainRecord(state);
  const accountRecord = snapshotPlainRecord(stateRecord?.["account"]);
  if (
    stateRecord === undefined ||
    accountRecord === undefined ||
    !Array.isArray(stateRecord["entries"])
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "Metering requires a valid ledger state.",
    );
  }

  const guarded = requireAuthenticated(
    principal,
    surface === undefined ? { now } : { now, surface },
  );
  if (!guarded.ok) {
    return billingRefuse(guarded.reason, guarded.message);
  }

  if (accountRecord["userId"] !== guarded.value.user.userId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The credit account belongs to a different user; metering refuses.",
    );
  }

  // The captain's unlimited allowance. Reported, not faked with a zero entry.
  if (guarded.value.role.role === "admin") {
    return billingOk(
      Object.freeze({
        state,
        metered: false,
        entry: undefined,
        balance: state.balance,
        replayed: false,
      }),
    );
  }

  const appended = appendCreditEntry(state, {
    entryId: deriveEntryId(idempotencyKey),
    movement: "debit",
    delta: -amount,
    reason,
    idempotencyKey,
    now,
  });
  if (!appended.ok) return appended;

  return billingOk(
    Object.freeze({
      state: appended.value.state,
      metered: true,
      entry: appended.value.entry,
      balance: appended.value.state.balance,
      replayed: appended.value.replayed,
    }),
  );
}
