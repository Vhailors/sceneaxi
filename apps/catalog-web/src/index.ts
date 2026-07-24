/**
 * @sceneaxi/catalog-web — dormant website-asset storefront app.
 *
 * Speaks only `@sceneaxi/schemas` catalog contracts (matrix-denied:
 * catalogs → authoring-core/engine/profiles). No storefront UI, no marketplace
 * activation, no spend. Commerce fields exist on Catalog Items but stay inert
 * until tier-6b holds open. The website-catalog scope is locked in sceneaxi#1.
 *
 * Policy SoT (cite only): factories-helpers#47, factories-helpers#48.
 * This stub stays topology-neutral; the product topology is locked in sceneaxi#1.
 */
import type {
  CatalogItem,
  HumanCurationVerdict,
  PackageSeam,
} from "@sceneaxi/schemas";
import {
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  attemptCommerceActivation,
  createCatalogItemAtIntake,
  transitionCatalogItem,
} from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/catalog-web",
  releaseGroup: "apps",
});

const FIXTURE_HASH =
  "sha256:ed96644f66eb3060a5d0fc1c814f6772eba0fa894dedb944ecdbf7edd8e37a8b";

function deepFreeze<T extends object>(value: T): T {
  const nestedValues: unknown[] = Object.values(value);
  for (const nested of nestedValues) {
    if (nested !== null && typeof nested === "object") {
      deepFreeze(nested);
    }
  }
  return Object.freeze(value);
}

function buildListedFixture(): CatalogItem {
  const intake = createCatalogItemAtIntake({
    itemId: "web-golden-fixture",
    assetPackage: {
      packageId: "web-golden-fixture-package",
      contentHash: FIXTURE_HASH,
    },
    rights: {
      license: "CC-BY-4.0",
      rightsHolder: "SceneAxi fixture",
      commercialUseAllowed: false,
    },
    provenance: {
      origin: "tests/e2e/fixtures/golden-project.ts",
      ingestedAt: "2026-07-24T12:00:00.000Z",
      sourceDigest: FIXTURE_HASH,
    },
    aiGenerationDisclosure: {
      aiGenerated: false,
      disclosureText: "Deterministic hand-authored catalog fixture.",
    },
    compatibility: { coreRange: "^0.0.0", profiles: ["web"] },
  });
  const screened = transitionCatalogItem(intake, {
    to: "screening",
    reason: "Fixture quarantine checks passed.",
    at: "2026-07-24T12:01:00.000Z",
  });
  if (!screened.ok) throw new Error(screened.message);
  const curated = transitionCatalogItem(screened.item, {
    to: "curation",
    reason: "Fixture metadata checks passed.",
    at: "2026-07-24T12:02:00.000Z",
  });
  if (!curated.ok) throw new Error(curated.message);
  const verdict: HumanCurationVerdict = {
    kind: "human",
    decision: "approve",
    curatorId: "Vhailors",
    rationale:
      "Approved only as dormant fixture evidence; recorded in apps/catalog-web/fixtures/web-golden-fixture.human-verdict.json.",
    recordedAt: "2026-07-24T12:03:00.000Z",
  };
  const listed = transitionCatalogItem(curated.item, {
    to: "listed",
    reason: "Fixture human approval recorded.",
    at: "2026-07-24T12:03:00.000Z",
    humanVerdict: verdict,
  });
  if (!listed.ok) throw new Error(listed.message);
  return listed.item;
}

export const listedFixtureItem = deepFreeze(buildListedFixture());
const listedItems = Object.freeze([listedFixtureItem] as const);

export function listCatalogItems(): readonly CatalogItem[] {
  return listedItems;
}

export function showCatalogItem(itemId: string) {
  const item = listedItems.find((candidate) => candidate.itemId === itemId);
  return item === undefined
    ? Object.freeze({
        ok: false as const,
        code: "catalog-item-not-found" as const,
        message: `Catalog item '${itemId}' is not listed.`,
      })
    : Object.freeze({ ok: true as const, item });
}

export const CATALOG_DORMANT_REFUSE_REASONS = Object.freeze({
  purchase: "catalog-purchase-disabled",
  marketplacePublish: "catalog-marketplace-publish-disabled",
} as const);

export function attemptCatalogPurchase(itemId: string) {
  return Object.freeze({
    ok: false as const,
    itemId,
    code: CATALOG_DORMANT_REFUSE_REASONS.purchase,
    message: "Catalog purchase and billing are disabled in the dormant MVP pipeline.",
  });
}

export function attemptCatalogMarketplacePublish(itemId: string) {
  return Object.freeze({
    ok: false as const,
    itemId,
    code: CATALOG_DORMANT_REFUSE_REASONS.marketplacePublish,
    message: "Marketplace publishing is disabled in the dormant MVP pipeline.",
  });
}

/** Dormant storefront surface over shared schemas catalog contracts only. */
export const catalogSurface = Object.freeze({
  dormant: true as const,
  storefrontLabel: "catalog-web",
  /** This implementation does not encode the locked product topology. */
  topologyNeutral: true as const,
  policyCites: CATALOG_POLICY_CITES,
  commerceGate: COMMERCE_ACTIVATION_GATE,
  /** Re-export pipeline entry points so the app speaks schemas contracts only. */
  createCatalogItemAtIntake,
  transitionCatalogItem,
  attemptCommerceActivation,
  listedFixtureItem,
  listCatalogItems,
  showCatalogItem,
  attemptCatalogPurchase,
  attemptCatalogMarketplacePublish,
});
