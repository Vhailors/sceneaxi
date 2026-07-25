/**
 * Versioned CLI protocol envelope.
 *
 * Output-schema changes are semver events for the cli-protocol release group.
 * `schemaVersion` is the envelope contract major; `cliVersion` is the package
 * version. Both appear on every success and every failure.
 */

import type { ApplyDiagnostic } from "@sceneaxi/authoring-core";
import type { FailureClass } from "./exit-codes.js";
import { ExitCode, exitCodeForFailure, type ExitCodeValue } from "./exit-codes.js";
import type { HeldKeyRefusalReason } from "./held-keys/gate.js";
import { CLI_VERSION, PROTOCOL_SCHEMA_VERSION } from "./version.js";

/** Machine payload for a successful command. */
export type ResultPayload = Readonly<Record<string, unknown>>;

export interface CliErrorBody {
  readonly code: FailureClass;
  readonly message: string;
  /** Attempted command path segments (empty for top-level flag errors). */
  readonly path: readonly string[];
  /** Present when code is HELD_KEY (sceneaxi#7); omitted otherwise. */
  readonly heldKey?: string;
  /** Refusal-table row when code is HELD_KEY (docs/held-key-enforcement.md). */
  readonly heldKeyReason?: HeldKeyRefusalReason;
  /** Typed diagnostics from propose/apply rejections (sceneaxi#9). */
  readonly diagnostics?: readonly ApplyDiagnostic[];
  /** Command-specific state retained when a typed refusal has partial results. */
  readonly details?: ResultPayload;
}

interface EnvelopeBase {
  readonly schemaVersion: typeof PROTOCOL_SCHEMA_VERSION;
  readonly cliVersion: string;
  readonly ok: boolean;
  /** Next-action affordances — required on every result. */
  readonly help: readonly string[];
}

export interface CliSuccessEnvelope extends EnvelopeBase {
  readonly ok: true;
  readonly result: ResultPayload;
}

export interface CliErrorEnvelope extends EnvelopeBase {
  readonly ok: false;
  readonly error: CliErrorBody;
}

export type CliEnvelope = CliSuccessEnvelope | CliErrorEnvelope;

/** Full dispatcher outcome: envelope + deterministic exit code. */
export interface CliOutcome {
  readonly exitCode: ExitCodeValue;
  readonly envelope: CliEnvelope;
}

export function success(
  result: ResultPayload,
  help: readonly string[],
): CliOutcome {
  return {
    exitCode: ExitCode.OK,
    envelope: {
      schemaVersion: PROTOCOL_SCHEMA_VERSION,
      cliVersion: CLI_VERSION,
      ok: true,
      result,
      help: Object.freeze([...help]),
    },
  };
}

export function failure(
  code: FailureClass,
  message: string,
  options: {
    readonly path?: readonly string[];
    readonly help?: readonly string[];
    readonly heldKey?: string;
    readonly heldKeyReason?: HeldKeyRefusalReason;
    readonly diagnostics?: readonly ApplyDiagnostic[];
    readonly details?: ResultPayload;
  } = {},
): CliOutcome {
  const path = Object.freeze([...(options.path ?? [])]);
  const help = Object.freeze([
    ...(options.help ?? defaultHelpForFailure(code, path)),
  ]);

  let error: CliErrorBody = { code, message, path };
  if (options.heldKey !== undefined) {
    error = { ...error, heldKey: options.heldKey };
  }
  if (options.heldKeyReason !== undefined) {
    error = { ...error, heldKeyReason: options.heldKeyReason };
  }
  if (options.diagnostics !== undefined) {
    error = {
      ...error,
      diagnostics: Object.freeze([...options.diagnostics]),
    };
  }
  if (options.details !== undefined) {
    error = { ...error, details: Object.freeze({ ...options.details }) };
  }

  return {
    exitCode: exitCodeForFailure(code),
    envelope: {
      schemaVersion: PROTOCOL_SCHEMA_VERSION,
      cliVersion: CLI_VERSION,
      ok: false,
      error,
      help,
    },
  };
}

function defaultHelpForFailure(
  code: FailureClass,
  path: readonly string[],
): string[] {
  const joined = path.length > 0 ? path.join(" ") : "";
  switch (code) {
    case "UNKNOWN_COMMAND":
      return [
        joined
          ? `Run \`sceneaxi ${path[0]} --help\` for known verbs under '${path[0]}'`
          : "Run `sceneaxi --help` to see available command groups",
        "Run `sceneaxi protocol inspect` for the protocol envelope and exit-code map",
      ];
    case "UNKNOWN_FLAG":
      return [
        "Only known flags are accepted; unknown flags refuse (fail-closed)",
        "Global flags: --json, --help, -h, -v, -V, --version",
      ];
    case "AMBIGUOUS_INPUT":
      return [
        joined
          ? `Run \`sceneaxi ${joined} --help\` for usage at this path`
          : "Run `sceneaxi --help` for usage",
      ];
    case "HELD_KEY":
      return [
        "This verb is gated by an open captain hold; resolve the named key before retrying",
        "See docs/held-key-enforcement.md",
      ];
    case "NOT_IMPLEMENTED":
      return [
        "This verb path is registered but has no body yet; later tickets plug real work in",
      ];
    case "CONFLICT":
      return [
        "Re-read the document and re-propose against current content",
        "Content-hash conflicts refuse the whole proposal (all-or-nothing)",
      ];
    case "VALIDATION":
      return [
        joined
          ? `Run \`sceneaxi ${joined} --help\` for usage`
          : "Run `sceneaxi --help` for usage",
        "Schema major mismatches and invalid pointers refuse (fail-closed)",
      ];
    case "NOT_FOUND":
      return [
        "Check document/proposal paths relative to --cwd (default: process cwd)",
      ];
    case "INTERNAL":
    default:
      return ["Run `sceneaxi protocol inspect` for protocol diagnostics"];
  }
}
