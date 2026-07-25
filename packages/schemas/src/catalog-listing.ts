/**
 * Catalog listings with dual pricing (v1).
 *
 * A seller decides what their asset costs, and in which currency: credits,
 * money, or both. Encoding that choice in the contract — `creditPrice` required
 * exactly when the mode includes credits, `moneyPrice` exactly when it includes
 * money — is what makes "the buyer picked a currency the seller never listed" a
 * *refusal* rather than a silent conversion at some exchange rate nobody agreed.
 *
 * A listing carrying a price its mode excludes refuses too. A dormant field is
 * how a credits-only listing quietly acquires a money price later.
 *
 * Purchase behavior and the creator revenue share live in @sceneaxi/billing;
 * this module is contracts only. Catalog browse surfaces are owned elsewhere —
 * `catalog-game` and `catalog-web` stay dormant.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isDateTime,
  isNonEmptyString,
  isPlainRecord,
  isSafeInteger,
  refuseWith,
  type ContractRefuse,
} from "./record-validation.js";

export const CATALOG_LISTING_SCHEMA_VERSION = 1 as const;

export const CATALOG_LISTING_KIND = "sceneaxi.catalog-listing" as const;

/** Which catalog a listing belongs to. Both are first-class. */
export const LISTING_CATALOGS = Object.freeze(["game", "web"] as const);

/** What the seller accepts. `credits-and-money` means the buyer chooses. */
export const LISTING_PRICE_MODES = Object.freeze([
  "credits",
  "money",
  "credits-and-money",
] as const);

/** Canonical listing fixture, relative to this package root. */
export const CATALOG_LISTINGS_FIXTURES_PATH =
  "contracts/catalog-listings.fixtures.json" as const;

export const CATALOG_LISTING_REFUSE_CODES = Object.freeze({
  notObject: "LISTING_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "LISTING_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "LISTING_KIND_MISMATCH",
  missingProperty: "LISTING_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "LISTING_UNEXPECTED_PROPERTY",
  invalidProperty: "LISTING_PROPERTY_INVALID",
  priceModeMismatch: "LISTING_PRICE_MODE_MISMATCH",
} as const);

export type CatalogListingRefuseCode =
  (typeof CATALOG_LISTING_REFUSE_CODES)[keyof typeof CATALOG_LISTING_REFUSE_CODES];

export type ListingCatalog = (typeof LISTING_CATALOGS)[number];
export type ListingPriceMode = (typeof LISTING_PRICE_MODES)[number];

/** A money price. `unitAmount` is in the currency's minor unit. */
export type ListingMoneyPrice = Readonly<{
  unitAmount: number;
  currency: string;
  stripePriceId: string;
}>;

export type CatalogListing = Readonly<{
  schemaVersion: typeof CATALOG_LISTING_SCHEMA_VERSION;
  kind: typeof CATALOG_LISTING_KIND;
  listingId: string;
  catalog: ListingCatalog;
  /** The creator who earns the revenue share on a sale. */
  sellerUserId: string;
  title: string;
  priceMode: ListingPriceMode;
  /** Present exactly when `priceMode` includes credits. */
  creditPrice?: number;
  /** Present exactly when `priceMode` includes money. */
  moneyPrice?: ListingMoneyPrice;
  publishedAt: string;
}>;

export type CatalogListingSet = Readonly<{
  schemaVersion: typeof CATALOG_LISTING_SCHEMA_VERSION;
  /** Test mode only: live price ids are a separate captain go-live decision. */
  mode: "test";
  listings: ReadonlyArray<CatalogListing>;
}>;

export type CatalogListingValidationOk<Value> = Readonly<{
  ok: true;
  value: Value;
}>;

export type CatalogListingValidationRefuse =
  ContractRefuse<CatalogListingRefuseCode>;

export type CatalogListingValidationResult<Value> =
  | CatalogListingValidationOk<Value>
  | CatalogListingValidationRefuse;

const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CURRENCY_RE = /^[a-z]{3}$/;

export function isListingCatalog(value: unknown): value is ListingCatalog {
  return LISTING_CATALOGS.some((catalog) => catalog === value);
}

