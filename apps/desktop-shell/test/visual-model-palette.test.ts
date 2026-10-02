import { describe, expect, it } from "vitest";
import {
  DESKTOP_INTERACTION_COMMANDS,
  DESKTOP_VISUAL_REFUSALS,
  PALETTE_GROUPS,
  createDesktopVisualState,
  desktopVisualView,
} from "@sceneaxi/desktop-shell";

describe("desktop visual model — palette", () => {
  it("projects exactly the real desktop commands into the palette", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const rows = view.overlay.paletteGroups.flatMap((group) => group.items);
    expect(rows.map((row) => row.commandId)).toEqual(
      DESKTOP_INTERACTION_COMMANDS.map((command) => command.id),
    );
    expect(rows.find((row) => row.commandId === "edit-undo")?.control).toMatchObject({
      kind: "inert",
      refusal: DESKTOP_VISUAL_REFUSALS.undoUnavailable,
    });
    expect(rows.find((row) => row.commandId === "edit-redo")?.control).toMatchObject({
      kind: "inert",
      refusal: DESKTOP_VISUAL_REFUSALS.redoUnavailable,
    });
    expect(
      rows.filter((row) => row.commandId !== "edit-undo" && row.commandId !== "edit-redo")
        .every((row) => row.control.kind === "live"),
    ).toBe(true);
  });

  it("omits command-set fiction from the palette", () => {
    expect(PALETTE_GROUPS.flatMap((group) => group.items).map((item) => item.id)).toEqual(
      DESKTOP_INTERACTION_COMMANDS.map((command) => command.id),
    );
  });
});
