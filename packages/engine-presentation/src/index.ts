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
  type PresentationRuntime,
} from "./runtime.js";
