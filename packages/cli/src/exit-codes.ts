/**
 * Deterministic exit-code map for the SceneAxi CLI protocol.
 *
 * Within a major CLI version these codes and their meanings are stable.
 * Agents branch on the numeric code; the versioned envelope carries the
 * typed failure class (`error.code`) for finer discrimination.
 *
 * Normative source for this ticket: sceneaxi#6 / docs in packages/cli/README.md.
 */

/** Process exit codes — the agent-facing branch table. */
export const ExitCode = {
  /** Command completed successfully. */
  OK: 0,
  /** Operational / internal failure (not a usage mistake). */
  ERROR: 1,
  /**
   * Usage / validation failure: unknown command path at any nesting level,
   * unknown flag, ambiguous or incomplete input. Fail-closed — never exit 0.
   */
  USAGE: 2,
  /**
   * Held-key refusal (reserved for sceneaxi#7). Skeleton maps HELD_KEY
   * failures here so later wiring does not renumber the table.
   */
  HELD_KEY: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Typed failure classes carried in the envelope (`error.code`).
 * Each maps to exactly one exit code via {@link exitCodeForFailure}.
 */
export type FailureClass =
  | "UNKNOWN_COMMAND"
  | "UNKNOWN_FLAG"
  | "AMBIGUOUS_INPUT"
  | "NOT_IMPLEMENTED"
  | "INTERNAL"
  | "HELD_KEY";

/** Documented failure-class → exit-code map (golden-tested). */
export const FAILURE_EXIT_CODE: Readonly<Record<FailureClass, ExitCodeValue>> =
  Object.freeze({
    UNKNOWN_COMMAND: ExitCode.USAGE,
    UNKNOWN_FLAG: ExitCode.USAGE,
    AMBIGUOUS_INPUT: ExitCode.USAGE,
    NOT_IMPLEMENTED: ExitCode.ERROR,
    INTERNAL: ExitCode.ERROR,
    HELD_KEY: ExitCode.HELD_KEY,
  });

export function exitCodeForFailure(code: FailureClass): ExitCodeValue {
  return FAILURE_EXIT_CODE[code];
}

/** Human-readable exit-code table for docs and protocol inspect. */
export const EXIT_CODE_TABLE: ReadonlyArray<{
  readonly code: ExitCodeValue;
  readonly name: string;
  readonly meaning: string;
}> = Object.freeze([
  {
    code: ExitCode.OK,
    name: "OK",
    meaning: "Command completed successfully",
  },
  {
    code: ExitCode.ERROR,
    name: "ERROR",
    meaning: "Operational or internal failure",
  },
  {
    code: ExitCode.USAGE,
    name: "USAGE",
    meaning:
      "Unknown command path (any depth), unknown flag, or ambiguous/incomplete input",
  },
  {
    code: ExitCode.HELD_KEY,
    name: "HELD_KEY",
    meaning: "Refused by an open captain hold (held-key protocol; sceneaxi#7)",
  },
]);
