import { describe, expect, it } from "vitest";
import {
  DESKTOP_VISUAL_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

const render = (state: DesktopVisualState = createDesktopVisualState()): string =>
  renderDesktopChrome(desktopVisualView(state));

describe("engine desktop chrome — assistant", () => {
  it("renders an honest prompt flow when an assistant runtime is bound", () => {
    const html = render(
      createDesktopVisualState({ assistantRuntime: "local" }),
    );
    expect(html).toContain(
      '<textarea id="assistant-prompt" data-kind="live"',
    );
    expect(html).toContain("Local · free");
    expect(html).toContain("BYOK · free");
    expect(html).toContain("Hosted · metered");
    expect(html).toContain(">Light</");
    expect(html).toContain(">Mid</");
    expect(html).toContain(">Strong</");
    expect(html).toContain(
      'id="assistant-send" data-kind="live" data-action="assistant-send"',
    );
    expect(html).toContain('data-assistant-mode="build"');
    expect(html).toContain('data-assistant-status role="status"');
    expect(html).toContain("Retry");
    expect(html).toContain(
      'data-assistant-manipulators="translation rotation scale"',
    );
    for (const id of ["move-x", "move-y", "rotate-y", "scale-up"]) {
      expect(html).toContain(
        `id="assistant-manipulator-${id}" data-kind="live"`,
      );
    }

    const unavailable = render();
    expect(unavailable).toContain(
      `id="assistant-send" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`,
    );
    expect(unavailable).toContain(
      `${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime} — assistant actions are unavailable until a packaged host binds.`,
    );
  });

  it("draws the assistant thinking state the model can hold", () => {
    expect(render(createDesktopVisualState({ assistantThinking: true }))).toContain(
      '<p class="assistant-thinking" role="status" data-assistant-thinking>',
    );
    expect(render()).toContain("data-assistant-thinking hidden>");
  });
});
