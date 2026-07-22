/**
 * @sceneaxi/profile-kids — Kids profile; fail-closed policy compiled in; nothing outside Kids surfaces may depend on it.
 * Implementation arrives under its own ticket; this module is the package's
 * public seam.
 */
import type { ProfileSeam } from "@sceneaxi/schemas";

export const seam: ProfileSeam = Object.freeze({
  name: "@sceneaxi/profile-kids",
  releaseGroup: "profile",
  corePin: "^0.0.0",
});
