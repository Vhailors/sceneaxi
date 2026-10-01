import { describe, expect, it } from "vitest";
import {
  DESKTOP_ASSISTANT_MODE_IDS,
  DESKTOP_VISUAL_REFUSALS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  desktopVisualView,
  type DesktopVisualAction,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

const drive = (
  actions: readonly DesktopVisualAction[],
  from: DesktopVisualState = createDesktopVisualState(),
): DesktopVisualState => actions.reduce(applyDesktopVisualAction, from);

describe("desktop visual model — assistant", () => {
  it("denies the assistant on Kids and cannot be toggled back open", () => {
    const kids = drive([{ type: "select-profile", profile: "kids" }]);
    expect(kids.assistant).toBe("denied");
    const toggled = applyDesktopVisualAction(kids, { type: "toggle-assistant" });
    expect(toggled).toBe(kids);
    const view = desktopVisualView(kids);
    expect(view.assistant.refusal).toBe(DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied);
    expect(view.assistant.refusalCode).toBe("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
    expect(view.assistant.modelLabel).toBe("denied");
    expect(view.assistant.toggle.kind).toBe("inert");
  });

  it("re-opens the assistant when leaving Kids", () => {
    const back = drive([
      { type: "select-profile", profile: "kids" },
      { type: "select-profile", profile: "game" },
    ]);
    expect(back.assistant).toBe("open");
  });

  it("toggles open and closed on a non-refusing profile", () => {
    const closed = drive([{ type: "toggle-assistant" }]);
    expect(closed.assistant).toBe("closed");
    expect(drive([{ type: "toggle-assistant" }], closed).assistant).toBe("open");
  });

  it("drops thinking when the assistant is not open", () => {
    const state = drive([
      { type: "toggle-assistant-thinking" },
      { type: "toggle-assistant" },
    ]);
    expect(state.assistantThinking).toBe(false);
  });

  it("ignores assistant-mode and thinking actions while closed", () => {
    const closed = drive([{ type: "toggle-assistant" }]);
    expect(
      applyDesktopVisualAction(closed, { type: "select-assistant-mode", mode: "agent" }),
    ).toBe(closed);
    expect(applyDesktopVisualAction(closed, { type: "toggle-assistant-thinking" })).toBe(
      closed,
    );
  });

  it("never claims a provider: send is inert with no presentation runtime", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.assistant.send.kind).toBe("inert");
    expect(view.assistant.send.refusal).toBe(DESKTOP_VISUAL_REFUSALS.noPresentationRuntime);
    expect(view.assistant.modelLabel).toBe("no provider configured");
    expect([...DESKTOP_ASSISTANT_MODE_IDS]).toEqual(["ask", "build", "agent"]);
  });
});
