/**
 * Catalog view models for the two deployable storefronts.
 *
 * The committed `CatalogListingSet` is the only listing inventory. This module
 * validates its bundled twin, projects it for the two sites, and deliberately
 * adds no asset payload, licence, preview, compatibility, checkout, or payment
 * completion that the listing contract does not contain.
 *
 * Commerce remains fail-closed on the catalog origins. The fixture set is
 * structurally TEST-only, and these sites have no billing implementation or
 * checkout adapter. Prices and the established creator-share rule are useful
 * evaluation metadata; they are not evidence that payment happened.
 */
import { createHash } from "node:crypto";
import {
  CATALOG_LISTINGS_DATA,
  CATALOG_LISTINGS_FIXTURES_PATH,
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  type CatalogListing,
  type ListingPriceMode,
  validateCatalogListingSet,
} from "@sceneaxi/schemas";
import { type SiteRefusal, type SiteResult, ok, refuse } from "./refusals.js";

/** The two storefront surfaces. The umbrella is not a catalog. */
export const CATALOG_SURFACES = Object.freeze(["catalog-game", "catalog-web"] as const);

export type CatalogSurface = (typeof CATALOG_SURFACES)[number];

export type SiteMoneyPrice = {
  /** Minor units, exactly as committed in the listing contract. */
  readonly unitAmount: number;
  readonly currency: string;
};

/**
 * Dual price. Either side may be absent according to the seller's price mode;
 * the contract validator guarantees that at least one is present.
 */
export type SiteListingPrice = {
  readonly credits: number | null;
  readonly money: SiteMoneyPrice | null;
};

export type CatalogListingAvailability = {
  readonly browse: "listed-fixture";
  readonly asset: "metadata-only";
  readonly purchase: "refused";
  readonly mode: "test";
  readonly reason: "CATALOG_COMMERCE_INERT";
};

/** The honest shared state of every record in the committed TEST fixture set. */
export const CATALOG_LISTING_AVAILABILITY: CatalogListingAvailability = Object.freeze({
  browse: "listed-fixture",
  asset: "metadata-only",
  purchase: "refused",
  mode: "test",
  reason: "CATALOG_COMMERCE_INERT",
});

export type SiteListing = {
  readonly surface: CatalogSurface;
  /** Route-compatible alias of the canonical `listingId`. */
  readonly itemId: string;
  readonly title: string;
  readonly creatorId: string;
  readonly publishedAt: string;
  readonly priceMode: ListingPriceMode;
  readonly price: SiteListingPrice;
  /** Digest of the validated listing record, never represented as an asset digest. */
  readonly recordDigest: string;
  readonly availability: CatalogListingAvailability;
  /** The exact validated record from the committed fixture set. */
  readonly listing: CatalogListing;
};

export type PriceDisplay = {
  readonly credits: string | null;
  readonly money: string | null;
  /** How the listing reads when both sides are offered. */
  readonly label: string;
};

function deepFreeze<T extends object>(value: T): T {
  for (const nested of Object.values(value) as unknown[]) {
    if (nested !== null && typeof nested === "object") deepFreeze(nested as object);
  }
  return Object.freeze(value);
}

const validatedListingSet = validateCatalogListingSet(CATALOG_LISTINGS_DATA);
if (!validatedListingSet.ok) {
  throw new Error(
    `Committed catalog listing data refused ${validatedListingSet.code}: ${validatedListingSet.message}`,
  );
}

/** The mode is contract-validated as TEST before any listing reaches a site. */
export const SITE_CATALOG_MODE = validatedListingSet.value.mode;

const surfaceFor = (listing: CatalogListing): CatalogSurface =>
  listing.catalog === "game" ? "catalog-game" : "catalog-web";

const recordDigest = (listing: CatalogListing) =>
  `sha256:${createHash("sha256").update(JSON.stringify(listing), "utf8").digest("hex")}`;

