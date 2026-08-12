/**
 * @sceneaxi/schemas — the shared contracts home: the seam vocabulary every
 * workspace package speaks, plus the versioned domain and JSON Schema contracts
 * shipped under contracts/.
 */

export {
  CATALOG_DATE_TIME_PATTERN,
  CATALOG_ITEM_SCHEMA_VERSION,
  CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION,
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  PIPELINE_STATES,
  attemptCommerceActivation,
  createCatalogItemAtIntake,
  isCommerceActive,
  legalSuccessors,
  missingMandatoryMetadata,
  transitionCatalogItem,
  validateCatalogItem,
} from "./catalog.js";
export type {
  AiGenerationDisclosure,
  AssetPackageRef,
  CatalogDelistingResult,
  CatalogItem,
  CatalogItemValidationResult,
  CatalogItemTransitionOk,
  CatalogItemTransitionResult,
  CatalogMetadataUnavailableTombstone,
  CatalogTombstoneTransitionOk,
  CommerceActivationResult,
  CommerceFields,
  Compatibility,
  HumanCurationVerdict,
  ModerationState,
  PipelineState,
  ProvenanceRecord,
  RightsRecord,
  TransitionOk,
  TransitionRecord,
  TransitionRefuse,
  TransitionRequest,
  TransitionResult,
} from "./catalog.js";

export {
  DOCUMENT_KIND,
  DOCUMENT_SCHEMA_VERSION,
  createDocument,
  isJsonObject,
  isJsonValue,
  parseDocumentText,
  serializeDocument,
  validateDocument,
} from "./document.js";

export {
  CLIENT_ROLE_CLAIM_KEYS,
  IDENTITY_REFUSE_CODES,
  IDENTITY_ROLES,
  IDENTITY_SCHEMA_VERSION,
  IDENTITY_SURFACES,
  KIDS_IDENTITY_SURFACE,
  ROLE_ASSIGNMENT_KIND,
  ROLE_SOURCES,
  SESSION_KIND,
  USER_KIND,
  claimedRoleKey,
  isIdentityRole,
  isIdentitySurface,
  isRoleSource,
  validatePrincipal,
  validateRoleAssignment,
  validateSession,
  validateUser,
} from "./identity.js";
export type {
  IdentityRefuseCode,
  IdentityRole,
  IdentitySurface,
  IdentityValidationOk,
  IdentityValidationRefuse,
  IdentityValidationResult,
  Principal,
  RoleAssignment,
  RoleSource,
  Session,
  User,
} from "./identity.js";

export {
  CREDITS_REFUSE_CODES,
  CREDITS_SCHEMA_VERSION,
  CREDIT_ACCOUNT_KIND,
  CREDIT_LEDGER_ENTRY_KIND,
  CREDIT_MOVEMENTS,
  isCreditMovement,
  validateCreditAccount,
  validateCreditLedgerEntry,
} from "./credits.js";
export type {
  CreditAccount,
  CreditLedgerEntry,
  CreditMovement,
  CreditsRefuseCode,
  CreditsValidationOk,
  CreditsValidationRefuse,
  CreditsValidationResult,
} from "./credits.js";

export {
  BILLING_MODES,
  BILLING_REFUSE_CODES,
  BILLING_SCHEMA_VERSION,
  CHECKOUT_PURPOSES,
  CHECKOUT_COMPLETED_EVENT_KIND,
  CHECKOUT_COMPLETED_EVENT_TYPE,
  CHECKOUT_SESSION_INTENT_KIND,
  CREDIT_PACKS_FIXTURES_PATH,
  DEFAULT_BILLING_MODE,
  STRIPE_CUSTOMER_LINK_KIND,
  isBillingIdentifier,
  isBillingMode,
  isCheckoutPurpose,
  isHttpsUrl,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  validateCreditPack,
  validateCreditPackCatalog,
  validateCreditPackCatalogArchive,
  validateStripeCustomerLink,
} from "./billing.js";
export { CREDIT_PACK_CATALOG_DATA } from "./credit-packs.data.js";
export type {
  BillingMode,
  BillingRefuseCode,
  BillingValidationOk,
  BillingValidationRefuse,
  BillingValidationResult,
  CheckoutCompletedEvent,
  CheckoutPurpose,
  CheckoutSessionIntent,
  CreditPack,
  CreditPackCatalog,
  CreditPackCatalogArchive,
  CreditPackRevision,
  StripeCustomerLink,
} from "./billing.js";

