import { connect } from "node:net";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  parseDesktopLocalBridgeDiscovery,
  type DesktopLocalBridgeRequest,
  type DesktopLocalBridgeResponse,
} from "@sceneaxi/schemas";
import {
  createDesktopBridge,
  seedDesktopProject,
  startDesktopLocalBridgeServer,
  type DesktopLocalBridgeServer,
} from "../src/index.js";

const CAPABILITY = "a".repeat(43);

function request(
  socketPath: string,
  body: DesktopLocalBridgeRequest,
): Promise<DesktopLocalBridgeResponse> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let response = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.end(`${JSON.stringify(body)}\n`));
    socket.on("data", (chunk: string) => {
      response += chunk;
    });
    socket.on("end", () => {
      try {
        resolve(JSON.parse(response) as DesktopLocalBridgeResponse);
      } catch (error) {
        reject(error);
      }
    });
    socket.on("error", reject);
  });
}

describe("desktop same-user local RPC bridge", () => {
  const roots: string[] = [];
  const servers: DesktopLocalBridgeServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("publishes a 0600 discovery capability and serves a permission-bound handshake", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const socketPath = join(root, "runtime", "desktop-v1.sock");
    const discoveryPath = join(root, "config", "desktop-bridge-v1.json");
    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath,
      discoveryPath,
      capability: CAPABILITY,
    });
    servers.push(server);

    expect(statSync(socketPath).mode & 0o777).toBe(0o600);
    expect(statSync(discoveryPath).mode & 0o777).toBe(0o600);
    const discovery = parseDesktopLocalBridgeDiscovery(
      JSON.parse(readFileSync(discoveryPath, "utf8")),
    );
    expect(discovery).not.toBeNull();
    expect(discovery?.capability).toBe(CAPABILITY);

    const response = await request(socketPath, {
      protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
      id: "handshake-1",
      capability: CAPABILITY,
      permission: "bridge:connect",
      tool: "sceneaxi.bridge.handshake",
      input: {},
    });
    expect(response).toMatchObject({
      protocolVersion: 1,
      id: "handshake-1",
      ok: true,
      result: {
        app: "@sceneaxi/desktop-linux",
        bridgeVersion: 1,
        localProtocolVersion: 1,
        transport: "unix-ndjson",
        creditRoute: "none",
      },
    });
  });

  it("refuses invalid capabilities and permissions before sharing the desktop authoring session", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const socketPath = join(root, "runtime", "desktop-v1.sock");
    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath,
      discoveryPath: join(root, "config", "desktop-bridge-v1.json"),
      capability: CAPABILITY,
    });
    servers.push(server);

    const rejectedCapability = await request(socketPath, {
      protocolVersion: 1,
      id: "status-bad-capability",
      capability: "b".repeat(43),
      permission: "project:read",
      tool: "sceneaxi.project.status",
      input: { documentPath: "scene.json" },
    });
    expect(rejectedCapability).toMatchObject({
      ok: false,
      error: { code: "LOCAL_BRIDGE_AUTHENTICATION_FAILED", detail: null },
    });
    expect(JSON.stringify(rejectedCapability)).not.toContain(CAPABILITY);

    const rejectedPermission = await request(socketPath, {
      protocolVersion: 1,
      id: "status-wrong-permission",
      capability: CAPABILITY,
      permission: "project:write",
      tool: "sceneaxi.project.status",
      input: { documentPath: "scene.json" },
    });
    expect(rejectedPermission).toMatchObject({
      ok: false,
      error: { code: "LOCAL_BRIDGE_PERMISSION_DENIED" },
    });

    const rejectedInput = await request(socketPath, {
      protocolVersion: 1,
      id: "status-extra-input",
      capability: CAPABILITY,
      permission: "project:read",
      tool: "sceneaxi.project.status",
      input: { documentPath: "scene.json", credential: "forbidden" },
    } as DesktopLocalBridgeRequest);
    expect(rejectedInput).toMatchObject({
      ok: false,
      error: { code: "LOCAL_BRIDGE_INPUT_INVALID" },
    });

    const status = await request(socketPath, {
      protocolVersion: 1,
      id: "status-ok",
      capability: CAPABILITY,
      permission: "project:read",
      tool: "sceneaxi.project.status",
      input: { documentPath: "scene.json" },
    });
    expect(status).toMatchObject({
      ok: true,
      result: { documentPath: "scene.json" },
    });
  });
});