const LISTINGS: readonly SiteListing[] = deepFreeze(
  validatedListingSet.value.listings.map((listing) => ({
    surface: surfaceFor(listing),
    itemId: listing.listingId,
    title: listing.title,
    creatorId: listing.sellerUserId,
    publishedAt: listing.publishedAt,
    priceMode: listing.priceMode,
    price: {
      credits: listing.creditPrice ?? null,
      money:
        listing.moneyPrice === undefined
          ? null
          : {
              unitAmount: listing.moneyPrice.unitAmount,
              currency: listing.moneyPrice.currency,
            },
    },
    recordDigest: recordDigest(listing),
    availability: CATALOG_LISTING_AVAILABILITY,
    listing,
  })),
) as readonly SiteListing[];

/** Listed fixture records for one storefront surface. */
export function listSiteCatalog(surface: CatalogSurface): readonly SiteListing[] {
  return Object.freeze(LISTINGS.filter((listing) => listing.surface === surface));
}

/** One listing, or a named refusal so a detail route can answer 404 honestly. */
export function showSiteListing(
  surface: CatalogSurface,
  itemId: string,
): SiteResult<SiteListing> {
  const listing = LISTINGS.find(
    (candidate) => candidate.surface === surface && candidate.itemId === itemId,
  );
  return listing === undefined ? refuse("CATALOG_ITEM_NOT_FOUND") : ok(listing);
}

function currencyFractionDigits(currency: string): number | null {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? null;
  } catch {
    return null;
  }
}

/** Format committed minor units without introducing a locale-dependent symbol. */
export function formatMoneyPrice(price: SiteMoneyPrice): string {
  const digits = currencyFractionDigits(price.currency);
  if (digits === null) {
    return `${price.unitAmount} ${price.currency.toUpperCase()} minor units`;
  }
  const scale = 10 ** digits;
  return `${(price.unitAmount / scale).toFixed(digits)} ${price.currency.toUpperCase()}`;
}

/** Render a dual price. Refuses when the listing offers neither side. */
export function describeListingPrice(price: SiteListingPrice): SiteResult<PriceDisplay> {
  const credits =
    price.credits === null
      ? null
      : `${price.credits} credit${price.credits === 1 ? "" : "s"}`;
  const money = price.money === null ? null : formatMoneyPrice(price.money);
  if (credits === null && money === null) return refuse("CATALOG_PRICE_UNAVAILABLE");
  const label =
    credits !== null && money !== null
      ? `${credits} or ${money}`
      : ((credits ?? money) as string);
  return ok(Object.freeze({ credits, money, label }));
}

export type CreatorShare = {
  readonly total: number;
  readonly creator: number;
  readonly platform: number;
};

/**
 * The captain's 50% creator share.
 *
 * Integer split with no lost unit: the creator takes the floor and the platform
 * absorbs the odd remainder, so `creator + platform === total` always holds.
 */
export function creatorShare(total: number): SiteResult<CreatorShare> {
  if (!Number.isSafeInteger(total) || total < 0) return refuse("CATALOG_PRICE_UNAVAILABLE");
  const creator = Math.floor(total / 2);
  return ok(Object.freeze({ total, creator, platform: total - creator }));
}

export type CreatorShareDisplay = {
  readonly credits: string | null;
  readonly money: string | null;
  readonly label: string;
  readonly settlement: "credits-ledger-or-money-bookkeeping-only";
};

/** Project the existing 50/50 rule for every currency a listing actually offers. */
export function describeCreatorShare(
  price: SiteListingPrice,
): SiteResult<CreatorShareDisplay> {
  const creditsSplit = price.credits === null ? null : creatorShare(price.credits);
  if (creditsSplit !== null && !creditsSplit.ok) return creditsSplit;
  const moneySplit = price.money === null ? null : creatorShare(price.money.unitAmount);
  if (moneySplit !== null && !moneySplit.ok) return moneySplit;

  const credits =
    creditsSplit === null
      ? null
      : `${creditsSplit.value.creator} creator / ${creditsSplit.value.platform} platform credits`;
  const money =
    moneySplit === null || price.money === null
      ? null
      : `${formatMoneyPrice({
          unitAmount: moneySplit.value.creator,
          currency: price.money.currency,
        })} creator / ${formatMoneyPrice({
          unitAmount: moneySplit.value.platform,
          currency: price.money.currency,
        })} platform (bookkeeping only)`;
  if (credits === null && money === null) return refuse("CATALOG_PRICE_UNAVAILABLE");
  return ok(
    Object.freeze({
      credits,
      money,
      label: [credits, money].filter((value): value is string => value !== null).join("; "),
      settlement: "credits-ledger-or-money-bookkeeping-only" as const,
    }),
  );
}

