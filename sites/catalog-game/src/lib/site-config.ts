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
  accent: "#f2a93b",
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
