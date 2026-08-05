/**
 * @sceneaxi/authoring-core — the one agent-native runtime/authoring core:
 * text-canonical document model, propose/apply application service, session
 * orchestration, evidence hooks, Model Provider Port.
 *
 * Sceneaxi#9 lands the document model, propose/apply service, and E1 durable
 * apply journal with crash recovery and undo. Sceneaxi#45 adds the provider-
 * neutral Model Provider Port. The hybrid sculpt vertical adds deterministic
 * reconstruction and bounded Minimum E2 orchestration; broader session
 * orchestration remains later work.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/authoring-core",
  releaseGroup: "core-train",
});

export {
  apply,
  applyPointerEditInMemory,
  contentHash,
  editDirect,
  propose,
  proposeMany,
  readProposalFile,
  serializeDocument,
  serializeProposal,
  validateDocument,
  writeDocumentFile,
  writeProposalFile,
  type ApplyInput,
  type DirectEditInput,
  type DirectEditOk,
  type DirectEditResult,
  type ProposeInput,
  type ProposeOk,
  type ProposeReject,
  type ProposeResult,
} from "./propose-apply.js";

export {
  atomicWriteAll,
  atomicWriteFile,
  acquireAtomicWriteLocks,
  canonicalPath,
  fileExists,
  readTextFile,
  releaseAtomicWriteLocks,
  type AtomicWriteLockSet,
  type AtomicWritePlan,
} from "./atomic-write.js";

export {
  getAtPointer,
  pointerTokens,
  setAtPointer,
  type PointerGetResult,
  type PointerSetResult,
} from "./json-pointer.js";

export { unifiedDiff } from "./unified-diff.js";

export {
  APPLY_JOURNAL_KIND,
  APPLY_JOURNAL_SCHEMA_VERSION,
  recoverIncompleteApplies,
  resolveApplyTransaction,
  undoLastApply,
  type ApplyTransactionResolutionOk,
  type ApplyTransactionResolutionResult,
  type ApplyTransactionState,
  type ApplyJournalDocument,
  type ApplyJournalEntry,
  type JournalOperationOk,
  type JournalOperationResult,
  type RecoveryOperationOk,
  type RecoveryOperationResult,
} from "./apply-journal.js";

export {
  MODEL_PROVIDER_REFUSE_REASONS,
  createModelProviderPort,
  type CreateModelProviderPortOptions,
  type ModelProviderAdapter,
  type ModelProviderAdapterSuccess,
  type ModelProviderPolicyAllow,
  type ModelProviderPolicyContext,
  type ModelProviderPolicyDecision,
  type ModelProviderPolicyFilter,
  type ModelProviderPolicyRefuse,
  type ModelProviderPort,
  type ModelProviderRefuse,
  type ModelProviderResult,
  type ModelProviderSuccess,
} from "./model-provider-port.js";

export {
  reconstructSculpt,
  reconstructSculptQuality,
  serializeSculptArtifact,
} from "./sculpt-reconstruction.js";

export {
  SCULPT_PROCEDURAL_EMIT_KIND,
  SCULPT_PROCEDURAL_EMIT_VERSION,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  emitSculptProcedural,
  type SculptProceduralEmit,
  type SculptProceduralGeometry,
  type SculptProceduralMaterial,
  type SculptProceduralNode,
} from "./sculpt-procedural-emit.js";
export type {
  SculptOfflineAgent,
  SculptReconstructionOptions,
  SculptReconstructionRefusalCode,
  SculptReconstructionResult,
  SculptQualityReconstructionRefusalCode,
  SculptQualityReconstructionResult,
} from "./sculpt-reconstruction.js";

export {
  composeScene,
  sceneDocumentFromComposedScene,
  serializeComposedScene,
  type SceneCompositionOptions,
  type SceneCompositionRefusalCode,
  type SceneCompositionResult,
} from "./scene-composition.js";

export {
  ASSISTANT_SCULPT_PROGRESS_PHASES,
  ASSISTANT_SCULPT_REFUSALS,
  runAssistantSculptAction,
  sculptArtifactFromAssistantCompletion,
  type AssistantSculptFailure,
  type AssistantSculptInspection,
  type AssistantSculptInspectionEdit,
  type AssistantSculptProgress,
  type AssistantSculptProgressPhase,
  type AssistantSculptRefusal,
  type AssistantSculptResult,
  type AssistantSculptSuccess,
  type RunAssistantSculptOptions,
} from "./assistant-sculpt.js";

export {
  MINIMUM_E2_STATE_VERSION,
  MinimumE2Error,
  createMinimumE2Editor,
  type MinimumE2Editor,
  type MinimumE2Inspector,
  type MinimumE2LoadResult,
  type MinimumE2PlayState,
  type MinimumE2SaveResult,
  type MinimumE2Snapshot,
  type MinimumE2TreeNode,
} from "./minimum-e2.js";

// Re-export document/proposal types from schemas for adapter convenience.
export type {
  ApplyDiagnostic,
  ApplyDiagnosticCode,
  ApplyApplied,
  ApplyIndeterminate,
  ApplyResult,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  Proposal,
  ProposalDiff,
  ProposalEdit,
  SceneDocument,
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
} from "@sceneaxi/schemas";

export {
  DOCUMENT_KIND,
  DOCUMENT_SCHEMA_VERSION,
  PROPOSAL_KIND,
  PROPOSAL_SCHEMA_VERSION,
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_OPERATIONS,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  MODEL_PROVIDER_ROUTE_KINDS,
  createDocument,
  createProposal,
  parseDocumentText,
  parseProposalText,
} from "@sceneaxi/schemas";
