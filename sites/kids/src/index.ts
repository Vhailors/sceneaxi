export type KidsSiteSeam = Readonly<{
  name: "@sceneaxi/site-kids";
  releaseGroup: "sites";
}>;

export const seam: KidsSiteSeam = Object.freeze({
  name: "@sceneaxi/site-kids",
  releaseGroup: "sites",
});

export * from "./lib/kids-activity.js";
export { KIDS_CONTENT_SECURITY_POLICY, KIDS_SECURITY_HEADERS } from "./lib/security-policy.js";
