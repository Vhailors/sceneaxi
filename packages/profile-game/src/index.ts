/**
 * @sceneaxi/profile-game — Game profile; pins a core range, compiles its policy in.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { ProfileSeam } from "@sceneaxi/schemas";

export const seam: ProfileSeam = Object.freeze({
  name: "@sceneaxi/profile-game",
  releaseGroup: "profile",
  corePin: "^0.0.0",
});
