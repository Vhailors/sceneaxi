/**
 * @sceneaxi/billing — credits and billing for the SceneAxi identity plane.
 *
 * Owns the append-only credit ledger, metering, entitlement enforcement, and
 * the Stripe test-mode checkout and webhook paths. Neon and the Stripe API are
 * injected adapters, never dependencies; webhook *signature verification* is
 * implemented in-repo because it is the security boundary and is fully
 * deterministic. See docs/auth-credits.md and ADR 0016.
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
  createInMemoryCreditStore,
  type CreditStore,
  type CreditsSaleSettlement,
  type InMemoryCreditStore,
  type InMemoryCreditStoreOptions,
} from "./store.js";

export {
  meterCredits,
  type MeterCreditsRequest,
  type MeterOutcome,
} from "./metering.js";

export {
  loadCreditPackCatalog,
  lookupCreditPack,
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
  assertModeAuthorized,
  createCheckoutSessionIntent,
  deriveIntentId,
  type CreateCheckoutSessionIntentRequest,
} from "./checkout.js";

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
  STRIPE_EVENT_IDEMPOTENCY_PREFIX,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  applyCheckoutCompletedGrant,
  parseCheckoutCompletedEvent,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  type ApplyCheckoutCompletedGrantRequest,
  type CheckoutSettlement,
  type CheckoutSettlementPort,
  type VerifiedCheckoutCompletion,
  type VerifiedWebhook,
  type VerifyStripeWebhookSignatureRequest,
} from "./stripe-webhook.js";

export {
  CREATOR_SHARE_BASIS_POINTS,
  applyCreditsSale,
  authorizeCreatorPublish,
  recordMoneySale,
  splitCredits,
  splitMoneyMinorUnits,
  type ApplyCreditsSaleRequest,
  type CreditsSaleOutcome,
  type RecordMoneySaleRequest,
  type Split,
} from "./revenue-share.js";
