/**
 * Versioned CLI protocol envelope.
 *
 * Output-schema changes are semver events for the cli-protocol release group.
 * `schemaVersion` is the envelope contract major; `cliVersion` is the package
 * version. Both appear on every success and every failure.
 */

import type { FailureClass } from "./exit-codes.js";
import { ExitCode, exitCodeForFailure, type ExitCodeValue } from "./exit-codes.js";
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
  } = {},
): CliOutcome {
  const path = Object.freeze([...(options.path ?? [])]);
  const help = Object.freeze([
    ...(options.help ?? defaultHelpForFailure(code, path)),
  ]);
  const error: CliErrorBody =
    options.heldKey === undefined
      ? { code, message, path }
      : { code, message, path, heldKey: options.heldKey };

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
    case "INTERNAL":
    default:
      return ["Run `sceneaxi protocol inspect` for protocol diagnostics"];
  }
}
