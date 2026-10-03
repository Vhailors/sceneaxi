import { expect, it } from "vitest";
import { CONTROL_STATES, regionControls } from "./helpers/desktop-chrome-golden.js";

it("pins the dock's timeline fields and declares every control", () => {
  for (const [label, state] of CONTROL_STATES) {
    const fields = regionControls(".dock", state).filter((control) => control.tagName !== "BUTTON");
    expect(fields.map((control) => [control.id, control.tagName]).sort(), label).toEqual([
      ["timeline-mutation", "TEXTAREA"],
      ["timeline-time", "INPUT"],
    ]);
  }
});
