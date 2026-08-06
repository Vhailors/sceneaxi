/**
 * Stripe Connect audit records (v1).
 *
 * These records are deliberately separate from `MoneySplitRecord`: a sale split
 * remains evidence of bookkeeping, while these append-only records describe the
 * provider account, onboarding, observed capability, and payout lifecycle.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isDateTime,
  refuseWith,
  snapshotPlainArray,
  snapshotPlainRecord,
  type ContractRefuse,
} from "./record-validation.js";
import {
  CREATOR_SHARE_BASIS_POINTS,
  validateMoneySplitRecord,
} from "./revenue-share.js";
import { isBillingMode, type BillingMode } from "./billing.js";

export const STRIPE_CONNECT_SCHEMA_VERSION = 1 as const;
export const CONNECT_ACCOUNT_RECORD_KIND = "sceneaxi.connect-account-record" as const;
export const CONNECT_ONBOARDING_INTENT_KIND =
  "sceneaxi.connect-onboarding-intent" as const;
export const CONNECT_STATUS_RECORD_KIND = "sceneaxi.connect-status-record" as const;
export const CONNECT_PAYOUT_INTENT_KIND = "sceneaxi.connect-payout-intent" as const;
export const CONNECT_PAYOUT_OUTCOME_KIND = "sceneaxi.connect-payout-outcome" as const;
export const CONNECT_PAYOUT_STATUSES = Object.freeze([
  "succeeded",
  "failed",
] as const);

export const STRIPE_CONNECT_REFUSE_CODES = Object.freeze({
  notObject: "STRIPE_CONNECT_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "STRIPE_CONNECT_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "STRIPE_CONNECT_KIND_MISMATCH",
  missingProperty: "STRIPE_CONNECT_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "STRIPE_CONNECT_UNEXPECTED_PROPERTY",
  invalidProperty: "STRIPE_CONNECT_PROPERTY_INVALID",
  splitInvalid: "STRIPE_CONNECT_SPLIT_INVALID",
  payoutEvidenceMissing: "STRIPE_CONNECT_PAYOUT_EVIDENCE_MISSING",
} as const);

export type StripeConnectRefuseCode =
  (typeof STRIPE_CONNECT_REFUSE_CODES)[keyof typeof STRIPE_CONNECT_REFUSE_CODES];
export type ConnectPayoutStatus = (typeof CONNECT_PAYOUT_STATUSES)[number];

export type ConnectAccountRecord = Readonly<{
  schemaVersion: typeof STRIPE_CONNECT_SCHEMA_VERSION;
  kind: typeof CONNECT_ACCOUNT_RECORD_KIND;
  creatorUserId: string;
  stripeAccountId: string;
  mode: BillingMode;
  providerRequestId: string;
  createdAt: string;
}>;

export type ConnectOnboardingIntent = Readonly<{
  schemaVersion: typeof STRIPE_CONNECT_SCHEMA_VERSION;
  kind: typeof CONNECT_ONBOARDING_INTENT_KIND;
  onboardingIntentId: string;
  creatorUserId: string;
  stripeAccountId: string;
  expiresAt: string;
  mode: BillingMode;
  idempotencyKey: string;
  providerRequestId: string;
  createdAt: string;
}>;

export type ConnectStatusRecord = Readonly<{
  schemaVersion: typeof STRIPE_CONNECT_SCHEMA_VERSION;
  kind: typeof CONNECT_STATUS_RECORD_KIND;
  statusId: string;
  creatorUserId: string;
  stripeAccountId: string;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  requirementsDue: ReadonlyArray<string>;
  providerRequestId: string;
  observedAt: string;
}>;

export type ConnectPayoutIntent = Readonly<{
  schemaVersion: typeof STRIPE_CONNECT_SCHEMA_VERSION;
  kind: typeof CONNECT_PAYOUT_INTENT_KIND;
  payoutIntentId: string;
  saleId: string;
  creatorUserId: string;
  stripeAccountId: string;
  grossMinor: number;
  creatorMinor: number;
  platformMinor: number;
  currency: string;
  basisPoints: typeof CREATOR_SHARE_BASIS_POINTS;
  mode: BillingMode;
  idempotencyKey: string;
  requestedAt: string;
}>;

export type ConnectPayoutOutcome = Readonly<{
  schemaVersion: typeof STRIPE_CONNECT_SCHEMA_VERSION;
  kind: typeof CONNECT_PAYOUT_OUTCOME_KIND;
  payoutOutcomeId: string;
  payoutIntentId: string;
  status: ConnectPayoutStatus;
  providerPayoutId: string | null;
  providerEvidenceId: string;
  providerMessage: string;
  observedAt: string;
}>;

export type StripeConnectValidationResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | ContractRefuse<StripeConnectRefuseCode>;

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const CURRENCY_RE = /^[a-z]{3}$/;

const ok = <Value>(value: Value) => Object.freeze({ ok: true as const, value });
const invalid = (message: string) =>
  refuseWith(STRIPE_CONNECT_REFUSE_CODES.invalidProperty, message);

function screen(
  candidate: unknown,
  kind: string,
  label: string,
  required: ReadonlyArray<string>,
): Readonly<Record<string, unknown>> | ContractRefuse<StripeConnectRefuseCode> {
  const record = snapshotPlainRecord(candidate);
  if (record === undefined) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.notObject,
      `A ${label} must be a plain JSON object.`,
    );
  }
  if (record["schemaVersion"] !== STRIPE_CONNECT_SCHEMA_VERSION) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.schemaVersionMismatch,
      `${label} schemaVersion must be ${STRIPE_CONNECT_SCHEMA_VERSION}.`,
    );
  }
  if (record["kind"] !== kind) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.kindMismatch,
      `${label} kind must be "${kind}".`,
    );
  }
  const missing = firstMissingKey(record, required);
  if (missing !== undefined) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.missingProperty,
      `${label} is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(record, required);
  if (unexpected !== undefined) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.unexpectedProperty,
      `${label} has unexpected property "${unexpected}".`,
    );
  }
  return record;
}

function isRefuse(
  value: Readonly<Record<string, unknown>> | ContractRefuse<StripeConnectRefuseCode>,
): value is ContractRefuse<StripeConnectRefuseCode> {
  return "ok" in value && value.ok === false;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

function validCommonProviderRecord(record: Readonly<Record<string, unknown>>) {
  return (
    validId(record["creatorUserId"]) &&
    validId(record["stripeAccountId"]) &&
    validId(record["providerRequestId"])
  );
}

const ACCOUNT_FIELDS = Object.freeze([
  "schemaVersion",
  "kind",
  "creatorUserId",
  "stripeAccountId",
  "mode",
  "providerRequestId",
  "createdAt",
]);

export function validateConnectAccountRecord(
  candidate: unknown,
): StripeConnectValidationResult<ConnectAccountRecord> {
  const record = screen(
    candidate,
    CONNECT_ACCOUNT_RECORD_KIND,
    "Connect account record",
    ACCOUNT_FIELDS,
  );
  if (isRefuse(record)) return record;
  if (
    !validCommonProviderRecord(record) ||
    !isBillingMode(record["mode"]) ||
    !isDateTime(record["createdAt"])
  ) {
    return invalid("A Connect account record carries an invalid property.");
  }
  return ok(Object.freeze({ ...record }) as ConnectAccountRecord);
}

const ONBOARDING_FIELDS = Object.freeze([
  "schemaVersion",
  "kind",
  "onboardingIntentId",
  "creatorUserId",
  "stripeAccountId",
  "expiresAt",
  "mode",
  "idempotencyKey",
  "providerRequestId",
  "createdAt",
]);

export function validateConnectOnboardingIntent(
  candidate: unknown,
): StripeConnectValidationResult<ConnectOnboardingIntent> {
  const record = screen(
    candidate,
    CONNECT_ONBOARDING_INTENT_KIND,
    "Connect onboarding intent",
    ONBOARDING_FIELDS,
  );
  if (isRefuse(record)) return record;
  if (
    !validCommonProviderRecord(record) ||
    !validId(record["onboardingIntentId"]) ||
    !validId(record["idempotencyKey"]) ||
    !isDateTime(record["expiresAt"]) ||
    !isBillingMode(record["mode"]) ||
    !isDateTime(record["createdAt"]) ||
    Date.parse(record["expiresAt"] as string) <= Date.parse(record["createdAt"] as string)
  ) {
    return invalid("A Connect onboarding intent carries an invalid property.");
  }
  return ok(Object.freeze({ ...record }) as ConnectOnboardingIntent);
}

const STATUS_FIELDS = Object.freeze([
  "schemaVersion",
  "kind",
  "statusId",
  "creatorUserId",
  "stripeAccountId",
  "onboardingComplete",
  "payoutsEnabled",
  "requirementsDue",
  "providerRequestId",
  "observedAt",
]);

export function validateConnectStatusRecord(
  candidate: unknown,
): StripeConnectValidationResult<ConnectStatusRecord> {
  const record = screen(
    candidate,
    CONNECT_STATUS_RECORD_KIND,
    "Connect status record",
    STATUS_FIELDS,
  );
  if (isRefuse(record)) return record;
  const requirements = snapshotPlainArray(record["requirementsDue"]);
  if (
    !validCommonProviderRecord(record) ||
    !validId(record["statusId"]) ||
    typeof record["onboardingComplete"] !== "boolean" ||
    typeof record["payoutsEnabled"] !== "boolean" ||
    requirements === undefined ||
    requirements.some((item) => !validId(item)) ||
    !isDateTime(record["observedAt"])
  ) {
    return invalid("A Connect status record carries an invalid property.");
  }
  return ok(
    Object.freeze({
      ...record,
      requirementsDue: Object.freeze([...requirements]) as ReadonlyArray<string>,
    }) as ConnectStatusRecord,
  );
}

const PAYOUT_INTENT_FIELDS = Object.freeze([
  "schemaVersion",
  "kind",
  "payoutIntentId",
  "saleId",
  "creatorUserId",
  "stripeAccountId",
  "grossMinor",
  "creatorMinor",
  "platformMinor",
  "currency",
  "basisPoints",
  "mode",
  "idempotencyKey",
  "requestedAt",
]);

export function validateConnectPayoutIntent(
  candidate: unknown,
): StripeConnectValidationResult<ConnectPayoutIntent> {
  const record = screen(
    candidate,
    CONNECT_PAYOUT_INTENT_KIND,
    "Connect payout intent",
    PAYOUT_INTENT_FIELDS,
  );
  if (isRefuse(record)) return record;
  const gross = record["grossMinor"];
  const creator = record["creatorMinor"];
  const platform = record["platformMinor"];
  if (
    !validId(record["payoutIntentId"]) ||
    !validId(record["saleId"]) ||
    !validId(record["creatorUserId"]) ||
    !validId(record["stripeAccountId"]) ||
    !Number.isSafeInteger(gross) ||
    !Number.isSafeInteger(creator) ||
    !Number.isSafeInteger(platform) ||
    (gross as number) < 1 ||
    (creator as number) < 0 ||
    (platform as number) < 0 ||
    (creator as number) + (platform as number) !== gross ||
    creator !==
      Number(
        (BigInt(gross as number) * BigInt(CREATOR_SHARE_BASIS_POINTS)) /
          10_000n,
      ) ||
    record["basisPoints"] !== CREATOR_SHARE_BASIS_POINTS ||
    typeof record["currency"] !== "string" ||
    !CURRENCY_RE.test(record["currency"]) ||
    !isBillingMode(record["mode"]) ||
    !validId(record["idempotencyKey"]) ||
    !isDateTime(record["requestedAt"])
  ) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.splitInvalid,
      "A Connect payout intent must preserve the exact 5000-basis-point money split.",
    );
  }
  return ok(Object.freeze({ ...record }) as ConnectPayoutIntent);
}

const PAYOUT_OUTCOME_FIELDS = Object.freeze([
  "schemaVersion",
  "kind",
  "payoutOutcomeId",
  "payoutIntentId",
  "status",
  "providerPayoutId",
  "providerEvidenceId",
  "providerMessage",
  "observedAt",
]);

export function validateConnectPayoutOutcome(
  candidate: unknown,
): StripeConnectValidationResult<ConnectPayoutOutcome> {
  const record = screen(
    candidate,
    CONNECT_PAYOUT_OUTCOME_KIND,
    "Connect payout outcome",
    PAYOUT_OUTCOME_FIELDS,
  );
  if (isRefuse(record)) return record;
  const status = record["status"];
  const providerPayoutId = record["providerPayoutId"];
  if (
    !validId(record["payoutOutcomeId"]) ||
    !validId(record["payoutIntentId"]) ||
    !CONNECT_PAYOUT_STATUSES.some((known) => known === status) ||
    !validId(record["providerEvidenceId"]) ||
    typeof record["providerMessage"] !== "string" ||
    record["providerMessage"].length > 1000 ||
    !isDateTime(record["observedAt"]) ||
    (status === "succeeded" && !validId(providerPayoutId)) ||
    (status === "failed" && providerPayoutId !== null)
  ) {
    return refuseWith(
      STRIPE_CONNECT_REFUSE_CODES.payoutEvidenceMissing,
      "A Connect payout outcome requires provider evidence, and success additionally requires a provider payout id.",
    );
  }
  return ok(Object.freeze({ ...record }) as ConnectPayoutOutcome);
}

/** Revalidate a money split and prove a payout intent is its exact creator leg. */
export function connectPayoutMatchesMoneySplit(
  intent: ConnectPayoutIntent,
  split: unknown,
): boolean {
  const validated = validateMoneySplitRecord(split);
  return (
    validated.ok &&
    validated.value.saleId === intent.saleId &&
    validated.value.creatorUserId === intent.creatorUserId &&
    validated.value.grossMinor === intent.grossMinor &&
    validated.value.creatorMinor === intent.creatorMinor &&
    validated.value.platformMinor === intent.platformMinor &&
    validated.value.currency === intent.currency &&
    validated.value.basisPoints === intent.basisPoints &&
    validated.value.mode === intent.mode
  );
}
