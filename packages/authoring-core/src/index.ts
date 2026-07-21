/**
 * @sceneaxi/authoring-core — the one agent-native runtime/authoring core: text-canonical document model, propose/apply application service, session orchestration, evidence hooks, Model Provider Port.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/authoring-core",
  releaseGroup: "core-train",
});
