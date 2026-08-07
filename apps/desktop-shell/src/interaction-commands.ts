/**
 * Commands the interactive Engine Desktop chrome can actually execute.
 *
 * This is deliberately separate from `commands.ts`: that file is the
 * `sceneaxi-desktop` CLI vocabulary, while these commands are renderer-to-host
 * operations. Menu items, palette rows, title-bar buttons, and keyboard
 * accelerators all carry one of these ids and the emitted chrome dispatches the
 * id through one handler table.
 */

export const DESKTOP_MENU_IDS = Object.freeze(["file", "edit", "run"] as const);
export type DesktopMenuId = (typeof DESKTOP_MENU_IDS)[number];

export const DESKTOP_MENU_LABELS: Readonly<Record<DesktopMenuId, string>> =
  Object.freeze({
    file: "File",
    edit: "Edit",
    run: "Run",
  });

export const DESKTOP_INTERACTION_COMMANDS = Object.freeze([
  Object.freeze({
    id: "project-new",
    label: "New Project",
    menu: "file" as const,
    accelerator: "",
    key: null,
    allowInTextEntry: false,
  }),
  Object.freeze({
    id: "project-open",
    label: "Open Project…",
    menu: "file" as const,
    accelerator: "Ctrl/Cmd+O",
    key: "o",
    allowInTextEntry: false,
  }),
  Object.freeze({
    id: "project-save",
    label: "Save",
    menu: "file" as const,
    accelerator: "Ctrl/Cmd+S",
    key: "s",
    allowInTextEntry: false,
  }),
  Object.freeze({
    id: "edit-undo",
    label: "Undo",
    menu: "edit" as const,
    accelerator: "Ctrl/Cmd+Z",
    key: "z",
    allowInTextEntry: false,
  }),
  Object.freeze({
    id: "run-play",
    label: "Play",
    menu: "run" as const,
    accelerator: "Ctrl/Cmd+P",
    key: "p",
    allowInTextEntry: false,
  }),
] as const);

export type DesktopInteractionCommand =
  (typeof DESKTOP_INTERACTION_COMMANDS)[number];
export type DesktopInteractionCommandId = DesktopInteractionCommand["id"];

export const DESKTOP_PALETTE_COMMAND_IDS = Object.freeze(
  DESKTOP_INTERACTION_COMMANDS.map((command) => command.id),
);

export const DESKTOP_PALETTE_SHORTCUT = Object.freeze({
  id: "palette-open",
  label: "Commands",
  accelerator: "Ctrl/Cmd+K",
  key: "k",
  allowInTextEntry: true,
});

export function desktopInteractionCommand(
  id: DesktopInteractionCommandId,
): DesktopInteractionCommand {
  const command = DESKTOP_INTERACTION_COMMANDS.find((candidate) => candidate.id === id);
  if (command === undefined) throw new Error(`unknown desktop interaction command ${id}`);
  return command;
}
