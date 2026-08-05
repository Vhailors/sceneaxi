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
 * `@sceneaxi/schemas` Catalog Item contract, a bounded Minimum E2 web editor
 * session over `@sceneaxi/authoring-core`, and the shared Foundations v2 visual
 * layer — token data, CSS emitters, a framework-neutral element tree, and the
 * Change Review primitive (owner: `docs/design-foundations.md`).
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
  JsonValue,
  ModerationState,
  PackageSeam,
  PipelineState,
  Proposal,
  ProposalEdit,
  ProvenanceRecord,
  RightsRecord,
  SceneDocument,
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
  IDENTITY_SURFACES,
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  createLoginPlane,
  hasClientRoleClaim,
  type BillingPlaneOptions,
  type CreditsPlaneOptions,
  type IdentityPlaneOptions,
  type LoginPlaneOptions,
  type SiteLoginAdapter,
  type SiteLoginGrant,
  type SiteLoginPort,
  type SiteLoginRequest,
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
  CATALOG_IDENTITY_SURFACE,
  createCatalogIdentityPlane,
  resolveCatalogViewer,
  type CatalogIdentityPlane,
  type CatalogIdentityPlaneOptions,
} from "./catalog-identity.js";

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
  type WebEditorViewportFrame,
} from "./web-editor.js";

export {
  WEB_EXPERIENCE_CANVAS_LAYOUTS,
  WEB_EXPERIENCE_DEFAULT_HTML,
  WEB_EXPERIENCE_DEFAULT_TITLE,
  WEB_EXPERIENCE_EDITOR_PARAMS,
  WEB_EXPERIENCE_HTML_MAX_LENGTH,
  WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH,
  WEB_EXPERIENCE_TITLE_MAX_LENGTH,
  buildWebExperienceEditorView,
  readWebExperienceEditorState,
  webExperienceRequestTarget,
  type WebExperienceCanvasLayout,
  type WebExperienceEditorState,
  type WebExperienceEditorView,
} from "./web-experience-editor.js";

export { sitePathWithSearchParams } from "./site-search-params.js";

export {
  WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  WEB_EXPERIENCE_AUTHORING_REFUSALS,
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
  WEB_EXPERIENCE_SANDBOX_POLICY,
  evaluateWebExperienceAuthoringOperation,
  type WebExperienceAuthoringDecision,
  type WebExperienceAuthoringOperation,
  type WebExperienceAuthoringRefusal,
  type WebExperienceDesktopOnlyOperation,
} from "@sceneaxi/schemas";

export {
  WEB_EDITOR_STARTER_SEED,
  reconstructStarter,
  webEditorStarterArtifact,
} from "./starter-artifact.js";

export {
  mountableScene,
  type ComposedSceneOk,
  type MountableScene,
  type MountableSceneInstance,
} from "./mountable-scene.js";

export {
  DESKTOP_LINUX_APP_OFFER,
  desktopLinuxAppOffer,
  resolveDesktopAppOffer,
  type DesktopAppArtifact,
  type DesktopAppOffer,
  type DesktopUnavailablePlatform,
} from "./desktop-app-offer.js";

export {
  LIVE_OPEN_INSTANCE_COUNT,
  LIVE_OPEN_PATH,
  LIVE_OPEN_PRESENTATION,
  LIVE_OPEN_SCENE_ID,
  composeLiveOpenScene,
  liveOpenScene,
  type LiveOpenInstance,
  type LiveOpenScene,
} from "./live-open.js";

export {
  CATALOG_SURFACES,
  CREATOR_SHARE_ROUNDING_NOTE,
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
  resolveCheckoutRedirectOrigin,
  resolveEditorLinkFromEnv,
  resolveFamilyLinks,
  resolveUmbrellaEditorOrigin,
  resolveUmbrellaOriginConfiguration,
  type EditorDeepLink,
  type FamilyLinks,
  type UmbrellaOriginConfiguration,
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
  resolveEditorSession,
  type CapabilityDecision,
  type EditorAccessDecision,
  type EditorEntitlementDecision,
  type EditorEntitlementInput,
  type EditorSessionAccess,
  type EntitlementBasis,
  type SiteAccess,
  type SiteCapability,
  type SiteCapabilityTier,
} from "./entitlement.js";

export {
  EDITOR_MAX_OBJECTS,
  EDITOR_MIN_OBJECTS,
  EDITOR_STATE_PARAMS,
  editorHref,
  readEditorState,
  type EditorInstanceState,
  type EditorState,
  type SearchParams,
} from "./editor-state.js";

