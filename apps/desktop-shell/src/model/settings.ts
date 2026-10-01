import type { DesktopControlMint } from "./core.js";

export function editorCommandControls(control: DesktopControlMint) {
  return Object.freeze([
    "package-install", "package-remove", "project-migration-commit", "extension-start",
    "input-action-rebind", "input-actions-reset", "input-actions-inspect", "physics-evaluate",
    "scene-prefab-define", "scene-prefab-inspect", "scene-prefab-instance", "scene-prefab-override",
    "scene-prefab-refresh",
  ].flatMap((commandId) => [
    control(`editor-command-submit-${commandId}`, commandId, "live"),
    // Only input-action settings have a command-level review; every document
    // mutation is accepted through Change Review instead.
    ...(commandId === "input-action-rebind" || commandId === "input-actions-reset"
      ? [control(`editor-command-review-${commandId}`, `Approve ${commandId}`, "live")]
      : []),
  ]).concat(
    ...([
      ["package-install", "locator"], ["package-install", "manifest"], ["package-install", "digest"],
      ["package-remove", "packageId"], ["extension-start", "seamId"],
      ["input-action-rebind", "scope"], ["input-action-rebind", "actionId"], ["input-action-rebind", "binding"],
      ["input-actions-reset", "scope"], ["physics-evaluate", "steps"], ["scene-prefab-define", "definitionId"],
      ["scene-prefab-instance", "definitionId"], ["scene-prefab-instance", "parentInstanceId"],
      ["scene-prefab-instance", "instanceKey"], ["scene-prefab-override", "instanceId"],
      ["scene-prefab-override", "sourceInstanceId"], ["scene-prefab-override", "propertyId"],
      ["scene-prefab-override", "newValue"], ["scene-prefab-refresh", "definitionId"],
      ["viewport-source-set", "source"],
    ] as const).map(([commandId, fieldName]) =>
      control(`command-field-${commandId}-${fieldName}`, fieldName, "live"),
    ),
    control("editor-command-submit-viewport-source-set", "Apply viewport source", "live")));
}

export function shipControls(control: DesktopControlMint) {
  return {
    exportWeb: control("ship-export-web", "Export Web", "live"),
    gitCommitMessage: control("project-git-commit-message", "Commit message", "live"),
  };
}
