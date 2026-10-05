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
  type ThreePresentationCore,
  type ThreeDrawnFrame,
  type ThreeSceneEnvironment,
  type ThreeViewport,
} from "./three-core.js";

export { releaseThreeCanvas } from "./three-surface.js";

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
  OrbitInputListener,
  OrbitPointerSample,
  OrbitWheelSample,
  Vector3Tuple,
} from "./orbit-camera.js";

export {
  createThreeSculptPresentationBackend,
  type ThreeSculptPresentationBackend,
  type ThreeTriangleAssetInput,
  type ThreeTriangleNodeInput,
  type ThreeContainedTexture,
  type ThreeInstancePose,
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

export { createAudioPlaybackRuntime, AudioPlaybackError, type AudioPlaybackRuntime, type ContainedAudioAsset, type AudioContextPort, type AudioBufferPort, type AudioSourcePort, type AudioGainPort, type AudioConnectionTarget, type AudioDestinationPort } from "./audio-playback.js";

// SDK pin: numeric cubic playback contract, never Three animation/loader types.
export type { ThreeTriangleAnimationClip } from "./triangle-animation.js";

// SDK pin: contained bytes only; format admission does not grant asset provenance.
export { decodeContainedImage, type ContainedImageInput, type DecodedContainedImage } from "./contained-image.js";

export {
  resolveScenePresentationV2,
  type ScenePresentationSourceV2,
} from "./scene-transforms.js";
