import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const BUILD = fileURLToPath(new URL("../bin/build-archive.mjs", import.meta.url));

it("runs a private extracted compiled archive outside the workspace with stock Node, no root scripts or workspace node_modules", () => {
  const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-cli-outsider-"));

  try {
    const out = join(cwd, "cli.tgz");
    const built = spawnSync(process.execPath, [BUILD, "--out", out], { cwd, encoding: "utf8", timeout: 30000 });
    expect(built.stderr).toBe(""); expect(built.status).toBe(0);
    const prepared = JSON.parse(built.stdout);
    expect(prepared).toMatchObject({ status: "prepared-private", publicationAuthorized: false });
    expect(prepared.packages.some((p: { name: string }) => p.name.includes("kids"))).toBe(false);
    expect(spawnSync("tar", ["-xzf", out, "-C", cwd]).status).toBe(0);
    const artifact = join(cwd, "sceneaxi-cli");
    expect(existsSync(join(artifact, "scripts"))).toBe(false);
    expect(existsSync(join(artifact, "src"))).toBe(false);
    expect(readdirSync(join(artifact, "node_modules"))).toEqual(["three"]);
    const bin = join(artifact, "bin/sceneaxi.mjs");

    const run = (...args: string[]) => {
      const r = spawnSync(process.execPath, [bin, ...args, "--json"], { cwd, encoding: "utf8", timeout: 10000, env: { PATH: process.env["PATH"] } });
      expect(r.stderr).toBe(""); expect(r.status).not.toBeNull();

      return { exit: r.status, envelope: JSON.parse(r.stdout) };
    };

    expect(run("--help").exit).toBe(0);
    expect(run("--version")).toMatchObject({ exit: 0, envelope: { result: { cliVersion: "0.0.0" } } });
    expect(run("project", "new", "--document", "scene.json").exit).toBe(0);
    expect(run("project", "test", "--document", "scene.json").exit).toBe(0);
    expect(run("project", "capture", "--document", "scene.json", "--out", "run.evidence.json").exit).toBe(0);
    expect(run("evidence", "verify", "--evidence", "run.evidence.json").exit).toBe(0);
    expect(run("project", "init", "--template", "workshop-bay", "--document", "workshop.json").exit).toBe(0);
    expect(run("constructor", "x")).toMatchObject({ exit: 2, envelope: { error: { code: "UNKNOWN_COMMAND" } } });
    expect(run("demo", "gated")).toMatchObject({ exit: 3, envelope: { error: { heldKeyReason: "currency-unavailable" } } });
    expect(readFileSync(join(artifact, "artifact.json"), "utf8")).toContain('"publicationAuthorized": false');
    expect(spawnSync(process.execPath, [BUILD, "--out", out], { encoding: "utf8" }).status).toBe(1);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
