/**
 * @sceneaxi/engine-presentation — Presentation Runtime seam (ADR 0002) with
 * Three.js as the product presentation core (ADR 0017).
 *
 * The seam stays deep: `mount / present / capture / dispose` plus the Sculpt
 * Mount boundary. No Three type crosses these exports.
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
  NULL_SCULPT_BACKEND_LABEL,
  SculptMountError,
  createNullSculptPresentationBackend,
  createSculptMountApi,
  type SculptInstanceInput,
  type SculptMountApi,
  type SculptMountedInstance,
  type SculptPresentationBackend,
  type SculptPresentationFrame,
} from "./sculpt-mount.js";

export {
  ThreePresentationError,
  type ThreePresentationErrorCode,
} from "./three-presentation-error.js";

export {
  THREE_HEADLESS_SURFACE_LABEL,
  THREE_PRESENTATION_CORE_LABEL,
  createThreePresentationCore,
  type ThreePresentationCoreOptions,
  type ThreeSceneEnvironment,
  type ThreeViewport,
} from "./three-core.js";

export type {
  ThreeCanvasTarget,
  ThreePresentationSurface,
  ThreePresentationSurfaceKind,
  ThreeRenderableHandle,
  ThreeSurfaceDrawResult,
} from "./three-surface.js";

export type {
  OrbitCameraControls,
  OrbitCameraOptions,
  OrbitCameraState,
  OrbitInputTarget,
  OrbitPointerSample,
  OrbitWheelSample,
  Vector3Tuple,
} from "./orbit-camera.js";

export {
  createThreeSculptPresentationBackend,
  type ThreeSculptPresentationBackend,
  type ThreeTriangleAssetInput,
  type ThreeTrianglePrimitiveInput,
} from "./three-sculpt.js";

export {
  createThreePresentationRuntime,
  type ThreePresentationRuntime,
  type ThreePresentationRuntimeOptions,
  type ThreePresentedFrame,
} from "./three-runtime.js";

export {
  createThreeRenderLoop,
  hostAnimationFrameScheduler,
  type FrameScheduler,
  type ThreeRenderLoop,
  type ThreeRenderLoopOptions,
} from "./render-loop.js";
