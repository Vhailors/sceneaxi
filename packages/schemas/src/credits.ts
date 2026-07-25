/**
 * SceneAxi credit contracts (v1) — CreditAccount and CreditLedgerEntry.
 *
 * `CreditAccount` deliberately has **no balance field**. A stored balance is a
 * second source of truth that can drift from the ledger; here the ledger is the
 * only record and the balance is always derived from it. `balanceAfter` on each
 * entry is a checkable witness of that derivation, not an independent store.
 *
 * Ledger behavior (append, idempotency, metering) lives in @sceneaxi/billing;
 * this module is contracts only.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isDateTime,
  isNonEmptyString,
  isPlainRecord,
  isSafeInteger,
  refuseWith,
  type ContractRefuse,
} from "./record-validation.js";

/** Contract major version for the credits plane. */
export const CREDITS_SCHEMA_VERSION = 1 as const;

export const CREDIT_ACCOUNT_KIND = "sceneaxi.credit-account" as const;
export const CREDIT_LEDGER_ENTRY_KIND =
  "sceneaxi.credit-ledger-entry" as const;

/**
 * Ledger movements. `grant` adds (purchase, admin gift), `debit` subtracts
 * (metered usage), `adjustment` is an admin correction in either direction and
 * therefore always requires a reason.
 */
export const CREDIT_MOVEMENTS = Object.freeze([
  "grant",
  "debit",
  "adjustment",
] as const);

export const CREDITS_REFUSE_CODES = Object.freeze({
  notObject: "CREDITS_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "CREDITS_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "CREDITS_KIND_MISMATCH",
  missingProperty: "CREDITS_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "CREDITS_UNEXPECTED_PROPERTY",
  invalidProperty: "CREDITS_PROPERTY_INVALID",
  deltaSignMismatch: "CREDITS_DELTA_SIGN_MISMATCH",
  balanceNegative: "CREDITS_BALANCE_NEGATIVE",
} as const);

export type CreditsRefuseCode =
  (typeof CREDITS_REFUSE_CODES)[keyof typeof CREDITS_REFUSE_CODES];

export type CreditMovement = (typeof CREDIT_MOVEMENTS)[number];

/** A credit account. Balance is derived from the ledger, never stored here. */
export type CreditAccount = {
  readonly schemaVersion: typeof CREDITS_SCHEMA_VERSION;
  readonly kind: typeof CREDIT_ACCOUNT_KIND;
  readonly accountId: string;
  readonly userId: string;
  readonly createdAt: string;
};

/** One immutable ledger row. Entries are appended, never edited or removed. */
export type CreditLedgerEntry = {
  readonly schemaVersion: typeof CREDITS_SCHEMA_VERSION;
  readonly kind: typeof CREDIT_LEDGER_ENTRY_KIND;
  readonly entryId: string;
  readonly accountId: string;
  /** 1-based, strictly monotonic per account. Gaps and reuse are refused. */
  readonly sequence: number;
  readonly movement: CreditMovement;
  /** Non-zero integer credit delta; sign is fixed by `movement`. */
  readonly delta: number;
  /** Derived balance witness: previous balance + delta. Never negative. */
  readonly balanceAfter: number;
  readonly reason: string;
  /** Replay key. The same key must never produce a second entry. */
  readonly idempotencyKey: string;
  readonly occurredAt: string;
};

export type CreditsValidationOk<Value> = {
  readonly ok: true;
  readonly value: Value;
};

export type CreditsValidationRefuse = ContractRefuse<CreditsRefuseCode>;

export type CreditsValidationResult<Value> =
  | CreditsValidationOk<Value>
  | CreditsValidationRefuse;

const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Idempotency keys are namespaced (`stripe-event:evt_1`), so `:` is allowed. */
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

export function isCreditMovement(value: unknown): value is CreditMovement {
  return CREDIT_MOVEMENTS.some((movement) => movement === value);
}

function ok<Value>(value: Value): CreditsValidationOk<Value> {
  return Object.freeze({ ok: true, value });
}

function invalid(detail: string): CreditsValidationRefuse {
  return refuseWith(CREDITS_REFUSE_CODES.invalidProperty, detail);
}

function checkEnvelope(
  value: unknown,
  kind: string,
  label: string,
  required: ReadonlyArray<string>,
): Record<string, unknown> | CreditsValidationRefuse {
  if (!isPlainRecord(value)) {
    return refuseWith(
      CREDITS_REFUSE_CODES.notObject,
      `A ${label} must be a plain JSON object.`,
    );
  }
  if (value["schemaVersion"] !== CREDITS_SCHEMA_VERSION) {
    return refuseWith(
      CREDITS_REFUSE_CODES.schemaVersionMismatch,
      `${label} schemaVersion must be ${CREDITS_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (value["kind"] !== kind) {
    return refuseWith(
      CREDITS_REFUSE_CODES.kindMismatch,
      `${label} kind must be "${kind}".`,
    );
  }
  const missing = firstMissingKey(value, required);
  if (missing !== undefined) {
    return refuseWith(
      CREDITS_REFUSE_CODES.missingProperty,
      `${label} is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, required);
  if (unexpected !== undefined) {
    return refuseWith(
      CREDITS_REFUSE_CODES.unexpectedProperty,
      `${label} has unexpected property "${unexpected}".`,
    );
  }
  return value;
}

function isRefuse(
  value: Record<string, unknown> | CreditsValidationRefuse,
): value is CreditsValidationRefuse {
  return "ok" in value && value.ok === false;
}

const CREDIT_ACCOUNT_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "accountId",
  "userId",
  "createdAt",
]);

