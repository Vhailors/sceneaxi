/**
 * Creator revenue share records (v1).
 *
 * The split is **integer arithmetic on basis points**: `floor(amount × 5000 /
 * 10000)` to the creator, remainder to the platform. No floating point, so the
 * result is exactly reproducible in any language and can never mint a fractional
 * credit or lose a minor unit. Both record types assert
 * `creator + platform === gross` as a *contract* invariant, so a split that
 * created or destroyed value cannot be persisted at all.
 *
 * `MoneySplitRecord` is **bookkeeping only**. It deliberately has no payout,
 * transfer, destination, or Connect-account field: real cash payouts to creators
 * are a later captain gate, and a record shaped like a payout instruction would
 * invite one to be attempted.
 *
 * Split behavior and the sale paths live in @sceneaxi/billing; this module is
 * contracts only.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isDateTime,
  isPlainRecord,
  isSafeInteger,
  refuseWith,
  type ContractRefuse,
} from "./record-validation.js";
import { BILLING_MODES, isBillingMode, type BillingMode } from "./billing.js";

export const REVENUE_SHARE_SCHEMA_VERSION = 1 as const;

export const CREATOR_SHARE_RECORD_KIND =
  "sceneaxi.creator-share-record" as const;
export const MONEY_SPLIT_RECORD_KIND = "sceneaxi.money-split-record" as const;

/** The creator's share, in basis points. 5000 = 50%. */
export const CREATOR_SHARE_BASIS_POINTS = 5000 as const;

/** Denominator for basis-point arithmetic. */
export const BASIS_POINTS_TOTAL = 10_000 as const;

export const REVENUE_SHARE_REFUSE_CODES = Object.freeze({
  notObject: "REVENUE_SHARE_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "REVENUE_SHARE_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "REVENUE_SHARE_KIND_MISMATCH",
  missingProperty: "REVENUE_SHARE_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "REVENUE_SHARE_UNEXPECTED_PROPERTY",
  invalidProperty: "REVENUE_SHARE_PROPERTY_INVALID",
  splitDoesNotBalance: "REVENUE_SHARE_SPLIT_DOES_NOT_BALANCE",
  payoutFieldForbidden: "REVENUE_SHARE_PAYOUT_FIELD_FORBIDDEN",
} as const);

export type RevenueShareRefuseCode =
  (typeof REVENUE_SHARE_REFUSE_CODES)[keyof typeof REVENUE_SHARE_REFUSE_CODES];

/**
 * Field names that would turn a bookkeeping record into a payout instruction.
 * Their presence refuses: v1 records balances, it never moves cash.
 */
export const FORBIDDEN_PAYOUT_KEYS = Object.freeze([
  "payout",
  "payoutId",
  "transfer",
  "transferId",
  "destination",
  "connectAccountId",
  "stripeAccountId",
] as const);

/** A credits sale's split. Creator credits land in the creator's own ledger. */
export type CreatorShareRecord = Readonly<{
  schemaVersion: typeof REVENUE_SHARE_SCHEMA_VERSION;
  kind: typeof CREATOR_SHARE_RECORD_KIND;
  saleId: string;
  listingId: string;
  buyerUserId: string;
  creatorUserId: string;
  grossCredits: number;
  creatorCredits: number;
  platformCredits: number;
  basisPoints: number;
  occurredAt: string;
}>;

/** A money sale's split. Bookkeeping only — no payout is performed. */
export type MoneySplitRecord = Readonly<{
  schemaVersion: typeof REVENUE_SHARE_SCHEMA_VERSION;
  kind: typeof MONEY_SPLIT_RECORD_KIND;
  saleId: string;
  listingId: string;
  buyerUserId: string;
  creatorUserId: string;
  grossMinor: number;
  creatorMinor: number;
  platformMinor: number;
  currency: string;
  basisPoints: number;
  mode: BillingMode;
  occurredAt: string;
}>;

export type RevenueShareValidationOk<Value> = Readonly<{
  ok: true;
  value: Value;
}>;

export type RevenueShareValidationRefuse =
  ContractRefuse<RevenueShareRefuseCode>;

