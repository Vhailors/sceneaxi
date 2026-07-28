/**
 * SceneAxi billing contracts (v1) — credit packs, Stripe customer links,
 * checkout session intents, and the normalized checkout-completed event.
 *
 * `CheckoutSessionIntent` is provider-neutral and **secret-free**: it describes
 * the checkout SceneAxi wants created, not a Stripe API call. That keeps the
 * contract stable if the payment provider ever changes, and makes it safe to
 * log, persist, and hand to an adapter.
 *
 * `mode` defaults to `test` everywhere. Reaching `live` requires an explicit
 * captain go-live decision — see docs/auth-credits.md.
 *
 * Checkout construction, signature verification, and grant application live in
 * @sceneaxi/billing; this module is contracts only.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isDateTime,
  isNonEmptyString,
  isSafeInteger,
  refuseWith,
  snapshotPlainArray,
  snapshotPlainRecord,
  type ContractRefuse,
} from "./record-validation.js";

/** Contract major version for the billing plane. */
export const BILLING_SCHEMA_VERSION = 1 as const;

export const STRIPE_CUSTOMER_LINK_KIND =
  "sceneaxi.stripe-customer-link" as const;
export const CHECKOUT_SESSION_INTENT_KIND =
  "sceneaxi.checkout-session-intent" as const;
export const CHECKOUT_COMPLETED_EVENT_KIND =
  "sceneaxi.checkout-completed-event" as const;

/** The only Stripe event type this contract normalizes in v1. */
export const CHECKOUT_COMPLETED_EVENT_TYPE =
  "checkout.session.completed" as const;

export const BILLING_MODES = Object.freeze(["test", "live"] as const);

/** Default mode for every billing path. Live is never implicit. */
export const DEFAULT_BILLING_MODE = "test" as const;

/** Canonical credit-pack fixture list, relative to this package root. */
export const CREDIT_PACKS_FIXTURES_PATH =
  "contracts/credit-packs.fixtures.json" as const;

export const BILLING_REFUSE_CODES = Object.freeze({
  notObject: "BILLING_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "BILLING_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "BILLING_KIND_MISMATCH",
  missingProperty: "BILLING_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "BILLING_UNEXPECTED_PROPERTY",
  invalidProperty: "BILLING_PROPERTY_INVALID",
  insecureRedirectUrl: "BILLING_REDIRECT_URL_NOT_HTTPS",
  packCreditsMismatch: "BILLING_PACK_CREDITS_MISMATCH",
} as const);

export type BillingRefuseCode =
  (typeof BILLING_REFUSE_CODES)[keyof typeof BILLING_REFUSE_CODES];

export type BillingMode = (typeof BILLING_MODES)[number];

/** A purchasable credit pack. Canonical list ships as a contract fixture. */
export type CreditPack = {
  readonly packId: string;
  readonly credits: number;
  /** Price in the currency's minor unit (e.g. cents), as Stripe expects. */
  readonly unitAmount: number;
  readonly currency: string;
  readonly stripePriceId: string;
};

export type CreditPackCatalog = {
  readonly schemaVersion: typeof BILLING_SCHEMA_VERSION;
  readonly mode: typeof DEFAULT_BILLING_MODE;
  readonly packs: ReadonlyArray<CreditPack>;
};

/** Links a SceneAxi user to a provider customer, per mode. */
export type StripeCustomerLink = {
  readonly schemaVersion: typeof BILLING_SCHEMA_VERSION;
  readonly kind: typeof STRIPE_CUSTOMER_LINK_KIND;
  readonly userId: string;
  readonly stripeCustomerId: string;
  readonly mode: BillingMode;
  readonly linkedAt: string;
};

/**
 * What a checkout is for. The two purposes settle differently — a credit pack
 * grants credits, a catalog listing transfers an asset and splits the money — so
 * the purpose is part of the contract rather than something a consumer infers
 * from which optional field happens to be present.
 */
