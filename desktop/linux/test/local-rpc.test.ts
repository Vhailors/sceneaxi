import { connect } from "node:net";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  EDITOR_COMMAND_REGISTRY,
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
    if (!response.ok) return;
    expect((response.result as { commands: unknown }).commands).toEqual(
      EDITOR_COMMAND_REGISTRY,
    );
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
    if (!status.ok) return;
    const genericStatus = status.result as {
      data?: Readonly<Record<string, unknown>>;
      dataKeys?: readonly string[];
    };
    expect(genericStatus.data).not.toHaveProperty("composedScene");
    expect(genericStatus.dataKeys).not.toContain("composedScene");
  });

  it("requires a non-Kids hierarchy profile before local-agent project access", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-hierarchy-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const socketPath = join(root, "runtime", "desktop-v1.sock");
    const createAuthoringSession = vi.fn(() => {
      throw new Error("must not reach project authority");
    });
    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({
        cwd: projectRoot,
        commandCapabilities: ["scene.compose"],
        createAuthoringSession,
      }),
      projectRoot,
      socketPath,
      discoveryPath: join(root, "config", "desktop-bridge-v1.json"),
      capability: CAPABILITY,
    });
    servers.push(server);

    expect(await request(socketPath, {
      protocolVersion: 1,
      id: "hierarchy-missing-profile",
      capability: CAPABILITY,
      permission: "project:read",
      tool: "sceneaxi.scene.hierarchy.inspect",
      input: { documentPath: "scene.json" },
    } as DesktopLocalBridgeRequest)).toMatchObject({
      ok: false,
      error: { code: "LOCAL_BRIDGE_INPUT_INVALID" },
    });
    expect(await request(socketPath, {
      protocolVersion: 1,
      id: "hierarchy-kids-profile",
      capability: CAPABILITY,
      permission: "project:read",
      tool: "sceneaxi.scene.hierarchy.inspect",
      input: { documentPath: "scene.json", profile: "kids" },
    })).toMatchObject({
      ok: false,
      error: {
        code: "LOCAL_BRIDGE_UPSTREAM_REFUSED",
        detail: "SCENE_HIERARCHY_KIDS_DENIED",
      },
    });
    expect(createAuthoringSession).not.toHaveBeenCalled();
  });

  it("stages scene properties through the local-agent reviewing result", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-property-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const socketPath = join(root, "runtime", "desktop-v1.sock");
    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({
        cwd: projectRoot,
        commandCapabilities: ["scene.compose"],
      }),
      projectRoot,
      socketPath,
      discoveryPath: join(root, "config", "desktop-bridge-v1.json"),
      capability: CAPABILITY,
    });
    servers.push(server);

    const status = await request(socketPath, {
      protocolVersion: 1,
      id: "property-status",
      capability: CAPABILITY,
      permission: "project:read",
      tool: "sceneaxi.project.status",
      input: { documentPath: "scene.json" },
    });
    if (!status.ok) throw new Error("property fixture status refused");
    const contentHash = (status.result as { contentHash?: unknown }).contentHash;
    if (typeof contentHash !== "string") throw new Error("property fixture hash missing");

    expect(await request(socketPath, {
      protocolVersion: 1,
      id: "property-stage",
      capability: CAPABILITY,
      permission: "project:write",
      tool: "sceneaxi.scene.property.set",
      input: {
        documentPath: "scene.json",
        expectedContentHash: contentHash,
        profile: "game",
        instanceId: "desktop-crate-beside",
        propertyId: "translation-x",
        newValue: -3.25,
      },
    })).toMatchObject({
      ok: true,
      result: {
        phase: "reviewing",
        transaction: {
          commandId: "scene-property-set",
          status: "reviewing",
          evidence: { kind: "scene-hierarchy", target: "change-review" },
          refusal: null,
          undo: { kind: "none", commandId: null },
        },
      },
    });
  });

  it("abandons only the assistant job identified by its start response", async () => {
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

    const started = await request(socketPath, {
      protocolVersion: 1,
      id: "assistant-start",
      capability: CAPABILITY,
      permission: "assistant:run",
      tool: "sceneaxi.assistant.local.start",
      input: { prompt: "Build a blue crate", profile: "@sceneaxi/profile-game" },
    });
    expect(started).toMatchObject({
      ok: true,
      result: { jobId: "desktop-assistant-1" },
    });

    const untargeted = await request(socketPath, {
      protocolVersion: 1,
      id: "assistant-abandon-untargeted",
      capability: CAPABILITY,
      permission: "assistant:run",
      tool: "sceneaxi.assistant.abandon",
      input: {},
    });
    expect(untargeted).toMatchObject({
      ok: false,
      error: { code: "LOCAL_BRIDGE_INPUT_INVALID" },
    });

    const wrongJob = await request(socketPath, {
      protocolVersion: 1,
      id: "assistant-abandon-wrong-job",
      capability: CAPABILITY,
      permission: "assistant:run",
      tool: "sceneaxi.assistant.abandon",
      input: { jobId: "desktop-assistant-wrong" },
    });
    expect(wrongJob).toMatchObject({
      ok: false,
      error: {
        code: "LOCAL_BRIDGE_UPSTREAM_REFUSED",
        detail: "EDITOR_COMMAND_ACTIVE_JOB_MISMATCH",
      },
    });

    const abandoned = await request(socketPath, {
      protocolVersion: 1,
      id: "assistant-abandon-targeted",
      capability: CAPABILITY,
      permission: "assistant:run",
      tool: "sceneaxi.assistant.abandon",
      input: { jobId: "desktop-assistant-1" },
    });
    expect(abandoned).toMatchObject({
      ok: true,
      result: {
        jobId: "desktop-assistant-1",
        terminal: { progress: { percent: 100, terminal: true } },
      },
    });
  });

  it("returns the shared command-registry Kids denial before Local Build", async () => {
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

    expect(await request(socketPath, {
      protocolVersion: 1,
      id: "assistant-kids-denied",
      capability: CAPABILITY,
      permission: "assistant:run",
      tool: "sceneaxi.assistant.local.start",
      input: { prompt: "Build a toy", profile: "@sceneaxi/profile-kids" },
    })).toMatchObject({
      ok: false,
      error: {
        code: "LOCAL_BRIDGE_UPSTREAM_REFUSED",
        detail: "EDITOR_COMMAND_KIDS_DENIED",
      },
    });
  });

  it("treats unparsable descriptor bytes as stale on both start and close", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const socketPath = join(root, "runtime", "desktop-v1.sock");
    const discoveryPath = join(root, "config", "desktop-bridge-v1.json");
    mkdirSync(dirname(discoveryPath), { recursive: true, mode: 0o700 });
    writeFileSync(discoveryPath, "{ not json", { encoding: "utf8", mode: 0o600 });

    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath,
      discoveryPath,
      capability: CAPABILITY,
    });
    expect(
      parseDesktopLocalBridgeDiscovery(JSON.parse(readFileSync(discoveryPath, "utf8"))),
    ).not.toBeNull();

    writeFileSync(discoveryPath, "still not json", { encoding: "utf8", mode: 0o600 });
    await expect(server.close()).resolves.toBeUndefined();
    expect(existsSync(discoveryPath)).toBe(true);
    expect(existsSync(socketPath)).toBe(false);
  });

  it("reclaims a descriptor whose recorded endpoint no longer accepts, even when its pid is alive", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const socketPath = join(root, "runtime", "desktop-v1.sock");
    const discoveryPath = join(root, "config", "desktop-bridge-v1.json");
    mkdirSync(dirname(discoveryPath), { recursive: true, mode: 0o700 });
    writeFileSync(
      discoveryPath,
      `${JSON.stringify({
        protocolVersion: 1,
        kind: "sceneaxi.desktop-local-bridge-discovery",
        transport: "unix-ndjson",
        instanceId: "recycled-pid-owner",
        socketPath: join(root, "runtime", "never-bound.sock"),
        capability: "b".repeat(43),
        pid: process.pid,
        projectRoot,
        permissions: ["bridge:connect", "project:read"],
      })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    const server = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath,
      discoveryPath,
      capability: CAPABILITY,
    });
    servers.push(server);

    const discovery = parseDesktopLocalBridgeDiscovery(
      JSON.parse(readFileSync(discoveryPath, "utf8")),
    );
    expect(discovery?.instanceId).toBe(server.discovery.instanceId);
    expect(discovery?.capability).toBe(CAPABILITY);
  });

  it("still refuses a second host while the recorded endpoint is accepting", async () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-rpc-"));
    roots.push(root);
    const projectRoot = join(root, "project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const discoveryPath = join(root, "config", "desktop-bridge-v1.json");
    const first = await startDesktopLocalBridgeServer({
      bridge: createDesktopBridge({ cwd: projectRoot }),
      projectRoot,
      socketPath: join(root, "runtime", "desktop-v1.sock"),
      discoveryPath,
      capability: CAPABILITY,
    });
    servers.push(first);

    await expect(
      startDesktopLocalBridgeServer({
        bridge: createDesktopBridge({ cwd: projectRoot }),
        projectRoot,
        socketPath: join(root, "runtime", "desktop-v1-second.sock"),
        discoveryPath,
        capability: CAPABILITY,
      }),
    ).rejects.toThrow(/Another SceneAxi desktop local bridge is active/);

    expect(
      parseDesktopLocalBridgeDiscovery(JSON.parse(readFileSync(discoveryPath, "utf8")))
        ?.instanceId,
    ).toBe(first.discovery.instanceId);
  });

  it("survives a client that disconnects before the response is written", async () => {
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

    await new Promise<void>((resolveAbandon) => {
      const socket = connect(socketPath);
      socket.on("error", () => resolveAbandon());
      socket.on("connect", () => {
        socket.write(`${JSON.stringify({
          protocolVersion: 1,
          id: "abandoned",
          capability: CAPABILITY,
          permission: "project:read",
          tool: "sceneaxi.project.status",
          input: { documentPath: "scene.json" },
        })}\n`);
        socket.destroy();
        resolveAbandon();
      });
    });
    await new Promise((tick) => setTimeout(tick, 100));

    const survived = await request(socketPath, {
      protocolVersion: 1,
      id: "after-abandon",
      capability: CAPABILITY,
      permission: "project:read",
      tool: "sceneaxi.project.status",
      input: { documentPath: "scene.json" },
    });
    expect(survived).toMatchObject({
      ok: true,
      id: "after-abandon",
      result: { documentPath: "scene.json" },
    });
  });
});
