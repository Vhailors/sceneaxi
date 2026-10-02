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

describe("engine desktop chrome — viewport", () => {
  it("declares the viewport sources inert and names why they cannot switch", () => {
    // They sit in a tablist that controls nothing, because switching what a
    // viewport shows needs a renderer and this surface mounts none.
    const html = render();
    for (const id of ["scene", "game", "sculpt-preview"]) {
      expect(html).toContain(
        `id="viewport-source-${id}" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`,
      );
    }
    expect(html).toContain('aria-selected="true"');
  });

  it("renders Sculpt commands with versioned registry metadata and exact-job cancellation", () => {
    const running = render(
      createDesktopVisualState({ mode: "sculpt", sculpt: "running" }),
    );
    expect(running).toMatch(
      /<div class="sculpt-progress" role="status" data-sculpt-progress>/,
    );
    expect(running).toContain(
      `id="sculpt-cancel" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`,
    );
    expect(running).toContain('data-editor-command="assistant-cancel"');
    const mounted = render(createDesktopVisualState({
      mode: "sculpt",
      assistantRuntime: "local",
    }));
    expect(mounted).toContain(
      'id="sculpt-start" data-kind="live" data-editor-command="assistant-local-build" data-command-schema-version="1"',
    );
    expect(mounted).toContain(
      `id="sculpt-cancel" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noActiveCommand}"`,
    );
    expect(running).toContain("Cancel after this pass");
    const idle = render(createDesktopVisualState({ mode: "sculpt" }));
    expect(idle).toContain('data-sculpt-progress hidden>');
  });

  it("keeps the viewport's image role off the progress and note subtree", () => {
    // `role="img"` is Children Presentational: anything under it is pruned from
    // the accessibility tree. It belongs on an empty backdrop, not on the box
    // that also holds the live progress region and the two notes.
    const html = render(createDesktopVisualState({ mode: "sculpt", sculpt: "running" }));
    expect(html).toContain('<div class="viewport-backdrop" role="img"');
    expect(html).not.toMatch(/<div class="viewport" [^>]*role="img"/);
    expect(html).toMatch(/<div class="viewport">/);
  });
});
