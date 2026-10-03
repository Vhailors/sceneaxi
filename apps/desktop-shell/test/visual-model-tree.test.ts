import { expect, it } from "vitest";
import { createDesktopVisualState, desktopVisualView } from "@sceneaxi/desktop-shell";
import { regionControls } from "./helpers/desktop-chrome-golden.js";

it("renders the tree landmark with the model's declared controls", () => {
  const state = createDesktopVisualState();
  const view = desktopVisualView(state);

  for (const control of regionControls(".left-dock", state)) {
    expect(view.controls.find((candidate) => candidate.id === control.id)?.kind).toBe(control.getAttribute("data-kind"));
  }
});
