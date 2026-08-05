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
  AssistantSculptResult,
  AssistantSculptSuccess,
} from "@sceneaxi/authoring-core";

/** The one IPC channel the preload exposes and the main process serves. */
export const DESKTOP_BRIDGE_CHANNEL = "sceneaxi:desktop-bridge";

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
  "scene",
  "open-path",
  "assistant",
  "authoring",
  "frame-report",
] as const);

export type DesktopBridgeAction = (typeof DESKTOP_BRIDGE_ACTIONS)[number];

/**
 * Refusals the bridge itself can mint. Upstream reasons (for example
 * `DESKTOP_SCENE_NOT_COMPOSABLE` or an orchestrator `OPEN_PATH_*` reason) travel
 * through the same envelope under their own names.
 */
export const DESKTOP_BRIDGE_REFUSALS = Object.freeze({
  actionUnknown: "DESKTOP_BRIDGE_ACTION_UNKNOWN",
  requestMalformed: "DESKTOP_BRIDGE_REQUEST_MALFORMED",
  authoringOpUnknown: "DESKTOP_BRIDGE_AUTHORING_OP_UNKNOWN",
  assistantOpUnknown: "DESKTOP_BRIDGE_ASSISTANT_OP_UNKNOWN",
  assistantBusy: "DESKTOP_ASSISTANT_BUSY",
  assistantByoUnavailable: "DESKTOP_ASSISTANT_BYO_UNAVAILABLE",
  assistantHostedMeteringUnavailable:
    "DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE",
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
  "accept",
  "reject",
  "undo",
] as const);

export type DesktopBridgeAuthoringOp = (typeof DESKTOP_BRIDGE_AUTHORING_OPS)[number];

export const DESKTOP_BRIDGE_ASSISTANT_OPS = Object.freeze([
  "start",
  "status",
] as const);

export type DesktopBridgeAssistantOp =
  (typeof DESKTOP_BRIDGE_ASSISTANT_OPS)[number];

export type DesktopAssistantJobSnapshot = Readonly<{
  jobId: string;
  route: "local" | "byo";
  status: "running" | "ready" | "refused";
  progress: ReadonlyArray<AssistantSculptProgress>;
  result?: AssistantSculptSuccess;
  refusal?: Extract<AssistantSculptResult, { readonly ok: false }>;
}>;

/** What `handshake` reports: identity, never capability it cannot prove. */
export type DesktopBridgeHandshake = {
  readonly app: "@sceneaxi/desktop-linux";
  readonly runtime: "electron";
  readonly bridgeVersion: 1;
  readonly actions: readonly DesktopBridgeAction[];
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
): DesktopBridgeRefusal {
  return Object.freeze({ ok: false as const, reason, message, detail });
}

export function bridgeOk<T>(action: DesktopBridgeAction, data: T): DesktopBridgeOk<T> {
  return Object.freeze({ ok: true as const, action, data });
}
