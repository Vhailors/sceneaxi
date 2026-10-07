import type { DesktopVisualView } from "../../visual-model.js";
import { INTERLOCKING, LINE, PROFILE_DOT, SIGNAL } from "../../visual-tokens.js";

export function titleBarStyles(): string {
  return `.title-bar{display:flex;align-items:center;gap:var(--space-3);padding:0 var(--space-3);background:var(--panel);border-bottom:1px solid var(--line);box-shadow:inset 0 -2px 0 var(--well);min-width:0}
.window-dots{display:flex;gap:var(--space-2)}
.window-dots i{width:10px;height:10px;border-radius:var(--r-control);background:var(--well);border:1px solid ${LINE.raised}}
.menu-bar{display:flex;gap:1px}
.menu-root{position:relative}
.menu-item{font-size:13px;color:var(--text-3);padding:0 var(--space-2);height:var(--control-h);border-radius:var(--r-control)}
.menu-item[aria-expanded="true"]{background:var(--hover);color:var(--text)}
.menu-panel{position:absolute;left:0;top:26px;z-index:45;min-width:228px;max-height:calc(100vh - 40px);overflow-y:auto;overscroll-behavior:contain;padding:var(--space-1);background:var(--raised);border:1px solid var(--line-raised);border-radius:var(--r-card);box-shadow:var(--float)}
.menu-command{display:flex;align-items:center;justify-content:space-between;gap:var(--space-6);width:100%;min-height:30px;padding:var(--space-1) var(--space-2);border-radius:var(--r-control);color:var(--text-2);font-size:13px;text-align:left}
.menu-command:hover,.menu-command:focus-visible{background:var(--hover);color:var(--text)}
.menu-command.is-inert:hover,.menu-command.is-inert:focus-visible{background:none;color:var(--inert)}
.menu-command kbd{font-size:13px;color:var(--faint);font-variant-numeric:tabular-nums}
.profile-switch{display:flex;gap:2px;padding:2px;background:var(--well);border:1px solid var(--line-control);border-radius:var(--r-control)}
.profile-chip{display:flex;align-items:center;gap:var(--space-2);height:calc(var(--control-h) - 6px);padding:0 var(--space-3);border-radius:var(--r-control);font-size:13px;color:var(--dim);white-space:nowrap}
.profile-chip[aria-pressed="true"]{background:var(--hover);color:var(--text);font-weight:600;box-shadow:inset 0 -2px 0 var(--accent)}
.profile-chip .dot{background:${PROFILE_DOT.idle}}
.profile-chip[aria-pressed="true"] [data-profile-dot="game"]{background:var(--accent)}
.profile-chip[aria-pressed="true"] [data-profile-dot="web"]{background:${PROFILE_DOT.web}}
.profile-chip[aria-pressed="true"] [data-profile-dot="kids"]{background:var(--scene)}
.chip-tag{font-family:var(--mono);font-size:13px;letter-spacing:.02em;color:var(--faint)}
.dot{width:5px;height:5px;border-radius:50%;flex:none;display:inline-block}
.dot-ok{background:var(--ok)}
.title-centre{flex:1;display:flex;justify-content:center;min-width:0}
.project-pill{display:flex;align-items:center;gap:var(--space-2);min-width:0;max-width:100%;height:var(--control-h);padding:0 var(--space-3);border-radius:var(--r-control);background:var(--well);border:1px solid var(--line-control);font-size:13px;white-space:nowrap;overflow:hidden}
/* The ellipsis belongs to the status text, not the flex box: a flex container cannot ellipsize its items. */
.project-pill [data-project-status]{min-width:0;overflow:hidden;text-overflow:ellipsis}
/* Mint means verified, so a refused project never keeps the mint dot. Unsaved is pending: the
   yellow line + dot carry it, and the status text names it (never paint alone). */
.project-pill[data-project-state="refused"] .dot{background:var(--refuse)}
.project-pill[data-project-state="dirty"],.project-pill[data-project-state="recovering"]{border-color:${INTERLOCKING.dark.commitEdge};color:var(--text)}
.project-pill[data-project-state="dirty"] .dot,.project-pill[data-project-state="recovering"] .dot{background:${INTERLOCKING.dark.pending}}
.project-pill[data-project-state="refused"]{border-color:${SIGNAL.refuseLine};color:var(--refuse)}
.title-actions{display:flex;align-items:center;gap:var(--space-2);flex:none}
/* Drawer toggles exist at every size but only matter once a column undocks.
   Scoped so the later .ghost-button rule cannot win on equal specificity. */
.title-actions .drawer-toggle{display:none}`;
}

