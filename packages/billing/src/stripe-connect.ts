/**
 * Stripe Connect creator onboarding and payout bookkeeping.
 *
 * Core owns no Stripe client and never receives a credential. An injected
 * provider reports TEST operational readiness and performs provider calls. The
 * application seam authenticates the creator before reading persistence, keeps
 * every audit record append-only and idempotent, and can only write a successful
 * payout outcome from provider evidence returned inside `requestCreatorPayout`.
 * LIVE is intentionally unreachable; activation remains an operator checklist.
 */

import {
  CONNECT_ACCOUNT_RECORD_KIND,
  CONNECT_ONBOARDING_INTENT_KIND,
  CONNECT_PAYOUT_INTENT_KIND,
  CONNECT_PAYOUT_OUTCOME_KIND,
  CONNECT_STATUS_RECORD_KIND,
  CREATOR_SHARE_BASIS_POINTS,
  STRIPE_CONNECT_SCHEMA_VERSION,
  isEpochMilliseconds,
  isHttpsUrl,
  snapshotPlainArray,
  snapshotPlainRecord,
  validateConnectAccountRecord,
  validateConnectOnboardingIntent,
  validateConnectPayoutIntent,
  validateConnectPayoutOutcome,
  validateConnectStatusRecord,
  validateMoneySplitRecord,
  type BillingMode,
  type ConnectAccountRecord,
  type ConnectOnboardingIntent,
  type ConnectPayoutIntent,
  type ConnectPayoutOutcome,
  type ConnectStatusRecord,
  type IdentitySurface,
  type MoneySplitRecord,
} from "@sceneaxi/schemas";
import {
  requireAuthenticated,
  type AdminIdentity,
  type Awaitable,
} from "@sceneaxi/auth";
import { deriveIntentId } from "./checkout.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

export const CONNECT_PAYOUT_IDEMPOTENCY_PREFIX = "connect-payout:" as const;
export const CONNECT_ONBOARDING_IDEMPOTENCY_PREFIX = "connect-onboarding:" as const;

export type ConnectProviderReadiness = Readonly<{
  mode: BillingMode;
  testOperationsEnabled: boolean;
  dashboardConfigured: boolean;
  secretConfigured: boolean;
}>;

export type ConnectProviderRefusal = Readonly<{
  ok: false;
  code: string;
  message: string;
  /** Provider request/event evidence; required for an auditable payout failure. */
  evidenceId?: string | undefined;
}>;

export type ConnectProviderResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | ConnectProviderRefusal;

export type ConnectOnboardingProviderValue = Readonly<{
  stripeAccountId: string;
  onboardingUrl: string;
  expiresAt: string;
  accountRequestId: string;
  accountCreatedAt: string;
  onboardingRequestId: string;
  onboardingCreatedAt: string;
}>;

export type ConnectStatusProviderValue = Readonly<{
  stripeAccountId: string;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  requirementsDue: ReadonlyArray<string>;
  requestId: string;
  observedAt: string;
}>;

export type ConnectPayoutProviderValue = Readonly<{
  payoutId: string;
  evidenceId: string;
  message: string;
  paidAt: string;
}>;

/** The only external operations needed by the Connect application seam. */
export type StripeConnectProvider = Readonly<{
  readiness: ConnectProviderReadiness;
  createOnboarding(request: {
    creatorUserId: string;
    idempotencyKey: string;
  }): Awaitable<ConnectProviderResult<ConnectOnboardingProviderValue>>;
  retrieveStatus(request: {
    stripeAccountId: string;
  }): Awaitable<ConnectProviderResult<ConnectStatusProviderValue>>;
  createPayout(request: {
    stripeAccountId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    saleId: string;
  }): Awaitable<ConnectProviderResult<ConnectPayoutProviderValue>>;
}>;

export type ConnectCommit<Value> = Readonly<{
  record: Value;
  replayed: boolean;
}>;

export type ConnectOnboardingCommit = Readonly<{
  account: ConnectAccountRecord;
  intent: ConnectOnboardingIntent;
  replayed: boolean;
}>;

export type ConnectPayoutIntentCommit = Readonly<{
  split: MoneySplitRecord;
  intent: ConnectPayoutIntent;
  replayed: boolean;
}>;

/**
 * Append-only persistence port. `commitPayoutIntent` is the atomic precondition:
 * the exact MoneySplitRecord and its creator-leg payout intent commit together.
 */
