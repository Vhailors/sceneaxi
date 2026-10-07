export function settingsStyles(): string {
  return `.editor-command-tools,.project-command-tools{display:grid;gap:var(--space-2);padding:var(--space-2);border-top:1px solid var(--line)}
.editor-command-form{display:grid;gap:var(--space-2);padding:var(--space-2) var(--space-3);border:1px solid var(--line-card);border-radius:var(--r-card);background:var(--well)}
.editor-command-form h3{margin:0;font-size:13px;font-weight:600}
.editor-command-form label,.viewport-source-control{display:grid;gap:var(--space-1);font-size:13px;color:var(--dim)}
.editor-command-form input,.editor-command-form select,.editor-command-form textarea,.viewport-source-control select{min-width:0;width:100%;min-height:28px;padding:var(--space-1) var(--space-2);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--well);color:var(--text);font:13px var(--mono)}
.editor-command-form textarea{min-height:48px;resize:vertical}
.editor-command-form :is(input,select,textarea):not(:disabled):not([aria-disabled="true"]):hover,.viewport-source-control select:not(:disabled):hover{border-color:var(--line-hover)}
.editor-command-form :is(input,select,textarea):focus-visible,.viewport-source-control select:focus-visible{border-color:var(--accent)}
.editor-command-form input:user-invalid{border-color:var(--refuse)}
.editor-command-form [aria-live]{margin:0;font-size:13px;line-height:1.5;color:var(--dim);overflow-wrap:anywhere}
.editor-command-form button,.view-tabs>[data-editor-command-submit]{min-height:28px;padding:var(--space-1) var(--space-2);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--header);text-align:left;font-size:13px}
.editor-command-form button:not(:disabled):hover,.view-tabs>[data-editor-command-submit]:not(:disabled):hover{border-color:var(--line-hover);color:var(--text)}
.editor-command-form button:disabled,.view-tabs>[data-editor-command-submit]:disabled{color:var(--inert);border-style:dashed;cursor:not-allowed}
.viewport-source-control{display:flex;align-items:center;white-space:nowrap}
.viewport-source-control select{width:auto}`;
}
