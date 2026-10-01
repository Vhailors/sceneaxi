import { expect, it } from "vitest";
import { CONTROL_STATES, regionControls } from "../../../tests/helpers/desktop-chrome-golden.js";

it("pins the assistant prompt and declares every assistant control", () => {
  for (const [label, state] of CONTROL_STATES) {
    const fields = regionControls(".assistant", state).filter((control) => control.tagName !== "BUTTON");
    expect(fields.map((control) => [control.id, control.tagName]), label).toEqual([
      ["assistant-prompt", "TEXTAREA"],
    ]);
  }
});
