import type { DesktopVisualView } from "../../visual-model.js";
import { DESKTOP_INTERACTION_COMMANDS } from "../../interaction-commands.js";
import { button, escapeHtml } from "../core/markup.js";

export function overlays(view: DesktopVisualView): string {
  const palette = view.overlay.paletteGroups
    .map(
      (group) => `<li class="palette-group"><h3>${escapeHtml(group.title)}</h3><ul>${group.items
        .map(
          (item) =>
            `<li>${button(
              item.control,
              `<span class="palette-name">${escapeHtml(item.name)}</span>${item.shortcut === "" ? "" : `<kbd data-input-binding-label="${escapeHtml(DESKTOP_INTERACTION_COMMANDS.find((command) => command.id === item.commandId)?.actionId ?? "")}">${escapeHtml(item.shortcut)}</kbd>`}`,
              "palette-item",
              ` data-command="${escapeHtml(item.commandId)}"`,
            )}</li>`,
        )
        .join("")}</ul></li>`,
    )
    .join("");

  // Server-rendered visibility: the requested overlay is open in the emitted
  // bytes, so a screenshot of one state needs no script to have run.
  const shown = (id: string): string => (view.state.overlay === id ? "" : " hidden");

  // One modelled control per dismiss button, so each carries its own id and kind
  // instead of several elements sharing a control that can only be rendered once.
  const dismissals = (overlay: string): string =>
    view.overlay.dismissals
      .filter((dismissal) => dismissal.overlay === overlay)
      .map((dismissal) => {
        // The model decides both the kind and the action, so a dismissal that
        // reaches the host cannot be rendered as a plain closer — nor a plain
        // closer be wired to another dismissal's handler.
        const action = dismissal.productAction === null
          ? ` data-action="overlay" data-value="none"`
          : ` data-product-action data-action="${escapeHtml(dismissal.productAction)}"`;

        return button(
          dismissal.control,
          escapeHtml(dismissal.label),
          dismissal.emphasis === "primary" ? "primary-button" : "ghost-button",
          action,
        );
      })
      .join("");

  return `
<div class="overlay-layer" data-overlay-host>
  <div class="overlay" data-overlay="palette" role="dialog" aria-modal="true" aria-label="Command palette"${shown("palette")}>
    <div class="overlay-card overlay-palette">
      <div class="overlay-head"><h2>Commands</h2><kbd>ESC</kbd></div>
      <ul class="palette-list">${palette}</ul>
      <p class="overlay-foot">Every row invokes the same desktop command as its menu item and accelerator.</p>
    </div>
  </div>

  <div class="overlay" data-overlay="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title" hidden>
    <div class="overlay-card overlay-refused">
      <div class="overlay-head"><span class="overlay-mark mark-refuse" data-outcome-mark aria-hidden="true">!</span><h2 id="outcome-title" data-outcome-title></h2></div>
      <p class="overlay-body"><code data-outcome-code></code><br><span data-outcome-message></span></p>
      <div class="overlay-actions">${dismissals("outcome")}</div>
    </div>
  </div>
</div>`;
}
