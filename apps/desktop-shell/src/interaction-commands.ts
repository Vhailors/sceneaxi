/**
 * Commands the interactive Engine Desktop chrome can actually execute.
 *
 * This is deliberately separate from `commands.ts`: that file is the
 * `sceneaxi-desktop` CLI vocabulary, while these commands are renderer-to-host
 * operations. Menu items, palette rows, title-bar buttons, and keyboard
 * accelerators all carry one of these ids and the emitted chrome dispatches the
 * id through one handler table.
 */

import {
  EDITOR_COMMAND_SCHEMA_VERSION,
  editorCommand,
  inputAction,
  inputActionForCommand,
  type InputActionBinding,
  type EditorCommandId,
} from "@sceneaxi/schemas";

export const DESKTOP_MENU_IDS = Object.freeze(["file", "edit", "run"] as const);
export type DesktopMenuId = (typeof DESKTOP_MENU_IDS)[number];

export const DESKTOP_MENU_LABELS: Readonly<Record<DesktopMenuId, string>> =
  Object.freeze({
    file: "File",
    edit: "Edit",
    run: "Run",
  });

function interaction<
  Id extends Extract<EditorCommandId,
    | "project-new"
    | "project-open"
    | "project-save"
    | "project-git-status"
    | "project-git-diff"
    | "project-git-stage"
    | "project-git-commit-prepare"
    | "ship-export-web"
    | "edit-undo"
    | "edit-redo"
    | "run-play">,
  Row extends Readonly<{
    menu: DesktopMenuId;
  }>,
>(
  id: Id,
  row: Row,
) {
  const command = editorCommand(id);
  if (command === undefined) throw new Error(`Missing editor command ${id}`);
  const action = inputActionForCommand(id);
  const binding = action?.defaultBinding;
  return Object.freeze({
    id,
    label: command.label,
    schemaVersion: EDITOR_COMMAND_SCHEMA_VERSION,
    permission: command.permission,
    actionId: action?.id ?? null,
    binding: binding ?? null,
    accelerator: binding === undefined ? "" : formatInputBinding(binding),
    key: binding?.device === "keyboard" && binding.code.startsWith("Key")
      ? binding.code.slice(3).toLowerCase()
      : null,
    allowInTextEntry: action?.allowInTextEntry ?? false,
    ...row,
  });
}

export function formatInputBinding(binding: InputActionBinding): string {
  if (binding.device === "keyboard") {
    const parts = binding.modifiers.map((modifier) => ({
      primary: "Ctrl/Cmd",
      control: "Ctrl",
      meta: "Cmd",
      alt: "Alt",
      shift: "Shift",
    })[modifier]);
    const key = binding.code.startsWith("Key") ? binding.code.slice(3)
      : binding.code.startsWith("Digit") ? binding.code.slice(5)
      : binding.code;
    return [...parts, key].join("+");
  }
  if (binding.device === "pointer") return `Pointer ${binding.button} ${binding.gesture}`;
  if (binding.device === "wheel") return `Wheel ${binding.axis.toUpperCase()}`;
  return `Controller ${binding.controller + 1} ${binding.input} ${binding.control}`;
}

export const DESKTOP_INTERACTION_COMMANDS = Object.freeze([
  interaction("project-new", {
    menu: "file" as const,
  }),
  interaction("project-open", {
    menu: "file" as const,
  }),
  interaction("project-save", {
    menu: "file" as const,
  }),
  interaction("project-git-status", {
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  interaction("project-git-diff", {
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  interaction("project-git-stage", {
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  interaction("project-git-commit-prepare", {
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  interaction("ship-export-web", {
    menu: "file" as const,
  }),
  interaction("edit-undo", {
    menu: "edit" as const,
  }),
  interaction("edit-redo", {
    menu: "edit" as const,
  }),
  interaction("run-play", {
    menu: "run" as const,
  }),
] as const);

export type DesktopInteractionCommand =
  (typeof DESKTOP_INTERACTION_COMMANDS)[number];
export type DesktopInteractionCommandId = DesktopInteractionCommand["id"];

const paletteAction = inputAction("editor.palette.open");
if (paletteAction === undefined || paletteAction.defaultBinding.device !== "keyboard") {
  throw new Error("Missing keyboard input action editor.palette.open");
}
export const DESKTOP_PALETTE_SHORTCUT = Object.freeze({
  id: "palette-open",
  actionId: paletteAction.id,
  label: paletteAction.label,
  binding: paletteAction.defaultBinding,
  accelerator: formatInputBinding(paletteAction.defaultBinding),
  key: paletteAction.defaultBinding.code.startsWith("Key")
    ? paletteAction.defaultBinding.code.slice(3).toLowerCase()
    : paletteAction.defaultBinding.code.toLowerCase(),
  allowInTextEntry: paletteAction.allowInTextEntry,
});
