import { describe, expect, it } from "vitest";
import {
  DESKTOP_INTERACTION_COMMANDS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

const render = (state: DesktopVisualState = createDesktopVisualState()): string =>
  renderDesktopChrome(desktopVisualView(state));

describe("engine desktop chrome — palette", () => {
  it("opens the requested overlay in the bytes, so a screenshot needs no script", () => {
    const palette = render(createDesktopVisualState({ overlay: "palette" }));
    expect(palette).toContain(`data-overlay="palette" role="dialog" aria-modal="true" aria-label="Command palette">`);
    expect(palette).toMatch(/data-overlay="outcome"[^>]*hidden/);
    const none = render();
    expect(none).toMatch(/data-overlay="palette"[^>]*hidden/);
  });

  it("keeps the palette honest about which rows this surface can drive", () => {
    const html = render(createDesktopVisualState({ overlay: "palette" }));
    for (const command of DESKTOP_INTERACTION_COMMANDS) {
      expect(html).toContain(`id="palette-${command.id}"`);
      expect(html).toContain(`data-command="${command.id}"`);
    }
    expect(html).not.toContain("Search commands");
    expect(html).not.toContain("sceneaxi project dev");
  });
});
