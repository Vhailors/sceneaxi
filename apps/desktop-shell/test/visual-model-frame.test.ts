import { describe, expect, it } from "vitest";
import {
  DESKTOP_INTERACTION_COMMANDS,
  DESKTOP_MENU_IDS,
  DESKTOP_MODE_IDS,
  DESKTOP_REFUSAL_MESSAGES,
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

describe("desktop visual model — frame", () => {
  it("has exactly the seven modes the accepted archive defines, in order", () => {
    expect([...DESKTOP_MODE_IDS]).toEqual([
      "build",
      "sculpt",
      "compose",
      "animate",
      "run",
      "ship",
      "plugins",
    ]);
  });

  it("exposes only real desktop commands through File, Edit, and Run", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.menus.map((menu) => menu.id)).toEqual([...DESKTOP_MENU_IDS]);
    for (const menu of view.menus) {
      expect(menu.control.kind).toBe("view");
    }
    expect(view.menus.flatMap((menu) => menu.items).map((item) => item.commandId)).toEqual(
      DESKTOP_INTERACTION_COMMANDS.map((command) => command.id),
    );
  });

  it("says no kernel session runs instead of reporting a tick", () => {
    const view = desktopVisualView(drive([{ type: "select-mode", mode: "run" }]));
    expect(view.statusText).toBe(
      DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.noKernelSession],
    );
  });
});
