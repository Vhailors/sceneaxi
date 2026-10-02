import type {
  AssistantSculptProgress,
  AssistantSculptSuccess,
  SafeRarityEvidence,
} from "@sceneaxi/authoring-core";
import { EDITOR_SHELL_ASSISTANT_MODE_IDS } from "@sceneaxi/schemas";
import type { EditorCommandId, EditorCommandTerminalResult } from "@sceneaxi/schemas";
import type { MountableScene } from "@sceneaxi/site-kit";
import type { DesktopSnapshot } from "@sceneaxi/desktop-shell";

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
