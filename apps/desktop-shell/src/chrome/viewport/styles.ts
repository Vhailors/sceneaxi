import { PROFILE_DOT, SCRIM, SIGNAL, SURFACE, VIEWPORT_GRADIENT } from "../../visual-tokens.js";

export function viewportLayoutStyles(): string {
  return `.viewport-column{display:flex;flex-direction:column;min-width:0;min-height:0}
.viewport-region{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;background:var(--canvas)}
.stage-host{flex:1;min-height:0;display:flex;flex-direction:column}
.profile-surfaces{flex:none;background:var(--panel);border-bottom:1px solid var(--line);position:relative}
.profile-surface{min-height:56px;padding:10px 14px;display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;align-items:center}
.capability-list{display:none}`;
}

export function viewportStyles(): string {
  return `.profile-surface[data-profile-surface="web"]{display:none}
.shell[data-profile="web"] .profile-surface[data-profile-surface="game"]{display:none}
.shell[data-profile="web"] .profile-surface[data-profile-surface="web"]{display:grid}
.profile-kicker{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.14em;color:var(--accent);margin-bottom:4px}
.profile-surface strong{font-size:13px}
.capability-list{list-style:none;margin:0;padding:0;display:flex;gap:6px;min-width:0;overflow:hidden}
.capability-list li{min-width:0;flex:1;padding:6px 8px;background:var(--raised);border:1px solid var(--line-card);border-radius:4px}
.capability-list b,.capability-list span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.capability-list b{font-size:10px}.capability-list span{font-size:8.5px;color:var(--dim);margin-top:2px}
.game-runtime-note,.web-authoring-tools p{margin:0;font-size:10px;line-height:1.45;color:var(--dim)}
.web-authoring-note{display:none}
.shell[data-details-open="true"] .web-authoring-note{display:block}
.web-authoring-tools{display:flex;flex-direction:column;gap:8px;min-width:0}
.web-authoring-tools p{font-size:12px;color:var(--text-2)}
.web-authoring-tools code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${PROFILE_DOT.web}}
.profile-actions{display:flex;gap:6px;align-items:center}
.profile-runtime-actions{min-height:30px;padding:0 12px 7px;display:flex;align-items:center;justify-content:flex-end;gap:9px}
.runtime-report{margin:0;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:8.5px;color:var(--dim)}
.view-tabs{height:var(--tabs-h);flex:none;display:flex;align-items:stretch;background:var(--panel);border-bottom:1px solid var(--line)}
/* The tablist owns only its tabs: ARIA restricts a tablist's children to tabs,
   so the spacer and the tool glyphs stay siblings in the same flex row. */
.view-tablist{display:flex;align-items:stretch}
.view-tab{padding:0 15px;font-size:11px;color:var(--dim);border-right:1px solid var(--line)}
.view-tab[aria-selected="true"]{color:var(--text);font-weight:600;background:var(--panel);box-shadow:inset 0 2px 0 var(--accent)}
.spacer{flex:1}
.view-tools{display:flex;align-items:center;gap:3px;padding:0 8px}
.view-tools i{width:10px;height:10px;border:1.4px solid var(--faint);border-radius:1px}
.viewport{flex:1;position:relative;min-height:0;overflow:hidden;background:radial-gradient(130% 95% at 50% 0%, ${VIEWPORT_GRADIENT.inner} 0%, ${VIEWPORT_GRADIENT.mid} 48%, ${SURFACE.canvas} 100%);display:grid;place-items:center}
.viewport-backdrop{position:absolute;inset:0;pointer-events:none}
.site-stage{display:none}
.shell[data-profile="web"] .stage-host{overflow:auto;background:${SIGNAL.infoSurface};padding:18px 20px 28px}
.shell[data-profile="web"] .site-stage{display:block}
.site-browser-bar{display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--line);border-bottom:0;border-radius:10px 10px 0 0;background:var(--header)}
.site-browser-bar i{width:8px;height:8px;border-radius:50%;background:var(--line-hover)}
.site-browser-bar span{margin-left:8px;font-size:11px;color:var(--dim)}
.site-page{border:1px solid var(--line);border-bottom:0;background:var(--raised);padding:18px 24px 14px}
.site-nav{display:flex;gap:16px;margin:0 0 18px;font-size:12px;color:var(--dim)}
.site-eyebrow{margin:0 0 6px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.site-hero-copy h3{margin:0 0 8px;font-size:32px;line-height:1.1;color:var(--text)}
.site-hero-copy p{margin:0;max-width:44ch;font-size:14px;line-height:1.55;color:var(--text-2)}
.site-page-tail{display:none;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px;background:var(--panel);padding:8px 24px 20px}
.shell[data-profile="web"] .site-page-tail{display:block}
.site-band{margin:16px 0;padding:14px 0;border-top:1px solid var(--line-row)}
.site-band h4{margin:0 0 6px;font-size:16px}
.site-band p{margin:0;max-width:48ch;font-size:13px;line-height:1.55;color:var(--text-2)}
.site-foot{margin:18px 0 0;font-size:11px;color:var(--dim)}`;
}

export function viewportOverlayStyles(): string {
  return `.viewport-note{margin:0;font-size:11px;line-height:1.5;color:var(--dim);max-width:44ch;text-align:center}
.axis-widget{position:absolute;right:12px;top:11px;display:flex;gap:4px}
.axis-widget i{width:18px;height:2px;border-radius:1px;display:block}
.assistant-manipulators{position:absolute;left:12px;top:12px;z-index:8;display:flex;gap:4px}
.assistant-manipulator{border:1px solid var(--line-hover);border-radius:3px;background:var(--header);color:var(--text);padding:5px 7px;font-size:10px}
.assistant-manipulator:hover{border-color:var(--accent);color:var(--accent)}
.assistant-manipulator.is-inert:hover{border-color:var(--line-hover);color:var(--inert)}

.sculpt-progress{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:9px;animation:rise .3s ease-out}
.sculpt-label{margin:0;font-size:14px;font-weight:600}
.sculpt-track{width:320px;height:3px;background:var(--hover);border-radius:2px;overflow:hidden;position:relative}
.sculpt-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent)}
.sculpt-sweep{position:absolute;inset:0;width:28%;background:linear-gradient(90deg,transparent,${SCRIM.sheen},transparent);animation:sweep 1.1s linear infinite}
.sculpt-detail{margin:0;font-family:var(--mono);font-size:9px;color:var(--faint)}`;
}
