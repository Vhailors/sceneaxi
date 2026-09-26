import { isBillingMode, type BillingMode } from "./billing.js";
import {
  isDateTime,
  isNonEmptyString,
  isSafeInteger,
  snapshotPlainRecord,
} from "./record-validation.js";

export type CreditReconciliationRecord = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.credit-reconciliation-record";
  eventId: string;
  mode: BillingMode;
  intentId: string;
  userId: string;
  chargeId: string;
  amount: number;
  currency: string;
  occurredAt: string;
  payloadDigest: string;
}> & (
  | Readonly<{
      eventType: "charge.refunded";
      reason: "STRIPE_REFUND_NOT_FULL" | "CREDIT_BALANCE_INSUFFICIENT";
      disputeId: null;
      disputeStatus: null;
    }>
  | Readonly<{
      eventType: "charge.dispute.created" | "charge.dispute.closed";
      reason: "STRIPE_DISPUTE_RECONCILIATION_REQUIRED";
      disputeId: string;
      disputeStatus: string;
    }>
);

const FIELDS = Object.freeze([
  "schemaVersion", "kind", "eventId", "mode", "intentId", "userId", "chargeId",
  "eventType", "reason", "amount", "currency", "disputeId", "disputeStatus",
  "occurredAt", "payloadDigest",
]);

export function validateCreditReconciliationRecord(candidate: unknown):
  | Readonly<{ ok: true; value: CreditReconciliationRecord }>
  | Readonly<{ ok: false; code: "CREDIT_RECONCILIATION_INVALID"; message: string }> {
  const invalid = Object.freeze({
    ok: false as const,
    code: "CREDIT_RECONCILIATION_INVALID" as const,
    message: "Invalid credit reconciliation record.",
  });

  const row = snapshotPlainRecord(candidate);

  if (
    row === undefined ||
    Object.keys(row).length !== FIELDS.length ||
    FIELDS.some((key) => !Object.hasOwn(row, key))
  ) return invalid;

  const {
    schemaVersion, kind, eventId, mode, intentId, userId, chargeId, amount,
    currency, occurredAt, payloadDigest, eventType, reason, disputeId, disputeStatus,
  } = row;

  if (
    schemaVersion !== 1 ||
    kind !== "sceneaxi.credit-reconciliation-record" ||
    !isNonEmptyString(eventId) ||
    !isBillingMode(mode) ||
    !isNonEmptyString(intentId) ||
    !isNonEmptyString(userId) ||
    !isNonEmptyString(chargeId) ||
    !isSafeInteger(amount) || amount <= 0 ||
    !isNonEmptyString(currency) || !/^[a-z]{3}$/.test(currency) ||
    !isDateTime(occurredAt) ||
    !isNonEmptyString(payloadDigest) || !/^[a-f0-9]{64}$/.test(payloadDigest)
  ) return invalid;

  const base = {
    schemaVersion, kind, eventId, mode, intentId, userId, chargeId, amount,
    currency, occurredAt, payloadDigest,
  } as const;

  if (
    eventType === "charge.refunded" &&
    (reason === "STRIPE_REFUND_NOT_FULL" || reason === "CREDIT_BALANCE_INSUFFICIENT") &&
    disputeId === null && disputeStatus === null
  ) {
    return Object.freeze({
      ok: true,
      value: Object.freeze({ ...base, eventType, reason, disputeId, disputeStatus }),
    });
  }

  if (
    (eventType === "charge.dispute.created" || eventType === "charge.dispute.closed") &&
    reason === "STRIPE_DISPUTE_RECONCILIATION_REQUIRED" &&
    isNonEmptyString(disputeId) && isNonEmptyString(disputeStatus)
  ) {
    return Object.freeze({
      ok: true,
      value: Object.freeze({ ...base, eventType, reason, disputeId, disputeStatus }),
    });
  }

  return invalid;
}
