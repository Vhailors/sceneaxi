/**
 * The web shell actually starts (sceneaxi#120).
 *
 * Every other web-shell test drives the app or the server in-process. This one
 * spawns the real binary and talks to it over a socket, so a broken `bin` entry,
 * a broken resolver, or a dev command that does not actually serve fails here
 * rather than shipping as an R2 "startable" claim.
 */
import { spawn, spawnSync, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";

const BIN = fileURLToPath(new URL("../bin/sceneaxi-web-shell.mjs", import.meta.url));
const BUILT_ENTRY = fileURLToPath(new URL("../dist/src/dev-server.js", import.meta.url));

/** The dev command's stdio shape: no stdin, piped stdout/stderr. */
type DevProcess = ChildProcessByStdio<null, Readable, Readable>;

type Started = {
  readonly child: DevProcess;
  readonly url: string;
};

describe("sceneaxi-web-shell binary", () => {
  let cwd: string;
  /**
   * The spawned process, tracked from the spawn itself rather than from a
   * successful start: this binary is a long-lived server, so a start that never
   * reports its banner would otherwise leave it running and hold the worker's
   * event loop open — turning one red assertion into a hung gate.
   */
  let spawned: DevProcess | null;

  beforeEach(() => {
    spawned = null;
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-web-shell-bin-"));
    const written = writeDocumentFile(
      join(cwd, "scene.json"),
      createDocument({ id: "scene", data: { entities: [{ id: "hero", x: 1 }] } }),
      { cwd },
    );
    expect(written.ok).toBe(true);
  });

  afterEach(async () => {
    if (spawned !== null) await stop(spawned);
    rmSync(cwd, { recursive: true, force: true });
  });

  /** Spawn the dev command on an ephemeral port and wait for its banner URL. */
  async function start(extra: readonly string[] = []): Promise<Started> {
    const child: DevProcess = spawn(
      process.execPath,
      [BIN, "--port", "0", "--cwd", cwd, ...extra],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        // The built fixture route must not need an admin bootstrap setting.
        env: {
          ...process.env,
          SCENEAXI_ADMIN_EMAIL: undefined,
          SCENEAXI_ADMIN_EMAILS: undefined,
          SCENEAXI_ADMINS: undefined,
        },
      },
    );
    spawned = child;

    const url = await new Promise<string>((resolveUrl, rejectUrl) => {
      let out = "";
      let err = "";
      const timer = setTimeout(
        () => rejectUrl(new Error(`dev command never reported a url.\n${out}\n${err}`)),
        30_000,
      );
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        out += chunk;
        const match = /url:\s+(http:\/\/\S+)/.exec(out);
        if (match?.[1] !== undefined) {
          clearTimeout(timer);
          resolveUrl(match[1]);
        }
      });
      child.stderr.on("data", (chunk: string) => (err += chunk));
      child.once("exit", (code) => {
        clearTimeout(timer);
        rejectUrl(new Error(`dev command exited early (${code}).\n${out}\n${err}`));
      });
    });

    return { child, url };
  }

  async function stop(child: DevProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((done) => {
      child.once("exit", () => done());
      child.kill("SIGTERM");
      setTimeout(() => {
        child.kill("SIGKILL");
        done();
      }, 10_000).unref();
    });
  }

  function run(args: readonly string[]) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
      cwd,
      encoding: "utf8",
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it("has build output to run (pnpm build ran before pnpm test in the gate)", () => {
    expect(existsSync(BUILT_ENTRY)).toBe(true);
  });

  it("starts and prints usage", () => {
    const r = run(["--help"]);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Usage: sceneaxi-web-shell");
    expect(r.stdout).toContain("POST /api/propose");
    expect(r.stdout).toContain("POST /api/assistant");
  });

  it("refuses a non-loopback bind with a usage exit rather than serving it", () => {
    const r = run(["--host", "0.0.0.0", "--port", "0"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("host-not-loopback");
    expect(r.stdout).toBe("");
  });

  it("refuses an unknown flag", () => {
    const r = run(["--frobnicate"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("argument-invalid");
  });

  it("serves the inspector page and its state on a real socket", async () => {
    const { url } = await start();

    const page = await fetch(url);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("SceneAxi inspector");
    expect(html).toContain(cwd);

    const state = await fetch(new URL("/api/state", url));
    expect(state.status).toBe(200);
    expect(((await state.json()) as { snapshot: { phase: string } }).snapshot.phase).toBe(
      "idle",
    );
  });

  it("drives the default fixture assistant turn against the started process", async () => {
    const { url } = await start();

    const response = await fetch(new URL("/api/assistant", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "How do I place a cube?" }),
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      app: string;
      ok: boolean;
      action: string;
      snapshot: {
        mode: string;
        metered: boolean;
        hostedEnabled: boolean;
        turns: Array<{
          prompt: string;
          text: string;
          metered: boolean;
          evidence: { kind: string; operation: string };
        }>;
        refusal?: unknown;
      };
    };
    expect(payload).toMatchObject({
      app: "sceneaxi-web-shell",
      ok: true,
      action: "assistant",
      snapshot: {
        mode: "fixture",
        metered: false,
        hostedEnabled: false,
        turns: [
          {
            prompt: "How do I place a cube?",
            text: "fixture completion",
            metered: false,
            evidence: {
              kind: "sceneaxi.model-provider-call-evidence",
              operation: "complete",
            },
          },
        ],
      },
    });
    expect(payload.snapshot.refusal).toBeUndefined();
  });

  it("drives propose → rendered diff → accept against the started process", async () => {
    const { url } = await start();
    const before = readFileSync(join(cwd, "scene.json"));

    const proposed = await fetch(new URL("/api/propose", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 21,
      }),
    });
    expect(proposed.status).toBe(200);
    const review = (await proposed.json()) as {
      reviewToken: string;
      snapshot: { phase: string; renderedDiff: string };
    };
    expect(review.snapshot.phase).toBe("reviewing");
    expect(review.snapshot.renderedDiff).toContain("SceneAxi inspector");
    // Reviewing is not writing.
    expect(readFileSync(join(cwd, "scene.json")).equals(before)).toBe(true);

    const accepted = await fetch(new URL("/api/accept", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewToken: review.reviewToken }),
    });
    expect(accepted.status).toBe(200);
    expect(
      ((await accepted.json()) as { snapshot: { phase: string } }).snapshot.phase,
    ).toBe("applied");
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toContain('"x": 21');
  });

  it("refuses an escaping document path from the served process", async () => {
    const { url } = await start();

    const response = await fetch(new URL("/api/propose", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentPath: "../escape.json",
        jsonPointer: "/data/x",
        newValue: 1,
      }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { reason: string }).reason).toBe(
      "document-outside-project-root",
    );
  });

  it("shuts down cleanly on SIGTERM", async () => {
    const { child } = await start();
    await stop(child);
    expect(child.signalCode === "SIGTERM" || child.exitCode === 0).toBe(true);
  });
});
