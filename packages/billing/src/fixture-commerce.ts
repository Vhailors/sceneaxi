/**
 * The one bounded, test-mode commerce path over the committed fixture catalog.
 *
 * Everything a real marketplace would need already exists one layer down —
 * listings, the buyer debit, the creator revenue share, the Stripe test-mode
 * checkout intent, and the webhook parser. What was missing is the thing that
 * makes those honest to *offer*: a statement of what is actually for sale. This
 * module is that statement, and it is deliberately a closed enumeration of
 * exactly one fixture SKU (`FIXTURE_COMMERCE_LISTING_IDS`).
 *
 * Three properties are why this is a module rather than a call sequence in a
 * test:
 *
 * 1. **A listing is resolved by id from the committed set, never supplied.**
 *    The layer below takes a `CatalogListing` *value*, which is right for it —
 *    it is the mechanism, and mechanisms take arguments. But it means a caller
 *    holding a hand-built listing object can transact against a SKU nobody
 *    published. No function here accepts a listing, so on this path the only
 *    purchasable assets are the enumerated ones: everything else — an unknown
 *    id, a fabricated listing, and every other committed fixture listing —
 *    refuses `LISTING_FIXTURE_COMMERCE_NOT_ENABLED`.
 *
 * 2. **The documented entitlement is actually evaluated.** The free-vs-paid
 *    matrix prices `catalog-asset-purchase` as account-required,
 *    credits-or-money. Both entry points here evaluate it with the currency the
 *    buyer chose, so the matrix row governs a purchase instead of merely
 *    describing one, and an insufficient balance refuses before any ledger is
 *    appended to.
 *
 * 3. **Money bookkeeping is bound to a settlement, not asserted.**
 *    `recordMoneySale` will record a split for any listing handed to it, which
 *    is correct for a primitive and wrong for a ledger of what was collected.
 *    `settleFixtureListingMoneySale` takes only the branded output of
 *    `parseCheckoutCompletedEvent` plus the persisted intent it was bound to, so
 *    a `MoneySplitRecord` on this path can only describe money a
 *    signature-verified Stripe settlement actually took.
 *
 * **Test mode only, structurally.** No function here accepts a
 * `liveModeAuthorized` flag, so the captain go-live gate cannot be passed
 * through this path at all: a live intent's completion refuses
 * `STRIPE_LIVE_MODE_NOT_AUTHORIZED`. This module adds no ledger, no second
 * entitlement table, no publishing surface, and no catalog activation — it only
 * narrows what the existing seams may be pointed at.
 */

import {
  snapshotPlainRecord,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  type CatalogListing,
  type CheckoutSessionIntent,
  type EntitlementCapability,
  type EntitlementDecision,
  type IdentitySurface,
  type MoneySplitRecord,
} from "@sceneaxi/schemas";
import type { AdminIdentity } from "@sceneaxi/auth";
import {
  LISTING_SALE_IDEMPOTENCY_PREFIX,
  createListingCheckoutIntent,
  loadCatalogListings,
  lookupCatalogListing,
} from "./catalog-listings.js";
import { assertModeAuthorized, deriveIntentId } from "./checkout.js";
import {
  evaluateEntitlement,
  type EntitlementPaymentMethod,
} from "./entitlements.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";
import {
  applyCreditsSale,
  persistCreditsSale,
  recordMoneySale,
  type CreditsSaleOutcome,
} from "./revenue-share.js";
import {
  loadLedgerState,
  validateLedgerState,
  type LedgerState,
} from "./ledger.js";
import type { CreditStore } from "./store.js";
import type { VerifiedCheckoutCompletion } from "./stripe-webhook.js";

/**
 * Every listing that may be transacted on this path.
 *
 * One SKU, and a dual-priced one, so both currencies are exercised by the same
 * asset. A second entry is a product decision, not a refactor: it is what turns
 * "one proven fixture purchase" into "a catalog is open for business".
 */
export const FIXTURE_COMMERCE_LISTING_IDS = Object.freeze([
  "market-stall-kit",
] as const);

/** The capability the free-vs-paid matrix prices a catalog purchase under. */
export const FIXTURE_COMMERCE_CAPABILITY: EntitlementCapability =
  "catalog-asset-purchase";

/** The only billing mode this path transacts in. */
export const FIXTURE_COMMERCE_MODE = "test" as const;

/** The checkout purpose a listing settlement must carry. */
export const FIXTURE_COMMERCE_CHECKOUT_PURPOSE = "catalog-listing" as const;

function isFixtureCommerceListingId(listingId: unknown): boolean {
  return FIXTURE_COMMERCE_LISTING_IDS.some((held) => held === listingId);
}

