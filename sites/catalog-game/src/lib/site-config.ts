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

export const CATALOG_SITE_SURFACE: CatalogSurface = "catalog-game";

export const CATALOG_SITE_BRAND = Object.freeze({
  /** Distinct positioning per the locked site/domain topology. */
  name: "SceneAxi Forge",
  tagline: "Game-ready sculpt artifacts, curated for the Game profile.",
  audience:
    "For game builders assembling props, kits, and set dressing into an openable scene.",
  /**
   * `--store-game` from the accepted Foundations v2 "Axis & surface accents" sheet.
   * `globals.css` declares the same value as `--accent`, and a gate test holds the two
   * in lockstep so the storefront cannot drift a second accent into existence.
   */
  accent: "#E8544E",
  /** The design's per-store mark: a squared corner here, a circle on the web store. */
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