export {
  EDITOR_SCENE_ID,
  EDITOR_SEED,
  renderEditorState,
  type EditorRender,
} from "./editor-session.js";

export {
  EDITOR_SHELL_FABRICATED_FIGURES,
  EDITOR_SHELL_WEB_REFUSALS,
  EDITOR_SHELL_WEB_REFUSAL_MESSAGES,
  buildEditorShellView,
  type EditorShellConsoleRow,
  type EditorShellControl,
  type EditorShellControlBinding,
  type EditorShellEvidenceRow,
  type EditorShellInput,
  type EditorShellInspectorField,
  type EditorShellInspectorSection,
  type EditorShellModeView,
  type EditorShellPaletteRow,
  type EditorShellProfileChip,
  type EditorShellRegistryRow,
  type EditorShellSocketRow,
  type EditorShellTreeRow,
  type EditorShellView,
  type EditorShellWebRefusal,
  type WebEditorOperation,
} from "./editor-shell.js";

export {
  FOUNDATIONS_SOURCE,
  FOUNDATIONS_VERSION,
  FOUNDATION_ACCENT_RULE,
  FOUNDATION_BUTTON_SIZES,
  FOUNDATION_COLORS,
  FOUNDATION_COLOR_LAWS,
  FOUNDATION_CONTRAST_MINIMUMS,
  FOUNDATION_CONTRAST_ROLES,
  FOUNDATION_FONT_STACKS,
  FOUNDATION_NEUTRAL_TOKENS,
  FOUNDATION_RADII,
  FOUNDATION_SPACING,
  FOUNDATION_SPACING_RULE,
  FOUNDATION_STATUSES,
  FOUNDATION_SURFACES,
  FOUNDATION_SURFACE_ACCENTS,
  FOUNDATION_SURFACE_RULE,
  FOUNDATION_TYPE_SCALE,
  contrastRatio,
  foundationsBaseCss,
  foundationsCss,
  foundationsStatusCss,
  foundationsSurfacesCss,
  foundationsVariablesCss,
  meetsContrast,
  resolveSurfaceAccent,
  type FoundationColor,
  type FoundationColorGroup,
  type FoundationContrastRole,
  type FoundationFamily,
  type FoundationStatus,
  type FoundationStatusId,
  type FoundationSurface,
  type FoundationSurfaceAccent,
  type FoundationSurfaceAccentId,
  type FoundationTypeStep,
  type FoundationsCssOptions,
} from "./design-tokens.js";

export {
  el,
  escapeHtml,
  renderSiteElementHtml,
  type SiteElement,
  type SiteElementProps,
} from "./site-element.js";

export {
  STATE_PANEL_TONES,
  createStatePanelModel,
  statePanelElement,
  type StatePanelEvidence,
  type StatePanelInput,
  type StatePanelModel,
  type StatePanelTone,
  type StatePanelVariant,
} from "./state-panel.js";

export {
  COMMERCE_NOTICE_COPY,
  commerceNoticeElement,
  createCommerceNoticeModel,
  type CommerceNoticeInput,
  type CommerceNoticeModel,
  type CommerceNoticeViewer,
} from "./commerce-notice.js";

export {
  SITE_COOKIE_OCTET_RE,
  SITE_SESSION_COOKIE,
  SITE_SESSION_HEADER,
  buildSiteSessionCookie,
  clearSiteSessionCookie,
  resolveSiteSessionCookieSecurity,
  resolveSiteSessionToken,
  verifySiteFormOrigin,
  type SiteFormOriginSignals,
  type SiteSessionCookieInput,
  type SiteSessionCookieSecuritySignals,
  type SiteSessionTokenSources,
} from "./site-session.js";

export {
  SITE_LOGIN_HREF_MAX_LENGTH,
  SITE_LOGIN_PATH,
  confineSiteRelativePath,
  describeSiteAccessState,
  siteLoginHref,
  type SiteAccessAction,
  type SiteAccessState,
  type SiteAccessStateKey,
  type SiteAccessStateOptions,
} from "./access-states.js";

export {
  CHANGE_REVIEW_BADGE_GLYPHS,
  changeReviewCss,
  changeReviewElement,
  decideAllRows,
  formatProposalValue,
  resolveChangeReview,
  reviewProposal,
  shortDigest,
  splitPointer,
  type ChangeReview,
  type ChangeReviewBadge,
  type ChangeReviewDecision,
  type ChangeReviewDocument,
  type ChangeReviewInput,
  type ChangeReviewResolution,
  type ChangeReviewRow,
} from "./change-review.js";
