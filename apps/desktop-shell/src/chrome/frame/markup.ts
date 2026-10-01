import { DESKTOP_MODES, type DesktopVisualView } from "../../visual-model.js";
import { DESKTOP_PALETTE_SHORTCUT } from "../../interaction-commands.js";
import { button, escapeHtml, refusalLegend } from "../core/markup.js";

export function titleBar(view: DesktopVisualView): string {
  const profiles = view.profiles
    .map((profile) => {
      const policy = profile.policy;

      const detail =
        policy === null
          ? "not in the shared open-path policy"
          : `${policy.demoLevel} · ${policy.sessionKind}`;

      return button(
        profile.control,
        [
          `<span class="dot" data-profile-dot="${escapeHtml(profile.id)}" aria-hidden="true"></span>`,
          `<span>${escapeHtml(profile.label)}</span>`,
          profile.refuseOnly ? `<span class="chip-tag">safe</span>` : "",
        ].join(""),
        "profile-chip",
        [
          ` data-product-action data-action="profile" data-value="${escapeHtml(profile.id)}"`,
          ` aria-pressed="${profile.active ? "true" : "false"}"`,
          ` title="${escapeHtml(`${profile.packageName} — ${detail}`)}"`,
        ].join(""),
      );
    })
    .join("");

  const drawers = view.drawers
    .map((drawer) =>
      button(
        drawer.control,
        escapeHtml(drawer.label),
        "ghost-button drawer-toggle",
        ` data-action="drawer" data-value="${escapeHtml(drawer.id)}" aria-expanded="false" aria-controls="${escapeHtml(drawer.target)}"`,
      ),
    )
    .join("");

  const menus = view.menus
    .map(
      (menu) => `<div class="menu-root" data-menu-root="${escapeHtml(menu.id)}">${button(
        menu.control,
        escapeHtml(menu.label),
        "menu-item",
        ` data-menu-trigger="${escapeHtml(menu.id)}" aria-haspopup="menu" aria-expanded="false"`,
      )}<div class="menu-panel" id="menu-panel-${escapeHtml(menu.id)}" role="menu" hidden>${menu.items
        .map((item) =>
          button(
            item.control,
            `<span>${escapeHtml(item.label)}</span>${item.accelerator === "" ? "" : `<kbd data-input-binding-label="${escapeHtml(item.actionId ?? "")}">${escapeHtml(item.accelerator)}</kbd>`}`,
            "menu-command",
            ` role="menuitem" data-command="${escapeHtml(item.commandId)}"`,
          ),
        )
        .join("")}</div></div>`,
    )
    .join("");

  return `
<header class="title-bar">
  <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
  <nav class="menu-bar" aria-label="Application menu">${menus}</nav>
  <div class="profile-switch" role="group" aria-label="Profile">${profiles}</div>
  <div class="title-centre">
    <span class="project-pill" data-project-state="closed"><span class="dot dot-ok" aria-hidden="true"></span><span data-project-status>No project selected</span></span>
  </div>
  <div class="title-actions">
    ${button(view.product.open, "Reload", "ghost-button", ` data-product-action data-action="document-reload"`)}
    ${button(view.product.save, "Save", "primary-button", ` data-product-action data-command="project-save"`)}
    ${drawers}
    ${button(
      view.overlay.search,
      `${escapeHtml(view.overlay.search.label)} <kbd data-input-binding-label="${escapeHtml(DESKTOP_PALETTE_SHORTCUT.actionId)}">${escapeHtml(DESKTOP_PALETTE_SHORTCUT.accelerator)}</kbd>`,
      "ghost-button",
      ` data-command="${escapeHtml(DESKTOP_PALETTE_SHORTCUT.id)}"`,
    )}
    ${button(
      view.assistant.toggle,
      `<span class="dot" data-assistant-dot aria-hidden="true"></span><span>Assistant</span>`,
      "assistant-toggle",
      ` data-action="assistant" aria-pressed="${view.assistant.togglePressed ? "true" : "false"}"`,
    )}
  </div>
</header>`;
}

export function modeRail(view: DesktopVisualView): string {
  const items = view.modes
    .map((mode) => {
      const def = DESKTOP_MODES.find((candidate) => candidate.id === mode.id);

      return button(
        mode.control,
        [
          `<span class="rail-glyph" aria-hidden="true" style="border-radius:${escapeHtml(def?.glyphRadius ?? "2px")};transform:${escapeHtml(def?.glyphTransform ?? "none")}"></span>`,
          `<span class="rail-label">${escapeHtml(mode.label)}</span>`,
          `<span class="sr-only">${escapeHtml(mode.title)} mode</span>`,
        ].join(""),
        "rail-mode",
        ` data-action="mode" data-value="${escapeHtml(mode.id)}" aria-pressed="${mode.active ? "true" : "false"}" title="${escapeHtml(mode.title)}"${mode.surface === "details" && !view.state.detailsOpen ? " hidden" : ""}`,
      );
    })
    .join("");

  return `<nav class="mode-rail" aria-label="Editor mode"><span class="brand" aria-hidden="true"></span>${items}</nav>`;
}

/** The product status remains reachable even when the title and tree undock. */
export function statusBar(view: DesktopVisualView): string {
  return `
<footer class="status-bar">
  <span class="status-text"><span class="dot dot-ok" aria-hidden="true"></span>${escapeHtml(view.statusText)}</span>
  <span class="divider" aria-hidden="true"></span>
  <span class="status-pin" data-profile-pin>${escapeHtml(view.profilePin)}</span>
  <span class="divider" aria-hidden="true"></span>
  <span class="status-project" data-project-status aria-live="polite">${escapeHtml(view.product.surface.project.activeFile)} · ready to open</span>
  <span class="spacer"></span>
  ${view.overlay.shortcuts
    .map((shortcut) =>
      button(
        shortcut.control,
        escapeHtml(shortcut.label),
        "state-shortcut",
        ` data-command="${escapeHtml(shortcut.commandId)}"`,
      ),
    )
    .join("")}
  ${refusalLegend(view)}
</footer>`;
}
