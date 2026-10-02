export function inspectorStyles(): string {
  return `.ship-export-evidence,.project-git-controls{display:none}
.shell[data-details-open="true"] .ship-export-evidence,
.shell[data-details-open="true"] .project-git-controls{display:grid}
.scene-property-editor{display:grid;gap:6px;padding:8px 10px}
.scene-property-entity{margin:0;padding-bottom:5px;border-bottom:1px solid var(--line);min-width:0}
.scene-property-entity b,.scene-property-entity code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scene-property-entity b{font-size:12px}.scene-property-entity code{display:none}
.scene-property-editor label{display:grid;gap:3px;font-size:9px;color:var(--dim)}
.scene-transform-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.scene-advanced{display:none;min-width:0;border:1px solid var(--line-row);border-radius:5px;padding:8px}
.shell[data-details-open="true"] .scene-advanced{display:grid;gap:7px}
.scene-review-details .scene-property-review{margin-top:4px}
.scene-instance-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.scene-instance-actions button{min-width:0;padding-inline:6px}
.scene-parenting{display:grid;gap:7px;padding-top:2px}.scene-parenting label{display:grid;gap:4px}.scene-parenting select{width:100%;min-width:0;height:28px;border:1px solid var(--line-control);border-radius:4px;background:var(--raised);color:var(--text);font-family:var(--mono);font-size:9px}
.scene-property-input{width:100%;min-width:0;height:28px;padding:0 8px;border:1px solid var(--line-control);border-radius:4px;background:var(--raised);color:var(--text);font-family:var(--mono);font-size:11px}
.scene-property-input:focus{outline:1px solid var(--accent);outline-offset:1px}.scene-property-input.is-inert{color:var(--inert)}
.scene-property-diagnostic{margin:0;font-size:9px;line-height:1.45;color:var(--dim);overflow-wrap:anywhere}
.scene-property-review{max-height:150px;margin:0;padding:8px;overflow:auto;border:1px solid var(--line);border-radius:4px;background:var(--well);color:var(--dim);font-family:var(--mono);font-size:8px;line-height:1.45;white-space:pre-wrap}
.ship-export-panel{padding:0 12px 12px}.ship-export-evidence{display:grid;gap:8px;margin:12px 0 0}.ship-export-evidence div{min-width:0}.ship-export-evidence dt{font:9px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}.ship-export-evidence dd{margin:2px 0 0;color:var(--dim);overflow-wrap:anywhere}.ship-export-evidence code{font-size:9px}
.pass-list{list-style:none;margin:0;padding:10px 11px;display:flex;flex-direction:column;gap:6px}
.pass-row{display:flex;align-items:center;gap:10px;padding:6px 9px;background:var(--raised);border:1px solid var(--line);border-radius:4px}
.pass-order{width:14px;height:14px;border-radius:3px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:9px;font-weight:700;flex:none}
.pass-row b{display:block;font-size:11px;font-weight:400;color:var(--text)}
.pass-row em{display:block;font-style:normal;font-size:10px;color:var(--dim)}`;
}

export function webInspectorStyles(): string {
  return `.web-page-inspector{display:none;padding:0 0 16px}
.shell[data-profile="web"] .web-page-inspector{display:block}
.web-page-sections{list-style:none;margin:0;padding:8px 12px;display:grid;gap:8px}
.web-page-sections li{padding:10px 11px;border:1px solid var(--line-card);border-radius:8px;background:var(--raised)}
.web-page-sections b,.web-page-sections span{display:block}
.web-page-sections b{font-size:12px}
.web-page-sections span{margin-top:3px;font-size:11px;color:var(--dim)}`;
}
