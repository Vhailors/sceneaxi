/**
 * Same-user Unix-socket adapter for the transport-free desktop bridge.
 *
 * This module owns transport, discovery, authentication, and the external
 * permission allow-list. It deliberately exposes only the shared agent-tool
 * registry: renderer-only scene/frame actions never cross this socket.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND,
  DESKTOP_LOCAL_BRIDGE_ERROR_CODES,
  DESKTOP_LOCAL_BRIDGE_PERMISSIONS,
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  DESKTOP_LOCAL_BRIDGE_TRANSPORT,
  createEditorCommandInvocation,
  desktopLocalBridgeTool,
  isDesktopLocalBridgePermission,
  parseDesktopLocalBridgeDiscovery,
  validateDesktopLocalBridgeToolInput,
  type DesktopLocalBridgeDiscovery,
  type DesktopLocalBridgeErrorCode,
  type DesktopLocalBridgeFailure,
  type DesktopLocalBridgePermission,
  type DesktopLocalBridgeRequest,
  type DesktopLocalBridgeResponse,
  type DesktopLocalBridgeToolName,
  type EditorCommandTransactionResult,
  type JsonObject,
} from "@sceneaxi/schemas";
import type { DesktopBridgeResponse } from "./bridge-contract.js";
import type { DesktopBridge } from "./bridge.js";

const MAX_REQUEST_BYTES = 1024 * 1024;
const SOCKET_IDLE_TIMEOUT_MS = 5_000;
const ENDPOINT_PROBE_TIMEOUT_MS = 1_000;

export type DesktopLocalBridgePaths = Readonly<{
  socketPath: string;
  discoveryPath: string;
}>;

export type DesktopLocalBridgePathOptions = Readonly<{
  homeDir?: string;
  runtimeDir?: string;
  configDir?: string;
  uid?: number;
}>;

export function resolveDesktopLocalBridgePaths(
  options: DesktopLocalBridgePathOptions = {},
): DesktopLocalBridgePaths {
  const home = options.homeDir ?? homedir();
  const uid = options.uid ?? process.getuid?.() ?? 0;
  const runtimeBase =
    options.runtimeDir !== undefined && isAbsolute(options.runtimeDir)
      ? options.runtimeDir
      : join(tmpdir(), `sceneaxi-${String(uid)}`);
  const configBase =
    options.configDir !== undefined && isAbsolute(options.configDir)
      ? options.configDir
      : join(home, ".config");
  return Object.freeze({
    socketPath: join(runtimeBase, "sceneaxi", "desktop-v1.sock"),
    discoveryPath: join(configBase, "sceneaxi", "desktop-bridge-v1.json"),
  });
}

export type StartDesktopLocalBridgeServerOptions = Readonly<{
  bridge: Pick<DesktopBridge, "handle">;
  projectRoot: string;
  socketPath?: string;
  discoveryPath?: string;
  capability?: string;
  permissions?: readonly DesktopLocalBridgePermission[];
}>;

export type DesktopLocalBridgeServer = Readonly<{
  discovery: DesktopLocalBridgeDiscovery;
  close: () => Promise<void>;
}>;

function failure(
  id: string,
  code: DesktopLocalBridgeErrorCode,
  message: string,
  detail: string | null = null,
  transaction?: EditorCommandTransactionResult,
): DesktopLocalBridgeFailure {
  return {
    protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
    id,
    ok: false,
    error: {
      code,
      message,
      detail,
      ...(transaction === undefined ? {} : { transaction }),
    },
  };
}

function ownField(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function parseRequest(value: unknown): DesktopLocalBridgeRequest | DesktopLocalBridgeFailure {
  const id = typeof ownField(value, "id") === "string" ? ownField(value, "id") as string : "";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failure(id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.requestMalformed, "The local bridge request must be an object.");
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 6 ||
    !["protocolVersion", "id", "capability", "permission", "tool", "input"].every(
      (key) => Object.hasOwn(value, key),
    )
  ) {
    return failure(id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.requestMalformed, "The local bridge request envelope has unknown or missing fields.");
  }
  const protocolVersion = ownField(value, "protocolVersion");
  if (protocolVersion !== DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION) {
    return failure(id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.protocolUnsupported, `Desktop local bridge protocol version ${String(protocolVersion)} is unsupported.`);
  }
  const capability = ownField(value, "capability");
  const permission = ownField(value, "permission");
  const toolName = ownField(value, "tool");
  const input = ownField(value, "input");
  if (
    id.length === 0 ||
    typeof capability !== "string" ||
    !isDesktopLocalBridgePermission(permission)
  ) {
    return failure(id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.requestMalformed, "The local bridge request contains an invalid id, capability, or permission.");
  }
  if (desktopLocalBridgeTool(toolName) === undefined) {
    return failure(id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.toolUnknown, "The requested local bridge tool is not registered.");
  }
  if (!validateDesktopLocalBridgeToolInput(toolName as DesktopLocalBridgeToolName, input)) {
    return failure(id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.inputInvalid, "The local bridge input does not match the registered tool schema.");
  }
  return value as DesktopLocalBridgeRequest;
}

function capabilityMatches(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function bridgeRequest(toolName: DesktopLocalBridgeToolName, input: JsonObject): unknown {
  const registered = desktopLocalBridgeTool(toolName);
  if (registered?.commandId !== null && registered?.commandId !== undefined) {
    return {
      action: "command",
      payload: createEditorCommandInvocation(
        registered.commandId,
        "local-agent",
        input,
        input["profile"] === "game" || input["profile"] === "web" || input["profile"] === "kids"
          ? input["profile"]
          : undefined,
      ),
    };
  }
  switch (toolName) {
    case "sceneaxi.bridge.handshake":
      return { action: "handshake" };
    case "sceneaxi.project.status":
      return { action: "authoring", payload: { op: "status", ...input } };
    case "sceneaxi.project.propose":
      return { action: "authoring", payload: { op: "propose", ...input } };
    case "sceneaxi.project.recover":
      return { action: "authoring", payload: { op: "recover" } };
    case "sceneaxi.project.restart":
      return { action: "authoring", payload: { op: "restart", ...input } };
    case "sceneaxi.project.accept":
    case "sceneaxi.project.reject":
    case "sceneaxi.project.undo":
    case "sceneaxi.project.redo":
    case "sceneaxi.project.inspect":
    case "sceneaxi.project.migration.propose":
    case "sceneaxi.project.migration.commit":
    case "sceneaxi.project.migration.recover":
    case "sceneaxi.run.play":
    case "sceneaxi.assistant.local.start":
    case "sceneaxi.assistant.byo.start":
    case "sceneaxi.assistant.local.agent":
    case "sceneaxi.assistant.status":
    case "sceneaxi.assistant.abandon":
      throw new Error(`Registered editor command ${toolName} was not adapted.`);
  }
}

function responseFor(
  request: DesktopLocalBridgeRequest,
  bridgeResponse: DesktopBridgeResponse,
  discovery: DesktopLocalBridgeDiscovery,
): DesktopLocalBridgeResponse {
  if (!bridgeResponse.ok) {
    return failure(
      request.id,
      DESKTOP_LOCAL_BRIDGE_ERROR_CODES.upstreamRefused,
      bridgeResponse.message,
      bridgeResponse.reason,
      bridgeResponse.transaction,
    );
  }
  const result = request.tool === "sceneaxi.bridge.handshake"
    ? {
        ...(bridgeResponse.data as Record<string, unknown>),
        localProtocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
        transport: DESKTOP_LOCAL_BRIDGE_TRANSPORT,
        permissions: discovery.permissions,
        tools: DESKTOP_LOCAL_BRIDGE_TOOLS.map((candidate) => candidate.name),
        creditRoute: "none",
      }
    : bridgeResponse.data;
  return {
    protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
    id: request.id,
    ok: true,
    result,
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isPrivateSameUserSocket(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isSocket() &&
      !stat.isSymbolicLink() &&
      (typeof process.getuid !== "function" || stat.uid === process.getuid()) &&
      (stat.mode & 0o077) === 0;
  } catch {
    return false;
  }
}

/**
 * Liveness of the recorded endpoint, not of a number: a PID may be recycled by
 * any other process of this user, but only a live host still answers on its own
 * socket. A dead host leaves no listener, so its descriptor is stale.
 */
