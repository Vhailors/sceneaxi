import { PROFILE_DOT, SCRIM, SIGNAL, SURFACE, VIEWPORT_GRADIENT } from "../../visual-tokens.js";

export function viewportLayoutStyles(): string {
  return `.viewport-column{display:flex;flex-direction:column;min-width:0;min-height:0}
.viewport-region{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;background:var(--canvas)}
.stage-host{flex:1;min-height:0;display:flex;flex-direction:column}
.profile-surfaces{flex:none;background:var(--panel);border-bottom:1px solid var(--line);position:relative}
.profile-surface{min-height:56px;padding:var(--space-2) var(--space-3);display:grid;grid-template-columns:120px minmax(0,1fr);gap:var(--space-3);align-items:center}
.capability-list{display:none}`;
}

export function viewportStyles(): string {
  return `.profile-surface[data-profile-surface="web"]{display:none}
.shell[data-profile="web"] .profile-surface[data-profile-surface="game"]{display:none}
.shell[data-profile="web"] .profile-surface[data-profile-surface="web"]{display:grid}
.profile-surface strong{font-size:13px}
.capability-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--space-1);min-width:0}
.capability-list li{position:relative;min-width:0;flex:1 1 120px;padding:var(--space-1) var(--space-2);background:var(--raised);border:1px solid var(--line-card);border-radius:6px}
/* Each capability names itself in one short title; its sentence is secondary
   detail, disclosed with the rest of the details layer rather than cut off. */
.capability-list b,.capability-list span{display:block;min-width:0;overflow-wrap:anywhere}
.shell:not([data-details-open="true"]) .capability-list span{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.capability-list b{font-size:11px}.capability-list span{font-size:11px;color:var(--dim);margin-top:2px}
.game-runtime-note,.web-authoring-tools p{margin:0;font-size:12px;line-height:1.5;color:var(--dim)}
.web-authoring-note{display:none}
.shell[data-details-open="true"] .web-authoring-note{display:block}
.web-authoring-tools{display:flex;flex-direction:column;gap:8px;min-width:0}
.web-authoring-tools p{font-size:12px;color:var(--text-2)}
.web-authoring-tools code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${PROFILE_DOT.web}}
.profile-actions{display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center}
.profile-runtime-actions{min-height:32px;padding:0 var(--space-3) var(--space-2);display:flex;align-items:center;justify-content:flex-end;gap:var(--space-3)}
.runtime-report{order:-1;margin:0 auto 0 0;min-width:0;max-width:min(52ch,100%);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11px;color:var(--dim)}
.view-tabs{height:var(--tabs-h);flex:none;display:flex;align-items:stretch;background:var(--panel);border-bottom:1px solid var(--line)}
/* The tablist owns only its tabs: ARIA restricts a tablist's children to tabs,
   so the spacer and the tool glyphs stay siblings in the same flex row. */
.view-tablist{display:flex;align-items:stretch}
.view-tab{position:relative;padding:0 var(--space-4);font-size:12px;color:var(--dim);border-right:1px solid var(--line)}
.view-tab:not(.is-inert):not([aria-selected="true"]):hover{color:var(--text);background:var(--header)}
.view-tab[aria-selected="true"]{color:var(--text);font-weight:600;background:var(--panel)}
.spacer{flex:1}
.view-tools{display:flex;align-items:center;gap:var(--space-1);padding:0 var(--space-3)}
.view-tools i{width:10px;height:10px;border:1.4px solid var(--faint);border-radius:1px}
.viewport{flex:1;position:relative;min-height:0;overflow:hidden;background:radial-gradient(130% 95% at 50% 0%, ${VIEWPORT_GRADIENT.inner} 0%, ${VIEWPORT_GRADIENT.mid} 48%, ${SURFACE.canvas} 100%);display:grid;place-items:center}
.viewport-backdrop{position:absolute;inset:0;pointer-events:none}
/* Runtime overlay lines (desktop/linux features/overlay-report.ts) read as chips over the canvas. */
.viewport p[data-live-viewport]{z-index:3;width:fit-content;padding:var(--space-1) var(--space-2);border:1px solid var(--line-card);border-radius:6px;background:var(--well);font-family:var(--mono);font-size:11px;line-height:1.5;color:var(--text-2);overflow-wrap:anywhere}
/* Run: the viewport frame takes the accent edge; it opens by aperture (row 15). */
.shell[data-mode="run"] .viewport::after{content:"";position:absolute;inset:0;z-index:2;border:1px solid var(--accent);pointer-events:none}
.site-stage{display:none}
.shell[data-profile="web"] .stage-host{overflow:auto;background:${SIGNAL.infoSurface};padding:var(--space-4) var(--space-4) var(--space-6)}
.shell[data-profile="web"] .site-stage{display:block}
.site-browser-bar{display:flex;align-items:center;gap:var(--space-2);height:32px;padding:0 12px;border:1px solid var(--line);border-bottom:0;border-radius:10px 10px 0 0;background:var(--header)}
.site-browser-bar i{width:8px;height:8px;border-radius:50%;background:var(--line-hover)}
.site-browser-bar span{margin-left:8px;font-size:11px;color:var(--dim)}
.site-page{border:1px solid var(--line);border-bottom:0;background:var(--raised);padding:var(--space-4) var(--space-6) var(--space-3)}
.site-nav{display:flex;gap:16px;margin:0 0 var(--space-4);font-size:12px;color:var(--dim)}
.site-eyebrow{display:inline-block;margin:0 0 var(--space-3);padding:2px var(--space-2);border:1px solid var(--line);border-radius:var(--r-control);font-size:11px;font-weight:500;line-height:1.4;color:var(--text-2)}
.site-hero-copy h3{margin:0 0 8px;font-size:32px;line-height:1.1;color:var(--text)}
.site-hero-copy p{margin:0;max-width:44ch;font-size:14px;line-height:1.55;color:var(--text-2)}
.site-page-tail{display:none;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px;background:var(--panel);padding:var(--space-2) var(--space-6) var(--space-4)}
.shell[data-profile="web"] .site-page-tail{display:block}
.site-band{margin:16px 0;padding:var(--space-3) 0;border-top:1px solid var(--line-row)}
.site-band h4{margin:0 0 var(--space-2);font-size:16px}
.site-band p{margin:0;max-width:48ch;font-size:13px;line-height:1.55;color:var(--text-2)}
.site-foot{margin:var(--space-4) 0 0;font-size:11px;color:var(--dim)}`;
}

