import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The `sceneaxi` binary actually starts (sceneaxi#115).
 *
 * Every other CLI test drives `runCli()` in-process. This one spawns the real
 * executable, so a broken `bin` entry, a broken resolver hook, or a missing
 * `main()` wiring fails here rather than shipping as a "runnable" claim.
 *
 * The binary runs the `tsc --build` output; `pnpm gate` builds before it tests,
 * so the artifacts exist by the time this runs.
 */
const BIN = fileURLToPath(new URL("../bin/sceneaxi.mjs", import.meta.url));
const BUILT_ENTRY = fileURLToPath(
  new URL("../dist/src/run.js", import.meta.url),
);

function sceneaxi(args: readonly string[], cwd: string) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function envelopeOf(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

describe("sceneaxi binary", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-bin-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("has build output to run (pnpm build ran before pnpm test in the gate)", () => {
    expect(existsSync(BUILT_ENTRY)).toBe(true);
  });

  it("starts and emits a versioned envelope on stdout", () => {
    const r = sceneaxi(["protocol", "version", "--json"], cwd);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);

    const envelope = envelopeOf(r.stdout);
    expect(envelope["ok"]).toBe(true);
    expect(envelope["schemaVersion"]).toBe(1);
    expect(envelope["result"]).toMatchObject({ releaseGroup: "cli-protocol" });
  });

  it("propagates the protocol exit-code map to the process exit code", () => {
    expect(sceneaxi(["--help"], cwd).status).toBe(0);
    // Unknown command path → USAGE (2), never 0. The gh-axi wart, at the
    // process boundary rather than only in-process.
    expect(sceneaxi(["definitely-not-a-group"], cwd).status).toBe(2);
    expect(sceneaxi(["project"], cwd).status).toBe(2);
    // Missing document → NOT_FOUND → ERROR (1).
    expect(
      sceneaxi(["project", "test", "--document", "absent.json"], cwd).status,
    ).toBe(1);
  });

  it("drives a real authoring round-trip from the command line", () => {
    const created = sceneaxi(
      ["project", "new", "--document", "scene.json", "--json"],
      cwd,
    );
    expect(created.status).toBe(0);

    const tested = sceneaxi(
      ["project", "test", "--document", "scene.json", "--json"],
      cwd,
    );
    expect(tested.status).toBe(0);
    expect(envelopeOf(tested.stdout)["result"]).toMatchObject({
      status: "passed",
      documentId: "scene",
    });

    const captured = sceneaxi(
      [
        "project",
        "capture",
        "--document",
        "scene.json",
        "--out",
        "run.evidence.json",
        "--json",
      ],
      cwd,
    );
    expect(captured.status).toBe(0);

    const listed = sceneaxi(["evidence", "list", "--dir", ".", "--json"], cwd);
    expect(listed.status).toBe(0);
    expect(envelopeOf(listed.stdout)["result"]).toMatchObject({
      packetCount: 1,
    });
  });

  it("resolves relative paths against the process working directory", () => {
    // No --cwd flag: the binary must honour where it was launched from.
    expect(
      sceneaxi(["project", "new", "--document", "here.json", "--json"], cwd)
        .status,
    ).toBe(0);
    expect(existsSync(join(cwd, "here.json"))).toBe(true);
  });
});
