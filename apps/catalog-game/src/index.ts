/**
 * @sceneaxi/catalog-game — game-asset storefront over the catalog pipeline contracts only; commerce fields inert.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/catalog-game",
  releaseGroup: "apps",
});