export {
  ENTITLEMENT_CAPABILITIES,
  ENTITLEMENT_DECISION_KIND,
  ENTITLEMENT_MATRIX,
  ENTITLEMENT_MATRIX_FIXTURES_PATH,
  ENTITLEMENT_OUTCOMES,
  ENTITLEMENT_PRICE_KINDS,
  ENTITLEMENT_REFUSE_CODES,
  ENTITLEMENT_SCHEMA_VERSION,
  STARTER_CREDIT_GRANT,
  entitlementRuleFor,
  isEntitlementCapability,
  isEntitlementOutcome,
  validateEntitlementDecision,
} from "./entitlements.js";
export type {
  EntitlementCapability,
  EntitlementDecision,
  EntitlementOutcome,
  EntitlementPriceKind,
  EntitlementRefuseCode,
  EntitlementRule,
  EntitlementValidationOk,
  EntitlementValidationRefuse,
  EntitlementValidationResult,
} from "./entitlements.js";

export {
  CATALOG_LISTINGS_FIXTURES_PATH,
  CATALOG_LISTING_KIND,
  CATALOG_LISTING_REFUSE_CODES,
  CATALOG_LISTING_SCHEMA_VERSION,
  LISTING_CATALOGS,
  LISTING_PRICE_MODES,
  isListingCatalog,
  isListingPriceMode,
  priceModeIncludesCredits,
  priceModeIncludesMoney,
  validateCatalogListing,
  validateCatalogListingSet,
} from "./catalog-listing.js";
export { CATALOG_LISTINGS_DATA } from "./catalog-listings.data.js";
export type {
  CatalogListing,
  CatalogListingRefuseCode,
  CatalogListingSet,
  CatalogListingValidationOk,
  CatalogListingValidationRefuse,
  CatalogListingValidationResult,
  ListingCatalog,
  ListingMoneyPrice,
  ListingPriceMode,
} from "./catalog-listing.js";

export {
  BASIS_POINTS_TOTAL,
  CREATOR_SHARE_BASIS_POINTS,
  CREATOR_SHARE_RECORD_KIND,
  FORBIDDEN_PAYOUT_KEYS,
  MONEY_SPLIT_RECORD_KIND,
  REVENUE_SHARE_REFUSE_CODES,
  REVENUE_SHARE_SCHEMA_VERSION,
  validateCreatorShareRecord,
  validateMoneySplitRecord,
} from "./revenue-share.js";
export type {
  CreatorShareRecord,
  MoneySplitRecord,
  RevenueShareRefuseCode,
  RevenueShareValidationOk,
  RevenueShareValidationRefuse,
  RevenueShareValidationResult,
} from "./revenue-share.js";

export {
  CONNECT_ACCOUNT_RECORD_KIND,
  CONNECT_ONBOARDING_INTENT_KIND,
  CONNECT_PAYOUT_INTENT_KIND,
  CONNECT_PAYOUT_OUTCOME_KIND,
  CONNECT_PAYOUT_STATUSES,
  CONNECT_STATUS_RECORD_KIND,
  STRIPE_CONNECT_REFUSE_CODES,
  STRIPE_CONNECT_SCHEMA_VERSION,
  connectPayoutMatchesMoneySplit,
  validateConnectAccountRecord,
  validateConnectOnboardingIntent,
  validateConnectPayoutIntent,
  validateConnectPayoutOutcome,
  validateConnectStatusRecord,
} from "./stripe-connect.js";
export type {
  ConnectAccountRecord,
  ConnectOnboardingIntent,
  ConnectPayoutIntent,
  ConnectPayoutOutcome,
  ConnectPayoutStatus,
  ConnectStatusRecord,
  StripeConnectRefuseCode,
  StripeConnectValidationResult,
} from "./stripe-connect.js";

