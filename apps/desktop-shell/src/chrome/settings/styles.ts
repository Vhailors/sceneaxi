export function settingsStyles(): string {
  return `.editor-command-tools,.project-command-tools{display:grid;gap:7px;padding:8px;border-top:1px solid var(--line)}
.editor-command-form{display:grid;gap:5px;padding:8px;border:1px solid var(--line-card);border-radius:5px;background:var(--well)}
.editor-command-form h3{margin:0;font-size:10px;font-weight:600}
.editor-command-form label,.viewport-source-control{display:grid;gap:3px;font-size:9px;color:var(--dim)}
.editor-command-form input,.editor-command-form select,.editor-command-form textarea,.viewport-source-control select{min-width:0;width:100%;padding:5px;border:1px solid var(--line-control);border-radius:4px;background:var(--raised);color:var(--text);font:9px var(--mono)}
.editor-command-form textarea{min-height:48px;resize:vertical}
.editor-command-form [aria-live]{margin:0;font-size:8px;line-height:1.4;color:var(--dim);overflow-wrap:anywhere}
.editor-command-form button,.view-tabs>[data-editor-command-submit]{min-height:24px;padding:3px 7px;border:1px solid var(--line-control);border-radius:4px;text-align:left;font-size:9px}
.editor-command-form button:disabled,.view-tabs>[data-editor-command-submit]:disabled{color:var(--inert);cursor:not-allowed}
.viewport-source-control{display:flex;align-items:center;white-space:nowrap}
.viewport-source-control select{width:auto}`;
}
