/**
 * The desktop bridge contract: one IPC channel, one request/response envelope.
 *
 * This is the narrow adapter seam between the Engine Desktop chrome (rendered by
 * `@sceneaxi/desktop-shell`, whose visual model this app deliberately does not
 * duplicate) and the real engine stack running in the Electron main process. The
 * shape mirrors web-shell's `InspectorApp.handle()`: a synchronous, transport-free
 * `handle(request)` that the Electron layer adapts in a few lines, so everything
 * the bridge decides is provable in `pnpm gate` with no Electron install.
 *
 * Fail-closed: an unknown action or a malformed request refuses by name; upstream
 * refusals (composition, orchestrator, authoring) pass through carrying their own
 * reason rather than being rewrapped into a second vocabulary.
 */
import type {
  AssistantSculptProgress,
  AssistantSculptSuccess,
  SafeRarityEvidence,
} from "@sceneaxi/authoring-core";
import { EDITOR_SHELL_ASSISTANT_MODE_IDS } from "@sceneaxi/schemas";
import type {
  EditorCommandDefinition,
  EditorCommandId,
  EditorCommandTerminalResult,
  EditorCommandTransactionResult,
} from "@sceneaxi/schemas";
import type { MountableScene } from "@sceneaxi/site-kit";
import type { DesktopSnapshot } from "@sceneaxi/desktop-shell";

/** The one IPC channel the preload exposes and the main process serves. */
export const DESKTOP_BRIDGE_CHANNEL = "sceneaxi:desktop-bridge";
export const DESKTOP_ASSET_IMPORT_CHANNEL = "sceneaxi:desktop-asset-import";

export const DESKTOP_VIEWPORT_PLAY_EVENT = "sceneaxi:desktop-viewport-play";
export const DESKTOP_VIEWPORT_SCENE_OPEN_EVENT = "sceneaxi:desktop-viewport-scene-open";
export const DESKTOP_RARITY_PROPOSAL_EVENT = "sceneaxi:desktop-rarity-proposal";

export const DESKTOP_ACTIVE_DOCUMENT_PATH = "scene.json";
export const DESKTOP_RARITY_EVENT_ID = "wayfinder-drop-001" as const;

/**
 * The chrome meta the renderer updates from the real frame report. Lives here —
 * not in `chrome-document.ts` — because this module is the browser-safe half of
 * the seam: the renderer bundle may not pull the Node-bearing chrome emitter.
 */
export const PIXELS_META_NAME = "sceneaxi-pixels-drawn";

/** Property name the preload script exposes the bridge under in the renderer. */
export const DESKTOP_BRIDGE_GLOBAL = "sceneaxiDesktopLinux";

export const DESKTOP_BRIDGE_ACTIONS = Object.freeze([
  "handshake",
  "profile",
  "command",
  "scene",
  "project-browser-open",
  "open-path",
  "asset-import",
  "ship",
  "assistant",
  "authoring",
  "frame-report",
] as const);

export type DesktopBridgeAction = (typeof DESKTOP_BRIDGE_ACTIONS)[number];

/**
 * Refusals the desktop runtime seam can mint. Upstream reasons (for example
 * `DESKTOP_SCENE_NOT_COMPOSABLE` or an orchestrator `OPEN_PATH_*` reason) travel
 * through the same envelope under their own names.
 */