/** The share rule as displayed to a creator. Display only — no ledger authority. */
export const CREATOR_SHARE_RULE = Object.freeze({
  creatorPercent: 50,
  platformPercent: 50,
  note:
    "Creators receive 50% of the credits on a sale; money sales are booked 50/50. Credit totals are split in whole units, so on an odd total the creator takes the floor (for example 17 of 35 credits) and the platform absorbs the single remaining unit rather than shorting either side. Payouts are not activated in this wave.",
});

export const CREATOR_SHARE_ROUNDING_NOTE =
  "Shares use whole minor units: on an odd total the creator takes the floor and the platform absorbs the remainder. Money shares are bookkeeping only; no payout is claimed.";

export type CatalogCommerceRefusal = SiteRefusal & {
  readonly gate: typeof COMMERCE_ACTIVATION_GATE;
  readonly registryCite: string;
  readonly mode: "test";
  /** A refusal can never be presented as payment evidence. */
  readonly completion: "none";
};

const commerceInert = (): CatalogCommerceRefusal =>
  Object.freeze({
    ...refuse("CATALOG_COMMERCE_INERT"),
    gate: COMMERCE_ACTIVATION_GATE,
    registryCite: COMMERCE_ACTIVATION_GATE.registry,
    mode: SITE_CATALOG_MODE,
    completion: "none" as const,
  });

export type CatalogPurchaseRequest = {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly payWith: "credits" | "money";
};

/**
 * Attempt a storefront purchase. It validates the listing and selected currency,
 * then refuses the TEST-only flow before checkout, ledger mutation, or payment
 * completion. The sites own no billing implementation and cannot widen this path.
 */
export function attemptCatalogPurchase(
  request: CatalogPurchaseRequest,
): SiteResult<never> | CatalogCommerceRefusal {
  const listing = showSiteListing(request.surface, request.itemId);
  if (!listing.ok) return listing;
  const price = describeListingPrice(listing.value.price);
  if (!price.ok) return price;
  if (
    (request.payWith === "credits" && listing.value.price.credits === null) ||
    (request.payWith === "money" && listing.value.price.money === null)
  ) {
    return refuse("CATALOG_PURCHASE_METHOD_UNAVAILABLE");
  }
  return commerceInert();
}

export type PublishIntent = {
  readonly creatorId: string;
  readonly surface: CatalogSurface;
  readonly title: string;
  readonly price: SiteListingPrice;
  readonly share: CreatorShare | null;
  readonly rule: typeof CREATOR_SHARE_RULE;
  /** Publishing is display-only in this wave; submission refuses. */
  readonly submittable: false;
};

/** Build the display-only creator publish intent, including the share preview. */
export function createPublishIntent(input: {
  readonly creatorId: string;
  readonly surface: CatalogSurface;
  readonly title: string;
  readonly price: SiteListingPrice;
}): SiteResult<PublishIntent> {
  const display = describeListingPrice(input.price);
  if (!display.ok) return display;
  const share = input.price.credits === null ? null : creatorShare(input.price.credits);
  if (share !== null && !share.ok) return share;
  return ok(
    Object.freeze({
      creatorId: input.creatorId,
      surface: input.surface,
      title: input.title,
      price: input.price,
      share: share === null ? null : share.value,
      rule: CREATOR_SHARE_RULE,
      submittable: false as const,
    }),
  );
}

/** Submitting a publish intent refuses while marketplace activation stays closed. */
export function submitPublishIntent(intent: PublishIntent): CatalogCommerceRefusal {
  void intent;
  return commerceInert();
}

/** Policy cites carried by both storefronts; cite, never rewrite. */
export const SITE_CATALOG_POLICY_CITES = CATALOG_POLICY_CITES;

/** Canonical source named by the storefront without copying its contents. */
export const SITE_CATALOG_FIXTURE_PATH = CATALOG_LISTINGS_FIXTURES_PATH;
