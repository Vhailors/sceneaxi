/**
 * @sceneaxi/desktop-shell — thin wrapper over the same protocol layer as web-shell.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/desktop-shell",
  releaseGroup: "apps",
});
