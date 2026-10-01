import { describe, expect, it } from "vitest";
import {
  EDITOR_SHELL_ASSISTANT_MODE_IDS,
  EDITOR_SHELL_ASSISTANT_MODES,
  EDITOR_SHELL_DESKTOP_ASSISTANT_INTENTS,
  EDITOR_SHELL_DESKTOP_LAYOUT,
  EDITOR_SHELL_DESKTOP_WORKSPACES,
  EDITOR_SHELL_MODE_IDS,
  inputAction,
} from "@sceneaxi/schemas";

describe("desktop-only shell vocabulary", () => {
  it("uses four existing mode ids in workspace shortcut order", () => {
    expect(EDITOR_SHELL_DESKTOP_WORKSPACES).toEqual([
      { id: "build", label: "Scene" },
      { id: "animate", label: "Animate" },
      { id: "run", label: "Play" },
      { id: "ship", label: "Ship" },
    ]);
    expect(Object.isFrozen(EDITOR_SHELL_DESKTOP_WORKSPACES)).toBe(true);
    EDITOR_SHELL_DESKTOP_WORKSPACES.forEach((row, index) => {
      expect(EDITOR_SHELL_MODE_IDS).toContain(row.id);
      expect(Object.isFrozen(row)).toBe(true);
      expect(inputAction(`editor.workspace.${index + 1}`)?.defaultBinding).toEqual({
        device: "keyboard", code: `Digit${index + 1}`, modifiers: ["primary"],
      });
    });
  });

  it("keeps desktop intent ids equal to the hosted strength ids", () => {
    expect(EDITOR_SHELL_DESKTOP_ASSISTANT_INTENTS).toEqual([
      { id: "ask", label: "Ask" },
      { id: "build", label: "Propose" },
      { id: "agent", label: "Plan" },
    ]);
    expect(EDITOR_SHELL_DESKTOP_ASSISTANT_INTENTS.map((row) => row.id)).toEqual(
      EDITOR_SHELL_ASSISTANT_MODE_IDS,
    );
    expect(EDITOR_SHELL_ASSISTANT_MODES.map((row) => row.label)).toEqual(["Light", "Mid", "Strong"]);
    expect(Object.isFrozen(EDITOR_SHELL_DESKTOP_ASSISTANT_INTENTS)).toBe(true);
    for (const row of EDITOR_SHELL_DESKTOP_ASSISTANT_INTENTS) expect(Object.isFrozen(row)).toBe(true);
  });

  it("ships desktop defaults and immutable resize bounds containing those defaults", () => {
    const layout = EDITOR_SHELL_DESKTOP_LAYOUT;
    expect(layout).toEqual({
      titleBarHeight: 36,
      toolbarHeight: 40,
      leftDockWidth: 256,
      inspectorWidth: 320,
      assistantWidth: 352,
      viewTabsHeight: 32,
      dockHeight: 232,
      timelineDockHeight: 280,
      statusBarHeight: 27,
      ranges: {
        leftDockWidth: { min: 200, max: 480 },
        inspectorWidth: { min: 280, max: 560 },
        assistantWidth: { min: 320, max: 560 },
        dockHeight: { min: 120, maxBodyFraction: 0.6 },
      },
    });
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.ranges)).toBe(true);
    for (const key of ["leftDockWidth", "inspectorWidth", "assistantWidth"] as const) {
      expect(Object.isFrozen(layout.ranges[key])).toBe(true);
      expect(layout[key]).toBeGreaterThanOrEqual(layout.ranges[key].min);
      expect(layout[key]).toBeLessThanOrEqual(layout.ranges[key].max);
    }
    expect(Object.isFrozen(layout.ranges.dockHeight)).toBe(true);
    const minimumBodyHeight = 600 - layout.titleBarHeight - layout.toolbarHeight - layout.statusBarHeight;
    for (const height of [layout.dockHeight, layout.timelineDockHeight]) {
      expect(height).toBeGreaterThanOrEqual(layout.ranges.dockHeight.min);
      expect(height).toBeLessThanOrEqual(minimumBodyHeight * layout.ranges.dockHeight.maxBodyFraction);
    }
  });
});
