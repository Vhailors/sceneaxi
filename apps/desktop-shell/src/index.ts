/**
 * @sceneaxi/desktop-shell — thin wrapper over the same protocol layer as
 * web-shell (authoring-core propose/apply). No forked behavior, no CLI spawn.
 *
 * sceneaxi#11: protocol client stub only. No packaging, no native shell UI.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/desktop-shell",
  releaseGroup: "apps",
});

export {
  renderDiffForInspector,
  shellApply,
  shellPropose,
  shellProposeAndApply,
  type ShellEditInput,
  type ShellProposeOk,
  type ShellProposeReject,
  type ShellProposeResult,
  type ShellRoundTripOk,
  type ShellRoundTripReject,
  type ShellRoundTripResult,
} from "./protocol-client.js";
