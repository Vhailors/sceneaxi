/**
 * @sceneaxi/site-kit — deployment-neutral logic for the first-party `sites/`
 * surfaces (umbrella, game-asset catalog, website-asset catalog).
 *
 * The three Next.js sites are thin view + wiring layers over this package, so
 * every site behaviour is testable in `pnpm gate` with no browser, no network,
 * and no framework in the hermetic package tier.
 *
 * What lives here: fail-closed identity/credits/billing ports (the single seam
 * with the identity plane owned by `sceneaxi-auth-credits-v1`), the free-vs-paid
 * capability matrix, Minimum E2 editor entitlement, catalog view models over the
 * `@sceneaxi/schemas` Catalog Item contract, and a bounded Minimum E2 web editor
 * session over `@sceneaxi/authoring-core`.
 *
 * What deliberately does not live here: any identity implementation, any credit
 * ledger, any Stripe signature verification, any second authoring implementation,
 * and any framework or provider SDK.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/site-kit",
  releaseGroup: "sites",
});

export {
  SITE_REFUSALS,
  SITE_REFUSAL_REASONS,
  ok,
  refuse,
  type SiteOk,
  type SiteRefusal,
  type SiteRefusalReason,
  type SiteResult,
} from "./refusals.js";

export {
  CLIENT_ROLE_CLAIM_KEYS,
  SITE_ROLES,
  SITE_SURFACES,
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  hasClientRoleClaim,
  type BillingPlaneOptions,
  type CreditsPlaneOptions,
  type IdentityPlaneOptions,
  type SiteBillingAdapter,
  type SiteBillingMode,
  type SiteBillingPort,
  type SiteCheckoutHandoff,
  type SiteCheckoutRequest,
  type SiteCreditBalance,
  type SiteCreditPack,
  type SiteCreditsAdapter,
  type SiteCreditsPort,
  type SiteIdentityAdapter,
  type SiteIdentityPort,
  type SiteIdentityRequest,
  type SitePrincipal,
  type SiteRole,
  type SiteSession,
  type SiteSurface,
  type SiteUser,
} from "./ports.js";

export {
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
  decideCapability,
  decideEditorEntitlement,
  resolveEditorAccess,
  type CapabilityDecision,
  type EditorEntitlementDecision,
  type EditorEntitlementInput,
  type EntitlementBasis,
  type SiteAccess,
  type SiteCapability,
  type SiteCapabilityTier,
} from "./entitlement.js";
