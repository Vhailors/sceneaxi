import { expect, it } from "vitest";
import { createDesktopVisualState, desktopVisualView } from "@sceneaxi/desktop-shell";
import { regionControls } from "./helpers/desktop-chrome-golden.js";

it("renders settings forms with the model's declared controls", () => {
  const state = createDesktopVisualState();
  const view = desktopVisualView(state);

  for (const control of regionControls(".editor-command-form", state)) {
    expect(view.controls.find((candidate) => candidate.id === control.id)?.kind).toBe(control.getAttribute("data-kind"));
  }
});
