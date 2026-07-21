/**
 * @sceneaxi/engine-kernel — Game Kernel seam (open/dispatch/advance/observe/save/replay).
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-kernel",
  releaseGroup: "core-train",
});
