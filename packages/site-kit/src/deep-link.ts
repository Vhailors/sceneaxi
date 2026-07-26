/**
 * Catalog → umbrella editor deep-link contract.
 *
 * Cross-links between SceneAxi surfaces are ordinary links: the locked site/domain
 * topology forbids carrying identity, session, tracking identity, or user data
 * across a surface boundary, and forbids any link into Kids. This module builds
 * and parses exactly three parameters and refuses anything else, so a deep link
 * cannot quietly grow into a session channel.
 */
import { CATALOG_SURFACES, type CatalogSurface } from "./catalog.js";
import { type SiteResult, ok, refuse } from "./refusals.js";

/** The editor route on the umbrella surface. */
export const EDITOR_DEEP_LINK_PATH = "/editor";

/** Exactly the parameters the contract carries. Anything else refuses. */
export const EDITOR_DEEP_LINK_PARAMS = Object.freeze(["source", "item", "artifact"] as const);

export type EditorDeepLink = {
  readonly source: CatalogSurface;
  readonly itemId: string;
  readonly artifactRef: string | null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Whether an origin may be linked to. https everywhere, with `http://localhost`
 * allowed so development does not need a second code path.
 */
function normalizeOrigin(umbrellaOrigin: string): string | null {
  if (!isNonEmptyString(umbrellaOrigin)) return null;
  let url: URL;
  try {
    url = new URL(umbrellaOrigin);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    return url.origin;
  }
  return null;
}

/** Build a deep link into the umbrella editor. */
export function buildEditorDeepLink(input: {
  readonly umbrellaOrigin: string;
  readonly source: CatalogSurface;
  readonly itemId: string;
  readonly artifactRef?: string | null;
}): SiteResult<string> {
  if (!(CATALOG_SURFACES as readonly string[]).includes(input.source)) {
    return refuse("DEEP_LINK_SOURCE_UNKNOWN");
  }
  const origin = normalizeOrigin(input.umbrellaOrigin);
  if (origin === null) return refuse("DEEP_LINK_ORIGIN_INSECURE");
  if (!isNonEmptyString(input.itemId)) return refuse("DEEP_LINK_ITEM_MISSING");
  const url = new URL(EDITOR_DEEP_LINK_PATH, `${origin}/`);
  url.searchParams.set("source", input.source);
  url.searchParams.set("item", input.itemId);
  if (isNonEmptyString(input.artifactRef)) {
    url.searchParams.set("artifact", input.artifactRef);
  }
  return ok(url.toString());
}

/** Parse a deep link, refusing anything outside the published contract. */
export function parseEditorDeepLink(href: string): SiteResult<EditorDeepLink> {
  if (!isNonEmptyString(href)) return refuse("DEEP_LINK_ITEM_MISSING");
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return refuse("DEEP_LINK_ORIGIN_INSECURE");
  }
  if (normalizeOrigin(url.origin) === null) return refuse("DEEP_LINK_ORIGIN_INSECURE");
  for (const key of url.searchParams.keys()) {
    if (!(EDITOR_DEEP_LINK_PARAMS as readonly string[]).includes(key)) {
      return refuse("DEEP_LINK_UNKNOWN_PARAMETER");
    }
  }
  const source = url.searchParams.get("source");
  if (source === null || !(CATALOG_SURFACES as readonly string[]).includes(source)) {
    return refuse("DEEP_LINK_SOURCE_UNKNOWN");
  }
  const itemId = url.searchParams.get("item");
  if (!isNonEmptyString(itemId)) return refuse("DEEP_LINK_ITEM_MISSING");
  const artifact = url.searchParams.get("artifact");
  return ok(
    Object.freeze({
      source: source as CatalogSurface,
      itemId,
      artifactRef: isNonEmptyString(artifact) ? artifact : null,
    }),
  );
}

/**
 * Parse the search params a Next route handler already holds, without needing the
 * caller to reassemble an absolute URL.
 */
