import { editorShellAssistantModeLabel } from "@sceneaxi/schemas";
import {
  DESKTOP_ASSISTANT_MODE_IDS,
  DESKTOP_VISUAL_REFUSALS,
  kidsAssistantDenial,
  liveControl,
  type DesktopControl,
  type DesktopControlMint,
  type DesktopAssistantProjection,
  type DesktopAssistantRuntime,
  type DesktopAssistantView,
  type DesktopVisualState,
} from "./core.js";

const ASSISTANT_MODEL_LABELS = Object.freeze({
  denied: "denied",
  noProvider: "no provider configured",
});

/** The same profile projection supplies the active column and profile chips. */
export function assistantProjection(
  refuseOnly: boolean,
  mint: DesktopControlMint = liveControl,
  runtime: DesktopAssistantRuntime = "none",
): DesktopAssistantProjection {
  const denial = kidsAssistantDenial();
  const runtimeAvailable = runtime === "local";

  const runtimeControl = (id: string, label: string): DesktopControl =>
    refuseOnly
      ? mint(id, label, "inert", denial.code)
      : runtimeAvailable
        ? mint(id, label, "live")
        : mint(id, label, "inert", DESKTOP_VISUAL_REFUSALS.noPresentationRuntime);

  return Object.freeze({
    state: refuseOnly ? "denied" : "open",
    modelLabel: refuseOnly
      ? ASSISTANT_MODEL_LABELS.denied
      : runtimeAvailable
        ? "OpenCode Flash"
        : ASSISTANT_MODEL_LABELS.noProvider,
    toggle: refuseOnly
      ? mint("assistant-toggle", "Assistant", "inert", denial.code)
      : mint("assistant-toggle", "Assistant", "view"),
    close: refuseOnly
      ? mint("assistant-close", "Close assistant", "inert", denial.code)
      : mint("assistant-close", "Close assistant", "view"),
    prompt: runtimeControl("assistant-prompt", "Assistant prompt"),
    send: runtimeControl("assistant-send", "Send"),
    retry: runtimeControl("assistant-retry", "Retry"),
    routes: Object.freeze(
      ([
        ["local", "Local · free"],
        ["byo", "BYOK · free"],
        ["hosted", "Hosted · metered"],
      ] as const).map(([id, label]) =>
        Object.freeze({
          id,
          label,
          control: refuseOnly
            ? mint(`assistant-route-${id}`, label, "inert", denial.code)
            : id === "hosted"
              ? mint(`assistant-route-${id}`, label, "inert", DESKTOP_VISUAL_REFUSALS.hostedAssistantUnavailable)
              : mint(`assistant-route-${id}`, label, "view"),
        }),
      ),
    ),
    modes: Object.freeze(
      DESKTOP_ASSISTANT_MODE_IDS.map((id) => {
        const label = editorShellAssistantModeLabel(id);

        return Object.freeze({
          id,
          label,
          control: refuseOnly
            ? mint(`assistant-mode-${id}`, label, "inert", denial.code)
            : mint(`assistant-mode-${id}`, label, "view"),
        });
      }),
    ),
    refusal: refuseOnly ? denial.code : null,
    refusalMessage: refuseOnly ? denial.message : null,
    refusalCode: refuseOnly ? denial.lockCode : null,
  });
}

export function assistantView(
  state: DesktopVisualState,
  assistantIsDrawer: boolean,
  control: DesktopControlMint,
): DesktopAssistantView {
  const projection = assistantProjection(state.profile === "kids", control, state.assistantRuntime);

  return Object.freeze({
    ...projection,
    state: state.assistant,
    mode: state.assistantMode,
    thinking: state.assistantThinking,
    togglePressed: state.assistant === "open" && !assistantIsDrawer,
    modes: Object.freeze(
      projection.modes.map((row) =>
        Object.freeze({ ...row, active: row.id === state.assistantMode }),
      ),
    ),
  });
}
