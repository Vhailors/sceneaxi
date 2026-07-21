/**
 * Public CLI runner: dispatch + format. Process I/O is optional so golden
 * tests can assert on outcomes without spawning a subprocess.
 */

import { dispatch } from "./dispatcher.js";
import type { CliOutcome } from "./envelope.js";
import { formatOutcome, type OutputFormat } from "./format.js";

export interface RunCliResult {
  readonly exitCode: number;
  readonly envelope: CliOutcome["envelope"];
  readonly format: OutputFormat;
  readonly stdout: string;
}

/** Run the umbrella CLI against argv (no binary name). Pure of process.exit. */
export function runCli(argv: readonly string[] = []): RunCliResult {
  const { outcome, format } = dispatch(argv);
  return {
    exitCode: outcome.exitCode,
    envelope: outcome.envelope,
    format,
    stdout: formatOutcome(outcome, format),
  };
}

/**
 * Process entry: write stdout and set `process.exitCode` (does not call
 * `process.exit`, so embedders and tests can observe the code).
 */
export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const result = runCli(argv);
  process.stdout.write(result.stdout);
  process.exitCode = result.exitCode;
  return result.exitCode;
}
