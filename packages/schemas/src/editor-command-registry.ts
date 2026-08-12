/**
 * Full-editor v1 command registry.
 *
 * This is product-command vocabulary, not a transport. Desktop IPC actions,
 * local-agent tool names, and CLI verbs adapt these definitions rather than
 * becoming competing sources of permission or result metadata.
 */
import type { JsonObject } from "./document.js";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  isDesktopSceneSelectionInput,
  type DesktopSceneHierarchyRefusal,
} from "./desktop-scene-edit.js";

export const EDITOR_COMMAND_SCHEMA_VERSION = 1 as const;

export const EDITOR_COMMAND_CLIENTS = Object.freeze([
  "desktop-control",
  "cli",
  "local-agent",
] as const);

export type EditorCommandClient = (typeof EDITOR_COMMAND_CLIENTS)[number];

export const EDITOR_COMMAND_PERMISSIONS = Object.freeze([
  "project:read",
  "project:write",
  "assistant:read",
  "assistant:run",
] as const);

export type EditorCommandPermission =
  (typeof EDITOR_COMMAND_PERMISSIONS)[number];

export const EDITOR_COMMAND_REFUSALS = Object.freeze({
  registryInvalid: "EDITOR_COMMAND_REGISTRY_INVALID",
  commandUnknown: "EDITOR_COMMAND_UNKNOWN",
  clientDenied: "EDITOR_COMMAND_CLIENT_DENIED",
  schemaUnsupported: "EDITOR_COMMAND_SCHEMA_UNSUPPORTED",
  inputInvalid: "EDITOR_COMMAND_INPUT_INVALID",
  permissionDenied: "EDITOR_COMMAND_PERMISSION_DENIED",
  capabilityDenied: "EDITOR_COMMAND_CAPABILITY_DENIED",
  kidsDenied: "EDITOR_COMMAND_KIDS_DENIED",
  staleBase: "EDITOR_COMMAND_STALE_BASE_VERSION",
  invalidPhase: "EDITOR_COMMAND_INVALID_PHASE",
  activeJobMismatch: "EDITOR_COMMAND_ACTIVE_JOB_MISMATCH",
} as const);

export type EditorCommandRefusal =
  (typeof EDITOR_COMMAND_REFUSALS)[keyof typeof EDITOR_COMMAND_REFUSALS];

export type EditorCommandId =
  | "project-new"
  | "project-inspect"
  | "project-migration-propose"
  | "project-migration-commit"
  | "project-migration-recover"
  | "project-open"
  | "project-save"
  | "ship-export-web"
  | "edit-undo"
  | "edit-redo"
  | "scene-hierarchy-inspect"
  | "scene-selection-set"
  | "scene-property-set"
  | "scene-object-create"
  | "scene-object-remove"
  | "scene-object-reparent"
  | "run-play"
  | "change-review-accept"
  | "change-review-reject"
  | "assistant-local-build"
  | "assistant-byo-build"
  | "assistant-local-agent"
  | "assistant-status"
  | "assistant-cancel";

export type EditorCommandMutation =
  | "none"
  | "stages-change"
  | "commits-project"
  | "reverts-project";

export type EditorCommandResultTarget =
  | "none"
  | "project"
  | "change-review"
  | "live-viewport";

export type EditorCommandDefinition = Readonly<{
  schemaVersion: typeof EDITOR_COMMAND_SCHEMA_VERSION;
  id: EditorCommandId;
  label: string;
  acceptedClients: readonly EditorCommandClient[];
  permission: EditorCommandPermission;
  capability: Readonly<{
    id: string;
    profiles: readonly ("game" | "web")[];
  }>;
  mutation: EditorCommandMutation;
  progress: Readonly<{
    kind: "immediate" | "bounded";
    minimum: 0;
    maximum: 100;
    phases: readonly string[];
  }>;
  evidence: Readonly<{
    kind:
      | "none"
      | "project-binding"
      | "project-inspection"
      | "project-migration-proposal"
      | "project-migration-evidence"
      | "authoring-snapshot"
      | "undo-result"
      | "redo-result"
      | "scene-hierarchy"
      | "kernel-session"
      | "sculpt-artifact"
      | "rarity-proposal"
      | "command-progress";
    target: EditorCommandResultTarget;
  }>;
  refusals: readonly string[];
  undo: Readonly<{
    kind: "none" | "records-entry" | "consumes-entry" | "replays-entry";
    commandId: "edit-undo" | "edit-redo" | null;
  }>;
  inputSchema: JsonObject;
  inputShape:
    | "none"
    | "document"
    | "export"
    | "assistant"
    | "assistant-agent"
    | "job"
    | "migration-approval"
    | "scene-document"
    | "scene-selection"
    | "scene-property"
    | "scene-create"
    | "scene-remove"
    | "scene-reparent";
}>;

