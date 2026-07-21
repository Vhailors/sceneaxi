/**
 * @sceneaxi/catalog-game — dormant game-asset storefront app.
 *
 * Speaks only `@sceneaxi/schemas` catalog contracts (matrix-denied:
 * catalogs → authoring-core/engine/profiles). No storefront UI, no marketplace
 * activation, no spend. Commerce fields exist on Catalog Items but stay inert
 * until tier-6b holds open.
 *
 * Policy SoT (cite only): factories-helpers#47, factories-helpers#48.
 * Topology-neutral: catalog-storefront-topology remains open.
 */
import type { PackageSeam } from "@sceneaxi/schemas";
import {
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  attemptCommerceActivation,
  createCatalogItemAtIntake,
  transitionCatalogItem,
} from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/catalog-game",
  releaseGroup: "apps",
});

/** Dormant storefront surface over shared schemas catalog contracts only. */
export const catalogSurface = Object.freeze({
  dormant: true as const,
  storefrontLabel: "catalog-game",
  /** No topology lock-in; held key catalog-storefront-topology stays open. */
  topologyNeutral: true as const,
  policyCites: CATALOG_POLICY_CITES,
  commerceGate: COMMERCE_ACTIVATION_GATE,
  /** Re-export pipeline entry points so the app speaks schemas contracts only. */
  createCatalogItemAtIntake,
  transitionCatalogItem,
  attemptCommerceActivation,
});
