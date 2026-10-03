import type { JsonObject } from "@sceneaxi/schemas";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
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
    timeout: 10000,
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function envelopeOf(stdout: string): JsonObject {
  // SAFETY: stdout is the real binary's --json protocol envelope, a serialized JSON object.
  return JSON.parse(stdout) as JsonObject;
}

describe("sceneaxi binary", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-bin-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("refuses prototype paths and malformed version invocations through the binary", () => {
    for (const prefix of [[], ["project"], ["desktop"], ["desktop", "bridge"]]) {
      for (const name of ["constructor", "__proto__", "toString"]) {
        const result = sceneaxi([...prefix, name, "x", "--json"], cwd);
        expect(result.status).toBe(2);
        expect(result.stderr).toBe("");
        expect(envelopeOf(result.stdout)).toMatchObject({ schemaVersion: 1, ok: false, error: { code: "UNKNOWN_COMMAND" } });
      }
    }

    for (const args of [["--version", "--nonsense"], ["--version", "--document", "x"]]) {
      const result = sceneaxi([...args, "--json"], cwd);
      expect(result.status).toBe(2);
      expect(result.stderr).toBe("");
      expect(envelopeOf(result.stdout)).toMatchObject({ ok: false, error: { code: "UNKNOWN_FLAG" } });
    }
  });

  it("help/watch and malformed global switches naturally exit without watch ownership", () => {
    expect(sceneaxi(["project", "new", "--document", "scene.json"], cwd).status).toBe(0);

    for (const flag of ["--help", "-h", "--version", "--help=false", "--json=false"]) {
      const result = sceneaxi(["project", "dev", "--document", "scene.json", "--watch", flag, "--json"], cwd);
      expect(result.status).toBe(flag === "--help" || flag === "-h" ? 0 : 2);
      expect(result.stderr).toBe("");
      const envelope = envelopeOf(result.stdout);

      if (envelope["ok"]) {
        expect(envelope["result"]).not.toHaveProperty("mode");
        expect(envelope["result"]).not.toHaveProperty("cycle");
      }
    }
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

  it("watches canonical documents, streams versioned cycles, and stops on SIGINT", async () => {
    sceneaxi(["project", "new", "--document", "scene.json", "--json"], cwd);

    const child = spawn(process.execPath, [
      BIN,
      "project",
      "dev",
      "--document",
      "scene.json",
      "--watch",
      "--json",
    ], { cwd, stdio: ["ignore", "pipe", "pipe"] });

    const lines = createInterface({ input: child.stdout });
    const pending: string[] = [];
    const waiters: ((line: string) => void)[] = [];
    lines.on("line", (line) => {
      const waiter = waiters.shift();

      if (waiter) waiter(line);
      else pending.push(line);
    });

    const nextLine = () => {
      const line = pending.shift();

      if (line !== undefined) return Promise.resolve(line);

      return new Promise<string>((resolveLine, reject) => {
        const timer = setTimeout(() => reject(new Error("watch envelope timeout")), 5000);
        waiters.push((value) => {
          clearTimeout(timer);
          resolveLine(value);
        });
      });
    };

    try {
      const initial = envelopeOf(await nextLine());
      expect(initial).toMatchObject({ schemaVersion: 1, ok: true });
      expect(initial["result"]).toMatchObject({ mode: "watch", cycle: 1 });

      writeFileSync(join(cwd, "scene.json"), `${JSON.stringify({
        schemaVersion: 1,
        kind: "sceneaxi.document",
        id: "scene",
        data: { edited: true },
      }, null, 2)}\n`);
      const changed = envelopeOf(await nextLine());
      expect(changed["result"]).toMatchObject({ mode: "watch", cycle: 2, dataKeys: ["edited"] });

      child.kill("SIGINT");
      const stopped = envelopeOf(await nextLine());
      expect(stopped["result"]).toMatchObject({ status: "stopped", mode: "watch", cycle: 2 });
      expect(await new Promise<number | null>((resolveClose) => child.once("close", resolveClose))).toBe(0);
    } finally {
      child.kill("SIGKILL");
      lines.close();
    }
  });

  it("exits non-zero when a watch is stopped on a refused cycle", async () => {
    sceneaxi(["project", "new", "--document", "scene.json", "--json"], cwd);
    const child = spawn(process.execPath, [BIN, "project", "dev", "--document", "scene.json", "--watch", "--json"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const lines = createInterface({ input: child.stdout });
    const received: string[] = [];
    const waiters: (() => void)[] = [];
    lines.on("line", (line) => {
      received.push(line);
      waiters.shift()?.();
    });

    const lineCount = (count: number) => received.length >= count
      ? Promise.resolve()
      : new Promise<void>((resolveCount, reject) => {
        const timer = setTimeout(() => reject(new Error("watch envelope timeout")), 5000);

        const check = () => {
          if (received.length >= count) {
            clearTimeout(timer);
            resolveCount();
          } else waiters.push(check);
        };

        waiters.push(check);
      });

    try {
      await lineCount(1);
      expect(JSON.parse(received[0] ?? "")).toMatchObject({ ok: true });
      writeFileSync(join(cwd, "scene.json"), "{ not json");
      await lineCount(2);
      expect(JSON.parse(received[1] ?? "")).toMatchObject({ ok: false });
      child.kill("SIGINT");
      await lineCount(3);
      expect(JSON.parse(received[2] ?? "")["result"]).toMatchObject({ status: "stopped" });
      expect(await new Promise<number | null>((resolveClose) => child.once("close", resolveClose))).not.toBe(0);
    } finally {
      child.kill("SIGKILL");
      lines.close();
    }
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