export const DESKTOP_BRIDGE_REFUSALS = Object.freeze({
  actionUnknown: "DESKTOP_BRIDGE_ACTION_UNKNOWN",
  requestMalformed: "DESKTOP_BRIDGE_REQUEST_MALFORMED",
  authoringOpUnknown: "DESKTOP_BRIDGE_AUTHORING_OP_UNKNOWN",
  assistantOpUnknown: "DESKTOP_BRIDGE_ASSISTANT_OP_UNKNOWN",
  assistantBusy: "DESKTOP_ASSISTANT_BUSY",
  assistantAbandoned: "DESKTOP_ASSISTANT_ABANDONED",
  assistantBuildModeRequired: "DESKTOP_ASSISTANT_BUILD_MODE_REQUIRED",
  assistantJobMissing: "DESKTOP_ASSISTANT_JOB_MISSING",
  assistantJobMismatch: "EDITOR_COMMAND_ACTIVE_JOB_MISMATCH",
  assistantStatusTimeout: "DESKTOP_ASSISTANT_STATUS_TIMEOUT",
  assistantRuntimeFailed: "DESKTOP_ASSISTANT_RUNTIME_FAILED",
  assistantByoUnavailable: "DESKTOP_ASSISTANT_BYO_UNAVAILABLE",
  assistantHostedMeteringUnavailable:
    "DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE",
  rarityProviderUnavailable: "DESKTOP_RARITY_PROVIDER_UNAVAILABLE",
  /**
   * No presentation runtime owns the window canvas, so nothing can be mounted.
   *
   * Mirrors `DESKTOP_VISUAL_REFUSALS.noPresentationRuntime` from the shell's
   * visual model on purpose: the renderer bundle is browser-only and may not
   * pull the Node-bearing shell barrel, but the chrome emits one refusal
   * paragraph per registry code, so a control the renderer turns inert has to
   * name a code whose `aria-describedby` still resolves in that document. The
   * two are kept in lockstep by `tests/desktop/desktop-linux-seams.test.ts`.
   */
  presentationRuntimeUnavailable: "DESKTOP_NO_PRESENTATION_RUNTIME",
} as const);

export type DesktopBridgeRefusalReason =
  | (typeof DESKTOP_BRIDGE_REFUSALS)[keyof typeof DESKTOP_BRIDGE_REFUSALS]
  | string;

export type DesktopBridgeRequest = {
  readonly action: DesktopBridgeAction;
  readonly payload?: unknown;
};

export type DesktopBridgeRefusal = {
  readonly ok: false;
  readonly reason: DesktopBridgeRefusalReason;
  readonly message: string;
  /** Upstream detail when one exists; always present so callers never branch on shape. */
  readonly detail: string | null;
  readonly transaction?: EditorCommandTransactionResult;
};

export type DesktopBridgeOk<T = unknown> = {
  readonly ok: true;
  readonly action: DesktopBridgeAction;
  readonly data: T;
};

export type DesktopBridgeResponse<T = unknown> = DesktopBridgeOk<T> | DesktopBridgeRefusal;

/** Authoring operations the bridge forwards to the shared desktop-shell session. */
export const DESKTOP_BRIDGE_AUTHORING_OPS = Object.freeze([
  "status",
  "propose",
  "edit-scene",
  "edit-property",
  "accept",
  "reject",
  "recover",
  "restart",
  "undo",
  "redo",
] as const);

export type DesktopBridgeAuthoringOp = (typeof DESKTOP_BRIDGE_AUTHORING_OPS)[number];

/** Safe rarity fields allowed across preload, renderer, and local inspection surfaces. */
export type DesktopRarityEvidence = SafeRarityEvidence;

export const DESKTOP_BRIDGE_ASSISTANT_OPS = Object.freeze([
  "start",
  "status",
  "abandon",
] as const);

export type DesktopBridgeAssistantOp =
  (typeof DESKTOP_BRIDGE_ASSISTANT_OPS)[number];

export const DESKTOP_ASSISTANT_START_MODES = EDITOR_SHELL_ASSISTANT_MODE_IDS;

export type DesktopAssistantStartMode =
  (typeof DESKTOP_ASSISTANT_START_MODES)[number];

export const DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE =
  "Choose Ask to inspect typed project state, Build for a Sculpt Artifact, or Agent for a fixture-backed rarity proposal.";

export function desktopAssistantStartMode(
  value: unknown,
): DesktopAssistantStartMode | null {
  return DESKTOP_ASSISTANT_START_MODES.find((mode) => mode === value) ?? null;
}