export {
  isEpochMilliseconds,
  isNonEmptyString,
  isPlainRecord,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./record-validation.js";

export { createProvenanceWitness } from "./provenance.js";
export type { ProvenanceWitness } from "./provenance.js";

export { parseUnambiguousJson } from "./unambiguous-json.js";
export type { UnambiguousJsonParseResult } from "./unambiguous-json.js";
export type {
  DocumentValidationOk,
  DocumentValidationRefuse,
  DocumentValidationResult,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  SceneDocument,
} from "./document.js";

export {
  WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  WEB_EXPERIENCE_AUTHORING_REFUSALS,
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
  WEB_EXPERIENCE_SANDBOX_POLICY,
  evaluateWebExperienceAuthoringOperation,
} from "./web-experience-authoring.js";
export type {
  WebExperienceAuthoringDecision,
  WebExperienceAuthoringOperation,
  WebExperienceAuthoringRefusal,
  WebExperienceDesktopOnlyOperation,
} from "./web-experience-authoring.js";

export {
  CONTENT_HASH_PREFIX,
  PROPOSAL_KIND,
  PROPOSAL_SCHEMA_VERSION,
  createProposal,
  parseProposalText,
  serializeProposal,
  validateProposal,
} from "./proposal.js";

export {
  EDITOR_COMMAND_CLIENTS,
  EDITOR_COMMAND_PERMISSIONS,
  EDITOR_COMMAND_REFUSALS,
  EDITOR_COMMAND_REGISTRY,
  EDITOR_COMMAND_SCHEMA_VERSION,
  createEditorCommandInvocation,
  defineEditorCommandRegistry,
  editorCommand,
  editorCommandTerminalResult,
  editorCommandTransactionResult,
  validateEditorCommandInput,
  validateEditorCommandInvocation,
} from "./editor-command-registry.js";
export type {
  EditorCommandClient,
  EditorCommandDefinition,
  EditorCommandId,
  EditorCommandInvocation,
  EditorCommandMutation,
  EditorCommandPermission,
  EditorCommandProgress,
  EditorCommandRefusal,
  EditorCommandResultTarget,
  EditorCommandTerminalResult,
  EditorCommandTransactionResult,
  EditorCommandValidation,
} from "./editor-command-registry.js";

export {
  LEGACY_PROJECT_FORMAT_VERSION,
  PROJECT_CAPABILITIES,
  PROJECT_FORMAT_VERSION,
  PROJECT_MANIFEST_DIAGNOSTICS,
  PROJECT_MANIFEST_KIND,
  PROJECT_MANIFEST_PATH,
  PROJECT_MANIFEST_SCHEMA_VERSION,
  PROJECT_MIGRATION_ID,
  canonicalProjectManifestJson,
  createProjectManifest,
  deterministicProjectAssetId,
  deterministicProjectId,
  deterministicProjectObjectId,
  isCanonicalProjectPath,
  parseProjectManifestText,
  projectManifestDigest,
  projectVersionCapabilityResult,
  serializeProjectManifest,
  validateProjectManifest,
} from "./project-manifest.js";
export type {
  ProjectAssetIdentity,
  ProjectCapability,
  ProjectCapabilityGrant,
  ProjectFormatVersion,
  ProjectManifest,
  ProjectManifestDiagnostic,
  ProjectManifestDiagnosticCode,
  ProjectManifestValidation,
  ProjectMigrationRecord,
  ProjectObjectIdentity,
  ProjectVersionCapabilityResult,
} from "./project-manifest.js";

export {
  DELIVERY_ARTIFACT_ROLES,
  DELIVERY_HANDOFF_KIND,
  DELIVERY_HANDOFF_SCHEMA_VERSION,
  DELIVERY_TARGET_PLATFORMS,
  computeDeliveryArtifactSetDigest,
  parseDeliveryHandoffText,
  validateDeliveryHandoff,
} from "./delivery-handoff.js";

export {
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_OPERATIONS,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  MODEL_PROVIDER_ROUTE_KINDS,
} from "./model-provider.js";

export {
  DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND,
  DESKTOP_LOCAL_BRIDGE_ERROR_CODES,
  DESKTOP_LOCAL_BRIDGE_PERMISSIONS,
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  DESKTOP_LOCAL_BRIDGE_TRANSPORT,
  desktopLocalBridgeTool,
  isDesktopLocalBridgePermission,
  parseDesktopLocalBridgeDiscovery,
  validateDesktopLocalBridgeToolInput,
} from "./desktop-local-bridge.js";
export type {
  DesktopLocalBridgeDiscovery,
  DesktopLocalBridgeErrorCode,
  DesktopLocalBridgeFailure,
  DesktopLocalBridgePermission,
  DesktopLocalBridgeRequest,
  DesktopLocalBridgeResponse,
  DesktopLocalBridgeSuccess,
  DesktopLocalBridgeTool,
  DesktopLocalBridgeToolName,
} from "./desktop-local-bridge.js";
export type {
  ModelCapabilityDescriptor,
  ModelCompleteRequest,
  ModelCompleteResponse,
  ModelDescriptor,
  ModelProviderCallEvidence,
  ModelProviderOperation,
  ModelProviderProfile,
  ModelProviderRequest,
  ModelProviderRequestBase,
  ModelProviderRouteKind,
  ModelStreamChunk,
  ModelStreamRequest,
  ModelToolCall,
  ModelToolCallRequest,
  ModelToolCallResponse,
  ModelToolDescriptor,
} from "./model-provider.js";
export type {
  DeliveryArtifactRole,
  DeliveryBuildMetadata,
  DeliveryHandoff,
  DeliveryHandoffArtifact,
  DeliveryHandoffArtifacts,
  DeliveryHandoffDiagnostic,
  DeliveryHandoffDiagnosticCode,
  DeliveryHandoffProduct,
  DeliveryHandoffProvenance,
  DeliveryHandoffValidationOk,
  DeliveryHandoffValidationRefuse,
  DeliveryHandoffValidationResult,
  DeliveryTargetPlatform,
} from "./delivery-handoff.js";

export {
  EDITOR_SHELL_ASSISTANT_MODE_IDS,
  EDITOR_SHELL_ASSISTANT_STATES,
  EDITOR_SHELL_CONTROL_KINDS,
  EDITOR_SHELL_DOCK_TAB_IDS,
  EDITOR_SHELL_METRICS,
  EDITOR_SHELL_MINIMUM_WINDOW,
  EDITOR_SHELL_MODE_IDS,
  EDITOR_SHELL_MODES,
  EDITOR_SHELL_RETIRED_COPY,
  EDITOR_SHELL_SCHEMA_VERSION,
  EDITOR_SHELL_SOURCE,
  EDITOR_SHELL_VIEWPORT_SOURCES,
  EDITOR_SHELL_WINDOW_TIERS,
  editorShellDockTabsFor,
  editorShellModeRow,
} from "./editor-shell.js";
export type {
  EditorShellAssistantModeId,
  EditorShellAssistantState,
  EditorShellControlKind,
  EditorShellDockTabId,
  EditorShellModeId,
  EditorShellModeRow,
  EditorShellViewportSourceId,
  EditorShellWindowTierId,
} from "./editor-shell.js";

export {
  PLUGIN_MANIFEST_HOST_API_DIALECT,
  PLUGIN_MANIFEST_PATH,
  PLUGIN_MANIFEST_SCHEMA_URI,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  inertPluginManifestFixture,
  parsePluginManifestText,
  validatePluginManifest,
} from "./plugin.js";
export type {
  PluginManifest,
  PluginManifestDiagnostic,
  PluginManifestDiagnosticCode,
  PluginManifestValidationOk,
  PluginManifestValidationRefuse,
  PluginManifestValidationResult,
} from "./plugin.js";

export {
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_PATH,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
  PLUGIN_CAPABILITY_REGISTRY_SEED_PATH,
  PLUGIN_CAPABILITY_REGISTRY_VERSION,
  SHIPPED_PLUGIN_CAPABILITY_IDS,
  emptyPluginCapabilityRegistry,
  lookupPluginCapability,
  parsePluginCapabilityRegistryText,
  pluginCapabilityRegistrySeed,
  validatePluginCapabilityRegistry,
} from "./plugin-capability-registry.js";
export type {
  PluginCapabilityLookupHit,
  PluginCapabilityLookupMiss,
  PluginCapabilityLookupResult,
  PluginCapabilityRegistry,
  PluginCapabilityRegistryDiagnostic,
  PluginCapabilityRegistryDiagnosticCode,
  PluginCapabilityRegistryEntry,
  PluginCapabilityRegistryValidationOk,
  PluginCapabilityRegistryValidationRefuse,
  PluginCapabilityRegistryValidationResult,
  ValidatePluginCapabilityRegistryOptions,
} from "./plugin-capability-registry.js";

export {
  SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
  SCULPT_INTAKE_SOURCE_CONTRACT_REF,
  SCULPT_INTAKE_SOURCE_CONTRACT_VERSION,
  SCULPT_INTAKE_SOURCE_OWNING_PACKAGE,
  checkSculptIntakeSourceImplementation,
  requestSculptIntake,
} from "./plugin-capability-sculpt-intake.js";
export type {
  SculptIntakeSource,
  SculptIntakeSourceContractCheckOk,
  SculptIntakeSourceContractCheckRefuse,
  SculptIntakeSourceContractCheckResult,
  SculptIntakeSourceOk,
  SculptIntakeSourceRefusalReason,
  SculptIntakeSourceRefuse,
  SculptIntakeSourceRequest,
  SculptIntakeSourceResult,
} from "./plugin-capability-sculpt-intake.js";
export type {
  ApplyDiagnostic,
  ApplyDiagnosticCode,
  ApplyApplied,
  ApplyIndeterminate,
  ApplyOk,
  ApplyReject,
  ApplyResult,
  Proposal,
  ProposalDiff,
  ProposalEdit,
  ProposalValidationOk,
  ProposalValidationRefuse,
  ProposalValidationResult,
} from "./proposal.js";

/** Release groups defined by docs/dependency-matrix.json. */
export type ReleaseGroup =
  | "contracts"
  | "core-train"
  | "profile"
  | "cli-protocol"
  | "importers"
  | "plugin-host"
  | "identity"
  | "apps"
  | "sites"
  | "desktop";

/** The self-description every SceneAxi package exposes at its public seam. */
export interface PackageSeam {
  readonly name: `@sceneaxi/${string}`;
  readonly releaseGroup: ReleaseGroup;
}

/** A profile seam additionally pins the core release train (semver range). */
export interface ProfileSeam extends PackageSeam {
  readonly releaseGroup: "profile";
  readonly corePin: string;
}

/** JSON-schema contracts shipped with this package, relative to its root. */
export const contracts = Object.freeze({
  cliCommandMap: "contracts/cli-command-map.schema.json",
  cliProtocolEnvelope: "contracts/cli-protocol-envelope.schema.json",
  heldKeyRegistry: "contracts/held-key-registry.schema.json",
  kernelSession: "contracts/kernel-session.schema.json",
  rarity: "contracts/rarity.schema.json",
  catalogItem: "contracts/catalog-item.schema.json",
  catalogMetadataUnavailableTombstone:
    "contracts/catalog-metadata-unavailable-tombstone.schema.json",
  document: "contracts/document.schema.json",
  proposal: "contracts/proposal.schema.json",
  deliveryHandoff: "contracts/delivery-handoff.schema.json",
  modelProviderPort: "contracts/model-provider-port.schema.json",
  desktopLocalBridge: "contracts/desktop-local-bridge.schema.json",
  editorCommandRegistry: "contracts/editor-command-registry.schema.json",
  projectManifest: "contracts/project-manifest.schema.json",
  sculptIntake: "contracts/sculpt-intake.schema.json",
  objectSculptSpec: "contracts/object-sculpt-spec.schema.json",
  sculptArtifact: "contracts/sculpt-artifact.schema.json",
  /** Scene Composition Intake + ComposedScene (sceneaxi#85); pipeline is @sceneaxi/authoring-core. */
  sceneComposition: "contracts/scene-composition.schema.json",
  /** Profile Conformance claim (sceneaxi#10) — shared suite + development consumers. */
  profileConformance: "contracts/profile-conformance.schema.json",
  /** Open-path demo policy (sceneaxi#137); data is OPEN_PATH_POLICY_FIXTURES_PATH. */
  openPathPolicy: "contracts/open-path-policy.schema.json",
  /** Identity plane records (sceneaxi#91); guards and ports live in @sceneaxi/auth. */
  identity: "contracts/identity.schema.json",
  /** Credit account + append-only ledger (sceneaxi#91); behavior in @sceneaxi/billing. */
  creditLedger: "contracts/credit-ledger.schema.json",
  /** Checkout intents, customer links, normalized completion events (sceneaxi#91). */
  billingCheckout: "contracts/billing-checkout.schema.json",
  /** Credit pack catalog schema; canonical list is CREDIT_PACKS_FIXTURES_PATH. */
  creditPacks: "contracts/credit-packs.schema.json",
  /** Free-vs-paid capability matrix (sceneaxi#99); data is ENTITLEMENT_MATRIX_FIXTURES_PATH. */
  entitlementMatrix: "contracts/entitlement-matrix.schema.json",
  entitlementDecision: "contracts/entitlement-decision.schema.json",
  /** Catalog dual-price listings (sceneaxi#100); data is CATALOG_LISTINGS_FIXTURES_PATH. */
  catalogListings: "contracts/catalog-listings.schema.json",
  revenueShare: "contracts/revenue-share.schema.json",
  stripeConnect: "contracts/stripe-connect.schema.json",
  /** Plugin Manifest descriptor (sceneaxi#20 / ADR 0005); host runtime is @sceneaxi/plugin-host. */
  pluginManifest: "contracts/plugin-manifest.schema.json",
  /** Plugin Capability ID registry schema (sceneaxi#21 / ADR 0005); seed path is PLUGIN_CAPABILITY_REGISTRY_SEED_PATH. */
  pluginCapabilityRegistry: "contracts/plugin-capability-registry.schema.json",
});

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/schemas",
  releaseGroup: "contracts",
});

