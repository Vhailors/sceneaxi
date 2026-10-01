import { DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS } from "@sceneaxi/schemas";
import { DESKTOP_MODE_IDS, SCULPT_PASSES, type DesktopVisualView } from "../../visual-model.js";
import { button, editorCommandAttributes, escapeHtml, gitCommitMessageInput, mutationTextarea, numericPropertyInput, selectControlAttributes, transformSnapInput } from "../core/markup.js";
import { MODE_PANELS } from "../core/panels.js";
import { editorCommandForm } from "../settings/markup.js";

function inspectorCatalogs(view: DesktopVisualView): string {
  return view.product.inspectors.map((inspector) => `<section class="scene-catalog-editor" aria-label="${escapeHtml(inspector.kind)} inspector">
    <h3>${escapeHtml(inspector.kind)}</h3>
    ${button(inspector.inspect, "Inspect", "ghost-button", ` data-product-action data-command="${inspector.inspectCommand}"`)}
    <pre data-catalog-report="${inspector.kind}" hidden role="region" aria-label="${escapeHtml(inspector.kind)} inspection"></pre>
    <p>Inspect the catalog, then enter one supported mutation object and stage it for review.</p>
    <label>Mutation JSON${mutationTextarea(inspector.mutation, ` data-catalog-mutation="${inspector.kind}" rows="3" spellcheck="false" aria-label="${escapeHtml(inspector.kind)} mutation JSON"`)}</label>
    ${button(inspector.stage, "Stage change", "primary-button", ` data-product-action data-action="catalog-stage" data-value="${inspector.kind}"`)}
  </section>`).join("");
}

