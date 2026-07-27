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

export const CATALOG_SITE_SURFACE: CatalogSurface = "catalog-web";

export const CATALOG_SITE_BRAND = Object.freeze({
  /** Distinct positioning per the locked site/domain topology. */
  name: "SceneAxi Vitrine",
  tagline: "Interactive scenes for web pages, curated for the Web Experience profile.",
  audience:
    "For product and marketing teams embedding a real interactive surface in a page.",
  /**
   * `--store-web` from the accepted Foundations v2 "Axis & surface accents" sheet.
   * `globals.css` declares the same value as `--accent`, and a gate test holds the two
   * in lockstep so the storefront cannot drift a second accent into existence.
   */
  accent: "#3FB8C9",
  /** The design's per-store mark: a circle here, a squared corner on the game store. */
  markRadius: "50%",
  /** Mono strapline under the wordmark, identical on both stores by design. */
  storeTag: "SCENEAXI STORE",
  /** Mono pill above the hero headline. */
  heroKicker: "CURATED FOR THE WEB EXPERIENCE PROFILE",
  heroCta: "Browse the showroom",
  /**
   * The design's second hero action is "How licensing works", pointing at a page this
   * storefront does not have. It links to the pricing section this page already
   * publishes instead of promising a route that would 404.
   */
  heroSecondaryCta: "How pricing reads",
  /** Section words the two stores differ on, so the shared skeleton stays shared. */
  catalogueWord: "Showroom",
  listingWord: "scene",
  listingWordPlural: "scenes",
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
