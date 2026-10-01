import { editorShellModeSurface } from "@sceneaxi/schemas";
import { DESKTOP_INTERACTION_COMMANDS, DESKTOP_MENU_IDS, DESKTOP_MENU_LABELS } from "../interaction-commands.js";
import {
  DESKTOP_DRAWER_IDS,
  DESKTOP_MODES,
  DESKTOP_VISUAL_REFUSALS,
  type DesktopControlMint,
  type DesktopDrawerId,
  type DesktopVisualState,
  type DesktopVisualView,
} from "./core.js";

const DRAWER_LABELS: Readonly<Record<DesktopDrawerId, string>> = Object.freeze({
  left: "Panels",
  inspector: "Inspector",
});

/** The region id each drawer toggle controls. */
const DRAWER_TARGETS: Readonly<Record<DesktopDrawerId, string>> = Object.freeze({
  left: "left-dock",
  inspector: "inspector",
});

export function frameDrawers(control: DesktopControlMint): DesktopVisualView["drawers"] {
  return Object.freeze(
    DESKTOP_DRAWER_IDS.map((id) =>
      Object.freeze({
        id,
        label: DRAWER_LABELS[id],
        target: DRAWER_TARGETS[id],
        control: control(`drawer-${id}`, DRAWER_LABELS[id], "view"),
      }),
    ),
  );
}

export function frameMenus(control: DesktopControlMint): DesktopVisualView["menus"] {
  return Object.freeze(
    DESKTOP_MENU_IDS.map((id) =>
      Object.freeze({
        id,
        label: DESKTOP_MENU_LABELS[id],
        control: control(`menu-${id}`, DESKTOP_MENU_LABELS[id], "view"),
        items: Object.freeze(
          DESKTOP_INTERACTION_COMMANDS.filter((command) => command.menu === id).map(
            (command) =>
              Object.freeze({
                commandId: command.id,
                actionId: command.actionId,
                label: command.label,
                accelerator: command.accelerator,
                control:
                  command.id === "edit-undo" || command.id === "edit-redo"
                    ? control(
                        `menu-command-${command.id}`,
                        command.label,
                        "inert",
                        command.id === "edit-redo"
                          ? DESKTOP_VISUAL_REFUSALS.redoUnavailable
                          : DESKTOP_VISUAL_REFUSALS.undoUnavailable,
                      )
                    : control(
                        `menu-command-${command.id}`,
                        command.label,
                        "live",
                      ),
              }),
          ),
        ),
      }),
    ),
  );
}

export function frameModes(state: DesktopVisualState, control: DesktopControlMint): DesktopVisualView["modes"] {
  return Object.freeze(
    DESKTOP_MODES.map((mode) =>
      Object.freeze({
        id: mode.id,
        label: mode.label,
        title: mode.title,
        active: mode.id === state.mode,
        surface: editorShellModeSurface(mode.id),
        control: mode.id === "compose" || mode.id === "plugins"
          ? control(`mode-${mode.id}`, mode.title, "inert", DESKTOP_VISUAL_REFUSALS.noDocumentBound)
          : control(`mode-${mode.id}`, mode.title, "view"),
      }),
    ),
  );
}
