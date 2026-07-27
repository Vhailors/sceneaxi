/**
 * The dev command that starts the web shell (sceneaxi#120).
 *
 * Argument parsing is pure and asserted directly; the socket half is asserted
 * against a real loopback server on an ephemeral port, which is the cheapest
 * honest proof that "startable" is not just an exported function.
 */
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDocument,
  writeDocumentFile,
  type JsonObject,
} from "@sceneaxi/authoring-core";
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  LOOPBACK_HOSTS,
  USAGE_LINES,
  WEB_SHELL_REFUSALS,
  WebShellExit,
  parseDevServerArgs,
  serverUrl,
  startInspectorDevServer,
  startupLines,
  type InspectorDevServer,
} from "@sceneaxi/web-shell";

function fixtureDir(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "sceneaxi-web-shell-serve-")), "root");
  mkdirSync(dir);
  return dir;
}

function writeScene(dir: string, name: string, data: JsonObject): void {
  const result = writeDocumentFile(
    join(dir, name),
    createDocument({ id: name.replace(/\.json$/, ""), data }),
    { cwd: dir },
  );
  expect(result.ok).toBe(true);
}

const running: InspectorDevServer[] = [];

async function serve(projectRoot: string): Promise<InspectorDevServer> {
  const server = await startInspectorDevServer({
    host: DEFAULT_HOST,
    port: 0,
    projectRoot,
  });
  running.push(server);
  return server;
}

function rawRequest(
  server: InspectorDevServer,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
  },
): Promise<{ readonly status: number; readonly body: string }> {
  return new Promise((resolveResponse, rejectResponse) => {
    const outgoing = request(
      {
        hostname: server.host,
        port: server.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          resolveResponse({
            status: incoming.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    outgoing.on("error", rejectResponse);
    if (options.body !== undefined) outgoing.write(options.body);
    outgoing.end();
  });
}

afterEach(async () => {
  while (running.length > 0) await running.pop()?.close();
});

describe("dev command arguments", () => {
  it("defaults to loopback, the default port, and the current directory", () => {
    const parsed = parseDevServerArgs([]);
    expect(parsed.ok && parsed.mode).toBe("serve");
    if (!parsed.ok || parsed.mode !== "serve") return;
    expect(parsed.options.host).toBe(DEFAULT_HOST);
    expect(parsed.options.port).toBe(DEFAULT_PORT);
    expect(parsed.options.projectRoot.length).toBeGreaterThan(0);
  });

  it("accepts every loopback host, in both flag spellings", () => {
    for (const host of LOOPBACK_HOSTS) {
      for (const argv of [["--host", host], [`--host=${host}`]]) {
        const parsed = parseDevServerArgs(argv);
        expect(parsed.ok && parsed.mode === "serve" && parsed.options.host, host).toBe(
          host,
        );
      }
    }
  });

  it("refuses a non-loopback host instead of quietly rebinding it", () => {
    for (const host of ["0.0.0.0", "::", "192.168.1.20", "127.0.0.1.example.com"]) {
      const parsed = parseDevServerArgs(["--host", host]);
      expect(parsed.ok, host).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.reason).toBe(WEB_SHELL_REFUSALS.hostNotLoopback);
      expect(parsed.exitCode).toBe(WebShellExit.USAGE);
      expect(parsed.message).toContain("authenticates nobody");
    }
  });

  it("refuses unknown flags, bare arguments, and valueless flags", () => {
    for (const argv of [
      ["--frobnicate"],
      ["serve"],
      ["--port"],
      ["--cwd="],
      ["--port", "not-a-number"],
      ["--port", "70000"],
    ]) {
      const parsed = parseDevServerArgs(argv);
      expect(parsed.ok, argv.join(" ")).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.reason).toBe(WEB_SHELL_REFUSALS.argumentInvalid);
      expect(parsed.exitCode).toBe(WebShellExit.USAGE);
    }
  });

  it("refuses a project root that is absent or not a directory", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });

    const absent = parseDevServerArgs(["--cwd", join(dir, "nowhere")]);
    expect(absent.ok).toBe(false);
    if (!absent.ok) {
      expect(absent.reason).toBe(WEB_SHELL_REFUSALS.projectRootUnusable);
    }

    const file = parseDevServerArgs(["--cwd", join(dir, "scene.json")]);
    expect(file.ok).toBe(false);
    if (!file.ok) {
      expect(file.reason).toBe(WEB_SHELL_REFUSALS.projectRootUnusable);
    }
  });

  it("prints usage that names every served route", () => {
    const parsed = parseDevServerArgs(["--help"]);
    expect(parsed.ok && parsed.mode).toBe("help");
    const usage = USAGE_LINES.join("\n");
    expect(usage).toContain("sceneaxi-web-shell");
    expect(usage).toContain("POST /api/propose");
    expect(usage).toContain("loopback");
  });

  it("brackets an IPv6 host into a browsable URL", () => {
    expect(serverUrl("::1", 5180)).toBe("http://[::1]:5180/");
    expect(serverUrl("127.0.0.1", 5180)).toBe("http://127.0.0.1:5180/");
  });
});

