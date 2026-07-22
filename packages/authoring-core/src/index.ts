/**
 * @sceneaxi/authoring-core — the one agent-native runtime/authoring core:
 * text-canonical document model, propose/apply application service, session
 * orchestration, evidence hooks, Model Provider Port.
 *
 * Sceneaxi#9 lands the document model, propose/apply service, and E1 durable
 * apply journal with crash recovery and undo. Session / evidence / provider
 * port remain later tickets.
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
  undoLastApply,
  type ApplyJournalDocument,
  type ApplyJournalEntry,
  type JournalOperationOk,
  type JournalOperationResult,
  type RecoveryOperationOk,
  type RecoveryOperationResult,
} from "./apply-journal.js";

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
} from "@sceneaxi/schemas";

export {
  DOCUMENT_KIND,
  DOCUMENT_SCHEMA_VERSION,
  PROPOSAL_KIND,
  PROPOSAL_SCHEMA_VERSION,
  createDocument,
  createProposal,
  parseDocumentText,
  parseProposalText,
} from "@sceneaxi/schemas";