export function validateCreditAccount(
  value: unknown,
): CreditsValidationResult<CreditAccount> {
  const record = checkEnvelope(
    value,
    CREDIT_ACCOUNT_KIND,
    "credit account",
    CREDIT_ACCOUNT_KEYS,
  );
  if (isRefuse(record)) return record;

  const accountId = record["accountId"];
  if (typeof accountId !== "string" || !IDENTIFIER_RE.test(accountId)) {
    return invalid(
      "credit account accountId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const userId = record["userId"];
  if (typeof userId !== "string" || !IDENTIFIER_RE.test(userId)) {
    return invalid(
      "credit account userId must be a url-safe identifier of 1-128 chars.",
    );
  }
  if (!isDateTime(record["createdAt"])) {
    return invalid(
      "credit account createdAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: CREDITS_SCHEMA_VERSION,
      kind: CREDIT_ACCOUNT_KIND,
      accountId,
      userId,
      createdAt: record["createdAt"],
    }),
  );
}

const CREDIT_LEDGER_ENTRY_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "entryId",
  "accountId",
  "sequence",
  "movement",
  "delta",
  "balanceAfter",
  "reason",
  "idempotencyKey",
  "occurredAt",
]);

export function validateCreditLedgerEntry(
  value: unknown,
): CreditsValidationResult<CreditLedgerEntry> {
  const record = checkEnvelope(
    value,
    CREDIT_LEDGER_ENTRY_KIND,
    "credit ledger entry",
    CREDIT_LEDGER_ENTRY_KEYS,
  );
  if (isRefuse(record)) return record;

  const entryId = record["entryId"];
  if (typeof entryId !== "string" || !IDENTIFIER_RE.test(entryId)) {
    return invalid(
      "credit ledger entry entryId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const accountId = record["accountId"];
  if (typeof accountId !== "string" || !IDENTIFIER_RE.test(accountId)) {
    return invalid(
      "credit ledger entry accountId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const sequence = record["sequence"];
  if (!isSafeInteger(sequence) || sequence < 1) {
    return invalid(
      "credit ledger entry sequence must be a positive safe integer (1-based).",
    );
  }
  const movement = record["movement"];
  if (!isCreditMovement(movement)) {
    return invalid(
      `credit ledger entry movement must be one of ${CREDIT_MOVEMENTS.join(", ")}.`,
    );
  }
  const delta = record["delta"];
  if (!isSafeInteger(delta) || delta === 0) {
    return invalid(
      "credit ledger entry delta must be a non-zero safe integer.",
    );
  }
  if (movement === "grant" && delta < 0) {
    return refuseWith(
      CREDITS_REFUSE_CODES.deltaSignMismatch,
      "a grant must carry a positive delta.",
    );
  }
  if (movement === "debit" && delta > 0) {
    return refuseWith(
      CREDITS_REFUSE_CODES.deltaSignMismatch,
      "a debit must carry a negative delta.",
    );
  }
  const balanceAfter = record["balanceAfter"];
  if (!isSafeInteger(balanceAfter)) {
    return invalid(
      "credit ledger entry balanceAfter must be a safe integer.",
    );
  }
  if (balanceAfter < 0) {
    return refuseWith(
      CREDITS_REFUSE_CODES.balanceNegative,
      "credit ledger entry balanceAfter must never be negative.",
    );
  }
  if (!isNonEmptyString(record["reason"])) {
    return invalid(
      "credit ledger entry reason must be a non-empty string; every movement is attributable.",
    );
  }
  const idempotencyKey = record["idempotencyKey"];
  if (
    typeof idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_RE.test(idempotencyKey)
  ) {
    return invalid(
      "credit ledger entry idempotencyKey must be a namespaced key of 1-192 chars.",
    );
  }
  if (!isDateTime(record["occurredAt"])) {
    return invalid(
      "credit ledger entry occurredAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: CREDITS_SCHEMA_VERSION,
      kind: CREDIT_LEDGER_ENTRY_KIND,
      entryId,
      accountId,
      sequence,
      movement,
      delta,
      balanceAfter,
      reason: record["reason"],
      idempotencyKey,
      occurredAt: record["occurredAt"],
    }),
  );
}
