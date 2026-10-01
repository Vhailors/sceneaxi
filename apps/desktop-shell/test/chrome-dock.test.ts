import { describe, expect, it } from "vitest";
import {
  DESKTOP_MODE_IDS,
  createDesktopVisualState,
  defaultDockTabFor,
  desktopVisualView,
  dockTabsFor,
  renderDesktopChrome,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

const render = (state: DesktopVisualState = createDesktopVisualState()): string =>
  renderDesktopChrome(desktopVisualView(state));

describe("engine desktop chrome — dock", () => {
  it("renders the dock tabs the active mode has, and no others", () => {
    for (const mode of DESKTOP_MODE_IDS) {
      const html = render(createDesktopVisualState({ mode }));
      const rendered = [...html.matchAll(/data-action="dock-tab" data-value="(\w+)"/g)]
        .map((match) => match[1]);
      expect(rendered, mode).toEqual([...dockTabsFor(mode)]);
    }
  });

  it("leaves exactly the panel the selected tab controls visible", () => {
    // The tab strip is built from the model, so the panels must be too: a
    // hardcoded visible panel shows Change Review in `run`, the one mode that
    // has no Changes tab at all.
    for (const mode of DESKTOP_MODE_IDS) {
      const html = render(createDesktopVisualState({ mode }));
      const visible = [...html.matchAll(/data-dock-panel="(\w+)"( hidden)?>/g)]
        .filter((match) => match[2] === undefined)
        .map((match) => match[1]);
      expect(visible, mode).toEqual([defaultDockTabFor(mode)]);
      expect(html, mode).toContain(
        `aria-selected="true" aria-controls="dock-panel-${defaultDockTabFor(mode)}"`,
      );
    }
  });

  it("renders one atomic proposal decision pair in an initially empty review", () => {
    const html = render();
    expect(html).toContain('data-change-proposal hidden>');
    expect(html).toContain('id="change-review-accept"');
    expect(html).toContain('id="change-review-reject"');
    expect(html).not.toContain("Accept all");
    expect(html).not.toContain("Reject all");
  });

  it("follows an explicit dock tab rather than the mode default", () => {
    const html = render(createDesktopVisualState({ mode: "build", dockTab: "console" }));
    expect(html).toContain(`data-dock-panel="console">`);
    expect(html).toContain(`data-dock-panel="changes" hidden>`);
  });

  it("serializes the dock-tab table the script reads, matching the model", () => {
    const html = render();
    const match = /const T = (\{.*?\});\n/s.exec(html);
    expect(match).not.toBeNull();
    const tables = JSON.parse(match?.[1] ?? "{}") as {
      dockTabsByMode: Record<string, string[]>;
      dockHeightByMode: Record<string, number>;
    };
    for (const mode of DESKTOP_MODE_IDS) {
      expect(tables.dockTabsByMode[mode]).toEqual([...dockTabsFor(mode)]);
    }
    expect(tables.dockHeightByMode["animate"]).toBe(252);
    expect(tables.dockHeightByMode["build"]).toBe(228);
  });

  it("renders the atomic proposal decisions through modelled controls", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const html = render();
    for (const control of [view.changeReview.accept, view.changeReview.reject]) {
      expect(html).toContain(`id="${control.id}" data-kind="${control.kind}"`);
    }
  });

  it("names the one whole-proposal decision pair", () => {
    const html = render();
    expect(html).toContain('id="change-review-accept"');
    expect(html).toContain('>Accept</button>');
    expect(html).toContain('id="change-review-reject"');
    expect(html).toContain('>Reject</button>');
  });

  it("states the atomic authoring behavior on Change Review", () => {
    const html = render();
    expect(html).toContain("Accept applies the whole proposal through the shared authoring session");
    expect(html).toContain("Reject discards it without writing");
  });

  it("ships no fabricated review row in the default document", () => {
    const html = render();
    expect(html).toContain("Nothing waiting for review");
    expect(html).not.toContain('class="change-row"');
    expect(html).not.toContain("field_drone");
    expect(html).not.toContain("matte_polymer");
    expect(html).not.toContain("0, 1.85, -2.30");
  });
});
