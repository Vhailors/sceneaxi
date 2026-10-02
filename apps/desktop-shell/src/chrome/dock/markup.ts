import { DESKTOP_DOCK_TAB_IDS, type DesktopDockTabId, type DesktopVisualView } from "../../visual-model.js";
import { button, editorCommandAttributes, escapeHtml } from "../core/markup.js";

export function dock(view: DesktopVisualView): string {
  const tabs = view.dockTabs
    .map((tab) =>
      button(
        tab.control,
        `${escapeHtml(tab.label)}${tab.id === "changes" ? `<span class="badge" data-change-badge>${tab.badge}</span>` : ""}`,
        "dock-tab",
        ` role="tab" data-action="dock-tab" data-value="${escapeHtml(tab.id)}" aria-selected="${tab.active ? "true" : "false"}" aria-controls="dock-panel-${escapeHtml(tab.id)}" tabindex="${tab.active ? "0" : "-1"}"${tab.id === "console" && view.state.session !== "running" && !view.state.detailsOpen ? " hidden" : ""}`,
      ),
    )
    .join("");

  const bodies: Readonly<Record<DesktopDockTabId, string>> = {
    changes: `
      <p class="dock-caption">One active E1 proposal at a time. Accept applies the whole proposal through the shared authoring session; Reject discards it without writing.</p>
      <article class="change-proposal" data-change-proposal hidden>
        <dl class="change-meta">
          <div><dt>Document</dt><dd><code data-change-document></code></dd></div>
          <div><dt>Base content hash</dt><dd><code data-change-content-hash></code></dd></div>
        </dl>
        <pre class="change-diff" data-change-rarity-evidence hidden tabindex="0" role="region" aria-label="Safe rarity provenance"></pre>
        <pre class="change-diff" data-change-diff tabindex="0" role="region" aria-label="Rendered proposal diff"></pre>
        <div class="change-actions">
          ${button(view.changeReview.reject, "Reject", "ghost-button", ` data-product-action data-action="change-reject"${editorCommandAttributes("change-review-reject")}`)}
          ${button(view.changeReview.accept, "Accept", "primary-button", ` data-product-action data-action="change-accept"${editorCommandAttributes("change-review-accept")}`)}
        </div>
      </article>
      <p class="change-empty" data-change-empty>Nothing waiting for review. Generated edits land here before they touch the scene.</p>
    `,
    assets: `<div class="asset-browser" data-project-assets><p class="panel-empty">No admitted project assets are present.</p></div>`,
    console: `<pre class="change-diff" data-console-output tabindex="0" role="log" aria-label="Play evidence and results" aria-live="polite">Play evidence will appear here.</pre>`,
    evidence: `<p class="panel-empty" data-rarity-evidence-empty>No accepted rarity evidence has been opened or staged in this session.</p><pre class="change-diff" data-rarity-evidence hidden tabindex="0" role="region" aria-label="Rarity evidence"></pre><p class="panel-empty">No evidence packet has been captured here. Evidence digests are produced by <code>sceneaxi project capture</code>, never invented by a viewer.</p>`,
    timeline: `<label>${escapeHtml(view.timelineControls.mutation.label)} <textarea id="${escapeHtml(view.timelineControls.mutation.id)}" data-kind="${view.timelineControls.mutation.kind}"${view.timelineControls.mutation.kind === "inert" ? ` readonly aria-disabled="true" data-refusal="${escapeHtml(view.timelineControls.mutation.refusal ?? "")}"` : ""} data-timeline-mutation>{"kind":"clip-upsert","clipId":"idle","name":"Idle","startMs":0,"durationMs":1000}</textarea></label>${button(view.timelineControls.apply, view.timelineControls.apply.label, "ghost-button", ` data-action="timeline-apply"`)}<label>${escapeHtml(view.timelineControls.time.label)} <input id="${escapeHtml(view.timelineControls.time.id)}" data-kind="${view.timelineControls.time.kind}"${view.timelineControls.time.kind === "inert" ? ` readonly aria-disabled="true" data-refusal="${escapeHtml(view.timelineControls.time.refusal ?? "")}"` : ""} type="number" min="0" step="1" data-timeline-time value="0"></label>${button(view.timelineControls.scrub, view.timelineControls.scrub.label, "ghost-button", ` data-action="timeline-scrub"`)}${button(view.timelineControls.evaluate, view.timelineControls.evaluate.label, "ghost-button", ` data-action="timeline-evaluate"`)}<pre data-timeline-result aria-live="polite">Open Timeline to inspect clips, tracks, and keyframes.</pre>`,
  };

  const panels = DESKTOP_DOCK_TAB_IDS.map(
    (id) =>
      `<div role="tabpanel" id="dock-panel-${escapeHtml(id)}" class="dock-tabpanel" data-dock-panel="${escapeHtml(id)}"${id === view.state.dockTab ? "" : " hidden"}>${bodies[id]}</div>`,
  ).join("\n    ");

  return `
<section class="dock" aria-label="Dock" style="--dock-h:${view.dockHeight}px">
  <div class="dock-tabs">
    <div class="dock-tablist" role="tablist" aria-label="Dock panel">
      ${tabs}
    </div>
    <span class="spacer"></span>
  </div>

  <div class="dock-body">
    ${panels}
  </div>
</section>`;
}
