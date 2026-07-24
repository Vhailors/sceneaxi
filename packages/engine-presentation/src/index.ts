/**
 * @sceneaxi/engine-presentation — Presentation Runtime seam; backend hidden,
 * Stage 1 decides real composition.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-presentation",
  releaseGroup: "core-train",
});

export {
  PresentationRuntimeError,
  createNullPresentationRuntime,
  type PresentationCaptureResult,
  type PresentationRuntime,
} from "./runtime.js";

export {
  EXPERIMENTAL_THREE_NON_DECISION_LABEL,
  SculptMountError,
  createNullSculptPresentationBackend,
  createSculptMountApi,
  type SculptInstanceInput,
  type SculptMountApi,
  type SculptMountedInstance,
  type SculptPresentationBackend,
  type SculptPresentationFrame,
} from "./sculpt-mount.js";

export { createExperimentalThreeSculptPresentationBackend } from "./experimental-three.js";
