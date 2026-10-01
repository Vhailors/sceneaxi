import type { DesktopVisualView } from "../../visual-model.js";
import { AXIS } from "../../visual-tokens.js";
import { button, editorCommandAttributes, escapeHtml } from "../core/markup.js";
import { editorCommandFieldAttrs } from "../settings/markup.js";

function profileSurfaces(view: DesktopVisualView): string {
  const surfaces = view.product.surfaces
    .filter((surface) => surface.profile !== "kids")
    .map((surface) => {
      const capabilities = surface.capabilities
        .map(
          (capability) => `<li><b>${escapeHtml(capability.label)}</b><span>${escapeHtml(capability.detail)}</span></li>`,
        )
        .join("");

      const webTools =
        surface.profile === "web"
          ? `<div class="web-authoring-tools">
  <p>This is a website, not a game scene. Ask Flash for a Three.js hero, a headline motion, or a new section.</p>
  <p class="web-authoring-note">Stored HTML is data, never executed by this chrome.</p>
  <div class="profile-actions">
    ${button(view.product.stageHtml, "Edit page", "primary-button", ` data-product-action data-action="web-stage-html"`)}
    ${button(view.product.injectAsset, "Add hero scene", "ghost-button", ` data-product-action data-action="web-inject-asset"`)}
  </div>
</div>`
          : `<p class="game-runtime-note">Play the scene in the middle. Ask Flash to make or change objects.</p>`;

      return `<section class="profile-surface" data-profile-surface="${escapeHtml(surface.profile)}" aria-label="${escapeHtml(surface.profile === "game" ? "Game product surface" : "Web Experience product surface")}">
  <div><strong>${surface.profile === "game" ? "Scene" : "Website studio"}</strong></div>
  <ul class="capability-list">${capabilities}</ul>
  ${webTools}
</section>`;
    })
    .join("");

  return `<div class="profile-surfaces">${surfaces}<div class="profile-runtime-actions">
  ${button(view.product.play, "Play", "primary-button", ` data-product-action data-command="run-play"`)}
  <p class="runtime-report" data-product-run-report aria-live="polite">Ready.</p>
</div></div>`;
}

/** Progress ships even while hidden, keeping every modelled control accounted for. */
export function viewport(view: DesktopVisualView): string {
  const sculptRunning = view.sculpt.phase === "running";
  const sourceFieldAttrs = editorCommandFieldAttrs(view, "viewport-source-set", "source", "Viewport source command");

  return `
<section class="viewport-region" aria-label="Viewport">
  ${profileSurfaces(view)}
  <div class="view-tabs">
    <div class="view-tablist" role="tablist" aria-label="Viewport source">
      ${view.viewport.sources
        .map((source) =>
          button(
            source.control,
            escapeHtml(source.label),
            "view-tab",
            ` role="tab" aria-selected="${source.active ? "true" : "false"}" tabindex="${source.active ? "0" : "-1"}"`,
          ),
        )
        .join("")}
    </div>
    <label class="viewport-source-control">Set source<select ${sourceFieldAttrs}><option value="">Choose source</option><option value="scene">Scene</option><option value="game">Game</option><option value="sculpt-preview">Sculpt preview</option></select></label>
    ${button(view.product.editorCommandControls.find((control) => control.id === "editor-command-submit-viewport-source-set") ?? (() => { throw new Error("Missing viewport source submit control"); })(), "Apply source", "ghost-button", ` data-action="editor-command-submit" data-value="viewport-source-set" data-editor-command-submit="viewport-source-set"`)}
    <span class="spacer"></span>
    <span class="view-tools" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  </div>
  <div class="stage-host">
  <div class="site-stage" aria-hidden="true">
    <div class="site-browser-bar"><i></i><i></i><i></i><span>example.com</span></div>
    <article class="site-page">
      <div class="site-nav"><span>Home</span><span>Story</span><span>Contact</span></div>
      <header class="site-hero-copy">
        <p class="site-eyebrow">Your site</p>
        <h3>Build a real page</h3>
        <p>This is a website creator. Ask Flash for a Three.js hero, a headline motion, or a new section. Engine tools stay on Engine.</p>
      </header>
    </article>
  </div>
  <div class="viewport">
    <div class="viewport-backdrop" role="img" aria-label="${escapeHtml(view.viewport.inertNote)}"></div>
    <p class="viewport-note viewport-note-inert">${escapeHtml(view.viewport.inertNote)}</p>
    <p class="viewport-note viewport-note-web">Hero stage. This is the Three.js embed on the page.</p>
    <div class="axis-widget" aria-hidden="true">
      <i style="background:${AXIS.x}"></i><i style="background:${AXIS.y}"></i><i style="background:${AXIS.z}"></i>
    </div>
    <div class="assistant-manipulators" data-assistant-manipulators="translation rotation scale" aria-label="Assistant artifact manipulators" hidden>
      ${view.viewport.manipulators
        .map((row) =>
          button(
            row.control,
            escapeHtml(row.label),
            "assistant-manipulator",
            ` data-action="assistant-manipulator" data-value="${escapeHtml(row.id)}"`,
          ),
        )
        .join("")}
    </div>
    <div class="sculpt-progress" role="status" data-sculpt-progress${sculptRunning ? "" : " hidden"}>
      <p class="sculpt-label">${escapeHtml(view.sculpt.label)}</p>
      <div class="sculpt-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${view.sculpt.percent}" aria-label="${escapeHtml(`Pass ${view.sculpt.passIndex + 1} of ${view.sculpt.passCount}`)}">
        <span class="sculpt-fill" style="width:${view.sculpt.percent}%"></span>
        <span class="sculpt-sweep" aria-hidden="true"></span>
      </div>
      <p class="sculpt-detail">pass ${view.sculpt.passIndex + 1} of ${view.sculpt.passCount}</p>
      ${button(view.sculpt.cancel, escapeHtml(view.sculpt.cancel.label), "ghost-button", ` data-action="sculpt-cancel"${editorCommandAttributes("assistant-cancel")}`)}
    </div>
  </div>
  <div class="site-page-tail" aria-hidden="true">
    <section class="site-band"><h4>Story</h4><p>Page copy lives here. Ask Flash to write this section.</p></section>
    <section class="site-band"><h4>Hero motion</h4><p>The stage above is the Three.js embed. Later you customize it here.</p></section>
    <footer class="site-foot">example.com · SceneAxi Website</footer>
  </div>
  </div>
</section>`;
}
