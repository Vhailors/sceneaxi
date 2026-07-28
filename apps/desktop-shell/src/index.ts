/**
 * @sceneaxi/desktop-shell — thin wrapper over the same protocol layer as
 * web-shell (authoring-core propose/apply). No forked behavior, no CLI spawn.
 *
 * sceneaxi#11 seeded the protocol client; sceneaxi#116 makes the shell
 * startable (`bin/sceneaxi-desktop.mjs`) with a real session and command layer;
 * sceneaxi#158 adds the accepted Engine Desktop visual surface as a view model
 * (`visual-model.ts`) plus a document renderer (`chrome.ts`).
 * Still protocol-thin: no native packaging, no installer, no offline store, no
 * presentation runtime — the chrome draws no pixels.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/desktop-shell",
  releaseGroup: "apps",
});

export {
  DESKTOP_COMMANDS,
  DesktopExit,
  main,
  renderDesktopResult,
  runDesktopCommand,
  runDesktopShell,
  type DesktopExitCode,
  type DesktopResult,
  type DesktopRunResult,
} from "./app.js";

export {
  createDesktopSession,
  type DesktopDocumentStatus,
  type DesktopPhase,
  type DesktopSession,
  type DesktopSessionOperations,
  type DesktopSessionOptions,
  type DesktopSnapshot,
  type DesktopUndoResult,
} from "./session.js";

export {
  renderDiffForInspector,
  shellApply,
  shellPropose,
  shellProposeAndApply,
  type ShellEditInput,
  type ShellProposeOk,
  type ShellProposeReject,
  type ShellProposeResult,
  type ShellRoundTripIndeterminate,
  type ShellRoundTripOk,
  type ShellRoundTripReject,
  type ShellRoundTripResult,
} from "./protocol-client.js";

export {
  ACCENT,
  AXIS,
  DEVIATIONS,
  FOUNDATIONS_V2_ALIGNMENT,
  FOUNDATIONS_V2_COLORS,
  FOUNDATIONS_V2_FAMILIES,
  FOUNDATIONS_V2_SOURCE,
  LINE,
  METRICS,
  PROFILE_DOT,
  SCRIM,
  SIGNAL,
  SUPERSEDED_V1,
  SURFACE,
  TEXT,
  TYPE,
  VIEWPORT_GRADIENT,
  VISUAL_SOURCE,
} from "./visual-tokens.js";

export {
  CHANGE_REVIEW_ROWS,
  DESKTOP_ASSISTANT_MODE_IDS,
  DESKTOP_DOCK_TAB_IDS,
  DESKTOP_MENU_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_MODES,
  DESKTOP_MODE_IDS,
  DESKTOP_OVERLAY_IDS,
  DESKTOP_PROFILE_IDS,
  DESKTOP_PROFILE_PACKAGES,
  DESKTOP_REFERENCE_WINDOW,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  PALETTE_GROUPS,
  SCULPT_PASSES,
  VIEWPORT_INERT_NOTE,
  VIEWPORT_RENDERER_NOTE,
  WINDOW_TIERS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  defaultDockTabFor,
  desktopVisualView,
  dockTabsFor,
  resolveWindowTier,
  type DesktopAssistantModeId,
  type DesktopAssistantState,
  type DesktopAssistantView,
  type DesktopChangeReviewRow,
  type DesktopChangeReviewView,
  type DesktopControl,
  type DesktopControlKind,
  type DesktopDockTabId,
  type DesktopMenuId,
  type DesktopModeId,
  type DesktopOverlayId,
  type DesktopOverlayView,
  type DesktopProfileChip,
  type DesktopProfileId,
  type DesktopSculptPhase,
  type DesktopSculptView,
  type DesktopVisualAction,
  type DesktopVisualRefusal,
  type DesktopVisualState,
  type DesktopVisualView,
  type DesktopWindowSize,
  type DesktopWindowTierId,
} from "./visual-model.js";

export {
  escapeHtml,
  renderDesktopChrome,
  type DesktopChromeOptions,
} from "./chrome.js";