export type ConnectStore = Readonly<{
  findAccountByCreatorUserId(
    creatorUserId: string,
  ): Awaitable<ConnectAccountRecord | undefined>;
  findOnboardingIntent(
    idempotencyKey: string,
  ): Awaitable<ConnectOnboardingIntent | undefined>;
  commitOnboarding(input: {
    account: ConnectAccountRecord;
    intent: ConnectOnboardingIntent;
  }): Awaitable<ConnectOnboardingCommit>;
  appendStatus(
    status: ConnectStatusRecord,
  ): Awaitable<ConnectCommit<ConnectStatusRecord>>;
  latestStatus(
    stripeAccountId: string,
  ): Awaitable<ConnectStatusRecord | undefined>;
  findPayoutIntent(
    idempotencyKey: string,
  ): Awaitable<ConnectPayoutIntent | undefined>;
  findPayoutOutcome(
    payoutIntentId: string,
  ): Awaitable<ConnectPayoutOutcome | undefined>;
  commitPayoutIntent(input: {
    split: MoneySplitRecord;
    intent: ConnectPayoutIntent;
  }): Awaitable<ConnectPayoutIntentCommit>;
  appendPayoutOutcome(
    outcome: ConnectPayoutOutcome,
  ): Awaitable<ConnectCommit<ConnectPayoutOutcome>>;
}>;

export type InMemoryConnectStore = ConnectStore &
  Readonly<{
    accountCount(): number;
    onboardingIntentCount(): number;
    statusCount(): number;
    moneySplitCount(): number;
    payoutIntentCount(): number;
    payoutOutcomeCount(): number;
  }>;

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/** In-memory reference adapter with the same idempotency conflicts as durable storage. */
export function createInMemoryConnectStore(): InMemoryConnectStore {
  const accounts = new Map<string, ConnectAccountRecord>();
  const onboarding = new Map<string, ConnectOnboardingIntent>();
  const statuses = new Map<string, ConnectStatusRecord>();
  const statusOrder: ConnectStatusRecord[] = [];
  const splits = new Map<string, MoneySplitRecord>();
  const payoutIntents = new Map<string, ConnectPayoutIntent>();
  const payoutOutcomes = new Map<string, ConnectPayoutOutcome>();

  const conflict = (label: string): never => {
    throw new Error(`connect store: ${label} idempotency conflict`);
  };

  return Object.freeze({
    findAccountByCreatorUserId: (creatorUserId) => accounts.get(creatorUserId),
    findOnboardingIntent: (idempotencyKey) => onboarding.get(idempotencyKey),
    commitOnboarding(input) {
      const account = validateConnectAccountRecord(input.account);
      const intent = validateConnectOnboardingIntent(input.intent);
      if (!account.ok || !intent.ok) throw new Error("connect store: invalid onboarding");
      if (
        account.value.creatorUserId !== intent.value.creatorUserId ||
        account.value.stripeAccountId !== intent.value.stripeAccountId ||
        account.value.mode !== intent.value.mode
      ) {
        throw new Error("connect store: onboarding account does not match intent");
      }
      const priorIntent = onboarding.get(intent.value.idempotencyKey);
      const priorAccount = accounts.get(account.value.creatorUserId);
      if (priorIntent !== undefined) {
        if (!same(priorIntent, intent.value) || !same(priorAccount, account.value)) {
          return conflict("onboarding");
        }
        return Object.freeze({
          account: priorAccount,
          intent: priorIntent,
          replayed: true,
        }) as ConnectOnboardingCommit;
      }
      if (priorAccount !== undefined && !same(priorAccount, account.value)) {
        return conflict("creator account");
      }
      accounts.set(account.value.creatorUserId, account.value);
      onboarding.set(intent.value.idempotencyKey, intent.value);
      return Object.freeze({
        account: account.value,
        intent: intent.value,
        replayed: false,
      });
    },
    appendStatus(candidate) {
      const validated = validateConnectStatusRecord(candidate);
      if (!validated.ok) throw new Error("connect store: invalid status");
      const prior = statuses.get(validated.value.statusId);
      if (prior !== undefined) {
        if (!same(prior, validated.value)) return conflict("status");
        return Object.freeze({ record: prior, replayed: true });
      }
      statuses.set(validated.value.statusId, validated.value);
      statusOrder.push(validated.value);
      return Object.freeze({ record: validated.value, replayed: false });
    },
    latestStatus(stripeAccountId) {
      return statusOrder
        .filter((status) => status.stripeAccountId === stripeAccountId)
        .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))[0];
    },
    findPayoutIntent: (idempotencyKey) => payoutIntents.get(idempotencyKey),
    findPayoutOutcome: (payoutIntentId) => payoutOutcomes.get(payoutIntentId),
    commitPayoutIntent(input) {
      const split = validateMoneySplitRecord(input.split);
      const intent = validateConnectPayoutIntent(input.intent);
      if (!split.ok || !intent.ok) throw new Error("connect store: invalid payout intent");
      if (
        split.value.saleId !== intent.value.saleId ||
        split.value.creatorUserId !== intent.value.creatorUserId ||
        split.value.grossMinor !== intent.value.grossMinor ||
        split.value.creatorMinor !== intent.value.creatorMinor ||
        split.value.platformMinor !== intent.value.platformMinor ||
        split.value.currency !== intent.value.currency ||
        split.value.basisPoints !== intent.value.basisPoints ||
        split.value.mode !== intent.value.mode
      ) {
        throw new Error("connect store: payout intent does not match money split");
      }
      const priorIntent = payoutIntents.get(intent.value.idempotencyKey);
      const priorSplit = splits.get(split.value.saleId);
      if (priorIntent !== undefined) {
        if (!same(priorIntent, intent.value) || !same(priorSplit, split.value)) {
          return conflict("payout");
        }
        return Object.freeze({
          split: priorSplit,
          intent: priorIntent,
          replayed: true,
        }) as ConnectPayoutIntentCommit;
      }
      if (priorSplit !== undefined && !same(priorSplit, split.value)) {
        return conflict("money split");
      }
      splits.set(split.value.saleId, split.value);
      payoutIntents.set(intent.value.idempotencyKey, intent.value);
      return Object.freeze({
        split: split.value,
        intent: intent.value,
        replayed: false,
      });
    },
    appendPayoutOutcome(candidate) {
      const validated = validateConnectPayoutOutcome(candidate);
      if (!validated.ok) throw new Error("connect store: invalid payout outcome");
      if (!payoutIntentsHasId(validated.value.payoutIntentId, payoutIntents)) {
        throw new Error("connect store: payout outcome has no committed intent");
      }
      const prior = payoutOutcomes.get(validated.value.payoutIntentId);
      if (prior !== undefined) {
        if (!same(prior, validated.value)) return conflict("payout outcome");
        return Object.freeze({ record: prior, replayed: true });
      }
      payoutOutcomes.set(validated.value.payoutIntentId, validated.value);
      return Object.freeze({ record: validated.value, replayed: false });
    },
    accountCount: () => accounts.size,
    onboardingIntentCount: () => onboarding.size,
    statusCount: () => statuses.size,
    moneySplitCount: () => splits.size,
    payoutIntentCount: () => payoutIntents.size,
    payoutOutcomeCount: () => payoutOutcomes.size,
  });
}

