/**
 * Versioned, provider-neutral contract for the same-user desktop local bridge.
 *
 * The transport carries agent tool inputs, never provider credentials. The
 * server-scoped capability authenticates the local CLI to the desktop host; the
 * explicit permission on every request is then checked against both the tool
 * registry and the permissions granted by that host instance.
 */
import { isJsonObject, isJsonValue, type JsonObject } from "./document.js";
import {
  editorCommand,
  validateEditorCommandInput,
  type EditorCommandId,
  type EditorCommandTransactionResult,
} from "./editor-command-registry.js";

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
  commandId: EditorCommandId | null;
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

const tool = (
  definition: DesktopLocalBridgeTool,
): DesktopLocalBridgeTool => Object.freeze(definition);

const commandTool = (definition: Readonly<{
  name: string;
  commandId: EditorCommandId;
  description: string;
  providerRoute: "none" | "byo";
}>): DesktopLocalBridgeTool => {
  const command = editorCommand(definition.commandId);
  if (command === undefined || !command.acceptedClients.includes("local-agent")) {
    throw new Error(`Local bridge tool names unavailable editor command ${definition.commandId}`);
  }
  return tool({
    ...definition,
    permission: command.permission,
    mutatesProject:
      command.mutation === "commits-project" ||
      command.mutation === "reverts-project" ||
      command.mutation === "commits-settings" ||
      command.id === "project-git-stage",
    creditRoute: "none",
    inputSchema: command.inputSchema,
  });
};