export function viewportOverlayStyles(): string {
  return `.viewport-note{margin:0;font-size:12px;line-height:1.55;color:var(--dim);max-width:44ch;text-align:center}
.axis-widget{position:absolute;right:12px;top:11px;display:flex;gap:4px}
.axis-widget i{width:18px;height:2px;border-radius:1px;display:block}
.assistant-manipulators{position:absolute;left:var(--space-3);top:var(--space-3);z-index:8;display:flex;gap:var(--space-1)}
.assistant-manipulator{border:1px solid var(--line-hover);border-radius:5px;background:var(--header);color:var(--text);min-height:26px;padding:var(--space-1) var(--space-2);font-size:11px}
.assistant-manipulator:hover{border-color:var(--accent);color:var(--accent)}
.assistant-manipulator.is-inert:hover{border-color:var(--line-hover);color:var(--inert)}

.sculpt-progress{position:absolute;left:50%;bottom:var(--space-4);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:var(--space-2);padding:var(--space-3) var(--space-4);border:1px solid var(--line-raised);border-radius:var(--r-card);background:var(--overlay);animation:ld-rise-md var(--motion-duration-panel) var(--motion-ease-out-expo) backwards}
.sculpt-label{margin:0;font-size:14px;font-weight:600}
.sculpt-track{width:320px;height:3px;background:var(--hover);border-radius:2px;overflow:hidden;position:relative}
.sculpt-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent)}
.sculpt-sweep{position:absolute;inset:0;width:90px;background:linear-gradient(90deg,transparent,${SCRIM.sheen},transparent);animation:sweep var(--motion-duration-loop) var(--motion-ease-out-quart) infinite}
.sculpt-detail{margin:0;font-family:var(--mono);font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums}`;
}
