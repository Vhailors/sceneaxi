/**
 * Catalog site configuration, read from the server environment.
 *
 * Pure TypeScript with no React and no Next import, so the hermetic gate type-checks
 * and tests it. The `src/app/` tree is the only place a framework appears.
 */
import { buildEditorDeepLink, type CatalogSurface, type SiteResult } from "@sceneaxi/site-kit";

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
 * Resolve the umbrella origin the editor deep links point at.
 *
 * A missing or non-https origin refuses, so a page renders a named reason instead of
 * emitting a link that would 404 for every visitor.
 */
export function resolveUmbrellaOrigin(
  env: Readonly<Record<string, string | undefined>>,
): UmbrellaOrigin {
  const origin = env["NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN"] ?? "";
  // Probe through the deep-link contract itself, so the origin rule has exactly one
  // definition rather than one here and one in site-kit.
  const probe = buildEditorDeepLink({
    umbrellaOrigin: origin,
    source: CATALOG_SITE_SURFACE,
    itemId: "origin-probe",
  });
  return probe.ok ? { ok: true, value: new URL(origin).origin } : probe;
}

/** Build a deep link for one listing, or the named refusal to render instead. */
export function editorLinkFor(
  env: Readonly<Record<string, string | undefined>>,
  itemId: string,
): SiteResult<string> {
  const origin = resolveUmbrellaOrigin(env);
  if (!origin.ok) return origin;
  return buildEditorDeepLink({
    umbrellaOrigin: origin.value,
    source: CATALOG_SITE_SURFACE,
    itemId,
  });
}
