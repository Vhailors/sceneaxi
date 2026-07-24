/**
 * @sceneaxi/engine-kernel — Game Kernel seam (open/dispatch/advance/observe/save/replay).
 * External interface is a command/snapshot session per ADR 0001 Design A.
 * Only advance mutates authoritative state; snapshots are read-only; Game-
 * session save/replay artifacts carry schema + kernel/BOM versions with fail-
 * closed major mismatch. The hybrid sculpt session preserves the same
 * authority model for its bounded hierarchy, animation-socket, and toy-
 * collision vertical.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-kernel",
  releaseGroup: "core-train",
});

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