export {
  KERNEL_SESSION_SCHEMA_VERSION,
  type ProductManifest,
  type ProductEntitySeed,
  type Axis2,
  type Position2,
  type RarityRollCommand,
  type KernelCommand,
  type FrameClock,
  type SnapshotEntity,
  type KernelSnapshot,
  type KernelSessionEvent,
  type KernelSessionSaveArtifact,
} from "./kernel-session.js";

export {
  RARITY_ALGORITHM_ID,
  RARITY_FIXTURES_PATH,
  RARITY_FORBIDDEN_INPUT_KEYS,
  RARITY_MAX_CANDIDATES,
  RARITY_NAMESPACE_KIND,
  RARITY_OUTCOME_KIND,
  RARITY_POLICY_KIND,
  RARITY_PROVIDER_DESCRIPTOR_MAX_CHARS,
  RARITY_PROVIDER_REQUEST_MAX_CHARS,
  RARITY_PROVENANCE_KIND,
  RARITY_REFUSE_CODES,
  RARITY_REQUEST_KIND,
  RARITY_SCHEMA_VERSION,
  RARITY_TIERS,
  canonicalRarityJson,
  digestRarityNamespace,
  digestRarityOutcome,
  digestRarityPolicy,
  digestRarityProvenance,
  digestRarityRequest,
  digestRarityValue,
  isRarityForbiddenInputKey,
  isRarityIdentifier,
  isRarityProviderSafeIdentifier,
  refuseRarity,
  serializeRarityNamespace,
  validateRarityNamespace,
  validateRarityOutcome,
  validateRarityPolicy,
  validateRarityProviderEvidence,
  validateRarityProvenance,
  validateRarityRollRequest,
} from "./rarity.js";
export type {
  RarityCandidate,
  RarityNamespace,
  RarityOutcome,
  RarityPolicy,
  RarityProvenance,
  RarityRefuseCode,
  RarityRollRecord,
  RarityRollRequest,
  RarityTierId,
  RarityTierWeights,
  RarityValidationOk,
  RarityValidationRefuse,
  RarityValidationResult,
} from "./rarity.js";

