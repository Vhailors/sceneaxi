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

export { dispatch, parseArgv } from "./dispatcher.js";

export { runCli, main, type RunCliResult } from "./run.js";

export {
  ROOT_COMMANDS,
  ROOT_GROUP_NAMES,
  topLevelHelpPayload,
} from "./commands.js";
