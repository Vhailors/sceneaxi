import { expect, it } from "vitest";
import { CONTROL_STATES, regionControls } from "./helpers/desktop-chrome-golden.js";

it("renders frame landmarks with classified buttons and no unpinned fields", () => {
  for (const [label, state] of CONTROL_STATES) {
    const controls = regionControls(".title-bar, .mode-rail, .status-bar", state);
    expect(controls.filter((control) => control.tagName !== "BUTTON"), label).toEqual([]);
  }
});
