/**
 * @sceneaxi/engine-orchestrator — the open path above the Game Kernel.
 *
 * Factory Orchestrator seam from spec #41's six deep modules. This package
 * supersedes the sceneaxi#60 option-B stub disposition ("not in the golden
 * path"): it now owns real bootstrap and session-lifecycle orchestration over
 * the kernel's three landed open paths — one request vocabulary, one host
 * contract, named fail-closed refusals instead of throws, a deterministic
 * bootstrap record, and a close-once session handle (ADR 0023).
 *
 * The bound is the point: one session per handle, no job queue, no scheduler,
 * no durable job store, no multi-tenancy, no plugin hook.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-orchestrator",
  releaseGroup: "core-train",
});

export {
  OPEN_PATH_KINDS,
  bootstrapOpenPath,
  resumeOpenPath,
  type AnyOpenPathHandle,
  type OpenPathBootstrap,
  type OpenPathHandle,
  type OpenPathHost,
  type OpenPathKind,
  type OpenPathRequest,
  type OpenPathStatus,
  type ProductOpenPathHandle,
  type ProductOpenPathRequest,
  type ProductResumeRequest,
  type ResumeOpenPathRequest,
  type SceneOpenPathHandle,
  type SceneOpenPathRequest,
  type SceneResumeRequest,
  type SculptOpenPathHandle,
  type SculptOpenPathRequest,
  type SculptResumeRequest,
} from "./open-path.js";

export {
  ORCHESTRATOR_REFUSALS,
  ORCHESTRATOR_REFUSAL_REASONS,
  type OrchestratorOk,
  type OrchestratorRefusal,
  type OrchestratorRefusalReason,
  type OrchestratorResult,
} from "./refusals.js";