export {
  PROFILE_CONFORMANCE_KIND,
  PROFILE_CONFORMANCE_SCHEMA_VERSION,
  PROFILE_CONFORMANCE_SUITE_VERSION,
  PROFILE_ROLLOUT_ORDER_HELD_KEY,
  createProfileConformanceClaim,
  profileConformanceRegistry,
  registryEntryFor,
  validateProfileConformanceClaim,
} from "./profile-conformance.js";
export type {
  ClaimValidationOk,
  ClaimValidationRefuse,
  ClaimValidationResult,
  ProfileClaimStatus,
  ProfileConformanceClaim,
  ProfileConformanceRegistryEntry,
  ProfileConformanceSeam,
  ProfileConformanceSurface,
  ProfileCoreAuthoring,
  ProfileCoreKernel,
  ProfileEvidenceHook,
  ProfileEvidenceHooks,
} from "./profile-conformance.js";

export {
  OPEN_PATH_DEMO_DECISION_KIND,
  OPEN_PATH_DEMO_LEVELS,
  OPEN_PATH_DEMO_OPERATIONS,
  OPEN_PATH_POLICY,
  OPEN_PATH_POLICY_FIXTURES_PATH,
  OPEN_PATH_POLICY_NOTES,
  OPEN_PATH_POLICY_PROFILES,
  OPEN_PATH_POLICY_SCHEMA_VERSION,
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  OPEN_PATH_SESSION_KINDS,
  evaluateOpenPathDemo,
  isOpenPathDemoOperation,
  openPathPolicyRowFor,
  openPathPolicyView,
  openPathPolicyViewFor,
  openPathSurfaceNotes,
  resolveOpenPathSurfaceRequest,
  validateOpenPathDemoDecision,
} from "./open-path-policy.js";
export type {
  OpenPathDemoAllowed,
  OpenPathDemoDecision,
  OpenPathDemoLevel,
  OpenPathDemoOperation,
  OpenPathDemoRefusal,
  OpenPathDemoRequest,
  OpenPathPolicyFilteredView,
  OpenPathPolicyProjection,
  OpenPathPolicyRow,
  OpenPathPolicyViewModel,
  OpenPathPolicyViewRow,
  OpenPathRefuseCode,
  OpenPathSessionKind,
  OpenPathSurfaceOutcome,
  OpenPathSurfaceRequest,
} from "./open-path-policy.js";

