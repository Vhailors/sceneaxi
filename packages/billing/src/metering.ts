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
 *
 * The caller's idempotency key is namespaced by account before it reaches the
 * ledger (`usage:<accountId>:<key>`), the way every other producer in this plane
 * namespaces by identity. Replay is a per-account question, but the persisted
 * `idempotency_key` uniqueness is global, so an un-namespaced caller key would
 * let one account's `usage:turn_01` turn another account's distinct usage into an
 * opaque store failure instead of a metered debit.
 */

import { requireAuthenticated, type AdminIdentity } from "@sceneaxi/auth";
import {
  isEpochMilliseconds,
  snapshotPlainRecord,
  type CreditAccount,
  type CreditLedgerEntry,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import {
  appendCreditEntry,
  deriveEntryId,
  loadLedgerState,
  validateLedgerState,
  type LedgerState,
} from "./ledger.js";
import type { CreditStore } from "./store.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

export type MeterCreditsRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, used to re-derive the role at the guard. */
  admin: AdminIdentity;
  store: CreditStore;
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

/** Namespace for metering idempotency keys; scoped by account, never bare. */
export const METERING_IDEMPOTENCY_PREFIX = "usage:" as const;

/** Scope a caller-supplied metering key to the account that is being debited. */
export function meteringIdempotencyKey(
  accountId: string,
  callerKey: string,
): string {
  return `${METERING_IDEMPOTENCY_PREFIX}${accountId}:${callerKey}`;
}

export type MeterOutcome = Readonly<{
  state: LedgerState;
  /** False when an admin's unlimited allowance applied and nothing was charged. */
  metered: boolean;
  entry?: CreditLedgerEntry | undefined;
  balance: number;
  replayed: boolean;
}>;

/** Debit an account for metered usage, or refuse without partial application. */
function sameLedgerState(left: LedgerState, right: LedgerState): boolean {
  return (
    left.balance === right.balance &&
    JSON.stringify(left.account) === JSON.stringify(right.account) &&
    JSON.stringify(left.entries) === JSON.stringify(right.entries)
  );
}

export async function meterCredits(
  request: MeterCreditsRequest,
): Promise<BillingOutcome<MeterOutcome>> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A metering request must be a plain object.",
    );
  }
  const screened = record as MeterCreditsRequest;
  const {
    principal,
    admin,
    store,
    state,
    amount,
    reason,
    idempotencyKey,
    now,
    surface,
  } = screened;

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
  const validatedState = validateLedgerState(state);
  if (!validatedState.ok) return validatedState;

  const guarded = requireAuthenticated(
    principal,
    surface === undefined ? { now, admin } : { now, surface, admin },
  );
  if (!guarded.ok) {
    return billingRefuse(guarded.reason, guarded.message);
  }

  if (validatedState.value.account.userId !== guarded.value.user.userId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The credit account belongs to a different user; metering refuses.",
    );
  }

  let persistedAccount: CreditAccount | undefined;
  let persistedEntries: ReadonlyArray<CreditLedgerEntry>;
  try {
    persistedAccount = await store.findAccountById(
      validatedState.value.account.accountId,
    );
    if (persistedAccount === undefined || persistedAccount === null) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerStateInvalid,
        "The credit account does not exist in persistence; metering refuses.",
      );
    }
    persistedEntries = await store.listEntries(
      validatedState.value.account.accountId,
    );
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.storeFailed,
      "The credit store failed while loading the metering account.",
    );
  }

  const persistedState = loadLedgerState(persistedAccount, persistedEntries);
  if (!persistedState.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      `The persisted credit account is invalid: ${persistedState.message}`,
    );
  }
  if (!sameLedgerState(validatedState.value, persistedState.value)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "The supplied ledger state is not the current persisted account state.",
    );
  }

  if (guarded.value.role.role === "admin") {
    return billingOk(
      Object.freeze({
        state: persistedState.value,
        metered: false,
        entry: undefined,
        balance: persistedState.value.balance,
        replayed: false,
      }),
    );
  }

  const scopedKey = meteringIdempotencyKey(
    persistedState.value.account.accountId,
    idempotencyKey,
  );
  const appended = appendCreditEntry(persistedState.value, {
    entryId: deriveEntryId(scopedKey),
    movement: "debit",
    delta: -amount,
    reason,
    idempotencyKey: scopedKey,
    now,
  });
  if (!appended.ok) return appended;

  if (!appended.value.replayed && appended.value.entry !== undefined) {
    try {
      await store.appendEntry(appended.value.entry);
    } catch {
      return billingRefuse(
        BILLING_REFUSE_REASONS.storeFailed,
        "The credit store failed while persisting the metered debit.",
      );
    }
  }

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
