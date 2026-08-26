/**
 * @sceneaxi/cli — thin agent-native protocol adapter (verbs + envelope) over
 * authoring-core; no direct engine access.
 *
 * This package implements the umbrella dispatcher, deterministic exit-code map,
 * versioned envelope, and strict `--json` equivalence (sceneaxi#6). E1
 * `project propose` / `project apply` are live (sceneaxi#9). Held-key currency
 * is sceneaxi#7.
 */

import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/cli",
  releaseGroup: "cli-protocol",
});

export {
  ExitCode,
  EXIT_CODE_TABLE,
  FAILURE_EXIT_CODE,
  exitCodeForFailure,
  type ExitCodeValue,
  type FailureClass,
} from "./exit-codes.js";

export {
  success,
  failure,
  type CliEnvelope,
  type CliErrorEnvelope,
  type CliSuccessEnvelope,
  type CliOutcome,
  type CliErrorBody,
  type ResultPayload,
} from "./envelope.js";

export { PROTOCOL_SCHEMA_VERSION, CLI_VERSION } from "./version.js";

export { formatOutcome, renderText, type OutputFormat } from "./format.js";

export { dispatch, parseArgv, type DispatchOptions } from "./dispatcher.js";

export { runCli, main, type RunCliResult } from "./run.js";

export {
  callDesktopLocalBridge,
  type DesktopLocalBridgeClient,
  type DesktopLocalBridgeClientCall,
  type DesktopLocalBridgeClientFailure,
  type DesktopLocalBridgeClientResult,
} from "./desktop-client.js";

export {
  ROOT_COMMANDS,
  ROOT_GROUP_NAMES,
  topLevelHelpPayload,
  type CommandNode,
  type GroupNode,
  type VerbNode,
} from "./commands.js";

// Held-key runtime protocol (sceneaxi#7; docs/held-key-enforcement.md).
export {
  HELD_KEY_SCHEMA_VERSION,
  computeSourceDigest,
  validateCommandMap,
  validateRegistrySnapshot,
  type CliCommandMap,
  type CommandMapEntry,
  type HeldKeyEntry,
  type HeldKeyRegistrySnapshot,
  type HeldKeyState,
  type Validation,
} from "./held-keys/registry.js";

export {
  FIRSTMATE_EXPORT_FORMAT,
  generateRegistrySnapshot,
  type FirstMateBacklogExport,
  type FirstMateHoldRecord,
  type GenerateSnapshotOptions,
} from "./held-keys/generate.js";

export {
  DEFAULT_FRESHNESS_BUDGET_MS,
  HELD_KEY_REFUSAL_REASONS,
  defaultHeldKeyRuntime,
  evaluateHeldKeyGate,
  staticEpochAuthority,
  unavailableEpochAuthority,
  type EpochAuthority,
  type EpochProbe,
  type GateAllow,
  type GateDecision,
  type GateRefusal,
  type HeldKeyRefusalReason,
  type HeldKeyRuntime,
} from "./held-keys/gate.js";

export { SHIPPED_COMMAND_MAP, SYNTHETIC_DEMO_KEYS } from "./held-keys/shipped.js";