export function parseEditorDeepLinkParams(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): SiteResult<EditorDeepLink> {
  for (const key of Object.keys(params)) {
    if (!(EDITOR_DEEP_LINK_PARAMS as readonly string[]).includes(key)) {
      return refuse("DEEP_LINK_UNKNOWN_PARAMETER");
    }
  }
  const single = (value: string | readonly string[] | undefined): string | null =>
    typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? null) : null;
  const source = single(params["source"]);
  if (source === null || !(CATALOG_SURFACES as readonly string[]).includes(source)) {
    return refuse("DEEP_LINK_SOURCE_UNKNOWN");
  }
  const itemId = single(params["item"]);
  if (!isNonEmptyString(itemId)) return refuse("DEEP_LINK_ITEM_MISSING");
  const artifact = single(params["artifact"]);
  return ok(
    Object.freeze({
      source: source as CatalogSurface,
      itemId,
      artifactRef: isNonEmptyString(artifact) ? artifact : null,
    }),
  );
}

export type FamilyLinks = {
  readonly gameCatalog: string | null;
  readonly webCatalog: string | null;
};

/**
 * Resolve family cross-links from the server environment.
 *
 * The umbrella links to its two catalog siblings. A non-https or malformed origin becomes
 * `null` (no link rendered rather than a broken one), `http://localhost` is allowed for
 * development, and these links never carry identity, session, or telemetry — and never
 * point at Kids.
 */
export function resolveFamilyLinks(
  env: Readonly<Record<string, string | undefined>>,
): FamilyLinks {
  return Object.freeze({
    gameCatalog: normalizeOrigin(env["NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN"] ?? ""),
    webCatalog: normalizeOrigin(env["NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN"] ?? ""),
  });
}

/**
 * Resolve the umbrella origin the editor deep links point at, from the server environment.
 *
 * A missing or non-https origin refuses, so a page renders a named reason instead of a
 * link that would 404 for every visitor. The origin rule has exactly one definition: the
 * origin is probed through the deep-link contract itself.
 */
export function resolveUmbrellaEditorOrigin(
  env: Readonly<Record<string, string | undefined>>,
): SiteResult<string> {
  const origin = env["NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN"] ?? "";
  const probe = buildEditorDeepLink({
    umbrellaOrigin: origin,
    source: "catalog-game",
    itemId: "origin-probe",
  });
  return probe.ok ? ok(new URL(origin).origin) : probe;
}

/**
 * The origin a checkout redirect may be built from.
 *
 * The umbrella's own success and cancel URLs must not be derived from the request's
 * `Host`: a deployment reachable under an alias, or behind a proxy that forwards an
 * attacker-influenced host, would otherwise hand the payment provider a redirect target
 * pointing away from SceneAxi — and the buyer would land there carrying the appearance
 * of a completed purchase. The origin therefore comes from the same server-configured
 * value the catalogs already link to, and a request arriving on any other origin is
 * refused rather than silently redirected to the configured one.
 *
 * Both failures answer in the billing vocabulary. The configured origin is probed through
 * the deep-link contract because that is where the origin rule is defined once, but a
 * buyer on the payment path must never be handed a catalog deep-link reason, so an absent
 * or non-https configured origin is renamed here rather than propagated.
 */
export function resolveCheckoutRedirectOrigin(
  env: Readonly<Record<string, string | undefined>>,
  requestOrigin: string,
): SiteResult<string> {
  const configured = resolveUmbrellaEditorOrigin(env);
  if (!configured.ok) return refuse("BILLING_CHECKOUT_ORIGIN_UNCONFIGURED");
  const observed = normalizeOrigin(requestOrigin);
  if (observed === null || observed !== configured.value) {
    return refuse("BILLING_CHECKOUT_ORIGIN_UNTRUSTED");
  }
  return ok(configured.value);
}

/** Build a deep link for one listing from the server environment, or the named refusal. */
export function resolveEditorLinkFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  surface: CatalogSurface,
  itemId: string,
): SiteResult<string> {
  const origin = resolveUmbrellaEditorOrigin(env);
  if (!origin.ok) return origin;
  return buildEditorDeepLink({ umbrellaOrigin: origin.value, source: surface, itemId });
}
