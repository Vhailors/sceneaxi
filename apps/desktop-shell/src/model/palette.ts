import {
  DESKTOP_OVERLAY_SHORTCUTS,
  DESKTOP_OVERLAY_DISMISSALS,
  DESKTOP_VISUAL_REFUSALS,
  PALETTE_GROUPS,
  type DesktopControl,
  type DesktopControlMint,
  type DesktopOverlayView,
  type DesktopVisualState,
} from "./core.js";

export function overlayView(
  state: DesktopVisualState,
  control: DesktopControlMint,
  outsideRefusal: (id: string, label: string) => DesktopControl,
): DesktopOverlayView {
  return Object.freeze({
    id: state.overlay,
    search: outsideRefusal("overlay-open-palette", "Commands"),
    refusalHelp: outsideRefusal("status-refusal-help", "Refusal help"),
    shortcuts: Object.freeze(
      DESKTOP_OVERLAY_SHORTCUTS.map((shortcut) =>
        Object.freeze({
          ...shortcut,
          control: outsideRefusal(
            `status-overlay-${shortcut.overlay}`,
            shortcut.label,
          ),
        }),
      ),
    ),
    dismissals: Object.freeze(
      DESKTOP_OVERLAY_DISMISSALS.map((dismissal) =>
        Object.freeze({
          id: dismissal.id,
          overlay: dismissal.overlay,
          label: dismissal.label,
          emphasis: dismissal.emphasis,
          productAction: dismissal.productAction,
          control: dismissal.productAction === null
            ? outsideRefusal(`overlay-close-${dismissal.id}`, dismissal.label)
            : control(`overlay-close-${dismissal.id}`, dismissal.label, "live"),
        }),
      ),
    ),
    paletteGroups: Object.freeze(
      PALETTE_GROUPS.map((group) =>
        Object.freeze({
          title: group.title,
          items: Object.freeze(
            group.items.map((item) =>
              Object.freeze({
                commandId: item.id,
                name: item.name,
                shortcut: item.shortcut,
                control:
                  item.id === "edit-undo" || item.id === "edit-redo"
                    ? control(
                        `palette-${item.id}`,
                        item.name,
                        "inert",
                        item.id === "edit-redo"
                          ? DESKTOP_VISUAL_REFUSALS.redoUnavailable
                          : DESKTOP_VISUAL_REFUSALS.undoUnavailable,
                      )
                    : control(`palette-${item.id}`, item.name, "live"),
              }),
            ),
          ),
        }),
      ),
    ),
  });
}
