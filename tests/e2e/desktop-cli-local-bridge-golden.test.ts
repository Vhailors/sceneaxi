import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDesktopBridge,
  seedDesktopProject,
  startDesktopLocalBridgeServer,
  type DesktopLocalBridgeServer,
} from "../../desktop/linux/src/index.ts";

const BIN = fileURLToPath(
  new URL("../../packages/cli/bin/sceneaxi.mjs", import.meta.url),
);
const WORKER = fileURLToPath(
  new URL("../../packages/cli/dist/src/desktop-socket-worker.js", import.meta.url),
);

function sceneaxi(args: readonly string[], cwd: string): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

describe("CLI → local desktop bridge golden path", () => {
  const roots: string[] = [];
  const servers: DesktopLocalBridgeServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("discovers the desktop and shares its real propose/apply authoring session", async () => {
    expect(existsSync(WORKER)).toBe(true);
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-cli-desktop-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const discoveryPath = join(root, "config", "desktop-bridge-v1.json");
    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath: join(root, "runtime", "desktop-v1.sock"),
      discoveryPath,
    });
    servers.push(server);

    const common = ["--descriptor", discoveryPath, "--json"];
    const status = await sceneaxi(
      ["desktop", "bridge", "status", ...common],
      projectRoot,
    );
    expect(status).toMatchObject({ status: 0, stderr: "" });
    expect(status.stdout).not.toContain(server.discovery.capability);
    expect(JSON.parse(status.stdout)).toMatchObject({
      ok: true,
      result: {
        connected: true,
        response: {
          app: "@sceneaxi/desktop-linux",
          localProtocolVersion: 1,
          creditRoute: "none",
        },
      },
    });

    const documentPath = join(projectRoot, "scene.json");
    const before = readFileSync(documentPath, "utf8");
    const proposed = await sceneaxi(
      [
        "desktop",
        "bridge",
        "call",
        "--tool",
        "sceneaxi.project.propose",
        "--allow",
        "project:write",
        "--input-json",
        JSON.stringify({
          documentPath: "scene.json",
          jsonPointer: "/data/entities/0/x",
          newValue: 7,
        }),
        ...common,
      ],
      projectRoot,
    );
    expect(proposed.status).toBe(0);
    expect(readFileSync(documentPath, "utf8")).toBe(before);

    const accepted = await sceneaxi(
      [
        "desktop",
        "bridge",
        "call",
        "--tool",
        "sceneaxi.project.accept",
        "--allow",
        "project:write",
        ...common,
      ],
      projectRoot,
    );
    expect(accepted.status).toBe(0);
    expect(readFileSync(documentPath, "utf8")).not.toBe(before);
  });

  it("keeps local authoring unmetered and refuses absent BYOK or hosted routes by name", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-cli-desktop-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const discoveryPath = join(root, "config", "desktop-bridge-v1.json");
    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath: join(root, "runtime", "desktop-v1.sock"),
      discoveryPath,
    });
    servers.push(server);
    const common = ["--descriptor", discoveryPath, "--json"];

    const local = await sceneaxi(
      [
        "desktop",
        "bridge",
        "call",
        "--tool",
        "sceneaxi.assistant.local.start",
        "--allow",
        "assistant:run",
        "--input-json",
        JSON.stringify({ prompt: "Build a blue crate", profile: "@sceneaxi/profile-game" }),
        ...common,
      ],
      projectRoot,
    );
    expect(local.status).toBe(0);
    expect(JSON.parse(local.stdout)).toMatchObject({
      ok: true,
      result: { response: { route: "local" } },
    });

    const byo = await sceneaxi(
      [
        "desktop",
        "bridge",
        "call",
        "--tool",
        "sceneaxi.assistant.byo.start",
        "--allow",
        "assistant:run",
        "--input-json",
        JSON.stringify({ prompt: "Build a blue crate", profile: "@sceneaxi/profile-game" }),
        ...common,
      ],
      projectRoot,
    );
    expect(byo.status).toBe(1);
    expect(JSON.parse(byo.stdout)).toMatchObject({
      ok: false,
      error: {
        code: "BRIDGE_REFUSED",
        details: { bridgeDetail: "DESKTOP_ASSISTANT_BYO_UNAVAILABLE" },
      },
    });

    const hosted = await sceneaxi(
      [
        "desktop",
        "bridge",
        "call",
        "--tool",
        "sceneaxi.assistant.hosted.start",
        "--allow",
        "assistant:run",
        ...common,
      ],
      projectRoot,
    );
    expect(hosted.status).toBe(2);
    expect(JSON.parse(hosted.stdout)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
  });
});