/**
 * Resolve one enabled fixture SKU from the committed listing set.
 *
 * A pure catalog read: no identity, no ledger, and no money are involved, so it
 * is safe to run before the entitlement gate that follows it in both entry
 * points. It is also the only way a `CatalogListing` enters this module.
 */
export function resolveFixtureCommerceListing(
  listingId: unknown,
): BillingOutcome<CatalogListing> {
  if (!isFixtureCommerceListingId(listingId)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingFixtureCommerceNotEnabled,
      `Listing "${String(listingId)}" is not enabled for fixture commerce; exactly ${FIXTURE_COMMERCE_LISTING_IDS.join(", ")} is purchasable, and the rest of the catalog is inert.`,
    );
  }

  const listings = loadCatalogListings();
  if (!listings.ok) return listings;

  const listing = lookupCatalogListing(listings.value, listingId);
  if (!listing.ok) return listing;

  // The enabled SKU is dual-priced on purpose: one asset proves both the credit
  // ledger's creator share and the money bookkeeping. A single-currency listing
  // reaching this path would mean the enumeration and the committed set drifted.
  if (listing.value.priceMode !== "credits-and-money") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingPriceModeMismatch,
      `Fixture commerce transacts a dual-priced listing; "${listing.value.listingId}" is priced "${listing.value.priceMode}".`,
    );
  }
  return billingOk(listing.value);
}

/**
 * The buyer's ledger as it stood immediately before this sale's debit, when
 * that debit is already in it.
 *
 * The balance gate below this is new, and it sits *above* the ledger's own
 * idempotency check, which is at the bottom of the stack. Without this, adding
 * the gate would break the retry it is supposed to protect: a caller re-sending
 * `sale_01` after a timeout holds a ledger that has already paid the 75 credits,
 * so a naive balance check would refuse `CREDIT_BALANCE_INSUFFICIENT` out of the
 * balance the caller's own first attempt spent — for a sale the layer below
 * would simply have replayed. Answering the balance question against the state
 * that preceded the debit asks it exactly once, while capability, Kids,
 * identity, ownership, and self-purchase are still re-checked on the retry.
 *
 * Recognition is over the supplied ledger because that is the same ledger
 * `applyCreditsSale`'s own idempotency reads; the gate must not be able to
 * refuse a retry the layer beneath it would replay.
 */
function ledgerBeforeSaleDebit(
  buyerState: LedgerState | undefined,
  saleId: unknown,
): LedgerState | undefined {
  if (typeof saleId !== "string" || saleId.length === 0) return undefined;
  const validated = validateLedgerState(buyerState);
  if (!validated.ok) return undefined;
  const key = `${LISTING_SALE_IDEMPOTENCY_PREFIX}${saleId}:buyer`;
  const index = validated.value.entries.findIndex(
    (entry) => entry.idempotencyKey === key,
  );
  if (index < 0) return undefined;
  const before = loadLedgerState(
    validated.value.account,
    validated.value.entries.slice(0, index),
  );
  return before.ok ? before.value : undefined;
}

export type AuthorizeFixtureListingPurchaseRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, used to re-derive the role at the guard. */
  admin: AdminIdentity;
  listingId: unknown;
  /** The currency the buyer chose; the seller's listing decides what is offered. */
  payWith: EntitlementPaymentMethod;
  /** The buyer's ledger. Required for the credits currency, unread for money. */
  buyerState?: LedgerState | undefined;
  /** Epoch milliseconds. */
  now: number;
  surface?: IdentitySurface | undefined;
  /**
   * The sale this authorization is for. Supplied by the purchase path so a
   * retry is judged against the balance it had before its own debit; a browse
   * surface asking only "would this be permitted" has no sale yet and omits it.
   */
  saleId?: string | undefined;
}>;

export type FixtureListingAuthorization = Readonly<{
  listing: CatalogListing;
  decision: EntitlementDecision;
}>;

/**
 * Resolve the SKU and evaluate the documented catalog-purchase entitlement.
 *
 * Exported because a browse surface needs to know whether a purchase would be
 * permitted before it offers one, and a second copy of this pairing is how the
 * offer and the transaction would come to disagree.
 */