export type EditorCommandInvocation = Readonly<{
  schemaVersion: typeof EDITOR_COMMAND_SCHEMA_VERSION;
  commandId: EditorCommandId;
  client: EditorCommandClient;
  permission: EditorCommandPermission;
  profile?: "game" | "web" | "kids";
  input: JsonObject;
}>;

export type EditorCommandValidation =
  | Readonly<{
      ok: true;
      invocation: EditorCommandInvocation;
      command: EditorCommandDefinition;
    }>
  | Readonly<{
      ok: false;
      reason: EditorCommandRefusal | DesktopSceneHierarchyRefusal;
      message: string;
    }>;

export type EditorCommandProgress = Readonly<{
  phase: string;
  percent: number;
  message: string;
  terminal: boolean;
}>;

export type EditorCommandTerminalResult = Readonly<{
  commandId: EditorCommandId;
  jobId: string | null;
  status: "completed" | "cancelled" | "refused";
  progress: EditorCommandProgress;
  evidenceKind: EditorCommandDefinition["evidence"]["kind"];
  resultTarget: EditorCommandResultTarget;
  refusal: string | null;
}>;

export type EditorCommandTransactionResult = Readonly<{
  schemaVersion: typeof EDITOR_COMMAND_SCHEMA_VERSION;
  commandId: EditorCommandId;
  transactionId: string | null;
  status: "reviewing" | "completed" | "recovery-pending" | "refused";
  progress: EditorCommandProgress;
  evidence: Readonly<{
    kind: EditorCommandDefinition["evidence"]["kind"];
    target: EditorCommandResultTarget;
    documentPaths: readonly string[];
  }>;
  refusal: string | null;
  undo: EditorCommandDefinition["undo"];
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
        "@sceneaxi/profile-kids",
      ]),
    }),
  }),
}) satisfies JsonObject;

const exportInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "expectedContentHash"]),
  properties: Object.freeze({
    documentPath: Object.freeze({ type: "string", minLength: 1 }),
    expectedContentHash: Object.freeze({
      type: "string",
      pattern: "^sha256:[0-9a-f]{64}$",
    }),
  }),
}) satisfies JsonObject;

const assistantAgentInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["prompt", "profile", "documentPath"]),
  properties: Object.freeze({
    ...assistantInput.properties,
    documentPath: Object.freeze({ type: "string", minLength: 1 }),
  }),
}) satisfies JsonObject;

const jobInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["jobId"]),
  properties: Object.freeze({
    jobId: Object.freeze({ type: "string", minLength: 1 }),
  }),
}) satisfies JsonObject;

const migrationApprovalInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["approved", "proposalDigest"]),
  properties: Object.freeze({
    approved: Object.freeze({ const: true }),
    proposalDigest: Object.freeze({
      type: "string",
      pattern: "^sha256:[0-9a-f]{64}$",
    }),
  }),
}) satisfies JsonObject;

const sceneId = Object.freeze({
  type: "string",
  pattern: "^[a-z0-9][a-z0-9-]*$",
}) satisfies JsonObject;

const sceneIds = Object.freeze({
  type: "array",
  minItems: 1,
  maxItems: 32,
  uniqueItems: true,
  items: sceneId,
}) satisfies JsonObject;

const sceneProfile = Object.freeze({
  type: "string",
  enum: Object.freeze(["game", "web", "kids"]),
}) satisfies JsonObject;

const sceneDocumentInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "profile"]),
  properties: Object.freeze({
    documentPath: documentInput.properties.documentPath,
    profile: sceneProfile,
  }),
}) satisfies JsonObject;

const sceneSelectionInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "profile", "instanceIds"]),
  properties: Object.freeze({
    documentPath: documentInput.properties.documentPath,
    profile: sceneProfile,
    instanceIds: sceneIds,
  }),
}) satisfies JsonObject;

const sceneMutationProperties = Object.freeze({
  documentPath: documentInput.properties.documentPath,
  expectedContentHash: Object.freeze({ type: "string", pattern: "^sha256:[0-9a-f]{64}$" }),
  profile: sceneProfile,
});

const scenePropertyInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "expectedContentHash", "profile", "instanceId", "propertyId", "newValue"]),
  properties: Object.freeze({
    ...sceneMutationProperties,
    instanceId: sceneId,
    propertyId: Object.freeze({
      type: "string",
      pattern: "^(translation|rotation|scale)-[xyz]$",
    }),
    newValue: Object.freeze({ type: "number" }),
  }),
}) satisfies JsonObject;

const sceneCreateInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "expectedContentHash", "profile", "sourceInstanceId", "parentInstanceId"]),
  properties: Object.freeze({
    ...sceneMutationProperties,
    sourceInstanceId: sceneId,
    parentInstanceId: sceneId,
  }),
}) satisfies JsonObject;

const sceneRemoveInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "expectedContentHash", "profile", "instanceIds"]),
  properties: Object.freeze({ ...sceneMutationProperties, instanceIds: sceneIds }),
}) satisfies JsonObject;

const sceneReparentInput = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["documentPath", "expectedContentHash", "profile", "instanceId", "parentInstanceId", "transformPolicy"]),
  properties: Object.freeze({
    ...sceneMutationProperties,
    instanceId: sceneId,
    parentInstanceId: sceneId,
    transformPolicy: Object.freeze({
      type: "string",
      enum: Object.freeze(["preserve-world", "preserve-local"]),
    }),
  }),
}) satisfies JsonObject;

const CLIENTS = Object.freeze([...EDITOR_COMMAND_CLIENTS]);
const BASE_REFUSALS = Object.freeze([
  EDITOR_COMMAND_REFUSALS.clientDenied,
  EDITOR_COMMAND_REFUSALS.schemaUnsupported,
  EDITOR_COMMAND_REFUSALS.inputInvalid,
  EDITOR_COMMAND_REFUSALS.permissionDenied,
  EDITOR_COMMAND_REFUSALS.capabilityDenied,
  EDITOR_COMMAND_REFUSALS.kidsDenied,
]);
const HIERARCHY_BASE_REFUSALS = Object.freeze([
  EDITOR_COMMAND_REFUSALS.clientDenied,
  EDITOR_COMMAND_REFUSALS.schemaUnsupported,
  DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
  EDITOR_COMMAND_REFUSALS.permissionDenied,
  DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing,
  DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied,
  DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
]);

const immediate = (phases: readonly string[] = ["completed"]) =>
  Object.freeze({ kind: "immediate" as const, minimum: 0 as const, maximum: 100 as const, phases });
const bounded = (phases: readonly string[]) =>
  Object.freeze({ kind: "bounded" as const, minimum: 0 as const, maximum: 100 as const, phases });
const capability = (id: string) =>
  Object.freeze({ id, profiles: Object.freeze(["game", "web"] as const) });
const evidence = (
  kind: EditorCommandDefinition["evidence"]["kind"],
  target: EditorCommandResultTarget,
) => Object.freeze({ kind, target });
const undo = (
  kind: EditorCommandDefinition["undo"]["kind"],
  commandId: "edit-undo" | "edit-redo" | null = null,
) => Object.freeze({ kind, commandId });

function definition(
  row: EditorCommandDefinition,
): EditorCommandDefinition {
  return Object.freeze({
    ...row,
    acceptedClients: Object.freeze([...row.acceptedClients]),
    refusals: Object.freeze([...row.refusals]),
  });
}

