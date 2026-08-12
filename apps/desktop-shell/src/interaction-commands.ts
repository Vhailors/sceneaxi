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
    | "ship-export-web"
    | "edit-undo"
    | "run-play">,
  Row extends Readonly<{
    menu: DesktopMenuId;
    accelerator: string;
    key: string | null;
    allowInTextEntry: boolean;
  }>,
>(
  id: Id,
  row: Row,
) {
  const command = editorCommand(id);
  if (command === undefined) throw new Error(`Missing editor command ${id}`);
  return Object.freeze({
    id,
    label: command.label,
    schemaVersion: EDITOR_COMMAND_SCHEMA_VERSION,
    permission: command.permission,
    ...row,
  });
}

export const DESKTOP_INTERACTION_COMMANDS = Object.freeze([
  interaction("project-new", {
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  interaction("project-open", {
    menu: "file" as const,
    accelerator: "Ctrl/Cmd+O",
    key: "o",
    allowInTextEntry: false,
  }),
  interaction("project-save", {
    menu: "file" as const,
    accelerator: "Ctrl/Cmd+S",
    key: "s",
    allowInTextEntry: false,
  }),
  interaction("ship-export-web", {
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  interaction("edit-undo", {
    menu: "edit" as const,
    accelerator: "Ctrl/Cmd+Z",
    key: "z",
    allowInTextEntry: false,
  }),
  interaction("run-play", {
    menu: "run" as const,
    accelerator: "Ctrl/Cmd+P",
    key: "p",
    allowInTextEntry: false,
  }),
] as const);

export type DesktopInteractionCommand =
  (typeof DESKTOP_INTERACTION_COMMANDS)[number];
export type DesktopInteractionCommandId = DesktopInteractionCommand["id"];

export const DESKTOP_PALETTE_SHORTCUT = Object.freeze({
  id: "palette-open",
  label: "Commands",
  accelerator: "Ctrl/Cmd+K",
  key: "k",
  allowInTextEntry: true,
});
