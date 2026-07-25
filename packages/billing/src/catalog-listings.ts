/**
 * Catalog listing lookup and the buyer side of a purchase.
 *
 * The rule this module exists to enforce: **a buyer may only pay in a currency
 * the seller listed.** Paying credits for a money-only listing is refused rather
 * than converted, because there is no exchange rate anyone agreed to, and
 * inventing one would silently move value between the platform and the creator.
 *
 * `purchaseListingWithCredits` is the buyer-side primitive. The creator revenue
 * share composes on top of it in `revenue-share.ts`, so the buyer debit has one
 * implementation regardless of who gets paid.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import {
  CATALOG_LISTINGS_FIXTURES_PATH,
  isEpochMilliseconds,
  priceModeIncludesCredits,
  priceModeIncludesMoney,
  snapshotPlainRecord,
  validateCatalogListingSet,
  type CatalogListing,
  type CatalogListingSet,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import { requireAuthenticated, type AdminIdentity } from "@sceneaxi/auth";
import { createMoneyCheckoutIntent } from "./checkout.js";
import {
  appendCreditEntry,
  deriveEntryId,
  type AppendOutcome,
  type LedgerState,
} from "./ledger.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";
import type { EntitlementPaymentMethod } from "./entitlements.js";

let cached: CatalogListingSet | undefined;

/** Load and validate the canonical committed test-mode listing set. */
export function loadCatalogListings(): BillingOutcome<CatalogListingSet> {
  if (cached !== undefined) return billingOk(cached);

  let raw: unknown;
  try {
    const require = createRequire(import.meta.url);
    const path = require.resolve(
      `@sceneaxi/schemas/${CATALOG_LISTINGS_FIXTURES_PATH}`,
    );
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingCatalogInvalid,
      `The catalog listing set could not be read: ${detail}`,
    );
  }

  const listings = validateCatalogListingSet(raw);
  if (!listings.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingCatalogInvalid,
      `The catalog listing set is invalid (${listings.code}): ${listings.message}`,
    );
  }
  cached = listings.value;
  return billingOk(listings.value);
}

export function lookupCatalogListing(
  listingSet: unknown,
  listingId: unknown,
): BillingOutcome<CatalogListing> {
  const validated = validateCatalogListingSet(listingSet);
  if (!validated.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingCatalogInvalid,
      `The catalog listing set is invalid (${validated.code}): ${validated.message}`,
    );
  }
  if (typeof listingId !== "string" || listingId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingUnknown,
      "A listing id is required.",
    );
  }
  const listing = validated.value.listings.find(
    (held) => held.listingId === listingId,
  );
  if (listing === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingUnknown,
      `No listing named "${listingId}" exists.`,
    );
  }
  return billingOk(listing);
}

/**
 * Check the buyer's chosen currency against what the seller listed.
 *
 * Exported because both the credits path and the money path need the same
 * answer, and a second copy of this rule is how the two paths drift.
 */
export function assertCurrencyListed(
  listing: CatalogListing,
  payWith: EntitlementPaymentMethod,
): BillingOutcome<CatalogListing> {
  const validated = validateCatalogListingSet({
    schemaVersion: 1,
    mode: "test",
    listings: [listing],
  });
  if (!validated.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingPriceModeMismatch,
      `The listing is invalid (${validated.code}): ${validated.message}`,
    );
  }
  const checked = validated.value.listings[0];
  if (checked === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingUnknown,
      "The listing could not be validated.",
    );
  }

  if (payWith === "credits" && !priceModeIncludesCredits(checked.priceMode)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
      `Listing "${checked.listingId}" is not priced in credits (priceMode "${checked.priceMode}"); no conversion is invented.`,
    );
  }
  if (payWith === "money" && !priceModeIncludesMoney(checked.priceMode)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
      `Listing "${checked.listingId}" is not priced in money (priceMode "${checked.priceMode}"); no conversion is invented.`,
    );
  }
  return billingOk(checked);
}

export type PurchaseListingWithCreditsRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, used to re-derive the role at the guard. */
  admin: AdminIdentity;
  listing: CatalogListing;
  /** The buyer's ledger. */
  buyerState: LedgerState;
  /** Epoch milliseconds. */
  now: number;
  /** Distinguishes one sale from another for idempotency. */
  saleId: string;
  surface?: IdentitySurface | undefined;
}>;

export type ListingPurchaseOutcome = Readonly<{
  buyer: AppendOutcome;
  listing: CatalogListing;
  /** False when an admin's unlimited allowance applied and nothing was charged. */
  charged: boolean;
}>;

/** Namespace for listing-sale idempotency keys. */
export const LISTING_SALE_IDEMPOTENCY_PREFIX = "sale:" as const;

