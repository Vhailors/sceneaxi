/**
 * The append-only credit ledger.
 *
 * Every operation is pure: `appendCreditEntry` returns a **new** frozen state
 * and never touches the one it was given. That is what makes "append-only" a
 * property of the type rather than a rule people remember — there is no
 * in-place mutation to forget to avoid. The database enforces the same
 * invariant independently (`db/migrations`, BEFORE UPDATE OR DELETE trigger), so
 * neither layer is the only thing standing between the ledger and a rewrite.
 *
 * Balance is always *derived*. `balanceAfter` on each entry is a witness of that
 * derivation which the ledger re-checks, not a second place the balance lives.
 */

import { createHash } from "node:crypto";
import {
  isEpochMilliseconds,
  snapshotPlainArray,
  snapshotPlainRecord,
  validateCreditAccount,
  validateCreditLedgerEntry,
  type CreditAccount,
  type CreditLedgerEntry,
  type CreditMovement,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

export type LedgerState = Readonly<{
  account: CreditAccount;
  entries: ReadonlyArray<CreditLedgerEntry>;
  /** Derived from `entries`; equal to the last entry's balanceAfter. */
  balance: number;
}>;

export type AppendCreditEntryRequest = Readonly<{
  entryId: string;
  movement: CreditMovement;
  /** Signed, non-zero. `grant` must be positive, `debit` negative. */
  delta: number;
  reason: string;
  idempotencyKey: string;
  /** Epoch milliseconds; injected so entries are deterministic. */
  now: number;
}>;

export type AppendOutcome = Readonly<{
  state: LedgerState;
  /**
   * The appended entry. Absent when the operation recorded nothing — for example
   * an admin's unlimited allowance, which is reported explicitly rather than faked
   * with a zero-credit row.
   */
  entry?: CreditLedgerEntry | undefined;
  /**
   * True when the idempotency key had already been applied and this call
   * appended nothing. Callers that count entries rely on this flag rather than
   * diffing lengths.
   */
  replayed: boolean;
}>;

/**
 * Derive a contract-valid entry id from an idempotency key.
 *
 * Idempotency keys are namespaced (`stripe-event:evt_1`), but `entryId` is a
 * url-safe identifier with no `:`, so the key cannot be used verbatim. The
 * readable part is sanitized for humans reading the ledger, and a digest of the
 * *raw* key is appended so two keys that sanitize to the same text still get
 * distinct ids — the database enforces `entryId` uniqueness, so a collision
 * would be a hard failure rather than a silent merge.
 */
export function deriveEntryId(idempotencyKey: string): string {
  const readable = idempotencyKey.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 96);
  const digest = createHash("sha256")
    .update(idempotencyKey, "utf8")
    .digest("hex")
    .slice(0, 12);
  return `ent_${readable}_${digest}`;
}

/** Empty ledger for a fresh account. Balance starts derived at zero. */
export function createLedgerState(account: CreditAccount): LedgerState {
  return Object.freeze({
    account,
    entries: Object.freeze([]),
    balance: 0,
  });
}

/**
 * Derive a balance from an entry list, refusing a list that could not have come
 * from this ledger: gaps, reuse, or reordering. A silent `reduce` over deltas
 * would happily total a corrupted list.
 */
