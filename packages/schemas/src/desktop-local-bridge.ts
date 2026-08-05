/**
 * Versioned, provider-neutral contract for the same-user desktop local bridge.
 *
 * The transport carries agent tool inputs, never provider credentials. The
 * launch-scoped capability authenticates the local CLI to the desktop host; the
 * explicit permission on every request is then checked against both the tool
 * registry and the permissions granted by that host instance.
 */
import { isJsonObject, isJsonValue, type JsonObject } from "./document.js";

export const DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION = 1 as const;
export const DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND =
  "sceneaxi.desktop-local-bridge-discovery" as const;
export const DESKTOP_LOCAL_BRIDGE_TRANSPORT = "unix-ndjson" as const;

export const DESKTOP_LOCAL_BRIDGE_PERMISSIONS = Object.freeze([
  "bridge:connect",
  "project:read",
  "project:write",
  "assistant:read",
  "assistant:run",
] as const);

export type DesktopLocalBridgePermission =
  (typeof DESKTOP_LOCAL_BRIDGE_PERMISSIONS)[number];

export type DesktopLocalBridgeTool = Readonly<{
  name: string;
  description: string;
  permission: DesktopLocalBridgePermission;
  mutatesProject: boolean;
  providerRoute: "none" | "byo";
  creditRoute: "none";
  inputSchema: JsonObject;
}>;

const noInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: Object.freeze({}),
}) satisfies JsonObject;

const documentInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath"]),
  properties: Object.freeze({
    documentPath: Object.freeze({ type: "string", minLength: 1 }),
  }),
}) satisfies JsonObject;

const assistantInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["prompt", "profile"]),
  properties: Object.freeze({
    prompt: Object.freeze({ type: "string", minLength: 1 }),
    profile: Object.freeze({
      type: "string",
      enum: Object.freeze([
        "@sceneaxi/profile-game",
        "@sceneaxi/profile-web",
      ]),
    }),
  }),
}) satisfies JsonObject;

const tool = (
  definition: DesktopLocalBridgeTool,
): DesktopLocalBridgeTool => Object.freeze(definition);

/** Closed first-release tool registry consumed by both the CLI and host. */
export const DESKTOP_LOCAL_BRIDGE_TOOLS = Object.freeze([
  tool({
    name: "sceneaxi.bridge.handshake",
    description: "Verify the discovered desktop instance and report its granted local permissions.",
    permission: "bridge:connect",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.project.status",
    description: "Read the active desktop authoring status for one project-contained document.",
    permission: "project:read",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: documentInput,
  }),
  tool({
    name: "sceneaxi.project.propose",
    description: "Open a reviewable JSON Pointer proposal without writing the document.",
    permission: "project:write",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze(["documentPath", "jsonPointer", "newValue"]),
      properties: Object.freeze({
        documentPath: Object.freeze({ type: "string", minLength: 1 }),
        jsonPointer: Object.freeze({ type: "string" }),
        newValue: Object.freeze({}),
        expectedContentHash: Object.freeze({
          type: "string",
          pattern: "^sha256:[0-9a-f]{64}$",
        }),
      }),
    }),
  }),
  tool({
    name: "sceneaxi.project.accept",
    description: "Accept and durably apply the active all-or-nothing proposal.",
    permission: "project:write",
    mutatesProject: true,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.project.reject",
    description: "Reject the active proposal without writing the document.",
    permission: "project:write",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.project.recover",
    description: "Resolve the shared authoring session's pending apply, rolling the prepared transaction forward or back on disk.",
    permission: "project:write",
    mutatesProject: true,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.project.restart",
    description: "Restart the desktop authoring session and read one contained document.",
    permission: "project:write",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: documentInput,
  }),
  tool({
    name: "sceneaxi.project.undo",
    description: "Undo the last durable apply recorded by the shared authoring session.",
    permission: "project:write",
    mutatesProject: true,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.assistant.local.start",
    description: "Start the deterministic offline assistant compiler; no provider or credits are involved.",
    permission: "assistant:run",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: assistantInput,
  }),
  tool({
    name: "sceneaxi.assistant.byo.start",
    description: "Start the explicitly injected BYOK provider runner; the credential never crosses this tool.",
    permission: "assistant:run",
    mutatesProject: false,
    providerRoute: "byo",
    creditRoute: "none",
    inputSchema: assistantInput,
  }),
  tool({
    name: "sceneaxi.assistant.status",
    description: "Read the newest assistant job snapshot and bounded progress.",
    permission: "assistant:read",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.assistant.abandon",
    description: "Abandon the current assistant job before a retry.",
    permission: "assistant:run",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
] as const);

export type DesktopLocalBridgeToolName =
  (typeof DESKTOP_LOCAL_BRIDGE_TOOLS)[number]["name"];

export const DESKTOP_LOCAL_BRIDGE_ERROR_CODES = Object.freeze({
  requestMalformed: "LOCAL_BRIDGE_REQUEST_MALFORMED",
  protocolUnsupported: "LOCAL_BRIDGE_PROTOCOL_UNSUPPORTED",
  authenticationFailed: "LOCAL_BRIDGE_AUTHENTICATION_FAILED",
  permissionDenied: "LOCAL_BRIDGE_PERMISSION_DENIED",
  toolUnknown: "LOCAL_BRIDGE_TOOL_UNKNOWN",
  inputInvalid: "LOCAL_BRIDGE_INPUT_INVALID",
  upstreamRefused: "LOCAL_BRIDGE_UPSTREAM_REFUSED",
  responseTooLarge: "LOCAL_BRIDGE_RESPONSE_TOO_LARGE",
  internal: "LOCAL_BRIDGE_INTERNAL",
} as const);