export type DesktopAssistantMountedResult = Omit<AssistantSculptSuccess, "artifact"> &
  Readonly<{
    mountable: MountableScene;
    providerClass?: "none" | "configured";
    fallbackPolicy?: "none";
  }>;

export type DesktopRarityRetirementReason =
  | "session-restarted"
  | "undo"
  | "namespace-replaced"
  | "document-missing";

/**
 * An Agent run either staged a canonical diff or replayed an event the project
 * already accepted. `replayed` is what tells the two apart, and a replay carries
 * no `authoring` snapshot at all: nothing was staged, so there is no proposal to
 * attach and no unrelated in-flight review to stamp this evidence onto.
 */
export type DesktopRarityProposalResult = Readonly<{
  ok: true;
  kind: "rarity-proposal";
  replayed: boolean;
  providerClass?: "fixture";
  evidence: DesktopRarityEvidence;
  authoring?: DesktopSnapshot & Readonly<{ rarityEvidence: DesktopRarityEvidence }>;
  retirement?: Readonly<{ reason: DesktopRarityRetirementReason }>;
}>;

export type DesktopAssistantAskResult = Readonly<{
  ok: true;
  kind: "sceneaxi.assistant-ask-answer";
  sourceContentHash: string;
  scope: string;
  savedBytesWritten: false;
  providerClass: "none";
  answer: string;
  evidence: unknown;
  digest: string;
}>;

export type DesktopAssistantResult =
  | DesktopAssistantMountedResult
  | DesktopRarityProposalResult
  | DesktopAssistantAskResult;

export type DesktopAssistantJobSnapshot = Readonly<{
  jobId: string;
  commandId: Extract<EditorCommandId,
    | "assistant-ask"
    | "assistant-local-build"
    | "assistant-byo-build"
    | "assistant-local-agent">;
  route: "local" | "byo";
  status: "running" | "ready" | "refused";
  /**
   * The newest progress entry only, never the accumulated log.
   *
   * A status poll runs every 50ms while a streaming BYOK route can report one
   * entry per provider chunk, each carrying its raw delta. `progressCount` is
   * what a caller needs to see that work is still moving.
   */
  latestProgress: AssistantSculptProgress | null;
  /** How many progress entries the job has observed so far. */
  progressCount: number;
  /** Registered terminal command result; null while this exact job is running. */
  terminal: EditorCommandTerminalResult | null;
  result?: DesktopAssistantResult;
  refusal?: Readonly<{
    ok: false;
    reason: string;
    message: string;
    recoverable: boolean;
    detail?: string;
  }>;
}>;

/** What `handshake` reports: identity, never capability it cannot prove. */
export type DesktopBridgeHandshake = {
  readonly app: "@sceneaxi/desktop-linux";
  readonly runtime: "electron";
  readonly bridgeVersion: 1;
  readonly actions: readonly DesktopBridgeAction[];
  readonly commandSchemaVersion: 1;
  readonly commands: readonly EditorCommandDefinition[];
};

/** A real presentation frame report as forwarded by the renderer process. */
export type DesktopFrameReport = {
  readonly backend: string;
  readonly label: string;
  readonly frame: number;
  readonly instanceIds: readonly string[];
  readonly drawCalls: number;
  readonly surface: string | null;
  readonly pixelsDrawn: boolean | null;
};

export function bridgeRefuse(
  reason: DesktopBridgeRefusalReason,
  message: string,
  detail: string | null = null,
  transaction?: EditorCommandTransactionResult,
): DesktopBridgeRefusal {
  return Object.freeze({
    ok: false as const,
    reason,
    message,
    detail,
    ...(transaction === undefined ? {} : { transaction }),
  });
}

export function bridgeOk<T>(action: DesktopBridgeAction, data: T): DesktopBridgeOk<T> {
  return Object.freeze({ ok: true as const, action, data });
}
