import { describe, expect, it } from "vitest";
import {
  ExitCode,
  EXIT_CODE_TABLE,
  FAILURE_EXIT_CODE,
  exitCodeForFailure,
  runCli,
  type FailureClass,
} from "@sceneaxi/cli";

/**
 * Golden table: every failure class maps to a stable exit code.
 * Agents branch on these numbers — renumbering is a semver-major event.
 */
const GOLDEN_FAILURE_EXIT: Record<FailureClass, number> = {
  UNKNOWN_COMMAND: 2,
  UNKNOWN_FLAG: 2,
  AMBIGUOUS_INPUT: 2,
  NOT_IMPLEMENTED: 1,
  INTERNAL: 1,
  HELD_KEY: 3,
};

describe("deterministic exit-code map", () => {
  it("matches the golden failure-class table", () => {
    for (const [cls, code] of Object.entries(GOLDEN_FAILURE_EXIT) as Array<
      [FailureClass, number]
    >) {
      expect(exitCodeForFailure(cls)).toBe(code);
      expect(FAILURE_EXIT_CODE[cls]).toBe(code);
    }
  });

  it("documents OK/ERROR/USAGE/HELD_KEY exactly once each", () => {
    const codes = EXIT_CODE_TABLE.map((r) => r.code);
    expect(codes).toEqual([
      ExitCode.OK,
      ExitCode.ERROR,
      ExitCode.USAGE,
      ExitCode.HELD_KEY,
    ]);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("exit codes at every nesting level (anti gh-axi wart)", () => {
  it("unknown top-level command → USAGE (2), never 0", () => {
    const r = runCli(["totally-unknown"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    expect(r.exitCode).not.toBe(0);
    expect(r.envelope.ok).toBe(false);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_COMMAND");
    }
  });

  it("unknown subcommand under a known group → USAGE (2), never 0", () => {
    const r = runCli(["project", "bogus-verb"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    expect(r.exitCode).not.toBe(0);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_COMMAND");
      expect(r.envelope.error.path).toEqual(["project", "bogus-verb"]);
    }
  });

  it("unknown sub-subcommand under a leaf verb → USAGE (2), never 0", () => {
    // The gh-axi wart: issue <unknown> exited 0. We must not.
    const r = runCli(["project", "new", "extra-depth"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    expect(r.exitCode).not.toBe(0);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_COMMAND");
      expect(r.envelope.error.path).toEqual([
        "project",
        "new",
        "extra-depth",
      ]);
    }
  });

  it("unknown under every command group is non-zero", () => {
    for (const group of [
      "project",
      "asset",
      "profile",
      "catalog",
      "evidence",
      "protocol",
    ]) {
      const r = runCli([group, "no-such-verb"]);
      expect(r.exitCode, group).toBe(ExitCode.USAGE);
      expect(r.envelope.ok, group).toBe(false);
    }
  });

  it("incomplete group path (no verb) → USAGE, never 0", () => {
    const r = runCli(["project"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("AMBIGUOUS_INPUT");
    }
  });

  it("registered skeleton verbs exit 0", () => {
    for (const path of [
      ["project", "new"],
      ["project", "dev"],
      ["project", "test"],
      ["project", "capture"],
      ["project", "report"],
      ["asset", "list"],
      ["profile", "list"],
      ["catalog", "list"],
      ["evidence", "list"],
      ["protocol", "version"],
      ["protocol", "inspect"],
    ]) {
      const r = runCli(path);
      expect(r.exitCode, path.join(" ")).toBe(ExitCode.OK);
      expect(r.envelope.ok, path.join(" ")).toBe(true);
    }
  });

  it("top-level --help and bare invocation exit 0", () => {
    expect(runCli([]).exitCode).toBe(ExitCode.OK);
    expect(runCli(["--help"]).exitCode).toBe(ExitCode.OK);
    expect(runCli(["--version"]).exitCode).toBe(ExitCode.OK);
  });
});