/** Closed first-release tool registry consumed by both the CLI and host. */
export const DESKTOP_LOCAL_BRIDGE_TOOLS = Object.freeze([
  tool({
    name: "sceneaxi.bridge.handshake",
    commandId: null,
    description: "Verify the discovered desktop instance and report its granted local permissions.",
    permission: "bridge:connect",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.project.status",
    commandId: null,
    description: "Read the active desktop authoring status for one project-contained document.",
    permission: "project:read",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: documentInput,
  }),
  commandTool({
    name: "sceneaxi.project.inspect",
    commandId: "project-inspect",
    description: "Inspect the active native project version and exact capability grants.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.migration.propose",
    commandId: "project-migration-propose",
    description: "Persist a deterministic migration proposal for review without changing existing project bytes.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.migration.commit",
    commandId: "project-migration-commit",
    description: "Commit only the exact reviewed and explicitly approved project migration proposal.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.migration.recover",
    commandId: "project-migration-recover",
    description: "Deterministically recover the one prepared project migration transaction.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.git.status",
    commandId: "project-git-status",
    description: "Inspect contained canonical and unrelated working-tree state without changing either.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.git.diff",
    commandId: "project-git-diff",
    description: "Read the canonical unstaged and staged project diff with the same repository evidence as desktop.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.git.stage",
    commandId: "project-git-stage",
    description: "Stage only the explicitly selected contained project paths after registered capability checks.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.git.commit.prepare",
    commandId: "project-git-commit-prepare",
    description: "Prepare evidence for an exact staged selection without creating a commit or bypassing hooks.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.hierarchy.inspect",
    commandId: "scene-hierarchy-inspect",
    description: "Inspect the versioned project hierarchy and current ordered selection for assistant or CLI use.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.selection.set",
    commandId: "scene-selection-set",
    description: "Set a deterministic ordered multi-selection through the shared hierarchy command.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.property.set",
    commandId: "scene-property-set",
    description: "Stage one validated property change through the shared hierarchy transaction.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.transform.apply",
    commandId: "scene-transform-apply",
    description: "Stage one gizmo or numeric transform through the shared preview/commit command.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.object.create",
    commandId: "scene-object-create",
    description: "Stage creation of one object from an already validated local artifact instance.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.object.remove",
    commandId: "scene-object-remove",
    description: "Stage bounded removal of the exact ordered object selection.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.scene.object.reparent",
    commandId: "scene-object-reparent",
    description: "Stage one reparent with an explicit preserve-world or preserve-local transform policy.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.input-actions.inspect",
    commandId: "input-actions-inspect",
    description: "Inspect the effective editor and Play action map plus project/workspace bases.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.input-actions.rebind",
    commandId: "input-action-rebind",
    description: "Review or commit one conflict-checked project/workspace input-action rebind.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.input-actions.reset",
    commandId: "input-actions-reset",
    description: "Review or commit an explicit reset of one input-action override scope.",
    providerRoute: "none",
  }),
  tool({
    name: "sceneaxi.project.propose",
    commandId: null,
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
  commandTool({
    name: "sceneaxi.project.accept",
    commandId: "change-review-accept",
    description: "Accept and durably apply the active all-or-nothing proposal.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.reject",
    commandId: "change-review-reject",
    description: "Reject the active proposal without writing the document.",
    providerRoute: "none",
  }),
  tool({
    name: "sceneaxi.project.recover",
    commandId: null,
    description: "Resolve the shared authoring session's pending apply, rolling the prepared transaction forward or back on disk.",
    permission: "project:write",
    mutatesProject: true,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: noInput,
  }),
  tool({
    name: "sceneaxi.project.restart",
    commandId: null,
    description: "Restart the desktop authoring session and read one contained document.",
    permission: "project:write",
    mutatesProject: false,
    providerRoute: "none",
    creditRoute: "none",
    inputSchema: documentInput,
  }),
  commandTool({
    name: "sceneaxi.project.undo",
    commandId: "edit-undo",
    description: "Undo the last durable apply recorded by the shared authoring session.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.project.redo",
    commandId: "edit-redo",
    description: "Redo the next durable apply on the active history branch.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.run.play",
    commandId: "run-play",
    description: "Play the active composed scene through the existing closed kernel session.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.assistant.local.start",
    commandId: "assistant-local-build",
    description: "Start the deterministic offline assistant compiler; no provider or credits are involved.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.assistant.byo.start",
    commandId: "assistant-byo-build",
    description: "Start the explicitly injected BYOK provider runner; the credential never crosses this tool.",
    providerRoute: "byo",
  }),
  commandTool({
    name: "sceneaxi.assistant.local.agent",
    commandId: "assistant-local-agent",
    description: "Start the bounded fixture-backed Local Agent and stage its registered proposal in Change Review.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.assistant.status",
    commandId: "assistant-status",
    description: "Read the newest assistant job snapshot and bounded progress.",
    providerRoute: "none",
  }),
  commandTool({
    name: "sceneaxi.assistant.abandon",
    commandId: "assistant-cancel",
    description:
      "Abandon the exact assistant job identified by its start response before a retry.",
    providerRoute: "none",
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
    transaction?: EditorCommandTransactionResult;
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
      input["profile"] === "@sceneaxi/profile-web" ||
      input["profile"] === "@sceneaxi/profile-kids");
}

/** Exact runtime validation for the checked-in tool schemas. */
export function validateDesktopLocalBridgeToolInput(
  toolName: DesktopLocalBridgeToolName,
  input: unknown,
): input is JsonObject {
  if (!isJsonObject(input)) return false;
  const registered = desktopLocalBridgeTool(toolName);
  if (registered?.commandId !== null && registered?.commandId !== undefined) {
    const command = editorCommand(registered.commandId);
    return command !== undefined && validateEditorCommandInput(command, input);
  }
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
    case "sceneaxi.project.redo":
    case "sceneaxi.project.inspect":
    case "sceneaxi.project.migration.propose":
    case "sceneaxi.project.migration.recover":
    case "sceneaxi.assistant.status":
    case "sceneaxi.bridge.handshake":
      return exactKeys(input, []);
    case "sceneaxi.project.migration.commit":
      return exactKeys(input, ["approved", "proposalDigest"]) &&
        input["approved"] === true && typeof input["proposalDigest"] === "string" &&
        /^sha256:[0-9a-f]{64}$/.test(input["proposalDigest"]);
    case "sceneaxi.run.play":
      return documentPathInput(input);
    case "sceneaxi.assistant.abandon":
      return exactKeys(input, ["jobId"]) &&
        typeof input["jobId"] === "string" && input["jobId"].length > 0;
    case "sceneaxi.assistant.local.start":
    case "sceneaxi.assistant.byo.start":
      return assistantStartInput(input);
    case "sceneaxi.assistant.local.agent":
      return exactKeys(input, ["prompt", "profile", "documentPath"]) &&
        typeof input["prompt"] === "string" && input["prompt"].trim().length > 0 &&
        (input["profile"] === "@sceneaxi/profile-game" ||
          input["profile"] === "@sceneaxi/profile-web" ||
          input["profile"] === "@sceneaxi/profile-kids") &&
        typeof input["documentPath"] === "string" && input["documentPath"].length > 0;
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