describe("the started server serves the inspector", () => {
  it("binds loopback and reports the port it actually got", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);

    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://${DEFAULT_HOST}:${server.port}/`);
    expect(startupLines(server).join("\n")).toContain(server.url);

    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(await page.text()).toContain("SceneAxi inspector");
  });

  it("refuses a non-loopback host at the exported server boundary", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });

    await expect(
      startInspectorDevServer({
        host: "0.0.0.0",
        port: 0,
        projectRoot: dir,
      }),
    ).rejects.toThrow("serves loopback only");
  });

  it("drives propose → rendered diff → accept over the socket", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);
    const before = readFileSync(join(dir, "scene.json"));

    const proposed = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 12,
      }),
    });
    expect(proposed.status).toBe(200);
    const review = (await proposed.json()) as {
      reviewToken: string;
      snapshot: { phase: string; renderedDiff: string };
    };
    expect(review.snapshot.phase).toBe("reviewing");
    expect(review.snapshot.renderedDiff).toContain('"x": 12');
    expect(readFileSync(join(dir, "scene.json")).equals(before)).toBe(true);

    const accepted = await fetch(`${server.url}api/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewToken: review.reviewToken }),
    });
    expect(accepted.status).toBe(200);
    expect(
      ((await accepted.json()) as { snapshot: { phase: string } }).snapshot.phase,
    ).toBe("applied");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain('"x": 12');
  });

  it("rejects an unexpected Host before serving the inspector", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);

    const response = await rawRequest(server, {
      method: "GET",
      path: "/",
      headers: { host: "attacker.example" },
    });

    expect(response.status).toBe(403);
    expect((JSON.parse(response.body) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.requestHostInvalid,
    );
  });

  it("rejects a cross-origin accept without changing the pending proposal", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);
    const before = readFileSync(join(dir, "scene.json"));

    const proposed = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: new URL(server.url).origin,
      },
      body: JSON.stringify({
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 12,
      }),
    });
    expect(proposed.status).toBe(200);

    const refused = await fetch(`${server.url}api/accept`, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.requestOriginInvalid,
    );

    const state = await fetch(`${server.url}api/state`);
    expect(
      ((await state.json()) as { snapshot: { phase: string } }).snapshot.phase,
    ).toBe("reviewing");
    expect(readFileSync(join(dir, "scene.json")).equals(before)).toBe(true);
  });

  it("refuses an escaping document path over the socket too", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ x: 1 }] });
    writeScene(dirname(dir), "outside.json", { entities: [{ x: 1 }] });
    const server = await serve(dir);

    const response = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentPath: "../outside.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 2,
      }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.documentOutsideProjectRoot,
    );
  });

  it("stops reading an oversized body instead of buffering it", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ x: 1 }] });
    const server = await serve(dir);

    const response = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(256 * 1024),
    });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.requestBodyTooLarge,
    );
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain('"x": 1');
  });

  it("serves a HEAD request without a body", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });
    const server = await serve(dir);

    const response = await fetch(server.url, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
