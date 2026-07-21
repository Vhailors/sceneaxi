/**
 * @sceneaxi/web-shell — human authoring surface; protocol client of authoring-core, never a second authoring implementation.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/web-shell",
  releaseGroup: "apps",
});
