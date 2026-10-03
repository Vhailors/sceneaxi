import { expect, it } from "vitest";
import { CONTROL_STATES, regionControls } from "./helpers/desktop-chrome-golden.js";

it("pins the viewport source field and declares every viewport control", () => {
  for (const [label, state] of CONTROL_STATES) {
    const fields = regionControls(".viewport-region", state).filter((control) => control.tagName !== "BUTTON");
    expect(fields.map((control) => [control.id, control.tagName]), label).toEqual([
      ["command-field-viewport-source-set-source", "SELECT"],
    ]);

    for (const control of fields) expect(control.outerHTML, label).toMatch(/data-kind="(live|inert)"/);
  }
});
