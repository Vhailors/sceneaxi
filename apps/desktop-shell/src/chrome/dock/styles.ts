export function assetStyles(): string {
  return `.asset-browser{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:var(--space-2);padding:var(--space-3);min-width:0}
.asset-browser .panel-empty{grid-column:1/-1}
.asset-browser-card{min-width:0;padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-radius:6px;background:var(--well)}
.asset-browser-card strong,.asset-browser-card span{display:block;overflow-wrap:anywhere}
.asset-browser-card strong{font-family:var(--mono);font-size:11px;color:var(--text)}
.asset-browser-card span{margin-top:4px;font-family:var(--mono);font-size:8px;line-height:1.45;color:var(--dim)}
.asset-browser-card .asset-browser-meta{display:none}`;
}

export function dockStyles(): string {
  return `.dock{height:var(--dock-h);flex:none;background:var(--panel);border-top:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.dock-tabs{height:30px;flex:none;display:flex;align-items:stretch;background:var(--header);border-bottom:1px solid var(--line)}
/* Same rule as the viewport strip: the bulk accept/reject are the highest
   consequence controls here, so they must not sit inside the tablist. */
.dock-tablist{display:flex;align-items:stretch}
.dock-tab{position:relative;display:flex;align-items:center;gap:var(--space-2);padding:0 var(--space-4);font-size:12px;color:var(--dim);border-right:1px solid var(--line)}
.dock-tab:not(.is-inert):not([aria-selected="true"]):hover{color:var(--text);background:var(--panel)}
.dock-tab[aria-selected="true"]{color:var(--text);font-weight:600;background:var(--panel)}
:is(.view-tab,.dock-tab)[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--accent);pointer-events:none}
.badge{min-width:18px;height:18px;padding:0 var(--space-1);border-radius:9px;background:var(--accent);color:var(--on-accent);font-family:var(--mono);font-size:11px;font-weight:700;display:grid;place-items:center;font-variant-numeric:tabular-nums}
.dock-body{flex:1;min-height:0;overflow-y:auto}
.dock-caption{margin:0;padding:var(--space-2) var(--space-4);font-size:12px;line-height:1.5;color:var(--dim);border-bottom:1px solid var(--line-row);background:var(--well)}
.change-proposal{padding:var(--space-3) var(--space-4);display:grid;grid-template-columns:minmax(220px,.42fr) minmax(0,1fr) auto;gap:var(--space-4);align-items:start}
.change-meta{margin:0;display:grid;gap:var(--space-2);min-width:0}
.change-meta div{min-width:0}
.change-meta dt{font-size:11px;color:var(--faint)}
.change-meta dd{margin:3px 0 0;min-width:0;color:var(--text-2)}
.change-meta code{display:block;overflow-wrap:anywhere;font-size:11px;font-variant-numeric:tabular-nums}
.change-diff{min-width:0;max-height:min(46vh,280px);overflow:auto;margin:0;padding:var(--space-2) var(--space-3);border:1px solid var(--line-control);border-radius:6px;background:var(--well);color:var(--text-2);font:11px/1.55 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}
.change-actions{display:flex;gap:var(--space-2);justify-content:flex-end}
.change-actions .primary-button,.change-actions .ghost-button{height:30px;padding:0 var(--space-3)}
.change-empty{margin:0;padding:34px 14px;text-align:center;font-size:12px;color:var(--dim)}`;
}
