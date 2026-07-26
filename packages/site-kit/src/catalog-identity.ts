/**
 * The catalog storefront's identity plane.
 *
 * A catalog is a *reader* of identity, never an issuer of it. It holds no store, no
 * provider, and no second auth stack: it builds the same identity port the umbrella
 * does, and an adapter — when a deployment supplies one — is the same
 * `@sceneaxi/auth`-backed adapter, injected. Both storefronts are the same behaviour,
 * so it lives here, where the gate already tests it, rather than in two byte-identical
 * site-local copies.
 *
 * Every deployable site maps onto the `"site"` identity surface, so the surface is
 * pinned here rather than passed in. Pinning it is what makes two refusals
 * unreachable-by-construction from a storefront: `kids` never reaches an adapter, and a
 * client-supplied role claim is refused before dispatch — both inside the port.
 */
import {
  createIdentityPlane,
  type SiteIdentityAdapter,
  type SiteIdentityPort,
  type SitePrincipal,
  type SiteSurface,
} from "./ports.js";
import { type SiteResult } from "./refusals.js";

/** The identity surface every deployable site holds a session on. */
export const CATALOG_IDENTITY_SURFACE: SiteSurface = "site";

export type CatalogIdentityPlane = {
  readonly identity: SiteIdentityPort;
  /** Whether an adapter is present, for honest UI copy. */
  readonly wired: boolean;
};

export type CatalogIdentityPlaneOptions = {
  readonly adapter?: SiteIdentityAdapter | undefined;
  /** Epoch milliseconds. Injected so session expiry is deterministic under test. */
  readonly clock?: (() => number) | undefined;
};

/**
 * Build the storefront's identity plane. Unwired by default, and honest about it:
 * every call then refuses `IDENTITY_PLANE_NOT_WIRED` rather than serving an
 * unauthenticated allow or inventing a viewer.
 */
export function createCatalogIdentityPlane(
  options: CatalogIdentityPlaneOptions = {},
): CatalogIdentityPlane {
  const clock = options.clock ?? (() => Date.now());
  return Object.freeze({
    identity: createIdentityPlane({
      adapter: options.adapter,
      now: () => new Date(clock()).toISOString(),
    }),
    wired: options.adapter !== undefined,
  });
}

/**
 * Resolve the viewer for a storefront request.
 *
 * The surface is pinned, so a caller cannot ask this plane to accept a `kids` session
 * or a session minted for another shell. The carried token is forwarded verbatim; this
 * module never interprets it.
 */
export function resolveCatalogViewer(
  plane: CatalogIdentityPlane,
  sessionToken?: string | null | undefined,
): Promise<SiteResult<SitePrincipal>> {
  return plane.identity.resolvePrincipal({
    surface: CATALOG_IDENTITY_SURFACE,
    ...(sessionToken === undefined ? {} : { sessionToken }),
  });
}