export function inspector(view: DesktopVisualView): string {
  const active = view.state.mode;

  const panels = DESKTOP_MODE_IDS.map((mode) => {
    const panel = MODE_PANELS[mode];

    return `<section class="inspector-panel" data-mode-panel="${escapeHtml(mode)}" aria-label="${escapeHtml(panel.inspectorTitle)}"${mode === active ? "" : " hidden"}>
  <h2 class="panel-head"><span>${escapeHtml(panel.inspectorTitle)}</span></h2>
  <p class="panel-empty"${mode === "run" ? " data-run-live-report" : mode === "ship" ? ' data-ship-export-status aria-live="polite"' : ""}>${escapeHtml(panel.inspectorEmpty)}</p>
  ${
    mode === "build"
      ? `<div class="scene-property-editor" data-scene-property-editor hidden>
    <p class="scene-property-entity"><b data-scene-property-entity-label></b><code data-scene-property-entity-id></code></p>
    <div class="scene-transform-grid">${DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition, index) => {
      const control = view.product.transformProperties[index];

      return control === undefined
        ? ""
        : `<label for="${escapeHtml(control.id)}"><span>${escapeHtml(definition.label)}</span>${numericPropertyInput(control, definition)}</label>`;
    }).join("")}</div>
    ${button(
      view.product.stageSceneEdit,
      "Stage",
      "primary-button block-button",
      ` data-product-action data-action="scene-property-stage"`,
    )}
    <p class="scene-property-diagnostic" data-scene-property-diagnostic aria-live="polite">Select an object, change one value, then Stage.</p>
    <div class="scene-advanced">
    <div class="scene-transform-gizmo" role="group" aria-label="Viewport transform gizmo">
      <div class="scene-instance-actions">
        ${button(view.product.transformModeTranslate, "Move", "ghost-button", ` data-product-action data-action="scene-transform-mode" data-value="translate"`)}
        ${button(view.product.transformModeRotate, "Rotate", "ghost-button", ` data-product-action data-action="scene-transform-mode" data-value="rotate"`)}
        ${button(view.product.transformModeScale, "Scale", "ghost-button", ` data-product-action data-action="scene-transform-mode" data-value="scale"`)}
      </div>
      <label for="${escapeHtml(view.product.transformSpace.id)}"><span>Space</span><select ${selectControlAttributes(view.product.transformSpace)} data-scene-transform-space aria-label="Transform space"><option value="local">Local</option><option value="world">World</option></select></label>
      <label for="${escapeHtml(view.product.transformPivot.id)}"><span>Pivot</span><select ${selectControlAttributes(view.product.transformPivot)} data-scene-transform-pivot aria-label="Transform pivot"><option value="individual">Individual</option><option value="selection">Selection</option><option value="origin">Origin</option></select></label>
      <label for="${escapeHtml(view.product.transformSnap.id)}"><span>Snap</span>${transformSnapInput(view.product.transformSnap)}</label>
      <div class="scene-instance-actions">
        ${button(view.product.transformNudgeXMinus, "−X", "ghost-button", ` data-product-action data-action="scene-transform-nudge" data-axis="x" data-sign="-1"`)}
        ${button(view.product.transformNudgeXPlus, "+X", "ghost-button", ` data-product-action data-action="scene-transform-nudge" data-axis="x" data-sign="1"`)}
        ${button(view.product.transformNudgeYMinus, "−Y", "ghost-button", ` data-product-action data-action="scene-transform-nudge" data-axis="y" data-sign="-1"`)}
        ${button(view.product.transformNudgeYPlus, "+Y", "ghost-button", ` data-product-action data-action="scene-transform-nudge" data-axis="y" data-sign="1"`)}
        ${button(view.product.transformNudgeZMinus, "−Z", "ghost-button", ` data-product-action data-action="scene-transform-nudge" data-axis="z" data-sign="-1"`)}
        ${button(view.product.transformNudgeZPlus, "+Z", "ghost-button", ` data-product-action data-action="scene-transform-nudge" data-axis="z" data-sign="1"`)}
      </div>
    </div>
    <div class="scene-instance-actions">
      ${button(view.product.addSceneInstance, "Duplicate", "ghost-button", ` data-product-action data-action="scene-instance-add"`)}
      ${button(view.product.removeSceneInstance, "Remove", "ghost-button", ` data-product-action data-action="scene-instance-remove"`)}
    </div>
    <div class="scene-parenting">
      <label for="${escapeHtml(view.product.reparentSceneParent.id)}"><span>New parent</span><select ${selectControlAttributes(view.product.reparentSceneParent)} data-scene-parent aria-label="New parent"></select></label>
      <label for="${escapeHtml(view.product.reparentScenePolicy.id)}"><span>Keep</span><select ${selectControlAttributes(view.product.reparentScenePolicy)} data-scene-policy aria-label="Transform policy"><option value="preserve-world">World place</option><option value="preserve-local">Local place</option></select></label>
      ${button(view.product.reparentSceneInstance, "Reparent", "ghost-button block-button", ` data-product-action data-action="scene-instance-reparent"`)}
    </div>
    </div>
    <div class="scene-advanced scene-review-details">
      <pre class="scene-property-review" data-scene-property-review hidden></pre>
    </div>
  </div>`
      : mode === "run"
        ? `<div class="run-controls">
    ${button(view.product.runStop, "Stop", "ghost-button", ` data-product-action data-command="run-stop"`)}
    ${button(view.product.runReset, "Reset", "ghost-button", ` data-product-action data-command="run-reset"`)}
  </div>`
        : mode === "ship"
        ? `<div class="ship-export-panel">
    ${button(view.product.exportWeb, "Export Web", "primary-button block-button", ` data-product-action data-command="ship-export-web"`)}
    <dl class="ship-export-evidence" data-ship-export-evidence hidden>
      <div><dt>Output</dt><dd><code data-ship-output></code></dd></div>
      <div><dt>Bundle digest</dt><dd><code data-ship-bundle-digest></code></dd></div>
      <div><dt>Source project</dt><dd><code data-ship-source-digest></code></dd></div>
      <div><dt>Handoff</dt><dd><code data-ship-handoff-path></code></dd></div>
    </dl>
    <div class="project-git-controls">
      <fieldset data-project-git-selection>
        <legend>Selected files</legend>
        <div data-project-git-path-list><p>Inspect repository status to select exact changed files.</p></div>
      </fieldset>
      <label for="${escapeHtml(view.product.gitCommitMessage.id)}">Commit message${gitCommitMessageInput(view.product.gitCommitMessage)}</label>
    </div>
    <pre class="change-diff" data-project-git-evidence hidden role="region" aria-label="Contained Git repository evidence"></pre>
  </div>`
        : ""
  }
  ${mode === "build" ? `${inspectorCatalogs(view)}<section class="editor-command-tools" aria-label="Build command tools">
    ${editorCommandForm(view, "scene-prefab-inspect", "Inspect reusable content")}
    ${editorCommandForm(view, "scene-prefab-define", "Define reusable content")}
    ${editorCommandForm(view, "scene-prefab-instance", "Create reusable-content instance")}
    ${editorCommandForm(view, "scene-prefab-override", "Override instance property")}
    ${editorCommandForm(view, "scene-prefab-refresh", "Refresh reusable-content instances")}
    ${editorCommandForm(view, "physics-evaluate", "Evaluate physics")}
    ${editorCommandForm(view, "package-install", "Install contained package")}
    ${editorCommandForm(view, "package-remove", "Remove installed package")}
    ${editorCommandForm(view, "extension-start", "Start inspected extension seam")}
  </section>` : ""}
</section>`;
  }).join("");

  const passes = SCULPT_PASSES.map(
    (pass, index) =>
      `<li class="pass-row"><span class="pass-order">${index + 1}</span><span><b>${escapeHtml(pass.name)}</b><em>${escapeHtml(pass.description)}</em></span></li>`,
  ).join("");

  return `
<aside class="inspector" id="inspector" aria-label="Inspector">
  ${panels}
  <section class="inspector-panel inspector-sculpt" data-mode-panel="sculpt" aria-label="Build passes"${active === "sculpt" ? "" : " hidden"}>
    <h2 class="panel-head"><span>BUILD PASSES</span></h2>
    <ol class="pass-list">${passes}</ol>
    ${button(view.sculpt.start, "Sculpt object", "primary-button block-button", editorCommandAttributes("assistant-local-build"))}
  </section>
  <section class="web-page-inspector" aria-label="Page sections">
    <h2 class="panel-head"><span>Page</span></h2>
    <ol class="web-page-sections">
      <li><b>Hero</b><span>Three.js stage on the page</span></li>
      <li><b>Headline</b><span>Ask Flash to animate this</span></li>
      <li><b>Story</b><span>Page copy under the hero</span></li>
    </ol>
  </section>
</aside>`;
}
