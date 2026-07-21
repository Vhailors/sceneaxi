/**
 * @sceneaxi/cli — thin agent-native protocol adapter (verbs + envelope) over authoring-core; no direct engine access.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/cli",
  releaseGroup: "cli-protocol",
});
