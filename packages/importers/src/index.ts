/**
 * @sceneaxi/importers — external content/project adapters producing Core documents and Asset Packages via the authoring service.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/importers",
  releaseGroup: "importers",
});
