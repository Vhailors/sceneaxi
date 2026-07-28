/**
 * @sceneaxi/site-catalog-web — the deployable website-asset catalog site.
 *
 * A thin view + wiring layer over `@sceneaxi/site-kit`, which owns every
 * non-presentational behaviour and is tested in `pnpm gate`. This seam and the
 * `src/lib/` modules beside it are pure TypeScript, so the hermetic gate type-checks
 * them; only `src/app/` imports React or Next.
 */
import type { PackageSeam } from "@sceneaxi/site-kit";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/site-catalog-web",
  releaseGroup: "sites",
});

export {
  CATALOG_SITE_BRAND,
  CATALOG_SITE_FOUNDATION_SURFACE,
  CATALOG_SITE_SURFACE,
  editorLinkFor,
  resolveUmbrellaOrigin,
  type UmbrellaOrigin,
} from "./lib/site-config.js";

export {
  foundationsStatusVariablesCss,
  foundationsStylesheet,
  type StorefrontSurface,
} from "./lib/foundations.js";

export {
  CATALOG_IDENTITY_SURFACE,
  createCatalogIdentityPlane,
  resolveCatalogViewer,
  type CatalogIdentityPlane,
  type CatalogIdentityPlaneOptions,
} from "./lib/identity-plane.js";

export {
  FAMILY_DOTS,
  FAMILY_KEYS,
  resolveFamilyBar,
  resolveStoreDomain,
  type FamilyEntry,
  type FamilyKey,
} from "./lib/family-bar.js";

export {
  digestSigil,
  shortenDigest,
  type DigestSigil,
} from "./lib/digest-sigil.js";

export {
  catalogFacets,
  curationTrail,
  sameCreatorListings,
  type CatalogFacet,
  type CatalogFacetRow,
  type CurationStep,
} from "./lib/catalog-facts.js";