function payoutIntentsHasId(
  payoutIntentId: string,
  intents: ReadonlyMap<string, ConnectPayoutIntent>,
) {
  return [...intents.values()].some((intent) => intent.payoutIntentId === payoutIntentId);
}

function isKids(principal: unknown, surface: unknown) {
  const record = snapshotPlainRecord(principal);
  const session = snapshotPlainRecord(record?.["session"]);
  return surface === "kids" || session?.["surface"] === "kids";
}

function authorizeCreator(input: {
  principal: unknown;
  admin: AdminIdentity;
  creatorUserId: string;
  now: number;
  surface?: IdentitySurface | undefined;
}): BillingOutcome<string> {
  if (isKids(input.principal, input.surface)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.kidsCommerceDenied,
      "Kids commerce is denied before any Connect identity, store, or provider operation.",
    );
  }
  const guarded = requireAuthenticated(
    input.principal,
    input.surface === undefined
      ? { now: input.now, admin: input.admin }
      : { now: input.now, admin: input.admin, surface: input.surface },
  );
  if (!guarded.ok) return billingRefuse(guarded.reason, guarded.message);
  if (guarded.value.user.userId !== input.creatorUserId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "A creator may only operate their own Connect account.",
    );
  }
  return billingOk(guarded.value.user.userId);
}

function readyProvider(provider: StripeConnectProvider | undefined) {
  if (provider === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderMissing,
      "No Stripe Connect provider is configured; the operation refuses.",
    );
  }
  const readiness = snapshotPlainRecord(provider.readiness);
  if (readiness === undefined || readiness["mode"] !== "test") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectLiveUnavailable,
      "Stripe Connect LIVE operations are not implemented; activation remains an operations checklist.",
    );
  }
  if (readiness["testOperationsEnabled"] !== true) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectTestOperationsDisabled,
      "Stripe Connect TEST operations are not explicitly enabled.",
    );
  }
  if (readiness["dashboardConfigured"] !== true) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectDashboardMissing,
      "The Stripe Connect TEST dashboard configuration is missing.",
    );
  }
  if (readiness["secretConfigured"] !== true) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectSecretMissing,
      "The Stripe Connect TEST provider secret is missing; no credential is accepted by core.",
    );
  }
  return billingOk(provider);
}

