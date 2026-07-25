/**
 * Catalog view models for the two storefront sites.
 *
 * Built over the `@sceneaxi/schemas` Catalog Item contract only. The dormant
 * `apps/catalog-game` / `apps/catalog-web` stubs are deliberately untouched — this
 * ship does not thrash the catalogs lane.
 *
 * Commerce is **inert**. `COMMERCE_ACTIVATION_GATE` always refuses because tier-6b
 * marketplace activation keys remain open in the factories-helpers#42 registry, and
 * fail-closed held-key behaviour is a hard repo rule. So price display, creator
 * share display, and publish intent are live, while every purchase and publish
 * *submission* refuses `CATALOG_COMMERCE_INERT` and appends nothing anywhere.
 */
import { createHash } from "node:crypto";
import {
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  type CatalogItem,
  type HumanCurationVerdict,
  createCatalogItemAtIntake,
  transitionCatalogItem,
} from "@sceneaxi/schemas";
import { type SiteRefusal, type SiteResult, ok, refuse } from "./refusals.js";

/** The two storefront surfaces. The umbrella is not a catalog. */
export const CATALOG_SURFACES = Object.freeze(["catalog-game", "catalog-web"] as const);

export type CatalogSurface = (typeof CATALOG_SURFACES)[number];

export type SiteMoneyPrice = { readonly amount: string; readonly currency: string };

/**
 * Dual price. Either side may be absent; a listing with neither refuses, because a
 * listing whose price cannot be shown is a broken listing, not a free one.
 */
export type SiteListingPrice = {
  readonly credits: number | null;
  readonly money: SiteMoneyPrice | null;
};

export type SiteListing = {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly title: string;
  readonly summary: string;
  readonly creatorId: string;
  readonly price: SiteListingPrice;
  readonly item: CatalogItem;
};

export type PriceDisplay = {
  readonly credits: string | null;
  readonly money: string | null;
  /** How the listing reads when both sides are offered. */
  readonly label: string;
};

/** Deterministic fixture digest: a fixture that hashes its own descriptor. */
const fixtureDigest = (descriptor: string): string =>
  `sha256:${createHash("sha256").update(descriptor, "utf8").digest("hex")}`;

function deepFreeze<T extends object>(value: T): T {
  for (const nested of Object.values(value) as unknown[]) {
    if (nested !== null && typeof nested === "object") deepFreeze(nested as object);
  }
  return Object.freeze(value);
}

type FixtureSeed = {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly title: string;
  readonly summary: string;
  readonly creatorId: string;
  readonly profile: string;
  readonly credits: number | null;
  readonly money: SiteMoneyPrice | null;
  readonly aiGenerated: boolean;
  readonly disclosureText: string;
  readonly license: string;
};

const FIXTURE_SEEDS: readonly FixtureSeed[] = Object.freeze([
  {
    surface: "catalog-game",
    itemId: "game-lantern-prop",
    title: "Hand-lantern prop",
    summary:
      "A single sculpt-artifact prop with a socketed handle, authored for the Game profile and ready to mount in the Minimum E2 editor.",
    creatorId: "Vhailors",
    profile: "game",
    credits: 40,
    money: { amount: "4.00", currency: "usd" },
    aiGenerated: false,
    disclosureText: "Deterministic hand-authored catalog fixture.",
    license: "CC-BY-4.0",
  },
  {
    surface: "catalog-game",
    itemId: "game-crate-set",
    title: "Stackable crate set",
    summary:
      "Three crate variants sharing one placement grid, sized for axis-aligned scene composition.",
    creatorId: "Vhailors",
    profile: "game",
    credits: 60,
    money: null,
    aiGenerated: false,
    disclosureText: "Deterministic hand-authored catalog fixture.",
    license: "CC-BY-4.0",
  },
  {
    surface: "catalog-web",
    itemId: "web-hero-diorama",
    title: "Hero diorama",
    summary:
      "A shallow-depth diorama scene for a Web Experience hero band, authored against the Web profile.",
    creatorId: "Vhailors",
    profile: "web",
    credits: 35,
    money: { amount: "3.50", currency: "usd" },
    aiGenerated: false,
    disclosureText: "Deterministic hand-authored catalog fixture.",
    license: "CC-BY-4.0",
  },
  {
    surface: "catalog-web",
    itemId: "web-ui-panel-kit",
    title: "UI panel kit",
    summary:
      "Panel and badge sculpts for embedding an interactive product surface in a marketing page.",
    creatorId: "Vhailors",
    profile: "web",
    credits: null,
    money: { amount: "6.00", currency: "usd" },
    aiGenerated: false,
    disclosureText: "Deterministic hand-authored catalog fixture.",
    license: "CC-BY-4.0",
  },
]);