export type RevenueShareValidationResult<Value> =
  | RevenueShareValidationOk<Value>
  | RevenueShareValidationRefuse;

const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CURRENCY_RE = /^[a-z]{3}$/;

function ok<Value>(value: Value): RevenueShareValidationOk<Value> {
  return Object.freeze({ ok: true, value });
}

function invalid(detail: string): RevenueShareValidationRefuse {
  return refuseWith(REVENUE_SHARE_REFUSE_CODES.invalidProperty, detail);
}

function screen(
  value: unknown,
  kind: string,
  label: string,
  required: ReadonlyArray<string>,
): Record<string, unknown> | RevenueShareValidationRefuse {
  if (!isPlainRecord(value)) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.notObject,
      `A ${label} must be a plain JSON object.`,
    );
  }
  const payout = FORBIDDEN_PAYOUT_KEYS.find((key) => Object.hasOwn(value, key));
  if (payout !== undefined) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.payoutFieldForbidden,
      `A ${label} must not carry a payout field ("${payout}"); v1 records balances and performs no cash payout. Real payouts are a later captain gate.`,
    );
  }
  if (value["schemaVersion"] !== REVENUE_SHARE_SCHEMA_VERSION) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.schemaVersionMismatch,
      `${label} schemaVersion must be ${REVENUE_SHARE_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (value["kind"] !== kind) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.kindMismatch,
      `${label} kind must be "${kind}".`,
    );
  }
  const missing = firstMissingKey(value, required);
  if (missing !== undefined) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.missingProperty,
      `${label} is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, required);
  if (unexpected !== undefined) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.unexpectedProperty,
      `${label} has unexpected property "${unexpected}".`,
    );
  }
  return value;
}

function isRefuse(
  value: Record<string, unknown> | RevenueShareValidationRefuse,
): value is RevenueShareValidationRefuse {
  return "ok" in value && value.ok === false;
}

/** Shared party/identity checks; both record types name the same four things. */
function checkParties(
  record: Record<string, unknown>,
  label: string,
): RevenueShareValidationRefuse | undefined {
  const saleId = record["saleId"];
  if (typeof saleId !== "string" || !IDENTIFIER_RE.test(saleId)) {
    return invalid(`${label} saleId must be a url-safe identifier.`);
  }
  const listingId = record["listingId"];
  if (typeof listingId !== "string" || !SLUG_RE.test(listingId)) {
    return invalid(`${label} listingId must be a lowercase slug of 1-64 chars.`);
  }
  for (const key of ["buyerUserId", "creatorUserId"]) {
    const value = record[key];
    if (typeof value !== "string" || !IDENTIFIER_RE.test(value)) {
      return invalid(`${label} ${key} must be a url-safe identifier.`);
    }
  }
  if (record["buyerUserId"] === record["creatorUserId"]) {
    return invalid(
      `${label} buyer and creator must differ; a seller cannot buy their own listing.`,
    );
  }
  if (record["basisPoints"] !== CREATOR_SHARE_BASIS_POINTS) {
    return invalid(
      `${label} basisPoints must be ${CREATOR_SHARE_BASIS_POINTS}; any other split needs a captain decision.`,
    );
  }
  if (!isDateTime(record["occurredAt"])) {
    return invalid(
      `${label} occurredAt must be an RFC 3339 date-time with an explicit timezone.`,
    );
  }
  return undefined;
}

const CREATOR_SHARE_REQUIRED = Object.freeze([
  "schemaVersion",
  "kind",
  "saleId",
  "listingId",
  "buyerUserId",
  "creatorUserId",
  "grossCredits",
  "creatorCredits",
  "platformCredits",
  "basisPoints",
  "occurredAt",
]);