function providerRefused(value: unknown) {
  const result = snapshotPlainRecord(value);
  return (
    result !== undefined &&
    result["ok"] === false &&
    typeof result["code"] === "string" &&
    typeof result["message"] === "string"
  );
}

function providerFailure(value: unknown, operation: string) {
  if (providerRefused(value)) {
    const result = value as ConnectProviderRefusal;
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderRefused,
      `Stripe Connect refused ${operation} (${result.code}): ${result.message}`,
    );
  }
  return billingRefuse(
    BILLING_REFUSE_REASONS.connectProviderResponseInvalid,
    `Stripe Connect returned an invalid ${operation} response.`,
  );
}

const validId = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(value);

function exactKeys(record: Readonly<Record<string, unknown>>, keys: string[]) {
  return (
    Object.keys(record).length === keys.length &&
    keys.every((key) => Object.hasOwn(record, key))
  );
}

function validateOnboardingProviderValue(value: unknown) {
  const record = snapshotPlainRecord(value);
  if (
    record === undefined ||
    !exactKeys(record, [
      "stripeAccountId",
      "onboardingUrl",
      "expiresAt",
      "accountRequestId",
      "accountCreatedAt",
      "onboardingRequestId",
      "onboardingCreatedAt",
    ]) ||
    !validId(record["stripeAccountId"]) ||
    !validId(record["accountRequestId"]) ||
    !validId(record["onboardingRequestId"]) ||
    !isHttpsUrl(record["onboardingUrl"]) ||
    !Number.isFinite(Date.parse(String(record["expiresAt"]))) ||
    !Number.isFinite(Date.parse(String(record["accountCreatedAt"]))) ||
    !Number.isFinite(Date.parse(String(record["onboardingCreatedAt"]))) ||
    Date.parse(String(record["expiresAt"])) <=
      Date.parse(String(record["onboardingCreatedAt"]))
  ) {
    return undefined;
  }
  return record as ConnectOnboardingProviderValue;
}

function validateStatusProviderValue(value: unknown) {
  const record = snapshotPlainRecord(value);
  const requirements = snapshotPlainArray(record?.["requirementsDue"]);
  if (
    record === undefined ||
    !exactKeys(record, [
      "stripeAccountId",
      "onboardingComplete",
      "payoutsEnabled",
      "requirementsDue",
      "requestId",
      "observedAt",
    ]) ||
    !validId(record["stripeAccountId"]) ||
    typeof record["onboardingComplete"] !== "boolean" ||
    typeof record["payoutsEnabled"] !== "boolean" ||
    requirements === undefined ||
    requirements.some((item) => !validId(item)) ||
    !validId(record["requestId"]) ||
    !Number.isFinite(Date.parse(String(record["observedAt"])))
  ) {
    return undefined;
  }
  return Object.freeze({
    ...record,
    requirementsDue: Object.freeze([...requirements]) as ReadonlyArray<string>,
  }) as ConnectStatusProviderValue;
}

function validatePayoutProviderValue(value: unknown) {
  const record = snapshotPlainRecord(value);
  if (
    record === undefined ||
    !exactKeys(record, ["payoutId", "evidenceId", "message", "paidAt"]) ||
    !validId(record["payoutId"]) ||
    !validId(record["evidenceId"]) ||
    typeof record["message"] !== "string" ||
    record["message"].length > 1000 ||
    !Number.isFinite(Date.parse(String(record["paidAt"])))
  ) {
    return undefined;
  }
  return record as ConnectPayoutProviderValue;
}

async function storeCall<Value>(operation: () => Awaitable<Value>) {
  try {
    return billingOk(await operation());
  } catch (error) {
    if (error instanceof Error && error.message.includes("idempotency conflict")) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.connectIdempotencyConflict,
        "The Connect audit store found a conflicting idempotent operation.",
      );
    }
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      "The Connect audit store failed; the operation refuses.",
    );
  }
}

function validateStored<Value>(
  candidate: unknown,
  validator: (value: unknown) => Readonly<{
    ok: boolean;
    value?: Value | undefined;
  }>,
  label: string,
): BillingOutcome<Value> {
  const validated = validator(candidate);
  if (!validated.ok || validated.value === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      `The Connect audit store returned an invalid ${label}.`,
    );
  }
  return billingOk(validated.value);
}

function validateStoredCommit<Value>(
  candidate: unknown,
  expected: Value,
  validator: (value: unknown) => Readonly<{
    ok: boolean;
    value?: Value | undefined;
  }>,
  label: string,
): BillingOutcome<ConnectCommit<Value>> {
  const record = snapshotPlainRecord(candidate);
  if (record === undefined || typeof record["replayed"] !== "boolean") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      `The Connect audit store returned an invalid ${label} commit.`,
    );
  }
  const stored = validateStored(record["record"], validator, label);
  if (!stored.ok) return stored;
  if (!same(stored.value, expected)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectIdempotencyConflict,
      `The Connect audit store answered ${label} with a different record.`,
    );
  }
  return billingOk(
    Object.freeze({ record: stored.value, replayed: record["replayed"] }),
  );
}

