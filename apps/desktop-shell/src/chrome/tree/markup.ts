import { DESKTOP_MODE_IDS, type DesktopVisualView } from "../../visual-model.js";
import { button, escapeHtml, note, projectFileSelect, recentProjectSelect, sceneEntitySelect } from "../core/markup.js";
import { MODE_PANELS } from "../core/panels.js";
import { editorCommandForm } from "../settings/markup.js";

export function leftDock(view: DesktopVisualView): string {
  const active = view.state.mode;
  const project = view.product.surface.project;

  const panels = DESKTOP_MODE_IDS.map((mode) => {
    const panel = MODE_PANELS[mode];

    return `<section class="dock-panel" data-mode-panel="${escapeHtml(mode)}" aria-label="${escapeHtml(panel.leftTitle)}"${mode === active ? "" : " hidden"}>
  <h2 class="panel-head"><span>${escapeHtml(panel.leftTitle)}</span></h2>
  <p class="panel-empty"${mode === "run" ? " data-run-session-report" : ""}>${escapeHtml(panel.leftEmpty)}</p>
  ${mode === "run" ? `<pre class="change-diff" data-run-rarity-evidence hidden tabindex="0" role="region" aria-label="Safe rarity provenance for this run"></pre>` : ""}
  ${note(panel.note, panel.noteTone)}
</section>`;
  }).join("");

  return `<aside class="left-dock" id="left-dock" aria-label="Project files and editor panels">
<section class="project-panel" aria-labelledby="project-files-title">
  <h2 class="panel-head" id="project-files-title"><span data-files-title>Objects</span><span class="project-name" data-project-name>${escapeHtml(project.name)}</span></h2>
  <div class="project-launcher" data-project-launcher>
    <p>No project is selected. New Project creates the starter only after you choose its directory.</p>
    <div class="project-lifecycle-actions">
      ${button(view.product.newProject, "New Project", "primary-button", ` data-product-action data-command="project-new"`)}
      ${button(view.product.openProjectRoot, "Open Project", "ghost-button", ` data-product-action data-command="project-open"`)}
    </div>
    <label class="project-recent-label" for="project-recent-select">Recent</label>
    ${recentProjectSelect(view.product.recentProject)}
    <div class="project-lifecycle-actions">
      ${button(view.product.openRecent, "Open Recent", "ghost-button", ` data-product-action data-action="project-open-recent"`)}
      ${button(view.product.removeRecent, "Remove", "ghost-button", ` data-product-action data-action="project-remove-recent"`)}
    </div>
  </div>
  <div class="project-bound" data-project-bound hidden>
    <div class="project-files" data-project-files>${projectFileSelect(view.product.browseFile, project.files)}</div>
    <section class="project-browser-detail" data-project-browser-detail hidden aria-live="polite">
      <strong data-project-browser-path></strong>
      <p class="project-browser-status" data-project-browser-validation></p>
      <div class="project-browser-advanced">
        <dl>
          <div><dt>Type</dt><dd data-project-browser-type></dd></div>
          <div><dt>Digest</dt><dd data-project-browser-digest></dd></div>
          <div><dt>Provenance</dt><dd data-project-browser-provenance></dd></div>
        </dl>
      </div>
      <div class="project-browser-actions">
        ${button(view.product.openBrowserFile, "Open", "ghost-button", ` data-product-action data-action="project-browser-open"`)}
        ${button(view.product.renameBrowserFile, "Rename…", "ghost-button", ` data-product-action data-action="project-browser-rename"`)}
        ${button(view.product.deleteBrowserFile, "Delete…", "ghost-button", ` data-product-action data-action="project-browser-delete"`)}
      </div>
      <p class="panel-empty">${escapeHtml(view.product.renameBrowserFile.refusal ?? "")} · ${escapeHtml(view.product.renameBrowserFile.refusalMessage ?? "")}</p>
    </section>
    <div class="scene-entities" data-scene-entities hidden>
      <p class="scene-entities-label">Objects · click to select</p>
      ${sceneEntitySelect(view.product.selectSceneEntity)}
      <ol class="scene-entity-identities" data-scene-identities aria-label="Hierarchy object identities and parentage"></ol>
    </div>
    <p class="scene-entities-refusal" data-scene-entities-refusal aria-live="polite" hidden></p>
    <p class="project-root" data-project-root></p>
    <section class="project-command-tools" aria-label="Project commands">
      ${editorCommandForm(view, "project-migration-commit", "Commit approved project migration")}
      ${editorCommandForm(view, "input-actions-inspect", "Inspect input actions")}
      ${editorCommandForm(view, "input-action-rebind", "Rebind input action")}
      ${editorCommandForm(view, "input-actions-reset", "Reset input actions")}
    </section>
  </div>
  <p class="project-file-state" data-project-file-state>Active · not opened</p>
</section>
${panels}</aside>`;
}
