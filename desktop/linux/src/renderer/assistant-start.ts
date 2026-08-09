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
  DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE,
  DESKTOP_ASSISTANT_START_MODES,
  DESKTOP_BRIDGE_REFUSALS,
  desktopAssistantStartMode,
  type DesktopAssistantStartMode,
} from "../lib/bridge-contract.js";
import { RARITY_PROVIDER_REQUEST_MAX_CHARS } from "@sceneaxi/schemas";
import type { DesktopAssistantProfile } from "../lib/bridge.js";

export { DESKTOP_ASSISTANT_START_MODES, type DesktopAssistantStartMode };

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
  const mode = desktopAssistantStartMode(input.mode);
  if (mode === null) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
      message: DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE,
    });
  }
  const trimmedPrompt = input.prompt.trim();
  const prompt = mode === "agent"
    ? trimmedPrompt.slice(0, RARITY_PROVIDER_REQUEST_MAX_CHARS)
    : trimmedPrompt;
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
