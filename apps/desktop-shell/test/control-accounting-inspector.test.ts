import { expect, it } from "vitest";
import { DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS } from "@sceneaxi/schemas";
import { CONTROL_STATES, regionControls } from "./helpers/desktop-chrome-golden.js";

it("pins inspector inputs, selects, and catalog textareas", () => {
  for (const [label, state] of CONTROL_STATES) {
    const controls = regionControls(".inspector", state).filter((control) =>
      control.closest(".editor-command-form") === null && control.id !== "project-git-commit-message",
    );

    const inputs = controls.filter((control) => control.tagName === "INPUT");
    expect(inputs, label).toHaveLength(DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.length + 1);
    expect(inputs.map((control) => control.id).sort(), label).toEqual([
      ...DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition) => `scene-property-${definition.id}`),
      "scene-transform-snap",
    ].sort());
    const selects = controls.filter((control) => control.tagName === "SELECT");
    expect(selects.map((control) => control.id).sort(), label).toEqual([
      "scene-transform-space",
      "scene-transform-pivot",
      "scene-instance-parent",
      "scene-instance-policy",
    ].sort());

    for (const control of selects) expect(control.outerHTML, label).toMatch(/data-kind="(live|inert)"/);

    const textareas = controls.filter((control) => control.tagName === "TEXTAREA");
    expect(textareas.map((control) => control.id).sort(), label).toEqual([
      "effect-mutation",
      "environment-mutation",
      "material-mutation",
      "physics-mutation",
    ].sort());
  }
});
