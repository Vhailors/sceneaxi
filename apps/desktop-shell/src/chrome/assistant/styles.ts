import { ACCENT, SIGNAL } from "../../visual-tokens.js";

export function assistantStyles(): string {
  return `.assistant{background:var(--assistant);border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.assistant-head{height:36px;flex:none;display:flex;align-items:center;gap:9px;padding:0 12px;background:var(--raised);border-bottom:1px solid var(--line)}
.assistant-head h2{margin:0;font-size:13px;font-weight:600;flex:1}
.assistant-mark{width:16px;height:16px;border-radius:var(--r-control);background:${ACCENT.surface};display:grid;place-items:center}
.assistant-mark::before{content:"";width:6px;height:6px;border-radius:1px;background:var(--accent);transform:rotate(45deg)}
.shell[data-assistant-busy="true"] .assistant-mark{box-shadow:0 0 0 4px ${ACCENT.surface};animation:assistant-breathe 1.1s ease-in-out infinite}
.shell[data-assistant-busy="true"] .assistant-mark::before{animation:assistant-spin 1.6s linear infinite}
.shell[data-assistant-busy="true"] .viewport::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(80% 70% at 50% 40%, ${ACCENT.surface} 0%, transparent 70%);animation:assistant-glow 1.4s ease-in-out infinite}
.shell[data-assistant="denied"] .assistant-mark{background:${SIGNAL.sceneSurface}}
.shell[data-assistant="denied"] .assistant-mark::before{background:var(--scene)}
.assistant-model{font-family:var(--mono);font-size:13px;color:var(--dim);background:var(--header);border:1px solid var(--line-control);border-radius:var(--r-control);padding:2px var(--space-2)}
.icon-button{width:26px;height:26px;border-radius:var(--r-control);display:grid;place-items:center;color:var(--dim)}
/* An icon button on the accent fill keeps the on-accent glyph colour: without
   this the later single-class rule wins and paints --dim on orange (1.1:1). */
.primary-button.icon-button{color:var(--on-accent)}
.primary-button.icon-button.is-inert{color:var(--inert-on-accent)}
.assistant-body{flex:1;min-height:0;overflow-y:auto;padding:13px 12px}
.assistant-empty{margin:0;font-size:13px;line-height:1.55;color:var(--dim)}
.assistant-live{display:none;align-items:end;gap:var(--space-1);height:28px;margin:var(--space-3) 0 0}
.shell[data-assistant-busy="true"] .assistant-live{display:flex}
.assistant-live i{width:5px;border-radius:var(--r-control);background:var(--accent);animation:assistant-bars var(--motion-duration-loop) var(--motion-ease-out-quart) infinite}
.assistant-live i:nth-child(1){height:8px;animation-delay:0s}
.assistant-live i:nth-child(2){height:16px;animation-delay:.12s}
.assistant-live i:nth-child(3){height:22px;animation-delay:.24s}
.assistant-thinking{display:flex;align-items:center;gap:var(--space-1);margin:var(--space-3) 0 0;font-size:13px;color:var(--accent)}
.assistant-thinking .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:assistant-dot 1s ease-in-out infinite}
.assistant-thinking .dot:nth-child(2){animation-delay:.15s}
.assistant-thinking .dot:nth-child(3){animation-delay:.3s}
.assistant-progress{font-size:13px;line-height:1.5;color:var(--text-2);padding:9px;border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--header);transition:border-color .2s ease,color .2s ease}
.shell[data-assistant-busy="true"] .assistant-progress{border-color:var(--accent);color:var(--text);animation:assistant-card 1.2s ease-in-out infinite}
.assistant-result{font-size:13px;line-height:1.55;color:var(--text-3);white-space:pre-wrap;animation:ld-rise-sm var(--motion-duration-micro) var(--motion-ease-out-quart) backwards}
.assistant-foot{font-size:13px;color:var(--dim);line-height:1.5;margin:var(--space-3) 0 0}
.assistant-composer{flex:none;border-top:1px solid var(--line);background:var(--panel);padding:9px 11px 11px;display:flex;flex-direction:column;gap:8px}
.assistant-prompt{width:100%;min-height:58px;resize:vertical;border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--well);color:var(--text);font:13px/1.5 var(--sans);padding:8px}
.assistant-prompt.is-inert{color:var(--inert);cursor:not-allowed}
.assistant-routes{display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-1)}
.shell[data-details-open="true"] .assistant-routes{display:grid}
.assistant-route{min-width:0;padding:5px 3px;border:1px solid var(--line-control);border-radius:var(--r-control);color:var(--dim);font-size:13px;line-height:1.2}
.assistant-route-refusal{display:block;margin-top:3px;font-size:13px;line-height:1.2;overflow-wrap:anywhere;color:var(--scene)}
.assistant-route[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:${ACCENT.surface}}
.assistant-route:not(.is-inert):not([aria-pressed="true"]):hover{border-color:var(--line-hover);color:var(--text)}
.composer-actions{display:flex;align-items:center;gap:var(--space-2)}
.assistant-modes{display:flex;background:var(--header);border:1px solid var(--line-control);border-radius:var(--r-card);padding:2px}
.assistant-mode{position:relative;isolation:isolate;height:var(--control-h);padding:0 var(--space-3);font-size:13px;color:var(--dim);border-radius:var(--r-control)}
.assistant-mode[aria-pressed="true"]{background:var(--accent);color:var(--on-accent);font-weight:600}
/* Row 17 indicator: the fill also lives on ::before, under the label. While the
   motion script glides it in from the previous mode (translate + clip-path), the
   button's own fill is held clear so only the moving fill shows. */
.assistant-mode[aria-pressed="true"]::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--accent);pointer-events:none}
.assistant-mode.is-gliding[aria-pressed="true"]{background:transparent}
.assistant-mode.is-inert[aria-pressed="true"]{color:var(--inert-on-accent)}
/* Both assistant bodies ship in every document and the state chooses between
   them, so a profile switched in the browser reaches the same named denial the
   model reports — the rule the editor body's refusal region already follows. */
.assistant-denied{display:none;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);padding:var(--space-8) var(--space-6);text-align:center}
.shell[data-assistant="denied"] .assistant-denied{display:flex}
.shell[data-assistant="denied"] .assistant-body,
.shell[data-assistant="denied"] .assistant-composer{display:none}
.assistant-denied p{margin:0;font-size:13px;color:var(--dim);line-height:1.6}
.assistant-denied-title{font-size:17px;font-weight:700;color:var(--text);text-wrap:balance}
.assistant-denied-detail,.assistant-denied-code{display:none}
.shell[data-details-open="true"] .assistant-denied-detail,
.shell[data-details-open="true"] .assistant-denied-code{display:block}
.assistant-denied code{color:${SIGNAL.sceneText};border:1px solid ${SIGNAL.sceneLine};background:${SIGNAL.sceneSurface};border-radius:var(--r-control);padding:4px 8px;display:inline-block}`;
}
