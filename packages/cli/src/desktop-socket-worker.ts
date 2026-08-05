/**
 * One-shot async Unix-socket worker used by the otherwise synchronous CLI.
 *
 * Stdout is exactly one client-result JSON object. It never writes discovery
 * contents, capabilities, request inputs, provider output, or raw errors.
 */
import { readFileSync, lstatSync } from "node:fs";
import { connect } from "node:net";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const PROTOCOL_VERSION = 1;
const DISCOVERY_KIND = "sceneaxi.desktop-local-bridge-discovery";
const TRANSPORT = "unix-ndjson";
const MAX_RESPONSE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5_000;

type WorkerCall = Readonly<{
  descriptorPath?: string;
  id: string;
  permission: string;
  tool: string;
  input: Record<string, unknown>;
}>;

type Discovery = Readonly<{
  protocolVersion: number;
  kind: string;
  transport: string;
  instanceId: string;
  socketPath: string;
  capability: string;
  pid: number;
  projectRoot: string;
  permissions: readonly string[];
}>;

const PERMISSIONS = new Set([
  "bridge:connect",
  "project:read",
  "project:write",
  "assistant:read",
  "assistant:run",
]);

type WorkerResult =
  | Readonly<{ ok: true; response: unknown }>
  | Readonly<{ ok: false; code: string; message: string }>;

function fail(code: string, message: string): WorkerResult {
  return { ok: false, code, message };
}

function own(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function validResponse(value: unknown, id: string): boolean {
  if (
    typeof value !== "object" || value === null || Array.isArray(value) ||
    own(value, "protocolVersion") !== PROTOCOL_VERSION ||
    own(value, "id") !== id ||
    typeof own(value, "ok") !== "boolean"
  ) return false;
  const ok = own(value, "ok");
  if (ok === true) {
    return Object.keys(value).length === 4 && Object.hasOwn(value, "result");
  }
  const error = own(value, "error");
  return Object.keys(value).length === 4 &&
    typeof error === "object" && error !== null && !Array.isArray(error) &&
    Object.keys(error).length === 3 &&
    typeof own(error, "code") === "string" &&
    typeof own(error, "message") === "string" &&
    (typeof own(error, "detail") === "string" || own(error, "detail") === null);
}

function callFromStdin(): WorkerCall | null {
  try {
    const value = JSON.parse(readFileSync(0, "utf8")) as unknown;
    const input = own(value, "input");
    const descriptorPath = own(value, "descriptorPath");
    if (
      typeof own(value, "id") !== "string" ||
      typeof own(value, "permission") !== "string" ||
      typeof own(value, "tool") !== "string" ||
      typeof input !== "object" || input === null || Array.isArray(input) ||
      (descriptorPath !== undefined && typeof descriptorPath !== "string")
    ) return null;
    return value as WorkerCall;
  } catch {
    return null;
  }
}

function defaultDescriptorPath(): string {
  const configured = process.env["XDG_CONFIG_HOME"];
  const base = configured !== undefined && isAbsolute(configured)
    ? configured
    : join(homedir(), ".config");
  return join(base, "sceneaxi", "desktop-bridge-v1.json");
}

function secureFile(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isFile() &&
      !stat.isSymbolicLink() &&
      (typeof process.getuid !== "function" || stat.uid === process.getuid()) &&
      (stat.mode & 0o077) === 0;
  } catch {
    return false;
  }
}