export const CHECKOUT_PURPOSES = Object.freeze([
  "credit-pack",
  "catalog-listing",
] as const);

export type CheckoutPurpose = (typeof CHECKOUT_PURPOSES)[number];

/**
 * Provider-neutral, secret-free description of a checkout to create.
 *
 * `credits` is present exactly when the purpose is `credit-pack`; a listing sale
 * grants no credits, so carrying a nominal one there would put a meaningless
 * number in the ledger's line of sight. `stripePriceId` is a public identifier,
 * not a secret — the adapter needs to know what to charge.
 */
export type CheckoutSessionIntent = {
  readonly schemaVersion: typeof BILLING_SCHEMA_VERSION;
  readonly kind: typeof CHECKOUT_SESSION_INTENT_KIND;
  readonly intentId: string;
  readonly userId: string;
  readonly purpose: CheckoutPurpose;
  /** The credit pack id or the catalog listing id, per `purpose`. */
  readonly itemId: string;
  /** Present exactly when `purpose` is `credit-pack`. */
  readonly credits?: number;
  /** Price in the currency's minor unit. */
  readonly unitAmount: number;
  readonly currency: string;
  readonly stripePriceId: string;
  readonly mode: BillingMode;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
};

/**
 * Provider event normalized to SceneAxi vocabulary before it touches credits.
 *
 * `checkoutSessionId` is the provider's own Checkout Session id, read from the
 * verified event body. It is what makes the settlement evidence *this* session's
 * rather than any identically-priced one: without it, a paid session's retrieved
 * settlement validates a different paid session's event. It is required, so a
 * completion that cannot name the session it settles does not exist at all.
 */
export type CheckoutCompletedEvent = {
  readonly schemaVersion: typeof BILLING_SCHEMA_VERSION;
  readonly kind: typeof CHECKOUT_COMPLETED_EVENT_KIND;
  readonly eventId: string;
  readonly type: typeof CHECKOUT_COMPLETED_EVENT_TYPE;
  readonly mode: BillingMode;
  /** The Stripe Checkout Session this completion settles. */
  readonly checkoutSessionId: string;
  readonly intentId: string;
  readonly userId: string;
  readonly purpose: CheckoutPurpose;
  readonly itemId: string;
  /** Present exactly when `purpose` is `credit-pack`. */
  readonly credits?: number;
  /** Gross amount paid, in the currency's minor unit. */
  readonly unitAmount: number;
  readonly currency: string;
  readonly stripePriceId: string;
  readonly occurredAt: string;
};

export type BillingValidationOk<Value> = {
  readonly ok: true;
  readonly value: Value;
};

export type BillingValidationRefuse = ContractRefuse<BillingRefuseCode>;

export type BillingValidationResult<Value> =
  | BillingValidationOk<Value>
  | BillingValidationRefuse;

const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const CURRENCY_RE = /^[a-z]{3}$/;

export function isBillingMode(value: unknown): value is BillingMode {
  return BILLING_MODES.some((mode) => mode === value);
}

/**
 * The one url-safe identifier rule every identifier SceneAxi *mints* is held to.
 *
 * Exported so code that mints an id can hold it to the same rule the record
 * validators will, rather than discovering a malformed id only when a later
 * validation refuses it under some other reason. It deliberately does not
 * govern provider-generated ids — `stripePriceId`, `stripeCustomerId`, and the
 * Checkout Session id are opaque strings whose shape SceneAxi does not own.
 */
export function isBillingIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_RE.test(value);
}

/**
 * A redirect URL must be absolute https. Checkout redirects carry a
 * post-payment state transition, so plaintext http is refused rather than
 * upgraded.
 */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:";
}

function ok<Value>(value: Value): BillingValidationOk<Value> {
  return Object.freeze({ ok: true, value });
}

function invalid(detail: string): BillingValidationRefuse {
  return refuseWith(BILLING_REFUSE_CODES.invalidProperty, detail);
}

