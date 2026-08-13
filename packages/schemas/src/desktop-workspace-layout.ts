/**
 * Versioned dock/workspace layouts stored outside the Scene Document.
 * Corrupt bytes recover to a named default without silent overwrite.
 */
import { digestSculptJson } from "./sculpt-json.js";

export const WORKSPACE_LAYOUT_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_LAYOUT_KIND = "sceneaxi.workspace-layout" as const;
export const WORKSPACE_LAYOUT_DEFAULT_ID = "default" as const;

export const WORKSPACE_LAYOUT_REFUSALS = Object.freeze({
  kidsDenied: "WORKSPACE_LAYOUT_KIDS_DENIED",
  inputUnsupported: "WORKSPACE_LAYOUT_INPUT_UNSUPPORTED",
  corrupt: "WORKSPACE_LAYOUT_CORRUPT",
  staleVersion: "WORKSPACE_LAYOUT_STALE_VERSION",
  offscreen: "WORKSPACE_LAYOUT_OFFSCREEN",
  capabilityMissing: "WORKSPACE_LAYOUT_CAPABILITY_MISSING",
} as const);

export type WorkspaceLayoutRefusal =
  (typeof WORKSPACE_LAYOUT_REFUSALS)[keyof typeof WORKSPACE_LAYOUT_REFUSALS];

export type WorkspaceLayout = Readonly<{
  schemaVersion: typeof WORKSPACE_LAYOUT_SCHEMA_VERSION;
  kind: typeof WORKSPACE_LAYOUT_KIND;
  layoutId: string;
  leftVisible: boolean;
  inspectorVisible: boolean;
  assistantVisible: boolean;
  dockHeight: number;
  documentUndo: false;
}>;

type Failure = Readonly<{ ok: false; reason: WorkspaceLayoutRefusal; message: string }>;
const fail = (reason: WorkspaceLayoutRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function defaultWorkspaceLayout(): WorkspaceLayout {
  return Object.freeze({
    schemaVersion: 1,
    kind: WORKSPACE_LAYOUT_KIND,
    layoutId: WORKSPACE_LAYOUT_DEFAULT_ID,
    leftVisible: true,
    inspectorVisible: true,
    assistantVisible: true,
    dockHeight: 228,
    documentUndo: false,
  });
}

export function parseWorkspaceLayout(value: unknown):
  | Readonly<{ ok: true; layout: WorkspaceLayout; recovered: false }>
  | Readonly<{ ok: true; layout: WorkspaceLayout; recovered: true; reason: WorkspaceLayoutRefusal }>
  | Failure {
  if (value === undefined || value === null) {
    return Object.freeze({
      ok: true as const,
      layout: defaultWorkspaceLayout(),
      recovered: true as const,
      reason: WORKSPACE_LAYOUT_REFUSALS.corrupt,
    });
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({
      ok: true as const,
      layout: defaultWorkspaceLayout(),
      recovered: true as const,
      reason: WORKSPACE_LAYOUT_REFUSALS.corrupt,
    });
  }
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || record["kind"] !== WORKSPACE_LAYOUT_KIND) {
    return Object.freeze({
      ok: true as const,
      layout: defaultWorkspaceLayout(),
      recovered: true as const,
      reason: WORKSPACE_LAYOUT_REFUSALS.staleVersion,
    });
  }
  if (typeof record["dockHeight"] !== "number" || record["dockHeight"] < 80 || record["dockHeight"] > 720) {
    return Object.freeze({
      ok: true as const,
      layout: defaultWorkspaceLayout(),
      recovered: true as const,
      reason: WORKSPACE_LAYOUT_REFUSALS.offscreen,
    });
  }
  return Object.freeze({
    ok: true as const,
    layout: Object.freeze({
      schemaVersion: 1 as const,
      kind: WORKSPACE_LAYOUT_KIND,
      layoutId: typeof record["layoutId"] === "string" && record["layoutId"].length > 0
        ? record["layoutId"]
        : WORKSPACE_LAYOUT_DEFAULT_ID,
      leftVisible: record["leftVisible"] !== false,
      inspectorVisible: record["inspectorVisible"] !== false,
      assistantVisible: record["assistantVisible"] !== false,
      dockHeight: record["dockHeight"],
      documentUndo: false as const,
    }),
    recovered: false as const,
  });
}

export function applyWorkspaceLayoutMutation(input: Readonly<{
  layout: WorkspaceLayout;
  profile: unknown;
  mutation:
    | Readonly<{ kind: "set"; next: Partial<Pick<WorkspaceLayout, "leftVisible" | "inspectorVisible" | "assistantVisible" | "dockHeight" | "layoutId">> }>
    | Readonly<{ kind: "reset" }>;
}>):
  | Readonly<{ ok: true; layout: WorkspaceLayout }>
  | Failure {
  if (input.profile === "kids" || input.profile === "@sceneaxi/profile-kids") {
    return fail(WORKSPACE_LAYOUT_REFUSALS.kidsDenied, "Workspace layouts cannot restore editor chrome on Kids.");
  }
  if (input.mutation.kind === "reset") {
    return Object.freeze({ ok: true as const, layout: defaultWorkspaceLayout() });
  }
  const nextHeight = input.mutation.next.dockHeight ?? input.layout.dockHeight;
  if (nextHeight < 80 || nextHeight > 720) {
    return fail(WORKSPACE_LAYOUT_REFUSALS.offscreen, "A dock height outside 80–720 recovers instead of writing.");
  }
  return Object.freeze({
    ok: true as const,
    layout: Object.freeze({
      ...input.layout,
      ...input.mutation.next,
      dockHeight: nextHeight,
      documentUndo: false as const,
      schemaVersion: 1 as const,
      kind: WORKSPACE_LAYOUT_KIND,
    }),
  });
}

export function inspectWorkspaceLayout(layout: WorkspaceLayout) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.workspace-layout-inspection",
    layout,
    documentUndo: false as const,
    digest: digestSculptJson(layout),
  });
}