export function authorizeFixtureListingPurchase(
  request: AuthorizeFixtureListingPurchaseRequest,
): BillingOutcome<FixtureListingAuthorization> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A fixture listing purchase request must be a plain object.",
    );
  }
  const screened = record as AuthorizeFixtureListingPurchaseRequest;
  const {
    principal,
    admin,
    listingId,
    payWith,
    buyerState,
    now,
    surface,
    saleId,
  } = screened;

  if (surface === "kids") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.kidsCommerceDenied,
      "Kids commerce is denied; no catalog purchase is offered on the Kids surface.",
    );
  }

  const listing = resolveFixtureCommerceListing(listingId);
  if (!listing.ok) return listing;

  const creditPrice = listing.value.creditPrice;
  if (payWith === "credits" && creditPrice === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingPriceModeMismatch,
      `Listing "${listing.value.listingId}" claims a credit price mode but carries no creditPrice.`,
    );
  }

  const judgedState = ledgerBeforeSaleDebit(buyerState, saleId) ?? buyerState;
  const decision = evaluateEntitlement({
    capability: FIXTURE_COMMERCE_CAPABILITY,
    now,
    admin,
    principal,
    payWith,
    ...(surface === undefined ? {} : { surface }),
    ...(judgedState === undefined ? {} : { state: judgedState }),
    ...(payWith === "credits" && creditPrice !== undefined
      ? { creditAmount: creditPrice }
      : {}),
  });
  if (!decision.ok) return decision;

  return billingOk(
    Object.freeze({ listing: listing.value, decision: decision.value }),
  );
}

export type PurchaseFixtureListingWithCreditsRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, used to re-derive the role at the guard. */
  admin: AdminIdentity;
  listingId: unknown;
  /** The buyer's ledger. */
  buyerState: LedgerState;
  /** The creator's ledger; must belong to the listing's seller. */
  creatorState: LedgerState;
  /** Epoch milliseconds. */
  now: number;
  saleId: string;
  surface?: IdentitySurface | undefined;
  /**
   * When given, the sale is settled atomically through the store as well as
   * computed. Absent means the pure computation only, which is what a caller
   * without a provisioned `CreditAccount` can honestly do.
   */
  store?: CreditStore | undefined;
}>;

/**
 * Buy the enabled fixture SKU with credits: buyer debited, creator paid 50%.
 *
 * Async in both shapes so the caller does not branch on whether a store was
 * supplied; the storeless form is the pure `applyCreditsSale` computation.
 */
export async function purchaseFixtureListingWithCredits(
  request: PurchaseFixtureListingWithCreditsRequest,
): Promise<BillingOutcome<CreditsSaleOutcome>> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A fixture listing credits purchase request must be a plain object.",
    );
  }
  const screened = record as PurchaseFixtureListingWithCreditsRequest;
  const {
    principal,
    admin,
    listingId,
    buyerState,
    creatorState,
    now,
    saleId,
    surface,
    store,
  } = screened;

  const authorized = authorizeFixtureListingPurchase({
    principal,
    admin,
    listingId,
    payWith: "credits",
    buyerState,
    now,
    saleId,
    ...(surface === undefined ? {} : { surface }),
  });
  if (!authorized.ok) return authorized;

  const sale = {
    principal,
    admin,
    listing: authorized.value.listing,
    buyerState,
    creatorState,
    now,
    saleId,
    ...(surface === undefined ? {} : { surface }),
  };
  return store === undefined
    ? applyCreditsSale(sale)
    : persistCreditsSale({ ...sale, store });
}

export type CreateFixtureListingCheckoutIntentRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, used to re-derive the role at the guard. */
  admin: AdminIdentity;
  listingId: unknown;
  successUrl: string;
  cancelUrl: string;
  /** Epoch milliseconds. */
  now: number;
  saleId: string;
  surface?: IdentitySurface | undefined;
}>;

/**
 * Build the test-mode Stripe checkout intent for the enabled fixture SKU.
 *
 * There is no `liveModeAuthorized` parameter, and none is forwarded, so this
 * entry point can only ever produce a `test` intent — the go-live gate is not
 * merely defaulted off here, it is unreachable.
 */
export function createFixtureListingCheckoutIntent(
  request: CreateFixtureListingCheckoutIntentRequest,
): BillingOutcome<CheckoutSessionIntent> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A fixture listing checkout request must be a plain object.",
    );
  }
  const screened = record as CreateFixtureListingCheckoutIntentRequest;
  const {
    principal,
    admin,
    listingId,
    successUrl,
    cancelUrl,
    now,
    saleId,
    surface,
  } = screened;

  const authorized = authorizeFixtureListingPurchase({
    principal,
    admin,
    listingId,
    payWith: "money",
    now,
    ...(surface === undefined ? {} : { surface }),
  });
  if (!authorized.ok) return authorized;

  return createListingCheckoutIntent({
    principal,
    admin,
    listing: authorized.value.listing,
    successUrl,
    cancelUrl,
    now,
    saleId,
    ...(surface === undefined ? {} : { surface }),
  });
}

