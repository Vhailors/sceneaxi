/** Agent-facing desktop local bridge CLI verbs (sceneaxi#202). */
import {
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  DESKTOP_LOCAL_BRIDGE_TRANSPORT,
  EDITOR_COMMAND_REGISTRY,
  EDITOR_COMMAND_SCHEMA_VERSION,
  desktopLocalBridgeTool,
  validateDesktopLocalBridgeToolInput,
  type DesktopLocalBridgePermission,
  type DesktopLocalBridgeToolName,
  type JsonObject,
  type JsonValue,
  type DesktopLocalBridgeResponse,
} from "@sceneaxi/schemas";
import { callDesktopLocalBridge, type DesktopLocalBridgeClient } from "./desktop-client.js";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs, requireFlag } from "./verb-args.js";
import { refuseUnknownArgs } from "./verb-support.js";

type BridgeCall = { descriptorPath?: string; permission: DesktopLocalBridgePermission; tool: DesktopLocalBridgeToolName; input: JsonObject };

type BridgeErrorDetails = { bridgeCode: string; bridgeDetail: string | null; transaction?: Extract<DesktopLocalBridgeResponse, { ok: false }>["error"]["transaction"] };

export function runDesktopBridgeTools(): ResultPayload {
  return Object.freeze({
    protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
    transport: DESKTOP_LOCAL_BRIDGE_TRANSPORT,
    creditRoute: "none",
    commandSchemaVersion: EDITOR_COMMAND_SCHEMA_VERSION,
    commands: EDITOR_COMMAND_REGISTRY,
    tools: DESKTOP_LOCAL_BRIDGE_TOOLS,
    workflows: {
      play: "sceneaxi.run.play",
      stop: "sceneaxi.run.stop",
      build: "sceneaxi.project.build",
      localAssistantBuild: "sceneaxi.assistant.local.start",
      webExport: "Packaged Ship menu; no admitted RPC export tool",
      nativeRelease: "Separate host/signing/publication authority; project.build is not a release",
    },
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
    const details: BridgeErrorDetails = { bridgeCode: result.response.error.code, bridgeDetail: result.response.error.detail };

    if (result.response.error.transaction !== undefined) details.transaction = result.response.error.transaction;

    return failure("BRIDGE_REFUSED", result.response.error.message, {
      path,
      details,
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
      response: result.response.result,
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
  let input: JsonValue;

  try {
    // SAFETY: JSON.parse produces a JSON value from CLI bytes; the tool schema is validated below.
    input = JSON.parse(rawInput) as JsonValue;
  } catch {
    return callValidation(path, "--input-json must be valid JSON.");
  }

  const toolName = definition.name;

  if (!validateDesktopLocalBridgeToolInput(toolName, input)) {
    return callValidation(
      path,
      `--input-json does not match the checked-in schema for ${definition.name}.`,
    );
  }

  const descriptorPath = args.flags.get("--descriptor");

  const call: BridgeCall = { permission: definition.permission, tool: toolName, input };

  if (descriptorPath !== undefined) call.descriptorPath = descriptorPath;

  return invoke(path, client, call);
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

  const call: BridgeCall = { permission: "bridge:connect", tool: "sceneaxi.bridge.handshake", input: {} };

  if (descriptorPath !== undefined) call.descriptorPath = descriptorPath;

  return invoke(path, client, call);
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


/** Thin discoverable aliases keep the exact permission/input validation of bridge call. */
export function runDesktopAlias(path: readonly string[], tokens: readonly string[], tool: string, client?: DesktopLocalBridgeClient): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, new Set(["--input-json", "--allow", "--descriptor"]), path);

  if (unknown) return unknown;

  return runDesktopBridgeCall(path, ["--tool", tool, ...tokens], client);
}

export function desktopAliasHelp(command: string, tool: string): ResultPayload {
  const definition = desktopLocalBridgeTool(tool);

  return { command, description: `Permission-bound alias for ${tool}; requires a running same-user desktop`, flags: { "--allow": `Required: ${definition?.permission ?? "unknown"}`, "--input-json": "Exact input schema from desktop bridge tools", "--descriptor": "Local discovery path" }, tool, inputSchema: definition?.inputSchema };
}
