export function assetStyles(): string {
  return `.asset-browser{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:8px;padding:10px;min-width:0}
.asset-browser .panel-empty{grid-column:1/-1}
.asset-browser-card{min-width:0;padding:9px 10px;border:1px solid var(--line-card);border-radius:4px;background:var(--well)}
.asset-browser-card strong,.asset-browser-card span{display:block;overflow-wrap:anywhere}
.asset-browser-card strong{font-family:var(--mono);font-size:9px;color:var(--text)}
.asset-browser-card span{margin-top:4px;font-family:var(--mono);font-size:8px;line-height:1.45;color:var(--dim)}
.asset-browser-card .asset-browser-meta{display:none}`;
}

export function dockStyles(): string {
  return `.dock{height:var(--dock-h);flex:none;background:var(--panel);border-top:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.dock-tabs{height:30px;flex:none;display:flex;align-items:stretch;background:var(--header);border-bottom:1px solid var(--line)}
/* Same rule as the viewport strip: the bulk accept/reject are the highest
   consequence controls here, so they must not sit inside the tablist. */
.dock-tablist{display:flex;align-items:stretch}
.dock-tab{display:flex;align-items:center;gap:7px;padding:0 13px;font-size:11px;color:var(--dim);border-right:1px solid var(--line)}
.dock-tab[aria-selected="true"]{color:var(--text);font-weight:600;background:var(--panel);box-shadow:inset 0 2px 0 var(--accent)}
.badge{min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-family:var(--mono);font-size:9px;font-weight:700;display:grid;place-items:center}
.dock-body{flex:1;min-height:0;overflow-y:auto}
.dock-caption{margin:0;padding:8px 14px;font-size:10.5px;color:var(--dim);border-bottom:1px solid var(--line-row);background:var(--well)}
.change-proposal{padding:12px 14px;display:grid;grid-template-columns:minmax(220px,.42fr) minmax(0,1fr) auto;gap:14px;align-items:start}
.change-meta{margin:0;display:grid;gap:9px;min-width:0}
.change-meta div{min-width:0}
.change-meta dt{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.change-meta dd{margin:3px 0 0;min-width:0;color:var(--text-2)}
.change-meta code{display:block;overflow-wrap:anywhere;font-size:10px}
.change-diff{min-width:0;max-height:min(46vh,280px);overflow:auto;margin:0;padding:9px 10px;border:1px solid var(--line-control);border-radius:4px;background:var(--well);color:var(--text-2);font:10px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
.change-actions{display:flex;gap:7px;justify-content:flex-end}
.change-actions .primary-button,.change-actions .ghost-button{height:30px;padding:0 13px}
.change-empty{margin:0;padding:34px 14px;text-align:center;font-size:12px;color:var(--dim)}`;
}