export function deriveBalance(
  entries: unknown,
): BillingOutcome<number> {
  const snapshot = snapshotPlainArray(entries);
  if (snapshot === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "A ledger entry list must be a plain array.",
    );
  }

  let balance = 0;
  let expectedSequence = 1;
  const seenKeys = new Set<string>();

  for (const candidate of snapshot) {
    const entry = validateCreditLedgerEntry(candidate);
    if (!entry.ok) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.entryInvalid,
        `A ledger entry is invalid (${entry.code}): ${entry.message}`,
      );
    }
    if (entry.value.sequence !== expectedSequence) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerOrderInvalid,
        `Ledger entry sequence ${entry.value.sequence} breaks the expected order at ${expectedSequence}; the list is gapped, reordered, or reuses a sequence.`,
      );
    }
    if (seenKeys.has(entry.value.idempotencyKey)) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerOrderInvalid,
        `Ledger idempotency key "${entry.value.idempotencyKey}" appears more than once.`,
      );
    }
    seenKeys.add(entry.value.idempotencyKey);

    balance += entry.value.delta;
    if (balance !== entry.value.balanceAfter) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerOrderInvalid,
        `Ledger entry ${entry.value.entryId} claims balanceAfter ${entry.value.balanceAfter} but the derived balance is ${balance}.`,
      );
    }
    if (balance < 0) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerOrderInvalid,
        "A ledger balance went negative; the entry list is not a valid history.",
      );
    }
    expectedSequence += 1;
  }

  return billingOk(balance);
}

/**
 * Rebuild state from persisted entries, validating the whole history first so a
 * corrupted ledger refuses at load rather than producing plausible arithmetic.
 */
export function loadLedgerState(
  account: CreditAccount,
  entries: unknown,
): BillingOutcome<LedgerState> {
  const snapshot = snapshotPlainArray(entries);
  if (snapshot === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "A ledger entry list must be a plain array.",
    );
  }
  const foreign = snapshot.find((entry) => {
    const record = snapshotPlainRecord(entry);
    return record !== undefined && record["accountId"] !== account.accountId;
  });
  if (foreign !== undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "A ledger entry belongs to a different account.",
    );
  }

  const balance = deriveBalance(snapshot);
  if (!balance.ok) return balance;

  const validated: CreditLedgerEntry[] = [];
  for (const candidate of snapshot) {
    const entry = validateCreditLedgerEntry(candidate);
    if (!entry.ok) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.entryInvalid,
        `A ledger entry is invalid (${entry.code}): ${entry.message}`,
      );
    }
    validated.push(entry.value);
  }

  return billingOk(
    Object.freeze({
      account,
      entries: Object.freeze(validated),
      balance: balance.value,
    }),
  );
}

/**
 * Validate a whole ledger state at the shared boundary every consumer crosses.
 *
 * Balance is derived from the entry history and compared to the stored `balance`,
 * and every entry is bound to `state.account`, so a forged witness such as
 * `{ entries: [], balance: 100 }` or a state mixing two accounts' histories is
 * refused rather than trusted for a charge or a spend.
 */
export function validateLedgerState(
  state: unknown,
): BillingOutcome<LedgerState> {
  const stateRecord = snapshotPlainRecord(state);
  const accountRecord = snapshotPlainRecord(stateRecord?.["account"]);
  const entries = snapshotPlainArray(stateRecord?.["entries"]);
  if (
    stateRecord === undefined ||
    accountRecord === undefined ||
    entries === undefined ||
    typeof stateRecord["balance"] !== "number"
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "The ledger state is not a valid ledger state.",
    );
  }
  const account = validateCreditAccount(accountRecord);
  if (!account.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      `The ledger account is invalid (${account.code}): ${account.message}`,
    );
  }
  for (const candidate of entries) {
    const entryRecord = snapshotPlainRecord(candidate);
    if (
      entryRecord === undefined ||
      entryRecord["accountId"] !== account.value.accountId
    ) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerStateInvalid,
        "A ledger entry belongs to a different account.",
      );
    }
  }
  const derived = deriveBalance(entries);
  if (!derived.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      `The ledger history is invalid (${derived.reason}): ${derived.message}`,
    );
  }
  if (derived.value !== stateRecord["balance"]) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      `The ledger balance ${stateRecord["balance"]} does not match the derived balance ${derived.value}; balance is derived, never stored as a source of truth.`,
    );
  }
  const validated: CreditLedgerEntry[] = [];
  for (const candidate of entries) {
    const entry = validateCreditLedgerEntry(candidate);
    if (!entry.ok) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.entryInvalid,
        `A ledger entry is invalid (${entry.code}): ${entry.message}`,
      );
    }
    validated.push(entry.value);
  }
  return billingOk(
    Object.freeze({
      account: account.value,
      entries: Object.freeze(validated),
      balance: derived.value,
    }),
  );
}

