/**
 * Catalog site configuration, read from the server environment.
 *
 * Non-presentational behaviour (origin resolution and editor deep-link building) lives in
 * `@sceneaxi/site-kit`; this module holds the storefront's surface id and presentational
 * brand and binds the shared deep-link behaviour to this surface. The `src/app/` tree is
 * the only place a framework appears.
 */
import {
  resolveEditorLinkFromEnv,
  resolveUmbrellaEditorOrigin,
  type CatalogSurface,
  type SiteResult,
} from "@sceneaxi/site-kit";
import type { StorefrontSurface } from "./foundations.js";

export const CATALOG_SITE_SURFACE: CatalogSurface = "catalog-game";

/**
 * Which row of the Foundations v2 surface → accent map this storefront themes with.
 *
 * The storefront names its surface; `@sceneaxi/site-kit` owns what that surface looks
 * like. That is the whole of the per-site accent override Foundations §06 allows, and it
 * is why no hex for `--accent` appears anywhere in this site.
 */
export const CATALOG_SITE_FOUNDATION_SURFACE: StorefrontSurface = "game-assets";

export const CATALOG_SITE_BRAND = Object.freeze({
  /** Distinct positioning per the locked site/domain topology. */
  name: "SceneAxi Forge",
  tagline: "Game-ready sculpt artifacts, curated for the Game profile.",
  audience:
    "For game builders assembling props, kits, and set dressing into an openable scene.",
  /**
   * The design's per-store mark: a squared corner here, a circle on the web store.
   *
   * This is a shape, not a colour: the archive states it and the Foundations sheet does
   * not, so it stays a per-store fact declared here and mirrored by `--mark-radius`.
   * The accent itself is not here — see `CATALOG_SITE_FOUNDATION_SURFACE`.
   */
  markRadius: "1px",
  /** Mono strapline under the wordmark, identical on both stores by design. */
  storeTag: "SCENEAXI STORE",
  /** Mono pill above the hero headline. */
  heroKicker: "CURATED FOR THE GAME PROFILE",
  heroCta: "Browse the catalogue",
  /**
   * The design's second hero action is "How licensing works", pointing at a page this
   * storefront does not have. It links to the pricing section this page already
   * publishes instead of promising a route that would 404.
   */
  heroSecondaryCta: "How pricing reads",
  /** Section words the two stores differ on, so the shared skeleton stays shared. */
  catalogueWord: "Catalogue",
  listingWord: "listing",
  listingWordPlural: "listings",
});

export type UmbrellaOrigin = SiteResult<string>;

/**
 * Resolve the umbrella origin the editor deep links point at. Delegates to the shared
 * site-kit rule, so the origin contract has exactly one definition.
 */
export const resolveUmbrellaOrigin = resolveUmbrellaEditorOrigin;

/** Build a deep link for one listing on this surface, or the named refusal to render. */
export const editorLinkFor = (
  env: Readonly<Record<string, string | undefined>>,
  itemId: string,
): SiteResult<string> => resolveEditorLinkFromEnv(env, CATALOG_SITE_SURFACE, itemId);
