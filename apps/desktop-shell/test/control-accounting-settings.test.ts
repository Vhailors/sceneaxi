import { expect, it } from "vitest";
import { CONTROL_STATES, chromeDocument } from "../../../tests/helpers/desktop-chrome-golden.js";

it("pins settings form inputs, selects, and JSON textareas", () => {
  for (const [label, state] of CONTROL_STATES) {
    const document = chromeDocument(state);
    const controls = [...document.querySelectorAll(".editor-command-form button, .editor-command-form input, .editor-command-form select, .editor-command-form textarea, #project-git-commit-message")];
    expect(document.querySelectorAll(".editor-command-form").length, label).toBeGreaterThan(0);

    for (const control of controls) expect(["view", "live", "inert"], control.id).toContain(control.getAttribute("data-kind"));

    expect(controls.flatMap((control) => control.tagName === "INPUT" ? [control.id] : []).sort(), label).toEqual([
      "project-git-commit-message",
      "command-field-package-install-locator",
      "command-field-package-install-digest",
      "command-field-physics-evaluate-steps",
      "command-field-scene-prefab-define-definitionId",
      "command-field-scene-prefab-instance-instanceKey",
      "command-field-scene-prefab-override-newValue",
    ].sort());
    const selects = controls.filter((control) => control.tagName === "SELECT");
    expect(selects.map((control) => control.id).sort(), label).toEqual([
      "command-field-package-remove-packageId",
      "command-field-extension-start-seamId",
      "command-field-input-action-rebind-scope",
      "command-field-input-action-rebind-actionId",
      "command-field-input-actions-reset-scope",
      "command-field-scene-prefab-instance-definitionId",
      "command-field-scene-prefab-instance-parentInstanceId",
      "command-field-scene-prefab-override-instanceId",
      "command-field-scene-prefab-override-sourceInstanceId",
      "command-field-scene-prefab-override-propertyId",
      "command-field-scene-prefab-refresh-definitionId",
    ].sort());

    for (const control of selects) expect(control.outerHTML, label).toMatch(/data-kind="(live|inert)"/);

    expect(controls.flatMap((control) => control.tagName === "TEXTAREA" ? [control.id] : []).sort(), label).toEqual([
      "command-field-package-install-manifest",
      "command-field-input-action-rebind-binding",
    ].sort());
  }
});