export function isListingPriceMode(value: unknown): value is ListingPriceMode {
  return LISTING_PRICE_MODES.some((mode) => mode === value);
}

/** True when the mode admits a credit price. */
export function priceModeIncludesCredits(mode: ListingPriceMode): boolean {
  return mode === "credits" || mode === "credits-and-money";
}

/** True when the mode admits a money price. */
export function priceModeIncludesMoney(mode: ListingPriceMode): boolean {
  return mode === "money" || mode === "credits-and-money";
}

function ok<Value>(value: Value): CatalogListingValidationOk<Value> {
  return Object.freeze({ ok: true, value });
}

function invalid(detail: string): CatalogListingValidationRefuse {
  return refuseWith(CATALOG_LISTING_REFUSE_CODES.invalidProperty, detail);
}

const LISTING_REQUIRED = Object.freeze([
  "schemaVersion",
  "kind",
  "listingId",
  "catalog",
  "sellerUserId",
  "title",
  "priceMode",
  "publishedAt",
]);
const LISTING_OPTIONAL = Object.freeze(["creditPrice", "moneyPrice"]);

function validateMoneyPrice(
  value: unknown,
): CatalogListingValidationResult<ListingMoneyPrice> {
  if (!isPlainRecord(value)) {
    return invalid("listing moneyPrice must be a plain JSON object.");
  }
  const required = ["unitAmount", "currency", "stripePriceId"];
  const missing = firstMissingKey(value, required);
  if (missing !== undefined) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.missingProperty,
      `listing moneyPrice is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, required);
  if (unexpected !== undefined) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.unexpectedProperty,
      `listing moneyPrice has unexpected property "${unexpected}".`,
    );
  }
  const unitAmount = value["unitAmount"];
  if (!isSafeInteger(unitAmount) || unitAmount < 1) {
    return invalid(
      "listing moneyPrice unitAmount must be a positive safe integer in the currency's minor unit.",
    );
  }
  const currency = value["currency"];
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
    return invalid(
      "listing moneyPrice currency must be a lowercase three-letter ISO 4217 code.",
    );
  }
  if (!isNonEmptyString(value["stripePriceId"])) {
    return invalid("listing moneyPrice stripePriceId must be a non-empty string.");
  }
  return ok(
    Object.freeze({
      unitAmount,
      currency,
      stripePriceId: value["stripePriceId"],
    }),
  );
}

export function validateCatalogListing(
  value: unknown,
): CatalogListingValidationResult<CatalogListing> {
  if (!isPlainRecord(value)) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.notObject,
      "A catalog listing must be a plain JSON object.",
    );
  }
  if (value["schemaVersion"] !== CATALOG_LISTING_SCHEMA_VERSION) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.schemaVersionMismatch,
      `listing schemaVersion must be ${CATALOG_LISTING_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (value["kind"] !== CATALOG_LISTING_KIND) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.kindMismatch,
      `listing kind must be "${CATALOG_LISTING_KIND}".`,
    );
  }
  const missing = firstMissingKey(value, LISTING_REQUIRED);
  if (missing !== undefined) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.missingProperty,
      `listing is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, LISTING_REQUIRED, LISTING_OPTIONAL);
  if (unexpected !== undefined) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.unexpectedProperty,
      `listing has unexpected property "${unexpected}".`,
    );
  }

  const listingId = value["listingId"];
  if (typeof listingId !== "string" || !SLUG_RE.test(listingId)) {
    return invalid("listing listingId must be a lowercase slug of 1-64 chars.");
  }
  if (!isListingCatalog(value["catalog"])) {
    return invalid(
      `listing catalog must be one of ${LISTING_CATALOGS.join(", ")}.`,
    );
  }
  const sellerUserId = value["sellerUserId"];
  if (typeof sellerUserId !== "string" || !IDENTIFIER_RE.test(sellerUserId)) {
    return invalid(
      "listing sellerUserId must be a url-safe identifier of 1-128 chars.",
    );
  }
  if (!isNonEmptyString(value["title"])) {
    return invalid("listing title must be a non-empty string.");
  }
  const priceMode = value["priceMode"];
  if (!isListingPriceMode(priceMode)) {
    return invalid(
      `listing priceMode must be one of ${LISTING_PRICE_MODES.join(", ")}.`,
    );
  }
  if (!isDateTime(value["publishedAt"])) {
    return invalid(
      "listing publishedAt must be an RFC 3339 date-time with an explicit timezone.",
    );
  }

  const hasCreditPrice = Object.hasOwn(value, "creditPrice");
  const hasMoneyPrice = Object.hasOwn(value, "moneyPrice");
  const wantsCredits = priceModeIncludesCredits(priceMode);
  const wantsMoney = priceModeIncludesMoney(priceMode);

  if (wantsCredits && !hasCreditPrice) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.priceModeMismatch,
      `priceMode "${priceMode}" includes credits, so creditPrice is required.`,
    );
  }
  if (!wantsCredits && hasCreditPrice) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.priceModeMismatch,
      `priceMode "${priceMode}" excludes credits, so creditPrice must be absent; a dormant price is how a listing quietly acquires one.`,
    );
  }
  if (wantsMoney && !hasMoneyPrice) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.priceModeMismatch,
      `priceMode "${priceMode}" includes money, so moneyPrice is required.`,
    );
  }
  if (!wantsMoney && hasMoneyPrice) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.priceModeMismatch,
      `priceMode "${priceMode}" excludes money, so moneyPrice must be absent; a dormant price is how a listing quietly acquires one.`,
    );
  }

  let creditPrice: number | undefined;
  if (wantsCredits) {
    const candidate = value["creditPrice"];
    if (!isSafeInteger(candidate) || candidate < 1) {
      return invalid("listing creditPrice must be a positive safe integer.");
    }
    creditPrice = candidate;
  }

  let moneyPrice: ListingMoneyPrice | undefined;
  if (wantsMoney) {
    const validated = validateMoneyPrice(value["moneyPrice"]);
    if (!validated.ok) return validated;
    moneyPrice = validated.value;
  }

  const base = {
    schemaVersion: CATALOG_LISTING_SCHEMA_VERSION,
    kind: CATALOG_LISTING_KIND,
    listingId,
    catalog: value["catalog"],
    sellerUserId,
    title: value["title"],
    priceMode,
    publishedAt: value["publishedAt"],
  };

  return ok(
    Object.freeze({
      ...base,
      ...(creditPrice === undefined ? {} : { creditPrice }),
      ...(moneyPrice === undefined ? {} : { moneyPrice }),
    }),
  );
}

export function validateCatalogListingSet(
  value: unknown,
): CatalogListingValidationResult<CatalogListingSet> {
  if (!isPlainRecord(value)) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.notObject,
      "The catalog listing set must be a plain JSON object.",
    );
  }
  const required = ["schemaVersion", "mode", "listings"];
  const missing = firstMissingKey(value, required);
  if (missing !== undefined) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.missingProperty,
      `catalog listing set is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(value, required);
  if (unexpected !== undefined) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.unexpectedProperty,
      `catalog listing set has unexpected property "${unexpected}".`,
    );
  }
  if (value["schemaVersion"] !== CATALOG_LISTING_SCHEMA_VERSION) {
    return refuseWith(
      CATALOG_LISTING_REFUSE_CODES.schemaVersionMismatch,
      `catalog listing set schemaVersion must be ${CATALOG_LISTING_SCHEMA_VERSION}.`,
    );
  }
  if (value["mode"] !== "test") {
    return invalid(
      'catalog listing set mode must be "test"; live price ids are not committed.',
    );
  }
  const listings = value["listings"];
  if (!Array.isArray(listings) || listings.length === 0) {
    return invalid("catalog listing set listings must be a non-empty array.");
  }

  const validated: CatalogListing[] = [];
  const seen = new Set<string>();
  for (const candidate of listings) {
    const listing = validateCatalogListing(candidate);
    if (!listing.ok) return listing;
    if (seen.has(listing.value.listingId)) {
      return invalid(
        `catalog listing set has duplicate listingId "${listing.value.listingId}".`,
      );
    }
    seen.add(listing.value.listingId);
    validated.push(listing.value);
  }

  return ok(
    Object.freeze({
      schemaVersion: CATALOG_LISTING_SCHEMA_VERSION,
      mode: "test" as const,
      listings: Object.freeze(validated),
    }),
  );
}
