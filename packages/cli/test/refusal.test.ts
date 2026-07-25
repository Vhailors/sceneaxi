import { describe, expect, it } from "vitest";
import { ExitCode, runCli } from "@sceneaxi/cli";

describe("fail-closed validation (unknown flags / ambiguous input)", () => {
  it("refuses unknown long flags", () => {
    const r = runCli(["--force"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    expect(r.envelope.ok).toBe(false);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_FLAG");
      expect(r.envelope.error.message).toMatch(/--force/);
    }
  });

  it("refuses unknown short flags", () => {
    const r = runCli(["-x"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_FLAG");
    }
  });

  it("refuses unknown flags after a valid path", () => {
    const r = runCli(["project", "new", "--mutate-anyway"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_FLAG");
    }
  });

  it("refuses unknown flags with =value form", () => {
    const r = runCli(["--output=file.json"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_FLAG");
    }
  });

  it("refuses incomplete group as ambiguous input", () => {
    for (const group of ["project", "asset", "profile", "catalog", "evidence", "demo"]) {
      const r = runCli([group]);
      expect(r.exitCode, group).toBe(ExitCode.USAGE);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code, group).toBe("AMBIGUOUS_INPUT");
        expect(r.envelope.error.path).toEqual([group]);
      }
    }
  });

  it("refuses --version combined with a command path", () => {
    const r = runCli(["project", "new", "--version"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("AMBIGUOUS_INPUT");
    }
  });

  it.each(["--json=false", "--help=false", "--version=false"])(
    "refuses valued global boolean switch %s",
    (flag) => {
      const r = runCli([flag]);
      expect(r.exitCode).toBe(ExitCode.USAGE);
      expect(r.format).toBe("text");
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("AMBIGUOUS_INPUT");
        expect(r.envelope.error.message).toContain(
          flag.slice(0, flag.indexOf("=")),
        );
      }
    },
  );

  it("does not best-effort accept partial unknown paths", () => {
    // `profile list` is valid; adding junk must not run the verb.
    const good = runCli(["profile", "list"]);
    const bad = runCli(["profile", "list", "junk"]);
    expect(good.exitCode).toBe(ExitCode.OK);
    expect(bad.exitCode).toBe(ExitCode.USAGE);
    expect(bad.envelope.ok).toBe(false);
  });
});