function validateOnboardingCommit(
  candidate: unknown,
  expectedAccount: ConnectAccountRecord,
  expectedIntent: ConnectOnboardingIntent,
): BillingOutcome<ConnectOnboardingCommit> {
  const record = snapshotPlainRecord(candidate);
  if (record === undefined || typeof record["replayed"] !== "boolean") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      "The Connect audit store returned an invalid onboarding commit.",
    );
  }
  const account = validateStored(
    record["account"],
    validateConnectAccountRecord,
    "Connect account",
  );
  if (!account.ok) return account;
  const intent = validateStored(
    record["intent"],
    validateConnectOnboardingIntent,
    "onboarding intent",
  );
  if (!intent.ok) return intent;
  if (!same(account.value, expectedAccount) || !same(intent.value, expectedIntent)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectIdempotencyConflict,
      "The Connect audit store answered onboarding with different records.",
    );
  }
  return billingOk(
    Object.freeze({
      account: account.value,
      intent: intent.value,
      replayed: record["replayed"],
    }),
  );
}

function validatePayoutIntentCommit(
  candidate: unknown,
  expectedSplit: MoneySplitRecord,
  expectedIntent: ConnectPayoutIntent,
): BillingOutcome<ConnectPayoutIntentCommit> {
  const record = snapshotPlainRecord(candidate);
  if (record === undefined || typeof record["replayed"] !== "boolean") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      "The Connect audit store returned an invalid payout-intent commit.",
    );
  }
  const split = validateStored(
    record["split"],
    validateMoneySplitRecord,
    "money split",
  );
  if (!split.ok) return split;
  const intent = validateStored(
    record["intent"],
    validateConnectPayoutIntent,
    "payout intent",
  );
  if (!intent.ok) return intent;
  if (!same(split.value, expectedSplit) || !same(intent.value, expectedIntent)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectIdempotencyConflict,
      "The Connect audit store answered payout intent with different records.",
    );
  }
  return billingOk(
    Object.freeze({
      split: split.value,
      intent: intent.value,
      replayed: record["replayed"],
    }),
  );
}

export type StartConnectOnboardingRequest = Readonly<{
  principal: unknown;
  admin: AdminIdentity;
  creatorUserId: string;
  idempotencyKey: string;
  now: number;
  store: ConnectStore;
  provider?: StripeConnectProvider | undefined;
  surface?: IdentitySurface | undefined;
}>;

export type StartConnectOnboardingOutcome = Readonly<{
  account: ConnectAccountRecord;
  intent: ConnectOnboardingIntent;
  onboardingUrl: string;
  replayed: boolean;
}>;

