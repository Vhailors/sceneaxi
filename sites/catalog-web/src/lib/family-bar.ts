/**
 * The SceneAxi family bar, resolved into the two-origin storefront topology.
 *
 * The accepted Asset Storefronts design holds both catalogs in one file and flips
 * between them with a runtime `state.store` switch. ADR 0018 makes each site its own
 * install root and its own deployed origin, so that switch cannot ship as drawn: what
 * survives is the *bar*, rebuilt here as ordinary cross-origin links. The current store
 * is marked rather than linked, a sibling whose origin this deployment has not
 * configured renders as plain text instead of a broken link, and the origin rule itself
 * is `@sceneaxi/site-kit`'s — this module owns no URL parsing of its own.
 *
 * There is no Kids key in `FAMILY_KEYS`, so no configuration and no future edit to the
 * env can make this bar emit a link into Kids. That is a structural denial, not a
 * filtered one.
 */
import {
  resolveFamilyLinks,
  resolveSurfaceAccent,
  resolveUmbrellaEditorOrigin,
  type CatalogSurface,
  type FoundationSurfaceAccentId,
} from "@sceneaxi/site-kit";

/** Every surface this bar can name. Kids is absent by construction. */
export const FAMILY_KEYS = Object.freeze(["engine", "catalog-game", "catalog-web"] as const);

export type FamilyKey = (typeof FAMILY_KEYS)[number];

/**
 * The Foundations v2 "Axis & surface accents" sheet, read rather than transcribed.
 *
 * The meanings are the sheet's own and are never reassigned — `--accent` marks the
 * engine, `--store-game` the game catalogue, `--store-web` the website catalogue — but
 * the *values* live in `@sceneaxi/site-kit` alone, so a bar dot cannot drift away from
 * the store it points at. A surface whose accent the shared layer refuses throws here
 * rather than falling back to a literal: a colour key this module cannot resolve is not
 * one it may invent.
 */
function surfaceDot(surface: FoundationSurfaceAccentId): string {
  const accent = resolveSurfaceAccent(surface);
  if (!accent.ok) {
    throw new Error(`Foundations accent unresolved for "${surface}": ${accent.reason}`);
  }
  return accent.value.accent;
}

export const FAMILY_DOTS: Readonly<Record<FamilyKey, string>> = Object.freeze({
  engine: surfaceDot("umbrella"),
  "catalog-game": surfaceDot("game-assets"),
  "catalog-web": surfaceDot("web-assets"),
});

const FAMILY_LABELS: Readonly<Record<FamilyKey, string>> = Object.freeze({
  engine: "Engine",
  "catalog-game": "Game assets",
  "catalog-web": "Web assets",
});

export type FamilyEntry = {
  readonly key: FamilyKey;
  readonly label: string;
  readonly dot: string;
  /** `null` when this deployment has no https origin configured for that surface. */
  readonly href: string | null;
  /** True for the store the visitor is already on; rendered as text, never a link. */
  readonly current: boolean;
};

/**
 * Build the family bar for one storefront.
 *
 * The current store is never given an `href` even when its own origin is configured,
 * because a link to the page you are on is noise rather than navigation.
 */
export function resolveFamilyBar(
  env: Readonly<Record<string, string | undefined>>,
  surface: CatalogSurface,
): readonly FamilyEntry[] {
  const siblings = resolveFamilyLinks(env);
  const umbrella = resolveUmbrellaEditorOrigin(env);
  const origins: Readonly<Record<FamilyKey, string | null>> = {
    engine: umbrella.ok ? umbrella.value : null,
    "catalog-game": siblings.gameCatalog,
    "catalog-web": siblings.webCatalog,
  };
  return Object.freeze(
    FAMILY_KEYS.map((key) => {
      const current = key === surface;
      return Object.freeze({
        key,
        label: FAMILY_LABELS[key],
        dot: FAMILY_DOTS[key],
        href: current ? null : origins[key],
        current,
      });
    }),
  );
}

/**
 * The storefront's own domain, for the mono line the design prints at the top right.
 *
 * A site does not know the origin it is served from without trusting the request `Host`,
 * which this tier never does, so the value comes from the same server-configured family
 * origins everything else uses. Unconfigured means the line is omitted — a storefront
 * that cannot prove its own domain does not print one.
 */
export function resolveStoreDomain(
  env: Readonly<Record<string, string | undefined>>,
  surface: CatalogSurface,
): string | null {
  const entry = resolveFamilyLinks(env);
  const origin = surface === "catalog-game" ? entry.gameCatalog : entry.webCatalog;
  return origin === null ? null : new URL(origin).host;
}
