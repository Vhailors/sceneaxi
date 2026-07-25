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
  accent: "#5b8def",
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
