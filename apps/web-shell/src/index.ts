/**
 * @sceneaxi/web-shell — human authoring surface; protocol client of
 * authoring-core, never a second authoring implementation.
 *
 * Sceneaxi#11: minimal propose→diff→apply inspector stub. The hybrid sculpt
 * vertical re-exports authoring-core's bounded Minimum E2 orchestration. No
 * hosting, deployment, or CLI spawn (matrix-denied).
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/web-shell",
  releaseGroup: "apps",
});

export {
  ACCOUNT_PANEL_REASONS,
  createAccountPanel,
  type AccountCreditsView,
  type AccountPanel,
  type AccountPanelPhase,
  type AccountPanelReason,
  type AccountPanelRefusal,
  type AccountPanelSnapshot,
  type CapabilityView,
  type CreateAccountPanelOptions,
  type CreateAccountPanelResult,
} from "./account-panel.js";

export {
  ASSISTANT_DEBIT_REASON,
  ASSISTANT_DEFAULT_MODE,
  ASSISTANT_MODES,
  ASSISTANT_MODE_BILLING,
  ASSISTANT_PANEL_REASONS,
  ASSISTANT_TURN_KEY_PREFIX,
  createAssistantPanel,
  type AssistantAskRequest,
  type AssistantCreditsView,
  type AssistantMode,
  type AssistantPanel,
  type AssistantPanelReason,
  type AssistantPanelSnapshot,
  type AssistantRefusal,
  type AssistantTurn,
  type CreateAssistantPanelOptions,
  type CreateAssistantPanelResult,
} from "./assistant-panel.js";

export {
  createOpenPathView,
  type OpenPathView,
} from "./open-path-view.js";

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
