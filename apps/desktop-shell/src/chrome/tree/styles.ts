import { ACCENT } from "../../visual-tokens.js";

export function projectStyles(): string {
  return `.project-panel{flex:none;border-bottom:1px solid var(--line)}
.project-panel .panel-head{justify-content:space-between}
.project-name{max-width:126px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim);font-size:11px;letter-spacing:0}
.project-launcher{display:grid;gap:7px;padding:9px;border-bottom:1px solid var(--line)}
.project-launcher p,.project-root{margin:0;color:var(--dim);font-size:9px;line-height:1.45;overflow-wrap:anywhere}
.project-lifecycle-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-2)}
.project-lifecycle-actions button{min-width:0;height:28px;padding-inline:var(--space-2);justify-content:center}
.project-recent-label{font-family:var(--mono);font-size:8px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}
.project-recent-select{width:100%;min-width:0;height:28px;padding:0 var(--space-2);border:1px solid var(--line-control);border-radius:5px;background:var(--raised);color:var(--text);font-family:var(--mono);font-size:11px}
.project-recent-select.is-inert{color:var(--inert);border-color:var(--line-control)}
.project-bound{min-width:0}
.project-files{padding:var(--space-2)}
.project-files select{width:100%;min-width:0;padding:var(--space-1);border:1px solid var(--line-control);border-radius:5px;background:var(--raised);color:var(--dim);font-family:var(--mono);font-size:11px}
.project-files select[aria-disabled="true"]{color:var(--inert);cursor:not-allowed}
.project-files option{padding:var(--space-2);color:var(--dim)}
.project-files option:checked{background:${ACCENT.surface};color:var(--text)}
.project-browser-detail{margin:0 var(--space-2) var(--space-2);padding:var(--space-2);border:1px solid var(--line);border-radius:6px;background:var(--well);min-width:0}
.project-browser-detail>strong{display:block;overflow-wrap:anywhere;font-family:var(--mono);font-size:11px;color:var(--text)}
.project-browser-detail dl{display:grid;gap:5px;margin:8px 0}
.project-browser-detail dl div{display:grid;grid-template-columns:72px minmax(0,1fr);gap:var(--space-2);min-width:0}
.project-browser-detail dt{font-family:var(--mono);font-size:8px;color:var(--faint);text-transform:uppercase}
.project-browser-detail dd{margin:0;min-width:0;overflow-wrap:anywhere;font-family:var(--mono);font-size:8px;line-height:1.45;color:var(--dim)}
.project-browser-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-1)}
.project-browser-actions button{min-width:0;height:auto;min-height:28px;padding:var(--space-1) var(--space-2);font-size:11px;white-space:normal;justify-content:center}
.project-browser-actions button:first-child{grid-column:1/-1}`;
}

export function treeStyles(): string {
  return `.scene-entities{padding:0 7px 9px}
.scene-entities-label{margin:var(--space-2) var(--space-1) var(--space-1);font-size:11px;color:var(--dim)}
.scene-entities select{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.scene-entity-identities{display:grid;gap:5px;min-width:0;margin:6px 0 0;padding:0;list-style:none}
.scene-entity-identity{min-width:0;margin-left:calc(var(--scene-depth,0) * var(--space-3));padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-left:2px solid var(--line-card);background:var(--well);cursor:pointer}
.scene-entity-identity:hover{border-color:var(--line-hover);background:var(--raised)}
.scene-entity-identity.is-selected{border-color:var(--accent);background:${ACCENT.surface}}
.scene-entity-identity>span{display:block;margin-bottom:2px;font-size:11px;font-weight:600;color:var(--text)}
.scene-entity-identity dl{display:none;gap:3px;margin:4px 0 0}
.shell[data-details-open="true"] .scene-entity-identity dl{display:grid}
.scene-entity-identity dl div{display:grid;grid-template-columns:42px minmax(0,1fr);gap:5px;min-width:0}
.scene-entity-identity dt{font-family:var(--mono);font-size:7px;line-height:1.45;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}
.scene-entity-identity dd{min-width:0;margin:0}
.scene-entity-identity code{display:block;min-width:0;font-size:8px;line-height:1.45;color:var(--dim);white-space:normal;overflow-wrap:anywhere}
.scene-entity{width:100%;min-width:0;padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-radius:6px;background:var(--raised);color:var(--dim);text-align:left}
.scene-entity:not(.is-inert):hover{border-color:var(--line-hover)}
.scene-entity span,.scene-entity code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scene-entity span{font-size:12px;color:var(--text)}.scene-entity code{margin-top:var(--space-1);font-size:11px;color:var(--dim)}
.scene-entity[aria-pressed="true"]{border-color:var(--accent);background:${ACCENT.surface}}
.scene-entities-refusal{margin:0;padding:0 var(--space-3) var(--space-2);font-size:11px;line-height:1.5;color:var(--dim);overflow-wrap:anywhere}
.project-file-state,.project-root,.scene-entities-refusal,.left-dock .panel-note{display:none}`;
}

export function projectDetailStyles(): string {
  return `.project-browser-status{margin:var(--space-1) 0 0;font-size:11px;color:var(--dim)}
.project-browser-advanced{display:none;margin-top:var(--space-2)}
.shell[data-details-open="true"] .project-browser-advanced{display:block}`;
}
