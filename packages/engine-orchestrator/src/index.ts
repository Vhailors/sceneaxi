/**
 * @sceneaxi/engine-orchestrator — Factory Orchestrator seam from spec #41's six
 * deep modules. The MVP golden path needs no job/session layer above the Game
 * Kernel session, so this deliberately remains a public boundary seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/engine-orchestrator",
  releaseGroup: "core-train",
});