export {
  ANIMATION_READY_HIERARCHY_KIND,
  ANIMATION_READY_HIERARCHY_VERSION,
  OBJECT_SCULPT_SPEC_KIND,
  REQUIRED_SCULPT_PASSES,
  SCULPT_ARTIFACT_KIND,
  SCULPT_INTAKE_KIND,
  SCULPT_INTAKE_MODES,
  SCULPT_SCHEMA_VERSION,
  digestObjectSculptSpec,
  isSculptIdentifier,
  isSculptIntakeMode,
  isSculptQualityObjectSculptSpec,
  isSculptTransform,
  normalizeObjectSculptSpec,
  projectAnimationReadyHierarchy,
  validateObjectSculptSpec,
  validateSculptArtifact,
  validateSculptIntake,
  validateSculptQualityArtifact,
  validateSculptQualityObjectSculptSpec,
} from "./sculpt.js";
export type {
  ObjectSculptSpec,
  LegacyObjectSculptSpec,
  LegacySculptArtifact,
  LegacySculptProceduralModuleRef,
  LegacySculptRuntimeHierarchy,
  RequiredSculptPassId,
  SculptAttachmentPoint,
  SculptArtifact,
  SculptComponent,
  SculptCollider,
  SculptDiagnostic,
  SculptDiagnosticCode,
  SculptDetailInventory,
  SculptEvidence,
  SculptHierarchyNode,
  SculptImage,
  SculptIntake,
  SculptIntakeMode,
  SculptMaterial,
  SculptMaterialBinding,
  SculptPass,
  SculptPivot,
  SculptProceduralModuleRef,
  SculptQualityGateEvidence,
  SculptQualityDiagnostic,
  SculptQualityDiagnosticCode,
  SculptQualityArtifact,
  SculptQualityObjectSculptSpec,
  SculptQualityProceduralModuleRef,
  SculptQualityRuntimeHierarchy,
  SculptQualityValidationResult,
  SculptRuntimeHierarchy,
  SculptSocket,
  SculptTransform,
  SculptValidationResult,
  Vector3,
} from "./sculpt.js";

