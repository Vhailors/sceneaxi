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

/**
 * Contract vocabulary re-exported for the `sites/` tier.
 *
 * A site depends on `@sceneaxi/site-kit` alone (matrix-enforced), so the shapes its
 * pages render travel through this seam rather than each site reaching into
 * `@sceneaxi/schemas` and `@sceneaxi/authoring-core` directly.
 */
export { COMMERCE_ACTIVATION_GATE } from "@sceneaxi/schemas";
export type {
  AiGenerationDisclosure,
  AssetPackageRef,
  CatalogItem,
  Compatibility,
  ModerationState,
  PackageSeam,
  PipelineState,
  ProvenanceRecord,
  RightsRecord,
  SculptTransform,
  TransitionRecord,
  Vector3,
} from "@sceneaxi/schemas";
export type {
  MinimumE2Inspector,
  MinimumE2SaveResult,
  MinimumE2Snapshot,
  MinimumE2TreeNode,
  SceneCompositionResult,
} from "@sceneaxi/authoring-core";

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
  SDK_MANIFEST_FILE,
  SDK_PUBLIC_DIR,
  formatByteSize,
  hashServedArchive,
  readEngineSdkOffer,
  type EngineSdkOffer,
} from "./engine-sdk-offer.js";

export {
  WEB_EDITOR_DOCUMENT_PATH,
  WEB_EDITOR_SESSION_OPERATIONS,
  WebEditorError,
  createWebEditorSession,
  type WebEditorMount,
  type WebEditorSession,
  type WebEditorSessionOptions,
} from "./web-editor.js";

export {
  WEB_EDITOR_STARTER_INTAKE_PATH,
  WEB_EDITOR_STARTER_SEED,
  webEditorStarterArtifact,
} from "./starter-artifact.js";

export {
  CATALOG_SURFACES,
  CREATOR_SHARE_RULE,
  SITE_CATALOG_POLICY_CITES,
  attemptCatalogPurchase,
  createPublishIntent,
  creatorShare,
  describeListingPrice,
  listSiteCatalog,
  showSiteListing,
  submitPublishIntent,
  type CatalogCommerceRefusal,
  type CatalogPurchaseRequest,
  type CatalogSurface,
  type CreatorShare,
  type PriceDisplay,
  type PublishIntent,
  type SiteListing,
  type SiteListingPrice,
  type SiteMoneyPrice,
} from "./catalog.js";

export {
  EDITOR_DEEP_LINK_PARAMS,
  EDITOR_DEEP_LINK_PATH,
  buildEditorDeepLink,
  parseEditorDeepLink,
  parseEditorDeepLinkParams,
  type EditorDeepLink,
} from "./deep-link.js";

export {
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
  decideCapability,
  decideEditorAccess,
  decideEditorEntitlement,
  readEditorPreviewFlag,
  resolveEditorAccess,
  type CapabilityDecision,
  type EditorAccessDecision,
  type EditorEntitlementDecision,
  type EditorEntitlementInput,
  type EntitlementBasis,
  type SiteAccess,
  type SiteCapability,
  type SiteCapabilityTier,
} from "./entitlement.js";