function buildListedItem(seed: FixtureSeed): CatalogItem {
  const digest = fixtureDigest(`${seed.surface}/${seed.itemId}`);
  const intake = createCatalogItemAtIntake({
    itemId: seed.itemId,
    assetPackage: { packageId: `${seed.itemId}-package`, contentHash: digest },
    rights: {
      license: seed.license,
      rightsHolder: "SceneAxi fixture",
      commercialUseAllowed: true,
    },
    provenance: {
      origin: "packages/site-kit/src/catalog.ts",
      ingestedAt: "2026-07-25T09:00:00.000Z",
      sourceDigest: digest,
    },
    aiGenerationDisclosure: {
      aiGenerated: seed.aiGenerated,
      disclosureText: seed.disclosureText,
    },
    compatibility: { coreRange: "^0.0.0", profiles: [seed.profile] },
    // Structurally inert commerce fields, populated for display only. The
    // activation gate still refuses every purchase.
    ...(seed.money === null ? {} : { commerce: { price: seed.money, sku: seed.itemId } }),
  });
  const screened = transitionCatalogItem(intake, {
    to: "screening",
    reason: "Fixture quarantine checks passed.",
    at: "2026-07-25T09:01:00.000Z",
  });
  if (!screened.ok) throw new Error(screened.message);
  const curated = transitionCatalogItem(screened.item, {
    to: "curation",
    reason: "Fixture metadata checks passed.",
    at: "2026-07-25T09:02:00.000Z",
  });
  if (!curated.ok) throw new Error(curated.message);
  const verdict: HumanCurationVerdict = {
    kind: "human",
    decision: "approve",
    curatorId: "Vhailors",
    rationale: `Approved as storefront fixture evidence for ${seed.surface}; display only while tier-6b commerce stays inert.`,
    recordedAt: "2026-07-25T09:03:00.000Z",
  };
  const listed = transitionCatalogItem(curated.item, {
    to: "listed",
    reason: "Fixture human approval recorded.",
    at: "2026-07-25T09:03:00.000Z",
    humanVerdict: verdict,
  });
  if (!listed.ok) throw new Error(listed.message);
  return listed.item;
}

const LISTINGS: readonly SiteListing[] = deepFreeze(
  FIXTURE_SEEDS.map((seed) => ({
    surface: seed.surface,
    itemId: seed.itemId,
    title: seed.title,
    summary: seed.summary,
    creatorId: seed.creatorId,
    price: { credits: seed.credits, money: seed.money },
    item: buildListedItem(seed),
  })),
) as readonly SiteListing[];

/** Listed fixtures for one storefront surface. */
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

/** Render a dual price. Refuses when the listing offers neither side. */
export function describeListingPrice(price: SiteListingPrice): SiteResult<PriceDisplay> {
  const credits =
    price.credits === null
      ? null
      : `${price.credits} credit${price.credits === 1 ? "" : "s"}`;
  const money =
    price.money === null
      ? null
      : `${price.money.amount} ${price.money.currency.toUpperCase()}`;
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

/** The share rule as displayed to a creator. Display only — no ledger authority. */
export const CREATOR_SHARE_RULE = Object.freeze({
  creatorPercent: 50,
  platformPercent: 50,
  note:
    "Creators receive 50% of the credits on a sale; money sales are booked 50/50. Credit totals are split in whole units, so on an odd total the creator takes the floor (for example 17 of 35 credits) and the platform absorbs the single remaining unit rather than shorting either side. Payouts are not activated in this wave.",
});

export const CREATOR_SHARE_ROUNDING_NOTE =
  "Credit shares are whole units: on an odd total the creator takes the floor and the platform absorbs the remainder, so the displayed creator share can read just below an exact 50%.";

export type CatalogCommerceRefusal = SiteRefusal & {
  readonly gate: typeof COMMERCE_ACTIVATION_GATE;
  readonly registryCite: string;
};

const commerceInert = (): CatalogCommerceRefusal =>
  Object.freeze({
    ...refuse("CATALOG_COMMERCE_INERT"),
    gate: COMMERCE_ACTIVATION_GATE,
    registryCite: COMMERCE_ACTIVATION_GATE.registry,
  });

export type CatalogPurchaseRequest = {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly payWith: "credits" | "money";
};

/**
 * Attempt a catalog purchase. Always refuses while tier-6b keys are open, and
 * appends nothing — no ledger entry, no order, no reservation.
 */
export function attemptCatalogPurchase(
  request: CatalogPurchaseRequest,
): SiteResult<never> | CatalogCommerceRefusal {
  const listing = showSiteListing(request.surface, request.itemId);
  if (!listing.ok) return listing;
  const price = describeListingPrice(listing.value.price);
  if (!price.ok) return price;
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

/** Submitting a publish intent refuses while tier-6b marketplace keys are open. */
export function submitPublishIntent(intent: PublishIntent): CatalogCommerceRefusal {
  void intent;
  return commerceInert();
}

/** Policy cites carried by both storefronts; cite, never rewrite. */
export const SITE_CATALOG_POLICY_CITES = CATALOG_POLICY_CITES;