function sameMovement(
  entry: CreditLedgerEntry,
  request: AppendCreditEntryRequest,
): boolean {
  return (
    entry.movement === request.movement &&
    entry.delta === request.delta &&
    entry.reason === request.reason
  );
}

/**
 * Append one entry, or refuse.
 *
 * Replay handling compares the *semantic* payload (movement, delta, reason) and
 * ignores `entryId`, because a retrying caller legitimately generates a fresh
 * id. An identical retry returns the existing entry with `replayed: true`; the
 * same key carrying different money is a conflict, so a mutated replay can never
 * top up a balance.
 */
export function appendCreditEntry(
  state: unknown,
  request: unknown,
): BillingOutcome<AppendOutcome> {
  const validatedState = validateLedgerState(state);
  if (!validatedState.ok) return validatedState;
  const current = validatedState.value;

  const requestRecord = snapshotPlainRecord(request);
  if (requestRecord === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A ledger append request must be a plain object.",
    );
  }
  const {
    entryId,
    movement,
    delta,
    reason,
    idempotencyKey,
    now,
  } = requestRecord;

  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "A ledger append requires valid epoch milliseconds.",
    );
  }
  if (
    typeof entryId !== "string" ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length === 0 ||
    typeof reason !== "string" ||
    reason.trim().length === 0
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A ledger append requires an entryId, a non-empty idempotencyKey, and a non-empty reason.",
    );
  }
  if (typeof delta !== "number" || !Number.isSafeInteger(delta) || delta === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A ledger delta must be a non-zero safe integer.",
    );
  }
  if (movement === "grant" && delta < 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.deltaSignMismatch,
      "A grant must carry a positive delta.",
    );
  }
  if (movement === "debit" && delta > 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.deltaSignMismatch,
      "A debit must carry a negative delta.",
    );
  }

  const existing = current.entries.find(
    (entry) => entry.idempotencyKey === idempotencyKey,
  );
  if (existing !== undefined) {
    const asRequest = {
      entryId,
      movement,
      delta,
      reason,
      idempotencyKey,
      now,
    } as AppendCreditEntryRequest;
    if (!sameMovement(existing, asRequest)) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.idempotencyConflict,
        `Idempotency key "${idempotencyKey}" was already applied with a different movement; a mutated replay is refused.`,
      );
    }
    return billingOk(
      Object.freeze({ state: current, entry: existing, replayed: true }),
    );
  }

  const balanceAfter = current.balance + delta;
  if (balanceAfter < 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.balanceInsufficient,
      `Balance ${current.balance} cannot absorb a ${delta} credit movement; nothing was appended.`,
    );
  }
  if (!Number.isSafeInteger(balanceAfter)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "The resulting balance would leave the safe integer range.",
    );
  }

  const candidate = {
    schemaVersion: 1 as const,
    kind: "sceneaxi.credit-ledger-entry" as const,
    entryId,
    accountId: current.account.accountId,
    sequence: current.entries.length + 1,
    movement,
    delta,
    balanceAfter,
    reason,
    idempotencyKey,
    occurredAt: new Date(now).toISOString(),
  };

  const entry = validateCreditLedgerEntry(candidate);
  if (!entry.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.entryInvalid,
      `The ledger entry would be invalid (${entry.code}): ${entry.message}`,
    );
  }

  return billingOk(
    Object.freeze({
      state: Object.freeze({
        account: current.account,
        entries: Object.freeze([...current.entries, entry.value]),
        balance: balanceAfter,
      }),
      entry: entry.value,
      replayed: false,
    }),
  );
}