export function validateCreatorShareRecord(
  value: unknown,
): RevenueShareValidationResult<CreatorShareRecord> {
  const record = screen(
    value,
    CREATOR_SHARE_RECORD_KIND,
    "creator share record",
    CREATOR_SHARE_REQUIRED,
  );
  if (isRefuse(record)) return record;

  const parties = checkParties(record, "creator share record");
  if (parties !== undefined) return parties;

  const grossCredits = record["grossCredits"];
  const creatorCredits = record["creatorCredits"];
  const platformCredits = record["platformCredits"];
  if (!isSafeInteger(grossCredits) || grossCredits < 1) {
    return invalid(
      "creator share record grossCredits must be a positive safe integer.",
    );
  }
  if (!isSafeInteger(creatorCredits) || creatorCredits < 0) {
    return invalid(
      "creator share record creatorCredits must be a non-negative safe integer.",
    );
  }
  if (!isSafeInteger(platformCredits) || platformCredits < 0) {
    return invalid(
      "creator share record platformCredits must be a non-negative safe integer.",
    );
  }
  if (creatorCredits + platformCredits !== grossCredits) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.splitDoesNotBalance,
      `creator share record must balance: ${creatorCredits} + ${platformCredits} !== ${grossCredits}. A split may never create or destroy credits.`,
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: REVENUE_SHARE_SCHEMA_VERSION,
      kind: CREATOR_SHARE_RECORD_KIND,
      saleId: record["saleId"] as string,
      listingId: record["listingId"] as string,
      buyerUserId: record["buyerUserId"] as string,
      creatorUserId: record["creatorUserId"] as string,
      grossCredits,
      creatorCredits,
      platformCredits,
      basisPoints: CREATOR_SHARE_BASIS_POINTS,
      occurredAt: record["occurredAt"] as string,
    }),
  );
}

const MONEY_SPLIT_REQUIRED = Object.freeze([
  "schemaVersion",
  "kind",
  "saleId",
  "listingId",
  "buyerUserId",
  "creatorUserId",
  "grossMinor",
  "creatorMinor",
  "platformMinor",
  "currency",
  "basisPoints",
  "mode",
  "occurredAt",
]);

export function validateMoneySplitRecord(
  value: unknown,
): RevenueShareValidationResult<MoneySplitRecord> {
  const record = screen(
    value,
    MONEY_SPLIT_RECORD_KIND,
    "money split record",
    MONEY_SPLIT_REQUIRED,
  );
  if (isRefuse(record)) return record;

  const parties = checkParties(record, "money split record");
  if (parties !== undefined) return parties;

  const grossMinor = record["grossMinor"];
  const creatorMinor = record["creatorMinor"];
  const platformMinor = record["platformMinor"];
  if (!isSafeInteger(grossMinor) || grossMinor < 1) {
    return invalid(
      "money split record grossMinor must be a positive safe integer in the currency's minor unit.",
    );
  }
  if (!isSafeInteger(creatorMinor) || creatorMinor < 0) {
    return invalid(
      "money split record creatorMinor must be a non-negative safe integer.",
    );
  }
  if (!isSafeInteger(platformMinor) || platformMinor < 0) {
    return invalid(
      "money split record platformMinor must be a non-negative safe integer.",
    );
  }
  if (creatorMinor + platformMinor !== grossMinor) {
    return refuseWith(
      REVENUE_SHARE_REFUSE_CODES.splitDoesNotBalance,
      `money split record must balance: ${creatorMinor} + ${platformMinor} !== ${grossMinor}. A split may never create or destroy money.`,
    );
  }
  const currency = record["currency"];
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
    return invalid(
      "money split record currency must be a lowercase three-letter ISO 4217 code.",
    );
  }
  const mode = record["mode"];
  if (!isBillingMode(mode)) {
    return invalid(
      `money split record mode must be one of ${BILLING_MODES.join(", ")}.`,
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: REVENUE_SHARE_SCHEMA_VERSION,
      kind: MONEY_SPLIT_RECORD_KIND,
      saleId: record["saleId"] as string,
      listingId: record["listingId"] as string,
      buyerUserId: record["buyerUserId"] as string,
      creatorUserId: record["creatorUserId"] as string,
      grossMinor,
      creatorMinor,
      platformMinor,
      currency,
      basisPoints: CREATOR_SHARE_BASIS_POINTS,
      mode,
      occurredAt: record["occurredAt"] as string,
    }),
  );
}
