/**
 * @sceneaxi/engine-presentation — Presentation Runtime seam; backend hidden, Stage 1 decides composition.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-presentation",
  releaseGroup: "core-train",
});
