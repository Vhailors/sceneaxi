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
} from "./catalog.js";
export type {
  AiGenerationDisclosure,
  AssetPackageRef,
  CatalogDelistingResult,
  CatalogItem,
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
  CONTENT_HASH_PREFIX,
  PROPOSAL_KIND,
  PROPOSAL_SCHEMA_VERSION,
  createProposal,
  parseProposalText,
  serializeProposal,
  validateProposal,
} from "./proposal.js";

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
  emptyPluginCapabilityRegistrySeed,
  lookupPluginCapability,
  parsePluginCapabilityRegistryText,
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
  | "apps";

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
  catalogItem: "contracts/catalog-item.schema.json",
  catalogMetadataUnavailableTombstone:
    "contracts/catalog-metadata-unavailable-tombstone.schema.json",
  document: "contracts/document.schema.json",
  proposal: "contracts/proposal.schema.json",
  deliveryHandoff: "contracts/delivery-handoff.schema.json",
  modelProviderPort: "contracts/model-provider-port.schema.json",
  sculptIntake: "contracts/sculpt-intake.schema.json",
  objectSculptSpec: "contracts/object-sculpt-spec.schema.json",
  sculptArtifact: "contracts/sculpt-artifact.schema.json",
  /** Scene Composition Intake + ComposedScene (sceneaxi#85); pipeline is @sceneaxi/authoring-core. */
  sceneComposition: "contracts/scene-composition.schema.json",
  /** Profile Conformance claim (sceneaxi#10) — shared suite + development consumers. */
  profileConformance: "contracts/profile-conformance.schema.json",
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
  type KernelCommand,
  type FrameClock,
  type SnapshotEntity,
  type KernelSnapshot,
  type KernelSessionEvent,
  type KernelSessionSaveArtifact,
} from "./kernel-session.js";

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
  runProfileConformanceSuite,
  type ConformanceCheckResult,
  type ConformanceSuiteResult,
} from "./profile-conformance-suite.js";

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
  SCENE_MAXIMUM_INSTANCES,
  SCENE_MINIMUM_INSTANCES,
  composeSculptTransforms,
  composedSceneFromDocumentData,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  identitySculptTransform,
  projectSceneInstanceHierarchy,
  resolveScenePlacements,
  validateComposedScene,
  validateSceneCompositionIntake,
} from "./scene-composition.js";
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
