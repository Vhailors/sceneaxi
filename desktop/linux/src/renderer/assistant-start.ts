/**
 * The renderer's assistant-start decision, separated from the DOM that carries it.
 *
 * Which modes may start, and what each one puts on the bridge request, is a rule
 * rather than a rendering detail: Agent has to name the document its rarity
 * proposal is staged against, Build must not, and anything else refuses by name
 * before a job exists. Keeping it here lets the gate execute the decision instead
 * of reading the viewport's source for a condition.
 */
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_REFUSALS,
} from "../lib/bridge-contract.js";
import type { DesktopAssistantProfile } from "../lib/bridge.js";

export const DESKTOP_ASSISTANT_START_MODES = Object.freeze(["build", "agent"] as const);

export type DesktopAssistantStartMode = (typeof DESKTOP_ASSISTANT_START_MODES)[number];

export type DesktopAssistantStartPayload = Readonly<{
  op: "start";
  route: string;
  profile: DesktopAssistantProfile;
  prompt: string;
  mode: DesktopAssistantStartMode;
  documentPath?: string;
}>;

export type DesktopAssistantStartDecision =
  | Readonly<{ ok: true; payload: DesktopAssistantStartPayload }>
  | Readonly<{ ok: false; reason: string; message: string }>;

export function decideAssistantStart(input: Readonly<{
  mode: string | undefined;
  route: string | undefined;
  profile: DesktopAssistantProfile;
  prompt: string;
}>): DesktopAssistantStartDecision {
  const mode = DESKTOP_ASSISTANT_START_MODES.find((candidate) => candidate === input.mode);
  if (mode === undefined) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
      message:
        "Choose Build for a Sculpt Artifact or Agent for a fixture-backed rarity proposal; Ask is not implemented.",
    });
  }
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return Object.freeze({
      ok: false as const,
      reason: "ASSISTANT_SCULPT_PROMPT_INVALID",
      message: "Enter a prompt before sending.",
    });
  }
  return Object.freeze({
    ok: true as const,
    payload: Object.freeze({
      op: "start" as const,
      route: input.route ?? "local",
      profile: input.profile,
      prompt,
      mode,
      ...(mode === "agent" ? { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } : {}),
    }),
  });
}
