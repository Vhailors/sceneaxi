import { expect, it } from "vitest";
import { CONTROL_STATES, regionControls } from "../../../tests/helpers/desktop-chrome-golden.js";

it("renders the palette landmark with classified buttons and no unpinned fields", () => {
  for (const [label, state] of CONTROL_STATES) {
    const controls = regionControls('.overlay[data-overlay="palette"]', state);
    expect(controls.filter((control) => control.tagName !== "BUTTON"), label).toEqual([]);
  }
});
