/** Agent-facing desktop local bridge CLI verbs (sceneaxi#202). */
import {
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  DESKTOP_LOCAL_BRIDGE_TRANSPORT,
  desktopLocalBridgeTool,
  validateDesktopLocalBridgeToolInput,
  type DesktopLocalBridgePermission,
  type DesktopLocalBridgeToolName,
  type JsonObject,
} from "@sceneaxi/schemas";
import { callDesktopLocalBridge, type DesktopLocalBridgeClient } from "./desktop-client.js";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs, requireFlag } from "./verb-args.js";
import { refuseUnknownArgs } from "./verb-support.js";

export function runDesktopBridgeTools(): ResultPayload {
  return Object.freeze({
    protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
    transport: DESKTOP_LOCAL_BRIDGE_TRANSPORT,
    creditRoute: "none",
    tools: DESKTOP_LOCAL_BRIDGE_TOOLS,
  });
}

const STATUS_FLAGS = new Set(["--descriptor"]);
const CALL_FLAGS = new Set(["--tool", "--input-json", "--allow", "--descriptor"]);

function invoke(
  path: readonly string[],
  client: DesktopLocalBridgeClient | undefined,
  call: Readonly<{
    descriptorPath?: string;
    permission: DesktopLocalBridgePermission;
    tool: DesktopLocalBridgeToolName;
    input: JsonObject;
  }>,
): CliOutcome {
  const result = (client ?? callDesktopLocalBridge)({
    ...call,
    id: "sceneaxi-cli-1",
  });
  if (!result.ok) {
    const failureClass = result.code === "LOCAL_BRIDGE_RESPONSE_INVALID"
      ? "BRIDGE_PROTOCOL"
      : "BRIDGE_UNAVAILABLE";
    return failure(failureClass, result.message, {
      path,
      details: { bridgeCode: result.code },
      help: [
        "Start SceneAxi Engine Desktop, then retry",
        "The discovery descriptor is local-only and must be owned/readable only by this user",
      ],
    });
  }
  if (!result.response.ok) {
    return failure("BRIDGE_REFUSED", result.response.error.message, {
      path,
      details: {
        bridgeCode: result.response.error.code,
        bridgeDetail: result.response.error.detail,
      },
      help: [
        `The desktop bridge refused ${call.tool}`,
        "Run `sceneaxi desktop bridge status --json` to verify the active desktop instance",
      ],
    });
  }
  return success(
    Object.freeze({
      connected: true,
      tool: call.tool,
      response: result.response.result as Record<string, unknown>,
    }),
    [
      "The response came from the discovered same-user desktop Unix socket",
      "Run `sceneaxi desktop bridge tools --json` for the closed tool registry",
    ],
  );
}

export function runDesktopBridgeCall(
  path: readonly string[],
  tokens: readonly string[],
  client?: DesktopLocalBridgeClient,
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, CALL_FLAGS, path);
  if (unknown) return unknown;
  for (const flag of ["--tool", "--input-json", "--allow", "--descriptor"]) {
    if (args.switches.has(flag)) return callValidation(path, `Missing value for ${flag}`);
  }
  const toolFlag = requireFlag(args, "--tool");
  if (!toolFlag.ok) return callValidation(path, toolFlag.message);
  const definition = desktopLocalBridgeTool(toolFlag.value);
  if (definition === undefined) {
    return callValidation(path, `Unknown desktop bridge tool: ${toolFlag.value}`);
  }
  const allow = requireFlag(args, "--allow");
  if (!allow.ok) {
    return callValidation(
      path,
      `${allow.message}; ${definition.name} requires --allow ${definition.permission}`,
    );
  }
  if (allow.value !== definition.permission) {
    return callValidation(
      path,
      `Permission ${allow.value} does not match ${definition.name}; required: ${definition.permission}`,
    );
  }
  const rawInput = args.flags.get("--input-json") ?? "{}";
  let input: unknown;
  try {
    input = JSON.parse(rawInput) as unknown;
  } catch {
    return callValidation(path, "--input-json must be valid JSON.");
  }
  const toolName = definition.name as DesktopLocalBridgeToolName;
  if (!validateDesktopLocalBridgeToolInput(toolName, input)) {
    return callValidation(
      path,
      `--input-json does not match the checked-in schema for ${definition.name}.`,
    );
  }
  const descriptorPath = args.flags.get("--descriptor");
  return invoke(path, client, {
    ...(descriptorPath === undefined ? {} : { descriptorPath }),
    permission: definition.permission,
    tool: toolName,
    input,
  });
}

function callValidation(path: readonly string[], message: string): CliOutcome {
  return failure("VALIDATION", message, {
    path,
    help: [
      "Usage: sceneaxi desktop bridge call --tool <name> --allow <permission> [--input-json <object>] [--descriptor <path>]",
      "Run `sceneaxi desktop bridge tools --json` for exact tool schemas and permissions",
    ],
  });
}

export function desktopBridgeCallHelp(): ResultPayload {
  return Object.freeze({
    command: "desktop bridge call",
    description: "Invoke one checked-in agent tool through the discovered local desktop",
    flags: Object.freeze({
      "--tool": "Exact tool name from desktop bridge tools (required)",
      "--allow": "Exact permission printed for that tool (required)",
      "--input-json": "Tool input object as JSON (defaults to {})",
      "--descriptor": "Override the local discovery descriptor path",
    }),
  });
}

export function runDesktopBridgeStatus(
  path: readonly string[],
  tokens: readonly string[],
  client?: DesktopLocalBridgeClient,
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, STATUS_FLAGS, path);
  if (unknown) return unknown;
  if (args.switches.has("--descriptor")) {
    return failure("VALIDATION", "Missing value for --descriptor", { path });
  }
  const descriptorPath = args.flags.get("--descriptor");
  return invoke(path, client, {
    ...(descriptorPath === undefined ? {} : { descriptorPath }),
    permission: "bridge:connect",
    tool: "sceneaxi.bridge.handshake",
    input: {},
  });
}

export function desktopBridgeStatusHelp(): ResultPayload {
  return Object.freeze({
    command: "desktop bridge status",
    description: "Discover, authenticate, and handshake with the running local Engine Desktop",
    flags: Object.freeze({
      "--descriptor": "Override the local discovery descriptor path (tests and isolated installs)",
    }),
  });
}
