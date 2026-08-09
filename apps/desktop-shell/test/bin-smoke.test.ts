import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";

/**
 * The desktop shell actually starts (sceneaxi#116).
 *
 * Every other desktop test drives `runDesktopShell()` in-process. This one
 * spawns the real binary, so a broken `bin` entry or resolver fails here rather
 * than shipping as a "startable" claim.
 */
const BIN = fileURLToPath(
  new URL("../bin/sceneaxi-desktop.mjs", import.meta.url),
);
const BUILT_ENTRY = fileURLToPath(
  new URL("../dist/src/app.js", import.meta.url),
);

function desktop(
  args: readonly string[],
  cwd: string,
  nodeArgs: readonly string[] = [],
) {
  const result = spawnSync(process.execPath, [...nodeArgs, BIN, ...args], {
    cwd,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("sceneaxi-desktop binary", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-bin-"));
    const written = writeDocumentFile(
      join(cwd, "scene.json"),
      createDocument({ id: "scene", data: { entities: [{ x: 1 }] } }),
      { cwd },
    );
    expect(written.ok).toBe(true);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("has build output to run (pnpm build ran before pnpm test in the gate)", () => {
    expect(existsSync(BUILT_ENTRY)).toBe(true);
  });

  it("starts and prints usage", () => {
    const r = desktop(["--help"], cwd);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("sceneaxi-desktop <command>");
  });

  // CI pins a Node that strips TypeScript by default, which would resolve a
  // source-backed `.ts` export target and hide a resolver that cannot map it.
  // `engines.node` also admits runtimes without type stripping, where that is a
  // hard ERR_UNKNOWN_FILE_EXTENSION at module load for *every* command — so the
  // binary is started once with stripping off, which is the same resolution the
  // lower half of the supported range performs.
  it("starts on a runtime that does not strip types", () => {
    const r = desktop(["--help"], cwd, ["--no-experimental-strip-types"]);
    expect(r.stderr).not.toContain("ERR_UNKNOWN_FILE_EXTENSION");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("sceneaxi-desktop <command>");
  });

  it("renders the chrome without type stripping, embedded functions intact", () => {
    const r = desktop(["chrome"], cwd, ["--no-experimental-strip-types"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("data-run-rarity-evidence");
    expect(r.stdout).toContain("data-change-rarity-evidence");
  });

  it("propagates exit codes: 2 for usage, 1 for refusal, 0 for success", () => {
    expect(desktop(["frobnicate"], cwd).status).toBe(2);
    expect(desktop(["status"], cwd).status).toBe(2);
    expect(desktop(["status", "--document", "absent.json"], cwd).status).toBe(1);
    expect(desktop(["status", "--document", "scene.json"], cwd).status).toBe(0);
  });

  it("drives a real propose → apply → undo round-trip from the command line", () => {
    const before = readFileSync(join(cwd, "scene.json"), "utf8");

    const applied = desktop(
      [
        "apply",
        "--document",
        "scene.json",
        "--pointer",
        "/data/entities/0/x",
        "--value",
        "9",
        "--json",
      ],
      cwd,
    );
    expect(applied.status).toBe(0);
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toContain('"x": 9');

    const undone = desktop(["undo", "--json"], cwd);
    expect(undone.status).toBe(0);
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
  });

  it("renders the editor chrome to stdout as a complete document", () => {
    // The evidence artifact is produced by the real binary, not by an
    // in-process helper, so `sceneaxi-desktop chrome > shell.html` is proven
    // rather than assumed.
    const r = desktop(["chrome", "--mode", "compose"], cwd);
    expect(r.status).toBe(0);
    expect(r.stdout.startsWith("<!doctype html>")).toBe(true);
    expect(r.stdout.trimEnd().endsWith("</html>")).toBe(true);
    expect(r.stdout).toContain('data-mode="compose"');
    expect(r.stdout).toContain('content="false"');
    expect(r.stderr).toBe("");
  });

  it("refuses an unknown chrome state with a usage exit and no document", () => {
    const r = desktop(["chrome", "--profile", "grown-ups"], cwd);
    expect(r.status).toBe(2);
    expect(r.stdout).not.toContain("<!doctype html>");
    expect(r.stdout).toContain("--profile must be one of");
  });

  it("resolves relative paths against the process working directory", () => {
    // No --cwd flag: the shell must honour where it was launched from.
    const r = desktop(["status", "--document", "scene.json", "--json"], cwd);
    expect(r.status).toBe(0);
    expect(
      (JSON.parse(r.stdout) as { result: { documentId: string } }).result
        .documentId,
    ).toBe("scene");
  });
});
