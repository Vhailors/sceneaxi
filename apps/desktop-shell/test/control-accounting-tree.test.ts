import { expect, it } from "vitest";
import { CONTROL_STATES, regionControls } from "../../../tests/helpers/desktop-chrome-golden.js";

it("pins tree fields and their declared kinds", () => {
  for (const [label, state] of CONTROL_STATES) {
    const controls = regionControls(".left-dock", state);
    const fields = controls.filter((control) => control.tagName !== "BUTTON" && control.closest(".editor-command-form") === null);
    expect(fields.map((control) => control.id).sort(), label).toEqual([
      "project-recent-select",
      "project-browser-file-select",
      "scene-entity-desktop-crate-beside",
    ].sort());

    for (const control of fields) {
      expect(control.tagName).toBe("SELECT");
      expect(control.outerHTML).toMatch(
        control.id === "project-recent-select" || control.id === "scene-entity-desktop-crate-beside"
          ? /data-kind="(view|inert)"/
          : /data-kind="(live|inert)"/,
      );
    }
  }
});
