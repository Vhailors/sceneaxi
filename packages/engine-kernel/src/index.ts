/**
 * @sceneaxi/engine-kernel — Game Kernel seam (open/dispatch/advance/observe/save/replay).
 * External interface is a command/snapshot session per ADR 0001 Design A.
 * Only advance mutates authoritative state; snapshots are read-only; Game-
 * session save/replay artifacts carry schema + kernel/BOM versions with fail-
 * closed major mismatch. The hybrid sculpt session preserves the same
 * authority model for its bounded hierarchy, animation-socket, and toy-
 * collision vertical.
 *
 * Every session path is browser-runnable: digests come from a portable
 * synchronous sha256 rather than `node:crypto`, and snapshots/save artifacts
 * stay plain serializable data a presentation runtime can consume
 * (docs/kernel-browser-open.md).
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-kernel",
  releaseGroup: "core-train",
});

export { portableKernelDigest } from "./portable-digest.js";

export {
  BOM_VERSION,
  KERNEL_VERSION,
  KernelSessionError,
  open,
  replay,
  type KernelHost,
  type KernelSession,
} from "./session.js";

export type {
  FrameClock,
  KernelCommand,
  KernelSessionEvent,
  KernelSessionSaveArtifact,
  KernelSnapshot,
  ProductManifest,
  SnapshotEntity,
} from "@sceneaxi/schemas";

export { KERNEL_SESSION_SCHEMA_VERSION } from "@sceneaxi/schemas";

export {
  SCULPT_KERNEL_SAVE_KIND,
  openSculptKernelSession,
  replaySculptKernelSession,
  type SculptAnimationSocketSnapshot,
  type SculptKernelNodeSnapshot,
  type SculptKernelOptions,
  type SculptKernelSaveArtifact,
  type SculptKernelSession,
  type SculptKernelSnapshot,
} from "./sculpt-session.js";

export {
  SCENE_KERNEL_SAVE_KIND,
  deriveSceneInstanceSeed,
  openSceneKernelSession,
  replaySceneKernelSession,
  type SceneInstanceSnapshot,
  type SceneKernelOptions,
  type SceneKernelSaveArtifact,
  type SceneKernelSession,
  type SceneKernelSnapshot,
} from "./scene-session.js";
