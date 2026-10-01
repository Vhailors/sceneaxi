import { LINE, PROFILE_DOT, SCRIM, SIGNAL } from "../../visual-tokens.js";

export function titleBarStyles(): string {
  return `.title-bar{display:flex;align-items:center;gap:12px;padding:0 11px;background:var(--panel);border-bottom:1px solid var(--line)}
.window-dots{display:flex;gap:7px}
.window-dots i{width:11px;height:11px;border-radius:50%;background:${LINE.raised}}
.menu-bar{display:flex;gap:1px}
.menu-root{position:relative}
.menu-item{font-size:12px;color:var(--text-3);padding:0 8px;height:22px;border-radius:3px}
.menu-item[aria-expanded="true"]{background:var(--hover);color:var(--text)}
.menu-panel{position:absolute;left:0;top:25px;z-index:45;min-width:220px;padding:5px;background:var(--raised);border:1px solid var(--line-raised);border-radius:6px;box-shadow:0 18px 45px -16px ${SCRIM.shadow}}
.menu-command{display:flex;align-items:center;justify-content:space-between;gap:22px;width:100%;padding:7px 9px;border-radius:4px;color:var(--text-2);font-size:12px;text-align:left}
.menu-command:hover,.menu-command:focus-visible{background:var(--hover);color:var(--text)}
.menu-command.is-inert:hover,.menu-command.is-inert:focus-visible{background:none;color:var(--inert)}
.menu-command kbd{font-size:9px;color:var(--dim)}
.profile-switch{display:flex;gap:2px;padding:2px;background:var(--well);border:1px solid var(--line-control);border-radius:5px}
.profile-chip{display:flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:3px;font-size:11px;color:var(--dim);white-space:nowrap}
.profile-chip[aria-pressed="true"]{background:var(--hover);color:var(--text);font-weight:600}
.profile-chip .dot{background:${PROFILE_DOT.idle}}
.profile-chip[aria-pressed="true"] [data-profile-dot="game"]{background:var(--accent)}
.profile-chip[aria-pressed="true"] [data-profile-dot="web"]{background:${PROFILE_DOT.web}}
.profile-chip[aria-pressed="true"] [data-profile-dot="kids"]{background:var(--scene)}
.chip-tag{font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;color:var(--faint)}
.dot{width:5px;height:5px;border-radius:50%;flex:none;display:inline-block}
.dot-ok{background:var(--ok)}
.title-centre{flex:1;display:flex;justify-content:center;min-width:0}
.project-pill{display:flex;align-items:center;gap:8px;height:22px;padding:0 11px;border-radius:11px;background:var(--header);border:1px solid var(--line-control);font-size:11px;white-space:nowrap}
.project-pill[data-project-state="dirty"],.project-pill[data-project-state="recovering"]{border-color:var(--accent);color:var(--accent)}
.project-pill[data-project-state="refused"]{border-color:${SIGNAL.refuseLine};color:var(--refuse)}
.title-actions{display:flex;align-items:center;gap:9px;flex:none}
/* Drawer toggles exist at every size but only matter once a column undocks.
   Scoped so the later .ghost-button rule cannot win on equal specificity. */
.title-actions .drawer-toggle{display:none}`;
}

export function modeRailStyles(): string {
  return `.mode-rail{background:var(--well);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:9px 0;gap:2px}
.brand{width:28px;height:28px;border-radius:7px;background:var(--accent);margin-bottom:9px;display:grid;place-items:center;box-shadow:0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),0 5px 16px -5px color-mix(in srgb, var(--accent) 60%, transparent)}
.brand::before{content:"";width:10px;height:10px;border:2px solid var(--on-accent);border-radius:1px;transform:rotate(45deg)}
.rail-mode{width:44px;height:42px;border-radius:var(--r-control);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;position:relative;color:var(--faint)}
.rail-mode:hover{background:var(--header)}
.rail-mode[aria-pressed="true"]{background:var(--header);color:var(--accent)}
.rail-mode[aria-pressed="true"]::before{content:"";position:absolute;left:-9px;top:10px;bottom:10px;width:2px;border-radius:0 2px 2px 0;background:var(--accent)}
.rail-glyph{width:14px;height:14px;border:1.5px solid currentColor;display:block}
.rail-label{font-family:var(--mono);font-size:8px;letter-spacing:.05em}`;
}

export function statusBarStyles(): string {
  return `.status-bar{position:relative;background:var(--well);border-top:1px solid var(--line);display:flex;align-items:center;padding:0 12px;gap:13px}
.status-text{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text-3)}
.status-pin{font-family:var(--mono);font-size:10px;color:var(--faint)}
.status-project{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:10px;color:var(--dim)}
.divider{width:1px;height:12px;background:var(--line-card)}
.state-shortcut{font-family:var(--mono);font-size:9px;letter-spacing:.07em;color:var(--faint);border:1px solid var(--line-control);border-radius:3px;padding:2px 7px}
.state-shortcut:hover{border-color:var(--line-hover);color:var(--text)}`;
}