function endpointAccepting(socketPath: string): Promise<boolean> {
  if (!isPrivateSameUserSocket(socketPath)) return Promise.resolve(false);
  return new Promise((resolveProbe) => {
    let settled = false;
    const probe = connect(socketPath);
    const finish = (accepting: boolean): void => {
      if (settled) return;
      settled = true;
      probe.destroy();
      resolveProbe(accepting);
    };
    probe.setTimeout(ENDPOINT_PROBE_TIMEOUT_MS, () => finish(false));
    probe.on("connect", () => finish(true));
    probe.on("error", () => finish(false));
  });
}

function preparePrivateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Desktop local bridge directory is not a real directory: ${path}`);
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error(`Desktop local bridge directory is not owned by this user: ${path}`);
  }
  chmodSync(path, 0o700);
}

function readDiscoveryDescriptor(path: string): DesktopLocalBridgeDiscovery | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  return parseDesktopLocalBridgeDiscovery(decoded);
}

async function removeStaleDiscovery(path: string): Promise<void> {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Desktop local bridge discovery path is not a regular file: ${path}`);
  }
  const parsed = readDiscoveryDescriptor(path);
  if (
    parsed !== null &&
    isProcessAlive(parsed.pid) &&
    await endpointAccepting(parsed.socketPath)
  ) {
    throw new Error(`Another SceneAxi desktop local bridge is active (pid ${String(parsed.pid)}).`);
  }
  rmSync(path);
}