export function modeRailStyles(): string {
  return `.mode-rail{position:relative;background:var(--well);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:var(--space-2) 0;gap:2px}
.brand{width:28px;height:28px;margin-bottom:var(--space-2);display:grid;place-items:center;border-bottom:1px solid var(--line)}
.brand::before{content:"";width:14px;height:14px;background:var(--accent);border-radius:var(--r-control)}
.rail-mode{width:48px;height:42px;border-radius:var(--r-control);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-1);position:relative;color:var(--faint)}
.rail-mode:not(.is-inert):hover{background:var(--header);color:var(--text-2)}
.rail-mode[aria-pressed="true"]{background:var(--header);color:var(--accent);font-weight:600}
.rail-mode[aria-pressed="true"]::before{content:"";position:absolute;left:-4px;top:10px;bottom:10px;width:2px;border-radius:0 2px 2px 0;background:var(--accent)}
.rail-glyph{width:14px;height:14px;border:1.5px solid currentColor;display:block}
.rail-label{font-family:var(--mono);font-size:13px;line-height:1;letter-spacing:0}`;
}

/**
 * Row 17: one mode-rail indicator glides to the pressed mode. Each slot is one
 * 42px button plus the 2px rail gap; details-only modes are hidden until the
 * details layer opens, so the closed and open orders are listed separately.
 * Without :has() the per-button bar above stays the indicator.
 */
export function modeRailIndicatorStyles(modes: DesktopVisualView["modes"]): string {
  const primary = modes.filter((mode) => mode.surface !== "details").map((mode) => mode.id);
  const all = modes.map((mode) => mode.id);

  const slot = (prefix: string, ids: readonly string[]): string =>
    ids
      .map((id, index) => `  ${prefix}.mode-rail:has(.rail-mode[data-value="${id}"][aria-pressed="true"]){--rail-i:${index}}`)
      .join("\n");

  return `@supports selector(:has(*)){
  .rail-mode[aria-pressed="true"]::before{content:none}
  .mode-rail::after{content:"";position:absolute;left:0;top:56px;width:2px;height:22px;border-radius:0 2px 2px 0;background:var(--accent);pointer-events:none;translate:0 calc(var(--rail-i,0) * 44px);transition:translate var(--motion-duration-panel) var(--motion-ease-out-expo)}
  .mode-rail:not(:has(.rail-mode[aria-pressed="true"]))::after{content:none}
${slot("", primary)}
${slot('.shell[data-details-open="true"] ', all)}
}`;
}

export function statusBarStyles(): string {
  return `.status-bar{position:relative;background:var(--well);border-top:1px solid var(--line);display:flex;align-items:center;padding:0 var(--space-3);gap:var(--space-3);min-width:0}
.status-text{display:flex;align-items:center;gap:var(--space-2);font-size:13px;color:var(--text-3);white-space:nowrap}
.status-pin{font-family:var(--mono);font-size:13px;color:var(--faint);white-space:nowrap}
.status-project{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:13px;color:var(--dim)}
.divider{width:1px;height:12px;background:var(--line-card)}
.state-shortcut{font-family:var(--mono);font-size:13px;letter-spacing:.02em;color:var(--faint);border:1px solid var(--line-control);border-radius:var(--r-control);padding:1px var(--space-2);white-space:nowrap}
.state-shortcut:not(.is-inert):hover{border-color:var(--line-hover);color:var(--text)}`;
}
