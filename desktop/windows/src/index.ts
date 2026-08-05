export {
  WINDOWS_UPDATE_REFUSALS,
  runWindowsUpdateCheck,
  type WindowsUpdateInput,
  type WindowsUpdateRefusal,
  type WindowsUpdateResult,
} from "./lib/update-policy.js";

export const seam = /* @__PURE__ */ Object.freeze({
  name: "@sceneaxi/desktop-windows",
  releaseGroup: "desktop",
} as const);
