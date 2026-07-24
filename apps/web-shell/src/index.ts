/**
 * @sceneaxi/web-shell — human authoring surface; protocol client of
 * authoring-core, never a second authoring implementation.
 *
 * sceneaxi#11: minimal propose→diff→apply inspector stub. No hosting, no
 * deployment, no CLI spawn (matrix-denied).
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/web-shell",
  releaseGroup: "apps",
});

export {
  createInspectorSession,
  type InspectorPhase,
  type InspectorSession,
  type InspectorSnapshot,
} from "./inspector.js";

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
  MINIMUM_E2_STATE_VERSION,
  MinimumE2Error,
  createMinimumE2Editor,
  type MinimumE2Editor,
  type MinimumE2Inspector,
  type MinimumE2LoadResult,
  type MinimumE2PlayState,
  type MinimumE2SaveResult,
  type MinimumE2Snapshot,
  type MinimumE2TreeNode,
} from "@sceneaxi/authoring-core";
