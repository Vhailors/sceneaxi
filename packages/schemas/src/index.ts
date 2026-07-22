/**
 * @sceneaxi/schemas — the shared contracts home: the seam vocabulary every
 * workspace package speaks, plus the versioned domain and JSON Schema contracts
 * shipped under contracts/.
 */

export {
  CATALOG_ITEM_SCHEMA_VERSION,
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
  CatalogItem,
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
  document: "contracts/document.schema.json",
  proposal: "contracts/proposal.schema.json",
  deliveryHandoff: "contracts/delivery-handoff.schema.json",
  /** Profile Conformance claim (sceneaxi#10) — shared suite + development consumers. */
  profileConformance: "contracts/profile-conformance.schema.json",
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