const DEFINITIONS = [
  definition({
    schemaVersion: 1,
    id: "project-new",
    label: "New Project",
    acceptedClients: ["desktop-control"],
    permission: "project:write",
    capability: capability("project.lifecycle"),
    mutation: "commits-project",
    progress: immediate(),
    evidence: evidence("project-binding", "project"),
    refusals: [...BASE_REFUSALS, "DESKTOP_PROJECT_SELECTION_CANCELLED"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "project-inspect",
    label: "Inspect Project Version",
    acceptedClients: CLIENTS,
    permission: "project:read",
    capability: capability("project.inspect"),
    mutation: "none",
    progress: immediate(),
    evidence: evidence("project-inspection", "project"),
    refusals: [...BASE_REFUSALS, "PROJECT_MANIFEST_MALFORMED"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "project-migration-propose",
    label: "Propose Project Migration",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("project.migrate"),
    mutation: "stages-change",
    progress: immediate(["inspecting", "reviewing"]),
    evidence: evidence("project-migration-proposal", "change-review"),
    refusals: [...BASE_REFUSALS, "PROJECT_MIGRATION_CHAIN_INVALID", "PROJECT_MIGRATION_MUTATION_CONFLICT"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "project-migration-commit",
    label: "Commit Approved Project Migration",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("project.migrate"),
    mutation: "commits-project",
    progress: immediate(["approved", "prepared", "committed"]),
    evidence: evidence("project-migration-evidence", "project"),
    refusals: [...BASE_REFUSALS, "PROJECT_MIGRATION_APPROVAL_REQUIRED", "PROJECT_MIGRATION_APPROVAL_MISMATCH", "PROJECT_MIGRATION_SOURCE_CHANGED"],
    undo: undo("none"),
    inputSchema: migrationApprovalInput,
    inputShape: "migration-approval",
  }),
  definition({
    schemaVersion: 1,
    id: "project-migration-recover",
    label: "Recover Project Migration",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("project.migrate"),
    mutation: "commits-project",
    progress: immediate(["validating", "recovering", "committed"]),
    evidence: evidence("project-migration-evidence", "project"),
    refusals: [...BASE_REFUSALS, "PROJECT_MIGRATION_RECOVERY_INVALID", "PROJECT_MIGRATION_SOURCE_CHANGED"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "ship-export-web",
    label: "Export Web",
    acceptedClients: ["desktop-control"],
    permission: "project:read",
    capability: capability("delivery.export-web"),
    mutation: "none",
    progress: immediate(["validating", "writing", "verified"]),
    evidence: evidence("project-binding", "project"),
    refusals: [...BASE_REFUSALS, "DESKTOP_WEB_EXPORT_WRITE_FAILED"],
    undo: undo("none"),
    inputSchema: exportInput,
    inputShape: "export",
  }),
  definition({
    schemaVersion: 1,
    id: "project-open",
    label: "Open Project…",
    acceptedClients: ["desktop-control"],
    permission: "project:write",
    capability: capability("project.lifecycle"),
    mutation: "none",
    progress: immediate(),
    evidence: evidence("project-binding", "project"),
    refusals: [...BASE_REFUSALS, "DESKTOP_PROJECT_SELECTION_CANCELLED"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "project-save",
    label: "Save",
    acceptedClients: ["desktop-control"],
    permission: "project:write",
    capability: capability("authoring.change-review"),
    mutation: "commits-project",
    progress: immediate(),
    evidence: evidence("authoring-snapshot", "change-review"),
    refusals: [...BASE_REFUSALS, EDITOR_COMMAND_REFUSALS.staleBase, "DESKTOP_PROPOSAL_NOT_REVIEWING"],
    undo: undo("records-entry", "edit-undo"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "edit-undo",
    label: "Undo",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("authoring.undo"),
    mutation: "reverts-project",
    progress: immediate(),
    evidence: evidence("undo-result", "project"),
    refusals: [...BASE_REFUSALS, EDITOR_COMMAND_REFUSALS.invalidPhase, "DESKTOP_UNDO_UNAVAILABLE"],
    undo: undo("consumes-entry", "edit-redo"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "edit-redo",
    label: "Redo",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("authoring.redo"),
    mutation: "reverts-project",
    progress: immediate(["validating", "restoring", "completed"]),
    evidence: evidence("redo-result", "project"),
    refusals: [...BASE_REFUSALS, EDITOR_COMMAND_REFUSALS.invalidPhase, "DESKTOP_REDO_UNAVAILABLE"],
    undo: undo("replays-entry", "edit-undo"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "scene-hierarchy-inspect",
    label: "Inspect Scene Hierarchy",
    acceptedClients: CLIENTS,
    permission: "project:read",
    capability: capability("scene.compose"),
    mutation: "none",
    progress: immediate(["inspecting", "completed"]),
    evidence: evidence("scene-hierarchy", "project"),
    refusals: [
      ...HIERARCHY_BASE_REFUSALS,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
      "DESKTOP_SCENE_NOT_COMPOSABLE",
    ],
    undo: undo("none"),
    inputSchema: sceneDocumentInput,
    inputShape: "scene-document",
  }),
  definition({
    schemaVersion: 1,
    id: "scene-selection-set",
    label: "Set Ordered Scene Selection",
    acceptedClients: CLIENTS,
    permission: "project:read",
    capability: capability("scene.compose"),
    mutation: "none",
    progress: immediate(),
    evidence: evidence("scene-hierarchy", "project"),
    refusals: [
      ...HIERARCHY_BASE_REFUSALS,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    ],
    undo: undo("none"),
    inputSchema: sceneSelectionInput,
    inputShape: "scene-selection",
  }),
  definition({
    schemaVersion: 1,
    id: "scene-property-set",
    label: "Set Scene Object Property",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("scene.compose"),
    mutation: "stages-change",
    progress: immediate(["validating", "reviewing"]),
    evidence: evidence("scene-hierarchy", "change-review"),
    refusals: [
      ...HIERARCHY_BASE_REFUSALS,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    ],
    undo: undo("none"),
    inputSchema: scenePropertyInput,
    inputShape: "scene-property",
  }),
  definition({
    schemaVersion: 1,
    id: "scene-object-create",
    label: "Create Scene Object",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("scene.compose"),
    mutation: "stages-change",
    progress: immediate(["validating", "reviewing"]),
    evidence: evidence("scene-hierarchy", "change-review"),
    refusals: [
      ...HIERARCHY_BASE_REFUSALS,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.parentMissing,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    ],
    undo: undo("none"),
    inputSchema: sceneCreateInput,
    inputShape: "scene-create",
  }),
  definition({
    schemaVersion: 1,
    id: "scene-object-remove",
    label: "Remove Scene Objects",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("scene.compose"),
    mutation: "stages-change",
    progress: immediate(["validating", "reviewing"]),
    evidence: evidence("scene-hierarchy", "change-review"),
    refusals: [
      ...HIERARCHY_BASE_REFUSALS,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    ],
    undo: undo("none"),
    inputSchema: sceneRemoveInput,
    inputShape: "scene-remove",
  }),
  definition({
    schemaVersion: 1,
    id: "scene-object-reparent",
    label: "Reparent Scene Object",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("scene.compose"),
    mutation: "stages-change",
    progress: immediate(["validating", "reviewing"]),
    evidence: evidence("scene-hierarchy", "change-review"),
    refusals: [
      ...HIERARCHY_BASE_REFUSALS,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.cycle,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.parentMissing,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid,
    ],
    undo: undo("none"),
    inputSchema: sceneReparentInput,
    inputShape: "scene-reparent",
  }),
  definition({
    schemaVersion: 1,
    id: "run-play",
    label: "Play",
    acceptedClients: CLIENTS,
    permission: "project:read",
    capability: capability("runtime.play"),
    mutation: "none",
    progress: immediate(["opening", "advancing", "closed"]),
    evidence: evidence("kernel-session", "live-viewport"),
    refusals: [
      ...BASE_REFUSALS,
      "DESKTOP_SCENE_NOT_COMPOSABLE",
      DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
    ],
    undo: undo("none"),
    inputSchema: documentInput,
    inputShape: "document",
  }),
  definition({
    schemaVersion: 1,
    id: "change-review-accept",
    label: "Accept proposal",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("authoring.change-review"),
    mutation: "commits-project",
    progress: immediate(),
    evidence: evidence("authoring-snapshot", "change-review"),
    refusals: [...BASE_REFUSALS, EDITOR_COMMAND_REFUSALS.staleBase, "DESKTOP_PROPOSAL_NOT_REVIEWING"],
    undo: undo("records-entry", "edit-undo"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "change-review-reject",
    label: "Reject proposal",
    acceptedClients: CLIENTS,
    permission: "project:write",
    capability: capability("authoring.change-review"),
    mutation: "none",
    progress: immediate(),
    evidence: evidence("authoring-snapshot", "change-review"),
    refusals: [...BASE_REFUSALS, "DESKTOP_PROPOSAL_NOT_REVIEWING"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "assistant-local-build",
    label: "Local Assistant Build",
    acceptedClients: CLIENTS,
    permission: "assistant:run",
    capability: capability("assistant.build.local"),
    mutation: "none",
    progress: bounded(["accepted", "generating-local", "validating-artifact", "ready", "cancelled"]),
    evidence: evidence("sculpt-artifact", "live-viewport"),
    refusals: [...BASE_REFUSALS, "DESKTOP_ASSISTANT_BUSY", "ASSISTANT_SCULPT_PROMPT_INVALID"],
    undo: undo("none"),
    inputSchema: assistantInput,
    inputShape: "assistant",
  }),
  definition({
    schemaVersion: 1,
    id: "assistant-byo-build",
    label: "BYOK Assistant Build",
    acceptedClients: CLIENTS,
    permission: "assistant:run",
    capability: capability("assistant.build.byo"),
    mutation: "none",
    progress: bounded(["accepted", "waiting-provider", "streaming-provider", "validating-artifact", "ready", "cancelled"]),
    evidence: evidence("sculpt-artifact", "live-viewport"),
    refusals: [...BASE_REFUSALS, "DESKTOP_ASSISTANT_BUSY", "DESKTOP_ASSISTANT_BYO_UNAVAILABLE"],
    undo: undo("none"),
    inputSchema: assistantInput,
    inputShape: "assistant",
  }),
  definition({
    schemaVersion: 1,
    id: "assistant-local-agent",
    label: "Bounded Local Agent",
    acceptedClients: CLIENTS,
    permission: "assistant:run",
    capability: capability("assistant.agent.bounded"),
    mutation: "stages-change",
    progress: bounded(["accepted", "waiting-provider", "validating-artifact", "ready", "cancelled"]),
    evidence: evidence("rarity-proposal", "change-review"),
    refusals: [...BASE_REFUSALS, "DESKTOP_ASSISTANT_BUSY", "DESKTOP_RARITY_PROVIDER_UNAVAILABLE"],
    undo: undo("none"),
    inputSchema: assistantAgentInput,
    inputShape: "assistant-agent",
  }),
  definition({
    schemaVersion: 1,
    id: "assistant-status",
    label: "Assistant status",
    acceptedClients: CLIENTS,
    permission: "assistant:read",
    capability: capability("assistant.progress"),
    mutation: "none",
    progress: bounded(["running", "completed", "cancelled", "refused"]),
    evidence: evidence("command-progress", "none"),
    refusals: [...BASE_REFUSALS, "DESKTOP_ASSISTANT_JOB_MISSING"],
    undo: undo("none"),
    inputSchema: noInput,
    inputShape: "none",
  }),
  definition({
    schemaVersion: 1,
    id: "assistant-cancel",
    label: "Cancel active command",
    acceptedClients: CLIENTS,
    permission: "assistant:run",
    capability: capability("assistant.cancel"),
    mutation: "none",
    progress: bounded(["cancelling", "cancelled", "completed", "refused"]),
    evidence: evidence("command-progress", "none"),
    refusals: [...BASE_REFUSALS, EDITOR_COMMAND_REFUSALS.activeJobMismatch],
    undo: undo("none"),
    inputSchema: jobInput,
    inputShape: "job",
  }),
] as const satisfies readonly EditorCommandDefinition[];

function registryError(message: string): never {
  throw new Error(`${EDITOR_COMMAND_REFUSALS.registryInvalid}: ${message}`);
}

/** Validate and freeze a registry. Exported so duplicate/drift failure is testable. */
export function defineEditorCommandRegistry(
  definitions: readonly EditorCommandDefinition[],
): readonly EditorCommandDefinition[] {
  const ids = new Set<string>();
  for (const command of definitions) {
    if (ids.has(command.id)) registryError(`duplicate command id ${command.id}`);
    ids.add(command.id);
    if (command.schemaVersion !== EDITOR_COMMAND_SCHEMA_VERSION) {
      registryError(`${command.id} has incompatible schema version ${String(command.schemaVersion)}`);
    }
    if (command.acceptedClients.length === 0 ||
      !command.acceptedClients.every((client) => EDITOR_COMMAND_CLIENTS.includes(client)) ||
      new Set(command.acceptedClients).size !== command.acceptedClients.length) {
      registryError(`${command.id} has invalid accepted clients`);
    }
    if (!EDITOR_COMMAND_PERMISSIONS.includes(command.permission)) {
      registryError(`${command.id} has an invalid permission`);
    }
    if (command.capability.profiles.includes("kids" as never)) {
      registryError(`${command.id} must not activate Kids`);
    }
    if (command.progress.minimum !== 0 || command.progress.maximum !== 100 ||
      command.progress.phases.length === 0) {
      registryError(`${command.id} has an invalid bounded progress declaration`);
    }
  }
  return Object.freeze([...definitions]);
}

export const EDITOR_COMMAND_REGISTRY = defineEditorCommandRegistry(DEFINITIONS);

export function editorCommand(
  id: unknown,
): EditorCommandDefinition | undefined {
  return EDITOR_COMMAND_REGISTRY.find((command) => command.id === id);
}

function exactKeys(value: JsonObject, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && allowed.every((key) => Object.hasOwn(value, key));
}

/**
 * Command envelopes cross browser/host and local-socket structured-clone
 * boundaries. Their plain-object prototype can therefore come from another
 * realm; validate their own data properties instead of comparing prototypes.
 */
function isCommandObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
  });
}

function profileInput(input: JsonObject): boolean {
  return typeof input["prompt"] === "string" && input["prompt"].trim().length > 0 &&
    (input["profile"] === "@sceneaxi/profile-game" ||
      input["profile"] === "@sceneaxi/profile-web" ||
      input["profile"] === "@sceneaxi/profile-kids");
}

function sceneDocumentFields(input: JsonObject): boolean {
  return typeof input["documentPath"] === "string" && input["documentPath"].length > 0;
}

function sceneProfileField(input: JsonObject): boolean {
  return input["profile"] === "kids" || isDesktopSceneEditProfile(input["profile"]);
}

function sceneMutationFields(input: JsonObject): boolean {
  return sceneDocumentFields(input) &&
    typeof input["expectedContentHash"] === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(input["expectedContentHash"]) &&
    sceneProfileField(input);
}

export function validateEditorCommandInput(
  command: EditorCommandDefinition,
  input: unknown,
): input is JsonObject {
  if (!isCommandObject(input)) return false;
  switch (command.inputShape) {
    case "none":
      return exactKeys(input, []);
    case "document":
      return exactKeys(input, ["documentPath"]) &&
        typeof input["documentPath"] === "string" && input["documentPath"].length > 0;
    case "export":
      return exactKeys(input, ["documentPath", "expectedContentHash"]) &&
        typeof input["documentPath"] === "string" && input["documentPath"].length > 0 &&
        typeof input["expectedContentHash"] === "string" &&
        /^sha256:[0-9a-f]{64}$/.test(input["expectedContentHash"]);
    case "assistant":
      return exactKeys(input, ["prompt", "profile"]) && profileInput(input);
    case "assistant-agent":
      return exactKeys(input, ["prompt", "profile", "documentPath"]) &&
        profileInput(input) && typeof input["documentPath"] === "string" &&
        input["documentPath"].length > 0;
    case "job":
      return exactKeys(input, ["jobId"]) &&
        typeof input["jobId"] === "string" && input["jobId"].length > 0;
    case "migration-approval":
      return exactKeys(input, ["approved", "proposalDigest"]) &&
        input["approved"] === true && typeof input["proposalDigest"] === "string" &&
        /^sha256:[0-9a-f]{64}$/.test(input["proposalDigest"]);
    case "scene-document":
      return exactKeys(input, ["documentPath", "profile"]) &&
        sceneDocumentFields(input) && sceneProfileField(input);
    case "scene-selection":
      return exactKeys(input, ["documentPath", "profile", "instanceIds"]) &&
        sceneDocumentFields(input) && sceneProfileField(input) &&
        isDesktopSceneSelectionInput(input["instanceIds"]);
    case "scene-property":
      return exactKeys(input, ["documentPath", "expectedContentHash", "profile", "instanceId", "propertyId", "newValue"]) &&
        sceneMutationFields(input) && isDesktopSceneEditOperation({
          kind: "set-transform-component",
          instanceId: input["instanceId"],
          propertyId: input["propertyId"],
          value: input["newValue"],
        });
    case "scene-create":
      return exactKeys(input, ["documentPath", "expectedContentHash", "profile", "sourceInstanceId", "parentInstanceId"]) &&
        sceneMutationFields(input) && isDesktopSceneEditOperation({
          kind: "create-object",
          sourceInstanceId: input["sourceInstanceId"],
          parentInstanceId: input["parentInstanceId"],
        });
    case "scene-remove":
      return exactKeys(input, ["documentPath", "expectedContentHash", "profile", "instanceIds"]) &&
        sceneMutationFields(input) && isDesktopSceneEditOperation({
          kind: "remove-objects",
          instanceIds: input["instanceIds"],
        });
    case "scene-reparent":
      return exactKeys(input, ["documentPath", "expectedContentHash", "profile", "instanceId", "parentInstanceId", "transformPolicy"]) &&
        sceneMutationFields(input) && isDesktopSceneEditOperation({
          kind: "reparent-object",
          instanceId: input["instanceId"],
          parentInstanceId: input["parentInstanceId"],
          transformPolicy: input["transformPolicy"],
        });
  }
}

const refusal = (
  reason: EditorCommandRefusal | DesktopSceneHierarchyRefusal,
  message: string,
): EditorCommandValidation => Object.freeze({ ok: false as const, reason, message });

/** Fail-closed validation performed before any command handler is selected. */
export function validateEditorCommandInvocation(
  value: unknown,
): EditorCommandValidation {
  if (!isCommandObject(value)) {
    return refusal(EDITOR_COMMAND_REFUSALS.inputInvalid, "A command invocation must be an object.");
  }
  const requestedCommand = editorCommand(value["commandId"]);
  const requestedHierarchyCommand = requestedCommand?.id.startsWith("scene-") === true;
  const invocationKeys = ["schemaVersion", "commandId", "client", "permission", "profile", "input"];
  if (Object.keys(value).some((key) => !invocationKeys.includes(key))) {
    return refusal(
      requestedHierarchyCommand
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported
        : EDITOR_COMMAND_REFUSALS.inputInvalid,
      "A command invocation has unknown fields.",
    );
  }
  const schemaVersion = value["schemaVersion"];
  if (schemaVersion !== EDITOR_COMMAND_SCHEMA_VERSION) {
    return refusal(
      EDITOR_COMMAND_REFUSALS.schemaUnsupported,
      `Editor command schema version ${String(schemaVersion)} is unsupported.`,
    );
  }
  const command = requestedCommand;
  if (command === undefined) {
    return refusal(EDITOR_COMMAND_REFUSALS.commandUnknown, "The editor command is not registered.");
  }
  const hierarchyCommand = command.id.startsWith("scene-");
  const client = value["client"];
  if (!EDITOR_COMMAND_CLIENTS.some((candidate) => candidate === client) ||
    !command.acceptedClients.some((candidate) => candidate === client)) {
    return refusal(
      EDITOR_COMMAND_REFUSALS.clientDenied,
      `${command.id} is not exposed to client ${String(client)}.`,
    );
  }
  if (value["permission"] !== command.permission) {
    return refusal(
      EDITOR_COMMAND_REFUSALS.permissionDenied,
      `${command.id} requires permission ${command.permission}.`,
    );
  }
  const profile = value["profile"];
  if (profile !== undefined && profile !== "game" && profile !== "web" && profile !== "kids") {
    return refusal(
      hierarchyCommand
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported
        : EDITOR_COMMAND_REFUSALS.inputInvalid,
      "The editor command profile is invalid.",
    );
  }
  if (profile === "kids") {
    return refusal(
      hierarchyCommand
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied
        : EDITOR_COMMAND_REFUSALS.kidsDenied,
      `${command.id} is denied for Kids before execution.`,
    );
  }
  const input = value["input"];
  if (!validateEditorCommandInput(command, input)) {
    return refusal(
      hierarchyCommand
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported
        : EDITOR_COMMAND_REFUSALS.inputInvalid,
      `Input does not match the registered schema for ${command.id}.`,
    );
  }
  if (input["profile"] === "@sceneaxi/profile-kids") {
    return refusal(
      EDITOR_COMMAND_REFUSALS.kidsDenied,
      `${command.id} is denied for @sceneaxi/profile-kids before execution.`,
    );
  }
  if (input["profile"] === "kids") {
    return refusal(
      hierarchyCommand
        ? DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied
        : EDITOR_COMMAND_REFUSALS.kidsDenied,
      `${command.id} is denied for Kids before execution.`,
    );
  }
  if (hierarchyCommand && profile !== input["profile"]) {
    return refusal(
      DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
      `${command.id} requires one matching explicit invocation and input profile.`,
    );
  }
  return Object.freeze({
    ok: true as const,
    invocation: value as EditorCommandInvocation,
    command,
  });
}

export function createEditorCommandInvocation(
  commandId: EditorCommandId,
  client: EditorCommandClient,
  input: JsonObject,
  profile?: "game" | "web" | "kids",
): EditorCommandInvocation {
  const command = editorCommand(commandId);
  if (command === undefined) registryError(`invocation names unknown command ${commandId}`);
  const inputProfile = input["profile"];
  const carriedProfile = profile ?? (command.id.startsWith("scene-") &&
    (inputProfile === "game" || inputProfile === "web" || inputProfile === "kids")
    ? inputProfile
    : undefined);
  const invocation = Object.freeze({
    schemaVersion: EDITOR_COMMAND_SCHEMA_VERSION,
    commandId,
    client,
    permission: command.permission,
    ...(carriedProfile === undefined ? {} : { profile: carriedProfile }),
    input,
  });
  const validated = validateEditorCommandInvocation(invocation);
  if (!validated.ok) {
    // Kids denial belongs to the execution boundary. Construction must still
    // carry the valid invocation there so every client observes the same named
    // refusal instead of translating it into an internal transport error.
    if (
      validated.reason === EDITOR_COMMAND_REFUSALS.kidsDenied ||
      validated.reason === DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied
    ) {
      return invocation;
    }
    registryError(validated.message);
  }
  return validated.invocation;
}

export function editorCommandTerminalResult(input: Readonly<{
  commandId: EditorCommandId;
  jobId?: string;
  status: EditorCommandTerminalResult["status"];
  phase: string;
  message: string;
  refusal?: string;
}>): EditorCommandTerminalResult {
  const command = editorCommand(input.commandId);
  if (command === undefined) registryError(`terminal result names unknown command ${input.commandId}`);
  return Object.freeze({
    commandId: input.commandId,
    jobId: input.jobId ?? null,
    status: input.status,
    progress: Object.freeze({
      phase: input.phase,
      percent: 100,
      message: input.message,
      terminal: true,
    }),
    evidenceKind: command.evidence.kind,
    resultTarget: command.evidence.target,
    refusal: input.refusal ?? null,
  });
}

export function editorCommandTransactionResult(input: Readonly<{
  commandId: EditorCommandId;
  transactionId?: string;
  status: EditorCommandTransactionResult["status"];
  phase: string;
  percent: number;
  message: string;
  terminal: boolean;
  documentPaths?: readonly string[];
  refusal?: string;
}>): EditorCommandTransactionResult {
  const command = editorCommand(input.commandId);
  if (command === undefined) registryError(`transaction result names unknown command ${input.commandId}`);
  if (!Number.isFinite(input.percent) || input.percent < 0 || input.percent > 100) {
    registryError(`transaction result for ${input.commandId} has unbounded progress`);
  }
  return Object.freeze({
    schemaVersion: EDITOR_COMMAND_SCHEMA_VERSION,
    commandId: input.commandId,
    transactionId: input.transactionId ?? null,
    status: input.status,
    progress: Object.freeze({
      phase: input.phase,
      percent: input.percent,
      message: input.message,
      terminal: input.terminal,
    }),
    evidence: Object.freeze({
      kind: command.evidence.kind,
      target: command.evidence.target,
      documentPaths: Object.freeze([...(input.documentPaths ?? [])]),
    }),
    refusal: input.refusal ?? null,
    undo: command.undo,
  });
}