function removeStaleSocket(path: string): void {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (!stat.isSocket() || stat.isSymbolicLink()) {
    throw new Error(`Desktop local bridge socket path is not a Unix socket: ${path}`);
  }
  rmSync(path);
}

function listen(server: Server, socketPath: string): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(socketPath, () => {
      server.off("error", onError);
      resolveListen();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => error === undefined ? resolveClose() : reject(error));
  });
}

export async function startDesktopLocalBridgeServer(
  options: StartDesktopLocalBridgeServerOptions,
): Promise<DesktopLocalBridgeServer> {
  const defaults = resolveDesktopLocalBridgePaths();
  const socketPath = resolve(options.socketPath ?? defaults.socketPath);
  const discoveryPath = resolve(options.discoveryPath ?? defaults.discoveryPath);
  const capability = options.capability ?? randomBytes(32).toString("base64url");
  if (!/^[A-Za-z0-9_-]{43,}$/.test(capability)) {
    throw new Error("Desktop local bridge capabilities must contain at least 256 bits encoded as base64url.");
  }
  const permissions = Object.freeze([...(options.permissions ?? DESKTOP_LOCAL_BRIDGE_PERMISSIONS)]);
  if (
    permissions.length === 0 ||
    !permissions.every(isDesktopLocalBridgePermission) ||
    new Set(permissions).size !== permissions.length
  ) {
    throw new Error("Desktop local bridge permissions must be a non-empty unique subset of the v1 registry.");
  }

  preparePrivateDirectory(dirname(socketPath));
  preparePrivateDirectory(dirname(discoveryPath));
  await removeStaleDiscovery(discoveryPath);
  removeStaleSocket(socketPath);

  const instanceId = randomBytes(16).toString("hex");
  const discovery: DesktopLocalBridgeDiscovery = Object.freeze({
    protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
    kind: DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND,
    transport: DESKTOP_LOCAL_BRIDGE_TRANSPORT,
    instanceId,
    socketPath,
    capability,
    pid: process.pid,
    projectRoot: resolve(options.projectRoot),
    permissions,
  });

  const serve = (socket: Socket): void => {
    socket.setEncoding("utf8");
    socket.setTimeout(SOCKET_IDLE_TIMEOUT_MS, () => socket.destroy());
    let bytes = 0;
    let body = "";
    let answered = false;
    const answer = (response: DesktopLocalBridgeResponse): void => {
      if (answered) return;
      let encoded: string;
      try {
        encoded = JSON.stringify(response);
      } catch {
        encoded = JSON.stringify(
          failure(
            response.id,
            DESKTOP_LOCAL_BRIDGE_ERROR_CODES.internal,
            "The desktop local bridge could not serialize the response.",
          ),
        );
      }
      if (Buffer.byteLength(encoded) > MAX_REQUEST_BYTES) {
        encoded = JSON.stringify(
          failure(
            response.id,
            DESKTOP_LOCAL_BRIDGE_ERROR_CODES.responseTooLarge,
            "The desktop local bridge response exceeds the 1 MiB limit.",
          ),
        );
      }
      answered = true;
      socket.end(`${encoded}\n`);
    };
    socket.on("error", () => {
      answered = true;
      socket.destroy();
    });
    socket.on("data", (chunk: string) => {
      if (answered) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_REQUEST_BYTES) {
        answer(failure("", DESKTOP_LOCAL_BRIDGE_ERROR_CODES.requestMalformed, "The local bridge request exceeds the 1 MiB limit."));
        return;
      }
      body += chunk;
      const newline = body.indexOf("\n");
      if (newline === -1) return;
      if (body.slice(newline + 1).trim().length > 0) {
        answer(failure("", DESKTOP_LOCAL_BRIDGE_ERROR_CODES.requestMalformed, "Exactly one request is allowed per connection."));
        return;
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(body.slice(0, newline));
      } catch {
        answer(failure("", DESKTOP_LOCAL_BRIDGE_ERROR_CODES.requestMalformed, "The local bridge request is not valid JSON."));
        return;
      }
      const request = parseRequest(decoded);
      if (!Object.hasOwn(request, "capability")) {
        answer(request as DesktopLocalBridgeFailure);
        return;
      }
      const valid = request as DesktopLocalBridgeRequest;
      if (!capabilityMatches(valid.capability, capability)) {
        answer(failure(valid.id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.authenticationFailed, "The desktop local bridge capability is invalid."));
        return;
      }
      const definition = desktopLocalBridgeTool(valid.tool);
      if (
        definition === undefined ||
        definition.permission !== valid.permission ||
        !permissions.includes(valid.permission)
      ) {
        answer(failure(valid.id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.permissionDenied, "The requested tool is outside the granted local permission."));
        return;
      }
      try {
        answer(responseFor(valid, options.bridge.handle(bridgeRequest(valid.tool, valid.input)), discovery));
      } catch {
        answer(failure(valid.id, DESKTOP_LOCAL_BRIDGE_ERROR_CODES.internal, "The desktop local bridge could not complete the request."));
      }
    });
  };

  const server = createServer(serve);
  await listen(server, socketPath);
  chmodSync(socketPath, 0o600);

  let closed = false;
  const removeOwnedEndpoint = (): void => {
    if (existsSync(discoveryPath)) {
      const current = readDiscoveryDescriptor(discoveryPath);
      if (current?.instanceId === instanceId) rmSync(discoveryPath);
    }
    if (existsSync(socketPath) && lstatSync(socketPath).isSocket()) rmSync(socketPath);
  };
  server.on("error", () => {
    if (closed || server.listening) return;
    closed = true;
    try {
      removeOwnedEndpoint();
    } catch {
      return;
    }
  });

  const temporaryDiscovery = `${discoveryPath}.${instanceId}.tmp`;
  try {
    writeFileSync(temporaryDiscovery, `${JSON.stringify(discovery)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporaryDiscovery, discoveryPath);
    chmodSync(discoveryPath, 0o600);
  } catch (error) {
    await closeServer(server);
    if (existsSync(temporaryDiscovery)) rmSync(temporaryDiscovery);
    if (existsSync(socketPath) && lstatSync(socketPath).isSocket()) rmSync(socketPath);
    throw error;
  }

  return Object.freeze({
    discovery,
    close: async (): Promise<void> => {
      if (closed) return;
      closed = true;
      await closeServer(server);
      removeOwnedEndpoint();
    },
  });
}