export type DesktopLocalBridgeErrorCode =
  (typeof DESKTOP_LOCAL_BRIDGE_ERROR_CODES)[keyof typeof DESKTOP_LOCAL_BRIDGE_ERROR_CODES];

export type DesktopLocalBridgeDiscovery = Readonly<{
  protocolVersion: typeof DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION;
  kind: typeof DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND;
  transport: typeof DESKTOP_LOCAL_BRIDGE_TRANSPORT;
  instanceId: string;
  socketPath: string;
  capability: string;
  pid: number;
  projectRoot: string;
  permissions: readonly DesktopLocalBridgePermission[];
}>;

export type DesktopLocalBridgeRequest = Readonly<{
  protocolVersion: typeof DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION;
  id: string;
  capability: string;
  permission: DesktopLocalBridgePermission;
  tool: DesktopLocalBridgeToolName;
  input: JsonObject;
}>;

export type DesktopLocalBridgeSuccess = Readonly<{
  protocolVersion: typeof DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: unknown;
}>;

export type DesktopLocalBridgeFailure = Readonly<{
  protocolVersion: typeof DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION;
  id: string;
  ok: false;
  error: Readonly<{
    code: DesktopLocalBridgeErrorCode | string;
    message: string;
    detail: string | null;
  }>;
}>;

export type DesktopLocalBridgeResponse =
  | DesktopLocalBridgeSuccess
  | DesktopLocalBridgeFailure;

export function desktopLocalBridgeTool(
  name: unknown,
): DesktopLocalBridgeTool | undefined {
  return DESKTOP_LOCAL_BRIDGE_TOOLS.find((candidate) => candidate.name === name);
}

function exactKeys(value: JsonObject, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && allowed.every((key) => Object.hasOwn(value, key));
}

function documentPathInput(input: JsonObject): boolean {
  return exactKeys(input, ["documentPath"]) &&
    typeof input["documentPath"] === "string" && input["documentPath"].length > 0;
}

function assistantStartInput(input: JsonObject): boolean {
  return exactKeys(input, ["prompt", "profile"]) &&
    typeof input["prompt"] === "string" && input["prompt"].trim().length > 0 &&
    (input["profile"] === "@sceneaxi/profile-game" ||
      input["profile"] === "@sceneaxi/profile-web");
}

/** Exact runtime validation for the checked-in tool schemas. */
export function validateDesktopLocalBridgeToolInput(
  toolName: DesktopLocalBridgeToolName,
  input: unknown,
): input is JsonObject {
  if (!isJsonObject(input)) return false;
  switch (toolName) {
    case "sceneaxi.project.status":
    case "sceneaxi.project.restart":
      return documentPathInput(input);
    case "sceneaxi.project.propose": {
      const keys = Object.keys(input);
      if (
        !keys.every((key) =>
          ["documentPath", "jsonPointer", "newValue", "expectedContentHash"].includes(key),
        ) ||
        ![3, 4].includes(keys.length) ||
        typeof input["documentPath"] !== "string" ||
        input["documentPath"].length === 0 ||
        typeof input["jsonPointer"] !== "string" ||
        !Object.hasOwn(input, "newValue") ||
        !isJsonValue(input["newValue"])
      ) {
        return false;
      }
      const expected = input["expectedContentHash"];
      return expected === undefined ||
        (typeof expected === "string" && /^sha256:[0-9a-f]{64}$/.test(expected));
    }
    case "sceneaxi.project.accept":
    case "sceneaxi.project.reject":
    case "sceneaxi.project.recover":
    case "sceneaxi.project.undo":
    case "sceneaxi.assistant.status":
    case "sceneaxi.assistant.abandon":
    case "sceneaxi.bridge.handshake":
      return exactKeys(input, []);
    case "sceneaxi.assistant.local.start":
    case "sceneaxi.assistant.byo.start":
      return assistantStartInput(input);
  }
  return false;
}

export function isDesktopLocalBridgePermission(
  value: unknown,
): value is DesktopLocalBridgePermission {
  return typeof value === "string" &&
    (DESKTOP_LOCAL_BRIDGE_PERMISSIONS as readonly string[]).includes(value);
}

export function parseDesktopLocalBridgeDiscovery(
  value: unknown,
): DesktopLocalBridgeDiscovery | null {
  if (!isJsonObject(value) || !exactKeys(value, [
    "protocolVersion",
    "kind",
    "transport",
    "instanceId",
    "socketPath",
    "capability",
    "pid",
    "projectRoot",
    "permissions",
  ])) return null;
  const permissions = value["permissions"];
  if (
    value["protocolVersion"] !== DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION ||
    value["kind"] !== DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND ||
    value["transport"] !== DESKTOP_LOCAL_BRIDGE_TRANSPORT ||
    typeof value["instanceId"] !== "string" || value["instanceId"].length === 0 ||
    typeof value["socketPath"] !== "string" || value["socketPath"].length === 0 ||
    typeof value["capability"] !== "string" || !/^[A-Za-z0-9_-]{43,}$/.test(value["capability"]) ||
    !Number.isInteger(value["pid"]) || (value["pid"] as number) <= 0 ||
    typeof value["projectRoot"] !== "string" || value["projectRoot"].length === 0 ||
    !Array.isArray(permissions) || permissions.length === 0 ||
    !permissions.every(isDesktopLocalBridgePermission) ||
    new Set(permissions).size !== permissions.length
  ) return null;
  return value as DesktopLocalBridgeDiscovery;
}
