import { describe, expect, it } from "vitest";
import {
  DESKTOP_MENU_IDS,
  DESKTOP_INTERACTION_COMMANDS,
  DESKTOP_VISUAL_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

const render = (state: DesktopVisualState = createDesktopVisualState()): string =>
  renderDesktopChrome(desktopVisualView(state));

describe("engine desktop chrome — frame", () => {
  it("keeps modelled refusal help collapsed with a bounded scroll panel", () => {
    const html = render();
    const footer = html.indexOf('<footer class="status-bar">');
    const help = html.indexOf('id="status-refusal-help" data-kind="view"');
    const legend = html.indexOf('<section class="refusal-legend-panel" id="refusal-legend"');
    const footerEnd = html.indexOf("</footer>", footer);
    expect(footer).toBeGreaterThan(-1);
    expect(help).toBeGreaterThan(footer);
    expect(legend).toBeGreaterThan(footer);
    expect(legend).toBeLessThan(footerEnd);
    expect(html).toContain('data-action="refusal-help" aria-expanded="false"');
    expect(html).toContain('aria-controls="refusal-legend"');
    expect(html).toContain('aria-labelledby="refusal-legend-title" hidden>');
    expect(html).not.toContain("<details");
    expect(html).not.toMatch(/refusal-legend[^>]*tabindex/);
    expect(html).toContain(".refusal-legend-panel{position:absolute");
    expect(html).toContain("overflow:auto;padding:10px 12px");
    expect(html).toContain("else if (action === 'refusal-help')");
  });

  it("renders File, Edit, and Run with their real command ids", () => {
    const html = render();
    for (const id of DESKTOP_MENU_IDS) {
      expect(html).toContain(`id="menu-${id}" data-kind="view"`);
    }
    for (const command of DESKTOP_INTERACTION_COMMANDS) {
      expect(html).toContain(`data-command="${command.id}"`);
    }
  });

  it("marks the active mode and profile with aria-pressed", () => {
    const html = render(createDesktopVisualState({ mode: "compose", profile: "web" }));
    expect(html).toContain(
      `id="mode-compose" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noDocumentBound}"`,
    );
    expect(html).toContain('id="mode-build" data-kind="view" data-action="mode" data-value="build" aria-pressed="true"');
    expect(html).toContain(
      'id="profile-web" data-kind="view" data-product-action data-action="profile" data-value="web" aria-pressed="true"',
    );
  });

  it("renders the mode rail through its modelled controls", () => {
    // The rail was the last group to read `id`/`label`/`active` off the model
    // and drop the control kind with it, which is what let a Kids document
    // render seven live-looking buttons.
    const view = desktopVisualView(createDesktopVisualState());
    const html = render();
    for (const mode of view.modes) {
      expect(html).toContain(
        `id="${mode.control.id}" data-kind="${mode.control.kind}"`,
      );
    }
  });
});