function checkEnvelope(
  value: unknown,
  kind: string,
  label: string,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string> = [],
): Record<string, unknown> | BillingValidationRefuse {
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.notObject,
      `A ${label} must be a plain JSON object.`,
    );
  }
  if (record["schemaVersion"] !== BILLING_SCHEMA_VERSION) {
    return refuseWith(
      BILLING_REFUSE_CODES.schemaVersionMismatch,
      `${label} schemaVersion must be ${BILLING_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (record["kind"] !== kind) {
    return refuseWith(
      BILLING_REFUSE_CODES.kindMismatch,
      `${label} kind must be "${kind}".`,
    );
  }
  const missing = firstMissingKey(record, required);
  if (missing !== undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.missingProperty,
      `${label} is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(record, required, optional);
  if (unexpected !== undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.unexpectedProperty,
      `${label} has unexpected property "${unexpected}".`,
    );
  }
  return record;
}

function isRefuse(
  value: Record<string, unknown> | BillingValidationRefuse,
): value is BillingValidationRefuse {
  return "ok" in value && value.ok === false;
}

const CREDIT_PACK_KEYS = Object.freeze([
  "packId",
  "credits",
  "unitAmount",
  "currency",
  "stripePriceId",
]);

export function validateCreditPack(
  value: unknown,
): BillingValidationResult<CreditPack> {
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.notObject,
      "A credit pack must be a plain JSON object.",
    );
  }
  const missing = firstMissingKey(record, CREDIT_PACK_KEYS);
  if (missing !== undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.missingProperty,
      `credit pack is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(record, CREDIT_PACK_KEYS);
  if (unexpected !== undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.unexpectedProperty,
      `credit pack has unexpected property "${unexpected}".`,
    );
  }

  const packId = record["packId"];
  if (typeof packId !== "string" || !SLUG_RE.test(packId)) {
    return invalid("credit pack packId must be a lowercase slug of 1-64 chars.");
  }
  const credits = record["credits"];
  if (!isSafeInteger(credits) || credits < 1) {
    return invalid("credit pack credits must be a positive safe integer.");
  }
  const unitAmount = record["unitAmount"];
  if (!isSafeInteger(unitAmount) || unitAmount < 1) {
    return invalid(
      "credit pack unitAmount must be a positive safe integer in the currency's minor unit.",
    );
  }
  const currency = record["currency"];
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
    return invalid(
      "credit pack currency must be a lowercase three-letter ISO 4217 code.",
    );
  }
  if (!isNonEmptyString(record["stripePriceId"])) {
    return invalid("credit pack stripePriceId must be a non-empty string.");
  }

  return ok(
    Object.freeze({
      packId,
      credits,
      unitAmount,
      currency,
      stripePriceId: record["stripePriceId"],
    }),
  );
}

/**
 * Validate the canonical pack catalog. The catalog is test-mode only: the live
 * price ids belong to a later captain go-live decision, so they are not
 * committed here.
 */
export function validateCreditPackCatalog(
  value: unknown,
): BillingValidationResult<CreditPackCatalog> {
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.notObject,
      "The credit pack catalog must be a plain JSON object.",
    );
  }
  const required = ["schemaVersion", "mode", "packs"];
  const missing = firstMissingKey(record, required);
  if (missing !== undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.missingProperty,
      `credit pack catalog is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(record, required);
  if (unexpected !== undefined) {
    return refuseWith(
      BILLING_REFUSE_CODES.unexpectedProperty,
      `credit pack catalog has unexpected property "${unexpected}".`,
    );
  }
  if (record["schemaVersion"] !== BILLING_SCHEMA_VERSION) {
    return refuseWith(
      BILLING_REFUSE_CODES.schemaVersionMismatch,
      `credit pack catalog schemaVersion must be ${BILLING_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (record["mode"] !== DEFAULT_BILLING_MODE) {
    return invalid(
      `credit pack catalog mode must be "${DEFAULT_BILLING_MODE}"; live price ids are not committed.`,
    );
  }
  const packs = snapshotPlainArray(record["packs"]);
  if (packs === undefined || packs.length === 0) {
    return invalid("credit pack catalog packs must be a non-empty array.");
  }

  const validated: CreditPack[] = [];
  const seen = new Set<string>();
  for (const candidate of packs) {
    const pack = validateCreditPack(candidate);
    if (!pack.ok) return pack;
    if (seen.has(pack.value.packId)) {
      return invalid(
        `credit pack catalog has duplicate packId "${pack.value.packId}".`,
      );
    }
    seen.add(pack.value.packId);
    validated.push(pack.value);
  }

  return ok(
    Object.freeze({
      schemaVersion: BILLING_SCHEMA_VERSION,
      mode: DEFAULT_BILLING_MODE,
      packs: Object.freeze(validated),
    }),
  );
}

const STRIPE_CUSTOMER_LINK_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "userId",
  "stripeCustomerId",
  "mode",
  "linkedAt",
]);

export function validateStripeCustomerLink(
  value: unknown,
): BillingValidationResult<StripeCustomerLink> {
  const record = checkEnvelope(
    value,
    STRIPE_CUSTOMER_LINK_KIND,
    "stripe customer link",
    STRIPE_CUSTOMER_LINK_KEYS,
  );
  if (isRefuse(record)) return record;

  const userId = record["userId"];
  if (!isBillingIdentifier(userId)) {
    return invalid(
      "stripe customer link userId must be a url-safe identifier of 1-128 chars.",
    );
  }
  if (!isNonEmptyString(record["stripeCustomerId"])) {
    return invalid(
      "stripe customer link stripeCustomerId must be a non-empty string.",
    );
  }
  const mode = record["mode"];
  if (!isBillingMode(mode)) {
    return invalid(
      `stripe customer link mode must be one of ${BILLING_MODES.join(", ")}.`,
    );
  }
  if (!isDateTime(record["linkedAt"])) {
    return invalid(
      "stripe customer link linkedAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  return ok(
    Object.freeze({
      schemaVersion: BILLING_SCHEMA_VERSION,
      kind: STRIPE_CUSTOMER_LINK_KIND,
      userId,
      stripeCustomerId: record["stripeCustomerId"],
      mode,
      linkedAt: record["linkedAt"],
    }),
  );
}

const CHECKOUT_SESSION_INTENT_REQUIRED = Object.freeze([
  "schemaVersion",
  "kind",
  "intentId",
  "userId",
  "purpose",
  "itemId",
  "unitAmount",
  "currency",
  "stripePriceId",
  "mode",
  "successUrl",
  "cancelUrl",
  "idempotencyKey",
  "createdAt",
]);

export function isCheckoutPurpose(value: unknown): value is CheckoutPurpose {
  return CHECKOUT_PURPOSES.some((purpose) => purpose === value);
}

/**
 * Validate the `credits` field against the purpose.
 *
 * Shared by the intent and the completion event so the two can never disagree
 * about whether a listing sale carries a credit amount.
 */
function checkPurposeCredits(
  record: Record<string, unknown>,
  purpose: CheckoutPurpose,
  label: string,
): BillingValidationRefuse | undefined {
  const hasCredits = Object.hasOwn(record, "credits");
  if (purpose === "credit-pack") {
    const credits = record["credits"];
    if (!hasCredits || !isSafeInteger(credits) || credits < 1) {
      return invalid(
        `${label} for a credit-pack purchase must carry a positive integer credits amount.`,
      );
    }
    return undefined;
  }
  if (hasCredits) {
    return invalid(
      `${label} for a ${purpose} purchase must not carry a credits amount; a listing sale grants no credits.`,
    );
  }
  return undefined;
}

export function validateCheckoutSessionIntent(
  value: unknown,
): BillingValidationResult<CheckoutSessionIntent> {
  const record = checkEnvelope(
    value,
    CHECKOUT_SESSION_INTENT_KIND,
    "checkout session intent",
    CHECKOUT_SESSION_INTENT_REQUIRED,
    ["credits"],
  );
  if (isRefuse(record)) return record;

  const intentId = record["intentId"];
  if (!isBillingIdentifier(intentId)) {
    return invalid(
      "checkout session intent intentId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const userId = record["userId"];
  if (!isBillingIdentifier(userId)) {
    return invalid(
      "checkout session intent userId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const purpose = record["purpose"];
  if (!isCheckoutPurpose(purpose)) {
    return invalid(
      `checkout session intent purpose must be one of ${CHECKOUT_PURPOSES.join(", ")}.`,
    );
  }
  const itemId = record["itemId"];
  if (typeof itemId !== "string" || !SLUG_RE.test(itemId)) {
    return invalid(
      "checkout session intent itemId must be a lowercase slug of 1-64 chars.",
    );
  }
  const creditsRefusal = checkPurposeCredits(
    record,
    purpose,
    "checkout session intent",
  );
  if (creditsRefusal !== undefined) return creditsRefusal;

  const unitAmount = record["unitAmount"];
  if (!isSafeInteger(unitAmount) || unitAmount < 1) {
    return invalid(
      "checkout session intent unitAmount must be a positive safe integer in the currency's minor unit.",
    );
  }
  const currency = record["currency"];
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
    return invalid(
      "checkout session intent currency must be a lowercase three-letter ISO 4217 code.",
    );
  }
  if (!isNonEmptyString(record["stripePriceId"])) {
    return invalid(
      "checkout session intent stripePriceId must be a non-empty string.",
    );
  }
  const mode = record["mode"];
  if (!isBillingMode(mode)) {
    return invalid(
      `checkout session intent mode must be one of ${BILLING_MODES.join(", ")}.`,
    );
  }
  const successUrl = record["successUrl"];
  const cancelUrl = record["cancelUrl"];
  if (!isHttpsUrl(successUrl)) {
    return refuseWith(
      BILLING_REFUSE_CODES.insecureRedirectUrl,
      "checkout session intent successUrl must be an absolute https URL.",
    );
  }
  if (!isHttpsUrl(cancelUrl)) {
    return refuseWith(
      BILLING_REFUSE_CODES.insecureRedirectUrl,
      "checkout session intent cancelUrl must be an absolute https URL.",
    );
  }
  const idempotencyKey = record["idempotencyKey"];
  if (
    typeof idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_RE.test(idempotencyKey)
  ) {
    return invalid(
      "checkout session intent idempotencyKey must be a namespaced key of 1-192 chars.",
    );
  }
  if (!isDateTime(record["createdAt"])) {
    return invalid(
      "checkout session intent createdAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  const base = {
    schemaVersion: BILLING_SCHEMA_VERSION,
    kind: CHECKOUT_SESSION_INTENT_KIND,
    intentId,
    userId,
    purpose,
    itemId,
    unitAmount,
    currency,
    stripePriceId: record["stripePriceId"],
    mode,
    successUrl,
    cancelUrl,
    idempotencyKey,
    createdAt: record["createdAt"],
  };

  return ok(
    Object.freeze(
      purpose === "credit-pack"
        ? { ...base, credits: record["credits"] as number }
        : base,
    ),
  );
}

const CHECKOUT_COMPLETED_EVENT_REQUIRED = Object.freeze([
  "schemaVersion",
  "kind",
  "eventId",
  "type",
  "mode",
  "checkoutSessionId",
  "intentId",
  "userId",
  "purpose",
  "itemId",
  "unitAmount",
  "currency",
  "stripePriceId",
  "occurredAt",
]);

export function validateCheckoutCompletedEvent(
  value: unknown,
): BillingValidationResult<CheckoutCompletedEvent> {
  const record = checkEnvelope(
    value,
    CHECKOUT_COMPLETED_EVENT_KIND,
    "checkout completed event",
    CHECKOUT_COMPLETED_EVENT_REQUIRED,
    ["credits"],
  );
  if (isRefuse(record)) return record;

  if (record["type"] !== CHECKOUT_COMPLETED_EVENT_TYPE) {
    return invalid(
      `checkout completed event type must be "${CHECKOUT_COMPLETED_EVENT_TYPE}".`,
    );
  }
  const eventId = record["eventId"];
  if (!isBillingIdentifier(eventId)) {
    return invalid(
      "checkout completed event eventId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const mode = record["mode"];
  if (!isBillingMode(mode)) {
    return invalid(
      `checkout completed event mode must be one of ${BILLING_MODES.join(", ")}.`,
    );
  }
  // Deliberately not IDENTIFIER_RE: this id is provider-generated and opaque.
  // Stripe guarantees nothing about the length or shape of a Checkout Session
  // id, so imposing SceneAxi's 1-128-char url-safe rule on it would refuse
  // genuinely paid webhooks. What binds the evidence is presence plus exact
  // string equality with the settlement, neither of which needs a charset rule.
  // IDENTIFIER_RE stays correct for the ids SceneAxi mints — intentId, userId.
  const checkoutSessionId = record["checkoutSessionId"];
  if (!isNonEmptyString(checkoutSessionId)) {
    return invalid(
      "checkout completed event checkoutSessionId must be a non-empty Checkout Session id; a completion that cannot name its Checkout Session is unbound evidence.",
    );
  }
  const intentId = record["intentId"];
  if (!isBillingIdentifier(intentId)) {
    return invalid(
      "checkout completed event intentId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const userId = record["userId"];
  if (!isBillingIdentifier(userId)) {
    return invalid(
      "checkout completed event userId must be a url-safe identifier of 1-128 chars.",
    );
  }
  const purpose = record["purpose"];
  if (!isCheckoutPurpose(purpose)) {
    return invalid(
      `checkout completed event purpose must be one of ${CHECKOUT_PURPOSES.join(", ")}.`,
    );
  }
  const itemId = record["itemId"];
  if (typeof itemId !== "string" || !SLUG_RE.test(itemId)) {
    return invalid(
      "checkout completed event itemId must be a lowercase slug of 1-64 chars.",
    );
  }
  const creditsRefusal = checkPurposeCredits(
    record,
    purpose,
    "checkout completed event",
  );
  if (creditsRefusal !== undefined) return creditsRefusal;

  const unitAmount = record["unitAmount"];
  if (!isSafeInteger(unitAmount) || unitAmount < 1) {
    return invalid(
      "checkout completed event unitAmount must be a positive safe integer in the currency's minor unit.",
    );
  }
  const currency = record["currency"];
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
    return invalid(
      "checkout completed event currency must be a lowercase three-letter ISO 4217 code.",
    );
  }
  if (!isNonEmptyString(record["stripePriceId"])) {
    return invalid(
      "checkout completed event stripePriceId must be a non-empty string.",
    );
  }
  if (!isDateTime(record["occurredAt"])) {
    return invalid(
      "checkout completed event occurredAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  const base = {
    schemaVersion: BILLING_SCHEMA_VERSION,
    kind: CHECKOUT_COMPLETED_EVENT_KIND,
    eventId,
    type: CHECKOUT_COMPLETED_EVENT_TYPE,
    mode,
    checkoutSessionId,
    intentId,
    userId,
    purpose,
    itemId,
    unitAmount,
    currency,
    stripePriceId: record["stripePriceId"],
    occurredAt: record["occurredAt"],
  };

  return ok(
    Object.freeze(
      purpose === "credit-pack"
        ? { ...base, credits: record["credits"] as number }
        : base,
    ),
  );
}
