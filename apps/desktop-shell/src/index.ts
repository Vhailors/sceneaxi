/**
 * @sceneaxi/desktop-shell — thin wrapper over the same protocol layer as
 * web-shell (authoring-core propose/apply). No forked behavior, no CLI spawn.
 *
 * sceneaxi#11 seeded the protocol client; sceneaxi#116 makes the shell
 * startable (`bin/sceneaxi-desktop.mjs`) with a real session and command layer.
 * Still protocol-thin: no native packaging, no installer, no offline store.
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
