/**
 * @sceneaxi/desktop-linux — the packaged Linux desktop application (ADR 0024).
 *
 * Electron packaging over the Engine Desktop chrome from `@sceneaxi/desktop-shell`
 * and the real engine stack: `composeScene()` composition, the orchestrated kernel
 * open path, the one Three presentation core in the renderer process, and the
 * shared authoring propose/accept session. This package adds packaging and one
 * narrow bridge seam; it duplicates no editor state machine, no visual token, and
 * no kernel behaviour.
 *
 * Everything under `src/lib/` is pure TypeScript proven by `pnpm gate` from
 * `tests/desktop/` and `tests/e2e/`; only `src/electron/` may import Electron
 * (enforced by `pnpm check:desktop`), and `src/renderer/` runs in the window.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/desktop-linux",
  releaseGroup: "desktop",
});

export {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_BRIDGE_GLOBAL,
  DESKTOP_BRIDGE_REFUSALS,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeAction,
  type DesktopBridgeAssistantOp,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeAuthoringOp,
  type DesktopBridgeHandshake,
  type DesktopBridgeOk,
  type DesktopBridgeRefusal,
  type DesktopBridgeRefusalReason,
  type DesktopBridgeRequest,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
} from "./lib/bridge-contract.js";

export {
  OPEN_PATH_EXERCISE_TICKS,
  createDesktopBridge,
  type DesktopBridge,
  type DesktopBridgeOptions,
  type DesktopAssistantRunRequest,
  type DesktopAssistantProfile,
  type OpenPathExercise,
} from "./lib/bridge.js";

export {
  DESKTOP_OPEN_PLACEMENTS,
  DESKTOP_OPEN_SCENE_ID,
  DESKTOP_SCENE_NOT_COMPOSABLE,
  desktopOpenScene,
  type DesktopSceneResult,
} from "./lib/desktop-scene.js";

export {
  DESKTOP_RUNTIME_META,
  PIXELS_META_NAME,
  RENDERER_SCRIPT_TAG,
  desktopLinuxIndexHtml,
  type DesktopIndexHtmlOptions,
} from "./lib/chrome-document.js";