/** Debit a buyer for a credits-priced listing, or refuse without partial effect. */
export function purchaseListingWithCredits(
  request: PurchaseListingWithCreditsRequest,
): BillingOutcome<ListingPurchaseOutcome> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A listing purchase request must be a plain object.",
    );
  }
  const screened = record as PurchaseListingWithCreditsRequest;
  const { principal, admin, listing, buyerState, now, saleId, surface } = screened;

  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "A listing purchase requires valid epoch milliseconds.",
    );
  }
  if (typeof saleId !== "string" || saleId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A listing purchase requires a sale id for idempotency.",
    );
  }
  if (surface === "kids") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.kidsCommerceDenied,
      "Kids commerce is denied; no catalog purchase is offered on the Kids surface.",
    );
  }

  const listed = assertCurrencyListed(listing, "credits");
  if (!listed.ok) return listed;
  const creditPrice = listed.value.creditPrice;
  if (creditPrice === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingPriceModeMismatch,
      `Listing "${listed.value.listingId}" claims a credit price mode but carries no creditPrice.`,
    );
  }

  const guarded = requireAuthenticated(
    principal,
    surface === undefined ? { now, admin } : { now, surface, admin },
  );
  if (!guarded.ok) return billingRefuse(guarded.reason, guarded.message);

  if (guarded.value.user.userId === listed.value.sellerUserId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingSelfPurchaseDenied,
      "A seller cannot buy their own listing; the revenue share would return their own credits.",
    );
  }

  const buyerRecord = snapshotPlainRecord(buyerState);
  const buyerAccount = snapshotPlainRecord(buyerRecord?.["account"]);
  if (
    buyerRecord === undefined ||
    buyerAccount === undefined ||
    buyerAccount["userId"] !== guarded.value.user.userId
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.accountNotOwned,
      "The buyer's credit account belongs to a different user.",
    );
  }

  const idempotencyKey = `${LISTING_SALE_IDEMPOTENCY_PREFIX}${saleId}:buyer`;

  // The captain's unlimited allowance: no debit is appended and none is
  // faked. The sale still happened, so the caller can still pay the creator;
  // the no-charge outcome is reported explicitly rather than as a ledger row.
  if (guarded.value.role.role === "admin") {
    return billingOk(
      Object.freeze({
        buyer: Object.freeze({
          state: buyerState,
          entry: undefined,
          replayed: false,
        }),
        listing: listed.value,
        charged: false,
      }),
    );
  }

  const debited = appendCreditEntry(buyerState, {
    entryId: deriveEntryId(idempotencyKey),
    movement: "debit",
    delta: -creditPrice,
    reason: `catalog listing ${listed.value.listingId} purchased`,
    idempotencyKey,
    now,
  });
  if (!debited.ok) return debited;

  return billingOk(
    Object.freeze({
      buyer: debited.value,
      listing: listed.value,
      charged: true,
    }),
  );
}

export type CreateListingCheckoutIntentRequest = Readonly<{
  principal: unknown;
  /** The single resolved admin identity, used to re-derive the role at the guard. */
  admin: AdminIdentity;
  listing: CatalogListing;
  successUrl: string;
  cancelUrl: string;
  /** Epoch milliseconds. */
  now: number;
  saleId: string;
  surface?: IdentitySurface | undefined;
  liveModeAuthorized?: boolean | undefined;
}>;

const LISTING_CHECKOUT_REQUEST_KEYS = new Set([
  "principal",
  "admin",
  "listing",
  "successUrl",
  "cancelUrl",
  "now",
  "saleId",
  "surface",
  "liveModeAuthorized",
]);

/**
 * Build a money checkout intent for a listing.
 *
 * The listing's own price is used, expressed as a one-off pack-shaped catalog so
 * the single checkout-intent builder — and its https and live-mode guards —
 * stays the only path that produces an intent.
 */
export function createListingCheckoutIntent(
  request: CreateListingCheckoutIntentRequest,
) {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A listing checkout request must be a plain object.",
    );
  }
  const unexpectedProperty = Object.keys(record).find(
    (key) => !LISTING_CHECKOUT_REQUEST_KEYS.has(key),
  );
  if (unexpectedProperty !== undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingCheckoutUnexpectedProperty,
      `A listing checkout request has unexpected property "${unexpectedProperty}".`,
    );
  }
  const screened = record as CreateListingCheckoutIntentRequest;
  const {
    principal,
    admin,
    listing,
    successUrl,
    cancelUrl,
    now,
    saleId,
    surface,
    liveModeAuthorized,
  } = screened;

  if (surface === "kids") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.kidsCommerceDenied,
      "Kids commerce is denied; no catalog purchase is offered on the Kids surface.",
    );
  }
  if (typeof saleId !== "string" || saleId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A listing checkout requires a sale id for idempotency.",
    );
  }

  const listed = assertCurrencyListed(listing, "money");
  if (!listed.ok) return listed;
  const moneyPrice = listed.value.moneyPrice;
  if (moneyPrice === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingPriceModeMismatch,
      `Listing "${listed.value.listingId}" claims a money price mode but carries no moneyPrice.`,
    );
  }

  const guarded = requireAuthenticated(
    principal,
    surface === undefined ? { now, admin } : { now, surface, admin },
  );
  if (!guarded.ok) return billingRefuse(guarded.reason, guarded.message);

  if (guarded.value.user.userId === listed.value.sellerUserId) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.listingSelfPurchaseDenied,
      "A seller cannot buy their own listing.",
    );
  }

  return createMoneyCheckoutIntent({
    purpose: "catalog-listing",
    itemId: listed.value.listingId,
    userId: guarded.value.user.userId,
    unitAmount: moneyPrice.unitAmount,
    currency: moneyPrice.currency,
    stripePriceId: moneyPrice.stripePriceId,
    successUrl,
    cancelUrl,
    idempotencyKey: `${LISTING_SALE_IDEMPOTENCY_PREFIX}${saleId}`,
    now,
    ...(liveModeAuthorized === undefined ? {} : { liveModeAuthorized }),
  });
}