export {
  COMPOSED_SCENE_DOCUMENT_DATA_KEY,
  COMPOSED_SCENE_KIND,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_MAXIMUM_DEPTH,
  SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  SCENE_MAXIMUM_INSTANCES,
  SCENE_MINIMUM_INSTANCES,
  SCENE_MINIMUM_SCALE,
  composeSculptTransforms,
  composedSceneFromDocumentData,
  deriveCanonicalLocalSculptTransform,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  identitySculptTransform,
  projectSceneInstanceHierarchy,
  resolveScenePlacements,
  validateComposedScene,
  validateSceneCompositionIntake,
} from "./scene-composition.js";

export type { CanonicalLocalSculptTransformResult } from "./scene-composition.js";

export {
  DESKTOP_SCENE_EDIT_PROFILES,
  DESKTOP_SCENE_HIERARCHY_KIND,
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION,
  DESKTOP_SCENE_REPARENT_POLICIES,
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  desktopSceneTransformProperty,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  isDesktopSceneReparentPolicy,
  resolveDesktopSceneSelection,
} from "./desktop-scene-edit.js";
export type {
  DesktopSceneEditOperation,
  DesktopSceneEditProfile,
  DesktopSceneHierarchyRefusal,
  DesktopSceneReparentPolicy,
  DesktopSceneSelection,
  DesktopSceneSelectionResult,
  DesktopSceneTransformPropertyDefinition,
  DesktopSceneTransformPropertyId,
} from "./desktop-scene-edit.js";
export type {
  ComposedScene,
  ComposedSceneArtifactDigest,
  ComposedSceneEvidence,
  ComposedSceneInstance,
  PlacedSceneInstanceHierarchy,
  ResolvedScenePlacement,
  SceneCompositionDiagnostic,
  SceneCompositionDiagnosticCode,
  SceneCompositionIntake,
  SceneCompositionValidationResult,
  ScenePlacement,
} from "./scene-composition.js";

export {
  SCULPT_PROCEDURAL_EMIT_KIND,
  SCULPT_PROCEDURAL_EMIT_VERSION,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
} from "./sculpt-procedural.js";
export type {
  SculptProceduralEmit,
  SculptProceduralGeometry,
  SculptProceduralMaterial,
  SculptProceduralNode,
} from "./sculpt-procedural.js";
