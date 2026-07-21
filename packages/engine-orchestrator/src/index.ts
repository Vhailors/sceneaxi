/**
 * @sceneaxi/engine-orchestrator — Factory Orchestrator seam from spec #41's six deep modules.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-orchestrator",
  releaseGroup: "core-train",
});