export type SettleFixtureListingMoneySaleRequest = Readonly<{
  /**
   * A completion whose provenance is proven: the branded output of
   * `parseCheckoutCompletedEvent`, which only accepts a signature-verified
   * webhook body.
   */
  completion: VerifiedCheckoutCompletion;
  /**
   * The persisted intent the completion was bound to. It carries the sale id
   * this bookkeeping belongs to, inside the idempotency key the checkout was
   * created under, so the recorded sale cannot be renamed after settlement.
   */
  intent: CheckoutSessionIntent;
  /** Epoch milliseconds. */
  now: number;
}>;

/**
 * Record the 50/50 money split for a settled fixture listing purchase.
 *
 * Bookkeeping only, exactly like `recordMoneySale` beneath it: no payout, no
 * transfer, no Stripe Connect. What this adds is that the record can only
 * describe money a verified Stripe test settlement actually took, for a SKU that
 * is enabled for sale, at the price the seller listed.
 */
export function settleFixtureListingMoneySale(
  request: SettleFixtureListingMoneySaleRequest,
): BillingOutcome<MoneySplitRecord> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A fixture listing money settlement request must be a plain object.",
    );
  }
  const screened = record as SettleFixtureListingMoneySaleRequest;

  const completion = validateCheckoutCompletedEvent(screened.completion);
  if (!completion.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The checkout completion is invalid (${completion.code}): ${completion.message}`,
    );
  }
  if (completion.value.purpose !== FIXTURE_COMMERCE_CHECKOUT_PURPOSE) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `A ${completion.value.purpose} completion books no listing sale; only a ${FIXTURE_COMMERCE_CHECKOUT_PURPOSE} settlement does.`,
    );
  }

  // No live authorization is accepted here, so a live settlement refuses by
  // name rather than being recorded as a test one.
  const mode = assertModeAuthorized(completion.value.mode, undefined);
  if (!mode.ok) return mode;

  const intent = validateCheckoutSessionIntent(screened.intent);
  if (!intent.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      `The persisted checkout intent is invalid (${intent.code}): ${intent.message}`,
    );
  }
  if (
    intent.value.intentId !== completion.value.intentId ||
    intent.value.userId !== completion.value.userId ||
    intent.value.purpose !== completion.value.purpose ||
    intent.value.itemId !== completion.value.itemId ||
    intent.value.mode !== completion.value.mode ||
    intent.value.unitAmount !== completion.value.unitAmount ||
    intent.value.currency !== completion.value.currency ||
    intent.value.stripePriceId !== completion.value.stripePriceId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The persisted checkout intent does not describe the settled completion.",
    );
  }
  if (!intent.value.idempotencyKey.startsWith(LISTING_SALE_IDEMPOTENCY_PREFIX)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      `A listing settlement's intent must be keyed "${LISTING_SALE_IDEMPOTENCY_PREFIX}<saleId>"; the sale id is not supplied separately, so bookkeeping cannot be attached to a different sale after the fact.`,
    );
  }
  // The completion pins `intentId`, and every real intent derives that id from
  // its own idempotency key. Re-deriving it is what binds the key — and so the
  // sale id read out of it below — to the verified settlement; without it the
  // key is the one intent field a caller could rename after the fact.
  if (deriveIntentId(intent.value.idempotencyKey) !== intent.value.intentId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The persisted checkout intent's idempotency key does not derive its intent id; the settled sale cannot be renamed.",
    );
  }
  const saleId = intent.value.idempotencyKey.slice(
    LISTING_SALE_IDEMPOTENCY_PREFIX.length,
  );
  if (saleId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.checkoutIntentInvalid,
      "The checkout intent's idempotency key names no sale id.",
    );
  }

  const listing = resolveFixtureCommerceListing(completion.value.itemId);
  if (!listing.ok) return listing;

  // The seller's listed price is what `recordMoneySale` splits, so a settlement
  // for some other amount must not be booked against it: the two figures would
  // silently disagree about what was collected.
  const moneyPrice = listing.value.moneyPrice;
  if (
    moneyPrice === undefined ||
    moneyPrice.unitAmount !== completion.value.unitAmount ||
    moneyPrice.currency !== completion.value.currency ||
    moneyPrice.stripePriceId !== completion.value.stripePriceId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      `The settled amount does not match the listed price of "${listing.value.listingId}"; no split is recorded for a sum the seller never listed.`,
    );
  }

  return recordMoneySale({
    listing: listing.value,
    buyerUserId: completion.value.userId,
    saleId,
    mode: mode.value,
    now: screened.now,
  });
}
