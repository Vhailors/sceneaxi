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
  accountNotOwned: "CREDIT_ACCOUNT_NOT_OWNED",
  amountInvalid: "CREDIT_AMOUNT_INVALID",
  storeFailed: "CREDIT_STORE_FAILED",

  // --- credit packs and checkout ---
  catalogInvalid: "BILLING_CATALOG_INVALID",
  catalogRevisionUnresolvable: "BILLING_CATALOG_REVISION_UNRESOLVABLE",
  catalogRevisionCreditsMismatch: "BILLING_CATALOG_REVISION_CREDITS_MISMATCH",
  packUnknown: "STRIPE_CREDIT_PACK_UNKNOWN",
  liveModeNotAuthorized: "STRIPE_LIVE_MODE_NOT_AUTHORIZED",
  checkoutIntentInvalid: "STRIPE_CHECKOUT_INTENT_INVALID",
  redirectUrlInsecure: "STRIPE_REDIRECT_URL_NOT_HTTPS",

  // --- webhook signature verification ---
  webhookSecretMissing: "STRIPE_WEBHOOK_SECRET_MISSING",
  signatureHeaderMissing: "STRIPE_SIGNATURE_HEADER_MISSING",
  signatureHeaderMalformed: "STRIPE_SIGNATURE_HEADER_MALFORMED",
  signatureSchemeMissing: "STRIPE_SIGNATURE_SCHEME_MISSING",
  signatureTimestampStale: "STRIPE_SIGNATURE_TIMESTAMP_STALE",
  signatureTimestampFuture: "STRIPE_SIGNATURE_TIMESTAMP_IN_FUTURE",
  signatureMismatch: "STRIPE_SIGNATURE_MISMATCH",

  // --- webhook payload ---
  webhookPayloadInvalid: "STRIPE_WEBHOOK_PAYLOAD_INVALID",
  webhookEventTypeUnsupported: "STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED",

  // --- settlement bound to the exact Checkout Session ---
  checkoutSessionIdMissing: "STRIPE_CHECKOUT_SESSION_ID_MISSING",
  settlementSessionMismatch: "STRIPE_SETTLEMENT_SESSION_MISMATCH",

  // --- webhook provenance, checked at runtime rather than only typed ---
  webhookNotVerified: "STRIPE_WEBHOOK_NOT_VERIFIED",
  completionNotVerified: "STRIPE_COMPLETION_NOT_VERIFIED",

  // --- hosted AI routing ---
  hostedAiRouteInvalid: "HOSTED_AI_ROUTE_INVALID",
  hostedAiNotEnabled: "HOSTED_AI_NOT_ENABLED",
  hostedAiProviderFailed: "HOSTED_AI_PROVIDER_FAILED",

  // --- free-vs-paid enforcement ---
  capabilityUnknown: "ENTITLEMENT_CAPABILITY_UNKNOWN",
  accountRequired: "ENTITLEMENT_ACCOUNT_REQUIRED",
  paymentMethodRequired: "ENTITLEMENT_PAYMENT_METHOD_REQUIRED",
  creditAmountRequired: "ENTITLEMENT_CREDIT_AMOUNT_REQUIRED",
  kidsCommerceDenied: "KIDS_COMMERCE_DENIED",

  // --- catalog listings ---
  listingCatalogInvalid: "LISTING_CATALOG_INVALID",
  listingUnknown: "LISTING_UNKNOWN",
  listingPriceModeMismatch: "LISTING_PRICE_MODE_MISMATCH",
  listingCurrencyNotListed: "LISTING_CURRENCY_NOT_LISTED",
  listingSelfPurchaseDenied: "LISTING_SELF_PURCHASE_DENIED",
  listingCheckoutUnexpectedProperty: "LISTING_CHECKOUT_UNEXPECTED_PROPERTY",
  listingFixtureCommerceNotEnabled: "LISTING_FIXTURE_COMMERCE_NOT_ENABLED",

  // --- creator revenue share ---
  revenueShareInvalid: "REVENUE_SHARE_INVALID",
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