function secureSocket(path: string): boolean {
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

function discoveryAt(path: string): Discovery | WorkerResult {
  if (!secureFile(path)) {
    try {
      lstatSync(path);
      return fail(
        "LOCAL_BRIDGE_DISCOVERY_INSECURE",
        "The desktop bridge discovery descriptor is not a private same-user regular file.",
      );
    } catch {
      return fail(
        "LOCAL_BRIDGE_DISCOVERY_UNAVAILABLE",
        "No active SceneAxi desktop discovery descriptor was found.",
      );
    }
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (
      typeof value !== "object" || value === null || Array.isArray(value) ||
      Object.keys(value).length !== 9 ||
      ![
        "protocolVersion",
        "kind",
        "transport",
        "instanceId",
        "socketPath",
        "capability",
        "pid",
        "projectRoot",
        "permissions",
      ].every((key) => Object.hasOwn(value, key))
    ) {
      return fail(
        "LOCAL_BRIDGE_RESPONSE_INVALID",
        "The desktop bridge discovery descriptor does not match protocol v1.",
      );
    }
    const discovery: Discovery = {
      protocolVersion: own(value, "protocolVersion") as number,
      kind: own(value, "kind") as string,
      transport: own(value, "transport") as string,
      instanceId: own(value, "instanceId") as string,
      socketPath: own(value, "socketPath") as string,
      capability: own(value, "capability") as string,
      pid: own(value, "pid") as number,
      projectRoot: own(value, "projectRoot") as string,
      permissions: own(value, "permissions") as readonly string[],
    };
    if (
      discovery.protocolVersion !== PROTOCOL_VERSION ||
      discovery.kind !== DISCOVERY_KIND ||
      discovery.transport !== TRANSPORT ||
      typeof discovery.instanceId !== "string" || discovery.instanceId.length === 0 ||
      typeof discovery.socketPath !== "string" || !isAbsolute(discovery.socketPath) ||
      typeof discovery.capability !== "string" || !/^[A-Za-z0-9_-]{43,}$/.test(discovery.capability) ||
      !Number.isInteger(discovery.pid) || discovery.pid <= 0 ||
      typeof discovery.projectRoot !== "string" || !isAbsolute(discovery.projectRoot) ||
      !Array.isArray(discovery.permissions) || discovery.permissions.length === 0 ||
      !discovery.permissions.every((permission) => PERMISSIONS.has(permission)) ||
      new Set(discovery.permissions).size !== discovery.permissions.length
    ) {
      return fail(
        "LOCAL_BRIDGE_RESPONSE_INVALID",
        "The desktop bridge discovery descriptor does not match protocol v1.",
      );
    }
    if (!secureSocket(discovery.socketPath)) {
      return fail(
        "LOCAL_BRIDGE_DISCOVERY_INSECURE",
        "The discovered desktop bridge endpoint is not a private same-user Unix socket.",
      );
    }
    return discovery;
  } catch {
    return fail(
      "LOCAL_BRIDGE_RESPONSE_INVALID",
      "The desktop bridge discovery descriptor is invalid.",
    );
  }
}

function rpc(discovery: Discovery, call: WorkerCall): Promise<WorkerResult> {
  return new Promise((resolveResult) => {
    const socket = connect(discovery.socketPath);
    let settled = false;
    let bytes = 0;
    let response = "";
    const settle = (result: WorkerResult): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveResult(result);
    };
    socket.setEncoding("utf8");
    socket.setTimeout(TIMEOUT_MS, () =>
      settle(fail("LOCAL_BRIDGE_TRANSPORT_UNAVAILABLE", "The desktop local bridge timed out.")),
    );
    socket.on("connect", () => {
      socket.end(`${JSON.stringify({
        protocolVersion: PROTOCOL_VERSION,
        id: call.id,
        capability: discovery.capability,
        permission: call.permission,
        tool: call.tool,
        input: call.input,
      })}\n`);
    });
    socket.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_RESPONSE_BYTES) {
        settle(fail("LOCAL_BRIDGE_RESPONSE_INVALID", "The desktop local bridge response exceeds the 1 MiB limit."));
        return;
      }
      response += chunk;
    });
    socket.on("error", () =>
      settle(fail("LOCAL_BRIDGE_TRANSPORT_UNAVAILABLE", "The discovered desktop local bridge is unavailable.")),
    );
    socket.on("end", () => {
      if (settled) return;
      try {
        const decoded = JSON.parse(response.trim()) as unknown;
        if (!validResponse(decoded, call.id)) {
          settle(fail("LOCAL_BRIDGE_RESPONSE_INVALID", "The desktop local bridge response envelope is invalid."));
          return;
        }
        settle({ ok: true, response: decoded });
      } catch {
        settle(fail("LOCAL_BRIDGE_RESPONSE_INVALID", "The desktop local bridge response is not valid JSON."));
      }
    });
  });
}

const call = callFromStdin();
let result: WorkerResult;
if (call === null) {
  result = fail("LOCAL_BRIDGE_RESPONSE_INVALID", "The CLI supplied an invalid local bridge call.");
} else {
  const descriptorPath = resolve(call.descriptorPath ?? defaultDescriptorPath());
  const discovery = discoveryAt(descriptorPath);
  result = "socketPath" in discovery ? await rpc(discovery, call) : discovery;
}
process.stdout.write(JSON.stringify(result));
