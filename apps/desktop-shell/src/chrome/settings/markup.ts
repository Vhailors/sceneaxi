import type { DesktopVisualView } from "../../visual-model.js";
import { button, escapeHtml } from "../core/markup.js";

type EditorCommandFormField = Readonly<{ name: string; label: string; kind?: "text" | "number" | "json" | "select"; options?: readonly string[] }>;

const EDITOR_COMMAND_FORM_FIELDS: Readonly<Record<string, readonly EditorCommandFormField[]>> = Object.freeze({
  "package-install": [
    { name: "locator", label: "Contained package locator" },
    { name: "manifest", label: "Package manifest JSON", kind: "json" },
    { name: "digest", label: "Package digest" },
  ],
  "package-remove": [{ name: "packageId", label: "Installed package ID", kind: "select" }],
  "project-migration-commit": [],
  "extension-start": [{ name: "seamId", label: "Inspected extension seam", kind: "select" }],
  "input-action-rebind": [
    { name: "scope", label: "Scope", kind: "select", options: ["project", "workspace"] },
    { name: "actionId", label: "Inspected action ID", kind: "select" },
    { name: "binding", label: "New binding JSON", kind: "json" },
  ],
  "input-actions-reset": [
    { name: "scope", label: "Scope", kind: "select", options: ["project", "workspace"] },
  ],
  "input-actions-inspect": [],
  "physics-evaluate": [{ name: "steps", label: "Simulation steps", kind: "number" }],
  "scene-prefab-define": [{ name: "definitionId", label: "Prefab ID" }],
  "scene-prefab-inspect": [],
  "scene-prefab-instance": [
    { name: "definitionId", label: "Inspected prefab ID", kind: "select" },
    { name: "parentInstanceId", label: "Selected parent instance ID", kind: "select" },
    { name: "instanceKey", label: "New instance key" },
  ],
  "scene-prefab-override": [
    { name: "instanceId", label: "Selected instance ID", kind: "select" },
    { name: "sourceInstanceId", label: "Source instance ID", kind: "select" },
    { name: "propertyId", label: "Property ID", kind: "select", options: ["translation-x", "translation-y", "translation-z", "rotation-x", "rotation-y", "rotation-z", "scale-x", "scale-y", "scale-z"] },
    { name: "newValue", label: "New numeric value", kind: "number" },
  ],
  "scene-prefab-refresh": [{ name: "definitionId", label: "Inspected prefab ID", kind: "select" }],
  "viewport-source-set": [{ name: "source", label: "Viewport source", kind: "select", options: ["scene", "game", "sculpt-preview"] }],
});

export function editorCommandFieldAttrs(view: DesktopVisualView, commandId: string, name: string, label: string): string {
  const control = view.product.editorCommandControls.find((candidate) => candidate.id === `command-field-${commandId}-${name}`);

  if (!control) throw new Error(`Missing visual-model field control for ${commandId}.${name}`);

  const inertAttrs = control.kind === "inert"
    ? ` aria-disabled="true" data-refusal="${escapeHtml(control.refusal ?? "")}" aria-describedby="refusal-${escapeHtml(control.refusal ?? "")}"`
    : "";

  return `id="${escapeHtml(control.id)}" data-kind="${control.kind}"${inertAttrs} data-command-field="${escapeHtml(name)}" aria-label="${escapeHtml(label)}"`;
}

export function editorCommandForm(view: DesktopVisualView, commandId: keyof typeof EDITOR_COMMAND_FORM_FIELDS, title: string): string {
  const fields = (EDITOR_COMMAND_FORM_FIELDS[commandId] ?? []).map((field) => {
    const attrs = editorCommandFieldAttrs(view, commandId, field.name, field.label);

    const control = field.kind === "json"
      ? `<textarea ${attrs}></textarea>`
      : field.kind === "select"
        ? `<select ${attrs}><option value="">Choose after inspection</option>${(field.options ?? []).map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select>`
        : `<input ${attrs} type="${field.kind ?? "text"}">`;

    return `<label>${escapeHtml(field.label)}${control}</label>`;
  }).join("");

  const submit = view.product.editorCommandControls.find((control) => control.id === `editor-command-submit-${commandId}`);
  const review = view.product.editorCommandControls.find((control) => control.id === `editor-command-review-${commandId}`);

  if (!submit) throw new Error(`Missing visual-model controls for ${commandId}`);

  return `<section class="editor-command-form" data-editor-command-form="${commandId}" aria-label="${escapeHtml(title)}">
    <h3>${escapeHtml(title)}</h3>${fields}
    ${commandId === "project-migration-commit" ? '<p data-migration-proposal-refusal>Run Propose Project Migration first.</p>' : ""}
    <p data-editor-command-refusal="${commandId}" aria-live="polite">${commandId === "input-action-rebind" || commandId === "input-actions-reset" ? "Inspect input actions before choosing a target." : "Complete the required fields before submitting."}</p>
    ${button(submit, commandId === "input-actions-inspect" ? "Inspect input actions" : title, "ghost-button", ` data-action="editor-command-submit" data-value="${commandId}" data-editor-command-submit="${commandId}"`)}
    ${review ? button(review, "Approve reviewed change", "ghost-button", ` data-action="editor-command-review" data-value="${commandId}" data-editor-command-review="${commandId}" hidden`) : ""}
  </section>`;
}
