/**
 * @sceneaxi/billing — credits and billing for the SceneAxi identity plane.
 *
 * Owns the append-only credit ledger, metering, entitlement enforcement, the
 * default-off hosted-AI credit gate, the Stripe test-mode checkout and webhook
 * paths, and the bounded fixture-SKU commerce path over the committed catalog.
 * Neon, the Stripe API, and every model provider are
 * injected adapters, never dependencies; webhook *signature verification* is
 * implemented in-repo because it is the security boundary and is fully
 * deterministic. See docs/auth-credits.md and ADR 0021.
 *
 * Depends only on `@sceneaxi/schemas` and the `@sceneaxi/auth` seam.
 */

import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/billing",
  releaseGroup: "identity",
});

export {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOk,
  type BillingOutcome,
  type BillingRefuse,
  type BillingRefuseReason,
} from "./refusals.js";

export {
  appendCreditEntry,
  createLedgerState,
  deriveBalance,
  deriveEntryId,
  loadLedgerState,
  validateLedgerState,
  type AppendCreditEntryRequest,
  type AppendOutcome,
  type LedgerState,
} from "./ledger.js";

export {
  SALE_ENTRY_KEY_PREFIX,
  createCreditStore,
  createInMemoryCreditStore,
  isSaleEntryKey,
  saleEntryKeys,
  type CommittedEntry,
  type CreditStore,
  type CreditStoreAdapter,
  type CreditsSaleSettlement,
  type CreditsSaleSettlementOutcome,
  type InMemoryCreditStore,
  type InMemoryCreditStoreOptions,
} from "./store.js";

export {
  METERING_IDEMPOTENCY_PREFIX,
  meterCredits,
  meteringIdempotencyKey,
  type MeterCreditsRequest,
  type MeterOutcome,
} from "./metering.js";

export {
  loadCreditPackCatalog,
  lookupCreditPack,
  resolveCreditPackRevision,
} from "./credit-packs.js";

export {
  STARTER_IDEMPOTENCY_PREFIX,
  evaluateEntitlement,
  grantStarterCredits,
  type EntitlementPaymentMethod,
  type EvaluateEntitlementRequest,
  type GrantStarterCreditsRequest,
} from "./entitlements.js";

export {
  HOSTED_AI_DEFAULT_CONFIG,
  HOSTED_AI_ROUTES,
  HOSTED_AI_ROUTE_CAPABILITIES,
  runMeteredModelCall,
  type HostedAiConfig,
  type HostedAiProviderCall,
  type HostedAiRoute,
  type MeteredModelCallCompleted,
  type MeteredModelCallReplayed,
  type RunMeteredModelCallOutcome,
  type RunMeteredModelCallRequest,
} from "./hosted-ai.js";

export {
  assertModeAuthorized,
  createCheckoutSessionIntent,
  deriveIntentId,
  type CreateCheckoutSessionIntentRequest,
} from "./checkout.js";

export {
  STRIPE_LIVE_MODE_AFFIRMATIVE,
  STRIPE_LIVE_MODE_ALIAS_ENV_VARS,
  STRIPE_LIVE_MODE_ENV_VAR,
  hasLiveModeAuthorizationProvenance,
  liveModeAuthorizedFlag,
  resolveLiveModeAuthorization,
  type LiveModeAuthorization,
  type LiveModeAuthorizationAudit,
  type ResolveLiveModeAuthorizationRequest,
} from "./live-mode.js";

export {
  LISTING_SALE_IDEMPOTENCY_PREFIX,
  assertCurrencyListed,
  createListingCheckoutIntent,
  loadCatalogListings,
  lookupCatalogListing,
  purchaseListingWithCredits,
  type CreateListingCheckoutIntentRequest,
  type ListingPurchaseOutcome,
  type PurchaseListingWithCreditsRequest,
} from "./catalog-listings.js";

export {
  CHECKOUT_METADATA_KEYS,
  CREDIT_GRANTING_CHECKOUT_PURPOSE,
  STRIPE_EVENT_IDEMPOTENCY_PREFIX,
  STRIPE_REFUND_IDEMPOTENCY_PREFIX,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  applyCheckoutCompletedGrant,
  applyCreditPackRefund,
  checkoutPurposeGrantsCredits,
  checkoutPurposeSettlesElsewhere,
  hasVerifiedCompletionProvenance,
  hasVerifiedWebhookProvenance,
  hasVerifiedRefundProvenance,
  parseCheckoutCompletedEvent,
  parseCreditPackRefundEvent,
  persistCreditPackRefund,
  persistCheckoutCompletedGrant,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  type ApplyCheckoutCompletedGrantRequest,
  type ApplyCreditPackRefundRequest,
  type PersistCheckoutCompletedGrantRequest,
  type PersistCreditPackRefundRequest,
  type CheckoutSettlement,
  type CheckoutSettlementPort,
  type VerifiedCheckoutCompletion,
  type VerifiedCreditPackRefund,
  type VerifiedWebhook,
  type VerifyStripeWebhookSignatureRequest,
} from "./stripe-webhook.js";

export {
  FIXTURE_COMMERCE_CAPABILITY,
  FIXTURE_COMMERCE_CHECKOUT_PURPOSE,
  FIXTURE_COMMERCE_LISTING_IDS,
  FIXTURE_COMMERCE_MODE,
  authorizeFixtureListingPurchase,
  createFixtureListingCheckoutIntent,
  purchaseFixtureListingWithCredits,
  resolveFixtureCommerceListing,
  settleFixtureListingMoneySale,
  type AuthorizeFixtureListingPurchaseRequest,
  type CreateFixtureListingCheckoutIntentRequest,
  type FixtureListingAuthorization,
  type PurchaseFixtureListingWithCreditsRequest,
  type SettleFixtureListingMoneySaleRequest,
} from "./fixture-commerce.js";

export {
  CREATOR_SHARE_BASIS_POINTS,
  applyCreditsSale,
  authorizeCreatorPublish,
  bindSettledIntent,
  persistCreditsSale,
  recordMoneySale,
  splitCredits,
  splitMoneyMinorUnits,
  type ApplyCreditsSaleRequest,
  type CreditsSaleOutcome,
  type PersistCreditsSaleRequest,
  type RecordMoneySaleRequest,
  type SettledIntentBinding,
  type Split,
} from "./revenue-share.js";

export {
  CONNECT_ONBOARDING_IDEMPOTENCY_PREFIX,
  CONNECT_PAYOUT_IDEMPOTENCY_PREFIX,
  createInMemoryConnectStore,
  refreshConnectStatus,
  requestCreatorPayout,
  startConnectOnboarding,
  type ConnectCommit,
  type ConnectOnboardingCommit,
  type ConnectOnboardingProviderValue,
  type ConnectProviderReadiness,
  type ConnectProviderRefusal,
  type ConnectProviderResult,
  type ConnectPayoutProviderValue,
  type ConnectPayoutIntentCommit,
  type ConnectStatusProviderValue,
  type ConnectStore,
  type InMemoryConnectStore,
  type RefreshConnectStatusRequest,
  type RequestCreatorPayoutOutcome,
  type RequestCreatorPayoutRequest,
  type StartConnectOnboardingOutcome,
  type StartConnectOnboardingRequest,
  type StripeConnectProvider,
} from "./stripe-connect.js";