/** Authenticate a creator and create or replay one TEST onboarding intent. */
export async function startConnectOnboarding(
  request: StartConnectOnboardingRequest,
): Promise<BillingOutcome<StartConnectOnboardingOutcome>> {
  const screened = snapshotPlainRecord(request);
  if (screened === undefined || !isEpochMilliseconds(screened["now"])) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A Connect onboarding request requires a plain object and valid clock.",
    );
  }
  const input = screened as StartConnectOnboardingRequest;
  const authorized = authorizeCreator(input);
  if (!authorized.ok) return authorized;
  if (
    !validId(input.idempotencyKey) ||
    !input.idempotencyKey.startsWith(CONNECT_ONBOARDING_IDEMPOTENCY_PREFIX)
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      `Connect onboarding idempotency keys must start with "${CONNECT_ONBOARDING_IDEMPOTENCY_PREFIX}".`,
    );
  }
  const ready = readyProvider(input.provider);
  if (!ready.ok) return ready;

  const prior = await storeCall(() => input.store.findOnboardingIntent(input.idempotencyKey));
  if (!prior.ok) return prior;
  if (prior.value !== undefined) {
    const storedPrior = validateStored(
      prior.value,
      validateConnectOnboardingIntent,
      "onboarding intent",
    );
    if (!storedPrior.ok) return storedPrior;
    if (storedPrior.value.creatorUserId !== input.creatorUserId) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.connectIdempotencyConflict,
        "The onboarding idempotency key belongs to another creator.",
      );
    }
  }

  let response: unknown;
  try {
    response = await ready.value.createOnboarding({
      creatorUserId: input.creatorUserId,
      idempotencyKey: input.idempotencyKey,
    });
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderRefused,
      "Stripe Connect onboarding failed; no account or intent was recorded.",
    );
  }
  const envelope = snapshotPlainRecord(response);
  if (envelope?.["ok"] !== true) return providerFailure(response, "onboarding");
  const value = validateOnboardingProviderValue(envelope["value"]);
  if (value === undefined) return providerFailure(response, "onboarding");

  const accountValidation = validateConnectAccountRecord({
    schemaVersion: STRIPE_CONNECT_SCHEMA_VERSION,
    kind: CONNECT_ACCOUNT_RECORD_KIND,
    creatorUserId: input.creatorUserId,
    stripeAccountId: value.stripeAccountId,
    mode: "test",
    providerRequestId: value.accountRequestId,
    createdAt: value.accountCreatedAt,
  });
  const intentValidation = validateConnectOnboardingIntent({
    schemaVersion: STRIPE_CONNECT_SCHEMA_VERSION,
    kind: CONNECT_ONBOARDING_INTENT_KIND,
    onboardingIntentId: deriveIntentId(input.idempotencyKey),
    creatorUserId: input.creatorUserId,
    stripeAccountId: value.stripeAccountId,
    expiresAt: value.expiresAt,
    mode: "test",
    idempotencyKey: input.idempotencyKey,
    providerRequestId: value.onboardingRequestId,
    createdAt: value.onboardingCreatedAt,
  });
  if (!accountValidation.ok || !intentValidation.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderResponseInvalid,
      "Stripe Connect onboarding evidence could not produce valid audit records.",
    );
  }
  const committed = await storeCall(() =>
    input.store.commitOnboarding({
      account: accountValidation.value,
      intent: intentValidation.value,
    }),
  );
  if (!committed.ok) return committed;
  const checkedCommit = validateOnboardingCommit(
    committed.value,
    accountValidation.value,
    intentValidation.value,
  );
  if (!checkedCommit.ok) return checkedCommit;
  return billingOk(
    Object.freeze({
      account: accountValidation.value,
      intent: checkedCommit.value.intent,
      onboardingUrl: value.onboardingUrl,
      replayed: checkedCommit.value.replayed,
    }),
  );
}

export type RefreshConnectStatusRequest = Readonly<{
  principal: unknown;
  admin: AdminIdentity;
  creatorUserId: string;
  now: number;
  store: ConnectStore;
  provider?: StripeConnectProvider | undefined;
  surface?: IdentitySurface | undefined;
}>;

/** Read provider capability into an immutable status observation. */
export async function refreshConnectStatus(
  request: RefreshConnectStatusRequest,
): Promise<BillingOutcome<ConnectCommit<ConnectStatusRecord>>> {
  const screened = snapshotPlainRecord(request);
  if (screened === undefined || !isEpochMilliseconds(screened["now"])) {
    return billingRefuse(BILLING_REFUSE_REASONS.requestInvalid, "A Connect status request is invalid.");
  }
  const input = screened as RefreshConnectStatusRequest;
  const authorized = authorizeCreator(input);
  if (!authorized.ok) return authorized;
  const ready = readyProvider(input.provider);
  if (!ready.ok) return ready;
  const account = await storeCall(() =>
    input.store.findAccountByCreatorUserId(input.creatorUserId),
  );
  if (!account.ok) return account;
  if (account.value === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectAccountMissing,
      "No Connect account is recorded for this creator.",
    );
  }
  const storedAccount = validateStored(
    account.value,
    validateConnectAccountRecord,
    "Connect account",
  );
  if (!storedAccount.ok) return storedAccount;
  if (storedAccount.value.creatorUserId !== input.creatorUserId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      "The Connect audit store returned an account for a different creator.",
    );
  }
  let response: unknown;
  try {
    response = await ready.value.retrieveStatus({
      stripeAccountId: storedAccount.value.stripeAccountId,
    });
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderRefused,
      "Stripe Connect status retrieval failed.",
    );
  }
  const envelope = snapshotPlainRecord(response);
  if (envelope?.["ok"] !== true) return providerFailure(response, "status retrieval");
  const value = validateStatusProviderValue(envelope["value"]);
  if (value === undefined || value.stripeAccountId !== storedAccount.value.stripeAccountId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderResponseInvalid,
      "Stripe Connect returned status for an invalid or different account.",
    );
  }
  const validated = validateConnectStatusRecord({
    schemaVersion: STRIPE_CONNECT_SCHEMA_VERSION,
    kind: CONNECT_STATUS_RECORD_KIND,
    statusId: deriveIntentId(`connect-status:${value.requestId}`),
    creatorUserId: input.creatorUserId,
    stripeAccountId: value.stripeAccountId,
    onboardingComplete: value.onboardingComplete,
    payoutsEnabled: value.payoutsEnabled,
    requirementsDue: value.requirementsDue,
    providerRequestId: value.requestId,
    observedAt: value.observedAt,
  });
  if (!validated.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderResponseInvalid,
      "Stripe Connect status evidence could not produce a valid audit record.",
    );
  }
  const committed = await storeCall(() => input.store.appendStatus(validated.value));
  if (!committed.ok) return committed;
  return validateStoredCommit(
    committed.value,
    validated.value,
    validateConnectStatusRecord,
    "status",
  );
}

export type RequestCreatorPayoutRequest = Readonly<{
  principal: unknown;
  admin: AdminIdentity;
  creatorUserId: string;
  moneySplit: MoneySplitRecord;
  idempotencyKey: string;
  now: number;
  store: ConnectStore;
  provider?: StripeConnectProvider | undefined;
  surface?: IdentitySurface | undefined;
}>;

export type RequestCreatorPayoutOutcome = Readonly<{
  intent: ConnectPayoutIntent;
  outcome: ConnectPayoutOutcome;
  replayed: boolean;
}>;

/** Persist the exact 50/50 split intent, call TEST Stripe, then persist evidence. */
export async function requestCreatorPayout(
  request: RequestCreatorPayoutRequest,
): Promise<BillingOutcome<RequestCreatorPayoutOutcome>> {
  const screened = snapshotPlainRecord(request);
  if (screened === undefined || !isEpochMilliseconds(screened["now"])) {
    return billingRefuse(BILLING_REFUSE_REASONS.requestInvalid, "A Connect payout request is invalid.");
  }
  const input = screened as RequestCreatorPayoutRequest;
  const authorized = authorizeCreator(input);
  if (!authorized.ok) return authorized;
  const split = validateMoneySplitRecord(input.moneySplit);
  if (!split.ok || split.value.creatorUserId !== input.creatorUserId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.revenueShareInvalid,
      "A payout requires the authenticated creator's valid 50/50 MoneySplitRecord.",
    );
  }
  if (split.value.mode !== "test") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectLiveUnavailable,
      "Stripe Connect LIVE payouts are not implemented; activation remains an operations checklist.",
    );
  }
  if (
    !validId(input.idempotencyKey) ||
    !input.idempotencyKey.startsWith(CONNECT_PAYOUT_IDEMPOTENCY_PREFIX)
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      `Connect payout idempotency keys must start with "${CONNECT_PAYOUT_IDEMPOTENCY_PREFIX}".`,
    );
  }
  const ready = readyProvider(input.provider);
  if (!ready.ok) return ready;
  const account = await storeCall(() =>
    input.store.findAccountByCreatorUserId(input.creatorUserId),
  );
  if (!account.ok) return account;
  if (account.value === undefined) {
    return billingRefuse(BILLING_REFUSE_REASONS.connectAccountMissing, "No Connect account is recorded.");
  }
  const storedAccount = validateStored(
    account.value,
    validateConnectAccountRecord,
    "Connect account",
  );
  if (!storedAccount.ok) return storedAccount;
  if (storedAccount.value.creatorUserId !== input.creatorUserId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      "The Connect audit store returned an account for a different creator.",
    );
  }
  const status = await storeCall(() =>
    input.store.latestStatus(storedAccount.value.stripeAccountId),
  );
  if (!status.ok) return status;
  if (status.value === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStatusMissing,
      "No provider status has been observed for this Connect account.",
    );
  }
  const storedStatus = validateStored(
    status.value,
    validateConnectStatusRecord,
    "status",
  );
  if (!storedStatus.ok) return storedStatus;
  if (
    storedStatus.value.creatorUserId !== input.creatorUserId ||
    storedStatus.value.stripeAccountId !== storedAccount.value.stripeAccountId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectStoreFailed,
      "The Connect audit store returned status for a different account.",
    );
  }
  if (!storedStatus.value.onboardingComplete || !storedStatus.value.payoutsEnabled) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectPayoutsDisabled,
      "The latest provider status does not enable payouts.",
    );
  }

  const payoutIntentId = deriveIntentId(input.idempotencyKey);
  const intentValidation = validateConnectPayoutIntent({
    schemaVersion: STRIPE_CONNECT_SCHEMA_VERSION,
    kind: CONNECT_PAYOUT_INTENT_KIND,
    payoutIntentId,
    saleId: split.value.saleId,
    creatorUserId: split.value.creatorUserId,
    stripeAccountId: storedAccount.value.stripeAccountId,
    grossMinor: split.value.grossMinor,
    creatorMinor: split.value.creatorMinor,
    platformMinor: split.value.platformMinor,
    currency: split.value.currency,
    basisPoints: CREATOR_SHARE_BASIS_POINTS,
    mode: split.value.mode,
    idempotencyKey: input.idempotencyKey,
    requestedAt: new Date(input.now).toISOString(),
  });
  if (!intentValidation.ok) {
    return billingRefuse(BILLING_REFUSE_REASONS.revenueShareInvalid, intentValidation.message);
  }
  const committed = await storeCall(() =>
    input.store.commitPayoutIntent({
      split: split.value,
      intent: intentValidation.value,
    }),
  );
  if (!committed.ok) return committed;
  const checkedIntent = validatePayoutIntentCommit(
    committed.value,
    split.value,
    intentValidation.value,
  );
  if (!checkedIntent.ok) return checkedIntent;
  const priorOutcome = await storeCall(() =>
    input.store.findPayoutOutcome(payoutIntentId),
  );
  if (!priorOutcome.ok) return priorOutcome;
  if (priorOutcome.value !== undefined) {
    const storedOutcome = validateStored(
      priorOutcome.value,
      validateConnectPayoutOutcome,
      "payout outcome",
    );
    if (!storedOutcome.ok) return storedOutcome;
    if (storedOutcome.value.payoutIntentId !== payoutIntentId) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.connectStoreFailed,
        "The Connect audit store returned an outcome for a different payout intent.",
      );
    }
    if (storedOutcome.value.status === "failed") {
      return billingRefuse(
        BILLING_REFUSE_REASONS.connectProviderRefused,
        `Stripe Connect already refused this payout (${storedOutcome.value.providerEvidenceId}); the failed outcome was replayed.`,
      );
    }
    return billingOk(
      Object.freeze({
        intent: checkedIntent.value.intent,
        outcome: storedOutcome.value,
        replayed: true,
      }),
    );
  }

  let response: unknown;
  try {
    response = await ready.value.createPayout({
      stripeAccountId: storedAccount.value.stripeAccountId,
      amountMinor: split.value.creatorMinor,
      currency: split.value.currency,
      idempotencyKey: input.idempotencyKey,
      saleId: split.value.saleId,
    });
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderRefused,
      "Stripe Connect payout failed; the committed intent remains pending and no success was recorded.",
    );
  }
  const envelope = snapshotPlainRecord(response);
  if (envelope?.["ok"] !== true) {
    if (providerRefused(response)) {
      const refusal = response as ConnectProviderRefusal;
      if (validId(refusal.evidenceId)) {
        const failed = validateConnectPayoutOutcome({
          schemaVersion: STRIPE_CONNECT_SCHEMA_VERSION,
          kind: CONNECT_PAYOUT_OUTCOME_KIND,
          payoutOutcomeId: deriveIntentId(`connect-outcome:${refusal.evidenceId}`),
          payoutIntentId,
          status: "failed",
          providerPayoutId: null,
          providerEvidenceId: refusal.evidenceId,
          providerMessage: refusal.message,
          observedAt: new Date(input.now).toISOString(),
        });
        if (failed.ok) {
          const recorded = await storeCall(() =>
            input.store.appendPayoutOutcome(failed.value),
          );
          if (!recorded.ok) return recorded;
          const checkedFailure = validateStoredCommit(
            recorded.value,
            failed.value,
            validateConnectPayoutOutcome,
            "failed payout outcome",
          );
          if (!checkedFailure.ok) return checkedFailure;
        }
      }
    }
    return providerFailure(response, "payout");
  }
  const value = validatePayoutProviderValue(envelope["value"]);
  if (value === undefined) return providerFailure(response, "payout");
  const outcomeValidation = validateConnectPayoutOutcome({
    schemaVersion: STRIPE_CONNECT_SCHEMA_VERSION,
    kind: CONNECT_PAYOUT_OUTCOME_KIND,
    payoutOutcomeId: deriveIntentId(`connect-outcome:${value.evidenceId}`),
    payoutIntentId,
    status: "succeeded",
    providerPayoutId: value.payoutId,
    providerEvidenceId: value.evidenceId,
    providerMessage: value.message,
    observedAt: value.paidAt,
  });
  if (!outcomeValidation.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.connectProviderResponseInvalid,
      "Stripe Connect payout evidence could not produce a valid success record.",
    );
  }
  const outcome = await storeCall(() =>
    input.store.appendPayoutOutcome(outcomeValidation.value),
  );
  if (!outcome.ok) return outcome;
  const checkedOutcome = validateStoredCommit(
    outcome.value,
    outcomeValidation.value,
    validateConnectPayoutOutcome,
    "payout outcome",
  );
  if (!checkedOutcome.ok) return checkedOutcome;
  return billingOk(
    Object.freeze({
      intent: checkedIntent.value.intent,
      outcome: checkedOutcome.value.record,
      replayed: checkedIntent.value.replayed || checkedOutcome.value.replayed,
    }),
  );
}
