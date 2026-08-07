/**
 * The Engine Desktop editor chrome, rendered as one self-contained document.
 *
 * `visual-model.ts` decides; this module draws. It is a string builder on
 * purpose: this package's `src` type-checks with `lib: es2023` and `types:
 * ["node"]`, so there is no DOM here to render into, and a pure builder is what
 * lets the gate assert the shipped markup without a browser while the same
 * bytes open in one for the pixel evidence.
 *
 * What the document contains, and what it deliberately does not:
 *
 * - **All seven modes are in the DOM**, as the archive's single component is,
 *   and a small emitted script switches `data-mode` on the root. The script
 *   carries no policy: every table it reads (which dock tabs a mode has, which
 *   controls are inert) is serialized from the model at render time, so the two
 *   cannot disagree.
 * - **Controls are real controls.** `<button>` elements, reachable by keyboard,
 *   with visible focus. An inert control keeps its focus stop and announces its
 *   refusal through `aria-disabled` + `aria-describedby` rather than vanishing,
 *   because a control the archive draws and this shell cannot honour should
 *   still be findable and still say why.
 * - **No fabricated inventory.** The archive's panels are full of fixture
 *   objects, digests, file sizes, frame counters, and timings. Those are not
 *   reproduced: the chrome reports only values returned by its injected desktop
 *   host, never invented fps, triangle counts, or 14.2 MB artifacts. Each panel
 *   renders its real structure and an honest empty or inert state instead.
 * - **No network.** No remote font, script, style, or image; the archive's font
 *   families are named in a stack that falls back to the system UI face.
 */

import {
  CHANGE_REVIEW_ROWS,
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  DESKTOP_DOCK_TAB_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_MODES,
  DESKTOP_MODE_IDS,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  SCULPT_PASSES,
  WINDOW_TIERS,
  desktopVisualView,
  dockTabsFor,
  kidsAssistantDenial,
  kidsProfileRefusal,
  type DesktopControl,
  type DesktopDockTabId,
  type DesktopModeId,
  type DesktopVisualView,
  type DesktopWindowTierId,
} from "./visual-model.js";
import {
  DESKTOP_PRODUCT_REFUSAL_MESSAGES,
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  DESKTOP_WEB_STAGE_CONFIG,
  DESKTOP_WEB_STARTER,
  desktopWebStageDecision,
} from "./product-loop.js";
import {
  DESKTOP_INTERACTION_COMMANDS,
  DESKTOP_PALETTE_SHORTCUT,
} from "./interaction-commands.js";
import {
  ACCENT,
  AXIS,
  INERT,
  LINE,
  METRICS,
  PROFILE_DOT,
  SCRIM,
  SIGNAL,
  SURFACE,
  TEXT,
  TYPE,
  VIEWPORT_GRADIENT,
  VISUAL_SOURCE,
} from "./visual-tokens.js";

/**
 * The media condition that holds *below* a tier, derived from `WINDOW_TIERS`.
 *
 * The stylesheet and `resolveWindowTier()` have to change size at the same
 * numbers, and on both axes: a 1920x700 window is `compact` to the model, so a
 * width-only breakpoint would leave the assistant docked in a tier the model
 * says undocks it. Every breakpoint in this sheet comes from here.
 */
function belowTier(id: DesktopWindowTierId): string {
  const tier = WINDOW_TIERS.find((row) => row.id === id);
  const width = (tier?.minWidth ?? 0) - 1;
  const height = (tier?.minHeight ?? 0) - 1;
  return `(max-width:${width}px),(max-height:${height}px)`;
}

/** The exact complement of `belowTier(id)`, so the two can never overlap. */
function atTierOrAbove(id: DesktopWindowTierId): string {
  const tier = WINDOW_TIERS.find((row) => row.id === id);
  return `(min-width:${tier?.minWidth ?? 0}px) and (min-height:${tier?.minHeight ?? 0}px)`;
}

/** HTML text escape. Applied to every interpolated value without exception. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON for an inline `<script>`: `<` is escaped so no tag can close early. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Per-mode panel copy. Structure and contract notes only — never inventory. */
const MODE_PANELS: Readonly<
  Record<
    DesktopModeId,
    Readonly<{
      leftTitle: string;
      leftEmpty: string;
      inspectorTitle: string;
      inspectorEmpty: string;
      /** A statement from a repository contract, safe to print verbatim. */
      note: string;
      noteTone: "info" | "scene" | "accent";
    }>
  >
> = Object.freeze({
  build: Object.freeze({
    leftTitle: "SCENE",
    leftEmpty: "The active Scene Document is listed above; Play sends its composed scene to the live viewport.",
    inspectorTitle: "PROPERTIES",
    inspectorEmpty: "Nothing is selected. Properties appear when a document is bound.",
    note: "Generated edits arrive as proposals and land in Change Review before they touch a document.",
    noteTone: "info" as const,
  }),
  sculpt: Object.freeze({
    leftTitle: "SCULPT LIBRARY",
    leftEmpty: "No sculpt artifacts are loaded on this surface.",
    inspectorTitle: "SCULPT OBJECT",
    inspectorEmpty: "The brief, references, and pass plan need a bound document.",
    note: "Nothing enters the scene until you review it.",
    noteTone: "accent" as const,
  }),
  compose: Object.freeze({
    leftTitle: "SCENE INSTANCES",
    leftEmpty: "No composed scene is open.",
    inspectorTitle: "INSTANCE",
    inspectorEmpty: "Instance transforms appear when a composed scene is bound.",
    note: "Placement is axis-aligned in v1 and is a projection: it never rewrites a Sculpt Artifact, because its evidence binds its exact bytes.",
    noteTone: "scene" as const,
  }),
  animate: Object.freeze({
    leftTitle: "CLIPS",
    leftEmpty: "No clips are loaded.",
    inspectorTitle: "KEY",
    inspectorEmpty: "Key and track details need a bound document.",
    note: "Socket values are advanced by the kernel and read back as frozen observations — the timeline authors them, it does not own them at runtime.",
    noteTone: "info" as const,
  }),
  run: Object.freeze({
    leftTitle: "RUNTIME",
    leftEmpty: "No kernel session is open on this surface, so there is no tick, frame, or body to report.",
    inspectorTitle: "LIVE VALUES",
    inspectorEmpty: "Live values need a running session.",
    note: "Every run records frames and ends with a digest. Replay plays the exact sequence back; a differing digest is reported as an error, never smoothed over.",
    noteTone: "info" as const,
  }),
  ship: Object.freeze({
    leftTitle: "TARGETS",
    leftEmpty: "No delivery handoff has been created here.",
    inspectorTitle: "DELIVERY HANDOFF",
    inspectorEmpty: "Handoff fields and digests need a captured evidence packet.",
    note: "A handoff is data, not authority. Creating one never uploads, signs, spends, or approves a release — an independent adapter does that.",
    noteTone: "accent" as const,
  }),
  plugins: Object.freeze({
    leftTitle: "LOADED",
    leftEmpty: "No plugin host runs on this surface.",
    inspectorTitle: "PLUGIN",
    inspectorEmpty: "Manifest, capabilities, and isolation checks need a loaded plugin.",
    note: "A plugin may only claim capability IDs already in the versioned registry — a new capability needs a public contract first, not a new manifest string.",
    noteTone: "accent" as const,
  }),
});

const TONE_COLORS: Readonly<
  Record<"info" | "scene" | "accent", Readonly<{ bg: string; line: string; dot: string; fg: string }>>
> = Object.freeze({
  info: Object.freeze({ bg: SIGNAL.infoSurface, line: SIGNAL.infoLine, dot: SIGNAL.info, fg: SIGNAL.info }),
  scene: Object.freeze({ bg: SIGNAL.sceneSurface, line: SIGNAL.sceneLine, dot: SIGNAL.scene, fg: SIGNAL.sceneText }),
  accent: Object.freeze({ bg: ACCENT.surface, line: ACCENT.line, dot: ACCENT.base, fg: ACCENT.noteText }),
});

/**
 * Render one control. `view`, `review`, and `live` controls are buttons; an inert
 * one keeps its focus stop, is marked `aria-disabled`, and points at the
 * paragraph carrying its refusal so a screen reader gets the reason, not just
 * "dimmed".
 */
function button(
  ctrl: DesktopControl,
  content: string,
  className: string,
  extra = "",
): string {
  const inert = ctrl.kind === "inert";
  const described = inert ? ` aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"` : "";
  return [
    `<button type="button" class="${className}${inert ? " is-inert" : ""}"`,
    ` id="${escapeHtml(ctrl.id)}" data-kind="${ctrl.kind}"`,
    inert ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}"` : "",
    described,
    extra,
    `>${content}</button>`,
  ].join("");
}

/** Render the one modelled prompt field through the same refusal contract. */
function promptInput(ctrl: DesktopControl): string {
  const inert = ctrl.kind === "inert";
  const described = inert
    ? ` aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"`
    : "";
  return [
    `<textarea id="${escapeHtml(ctrl.id)}" data-kind="${ctrl.kind}"`,
    inert
      ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}" readonly`
      : "",
    described,
    ` class="assistant-prompt${inert ? " is-inert" : ""}"`,
    ` aria-label="${escapeHtml(ctrl.label)}" rows="3"`,
    ` placeholder="Describe the object to build"></textarea>`,
  ].join("");
}

/** Render the bounded numeric Scene Document property through the modelled control. */
function numericPropertyInput(ctrl: DesktopControl): string {
  const inert = ctrl.kind === "inert";
  const described = inert
    ? ` aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"`
    : "";
  return [
    `<input id="${escapeHtml(ctrl.id)}" data-kind="${ctrl.kind}"`,
    inert
      ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}" readonly`
      : "",
    described,
    ` type="number"`,
    ` class="scene-property-input${inert ? " is-inert" : ""}"`,
    ` aria-label="${escapeHtml(ctrl.label)}" step="0.1">`,
  ].join("");
}

/** Render the modelled recent-project chooser through the same refusal contract. */
function recentProjectSelect(ctrl: DesktopControl): string {
  const inert = ctrl.kind === "inert";
  const described = inert
    ? ` aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"`
    : "";
  return [
    `<select id="${escapeHtml(ctrl.id)}" data-kind="${ctrl.kind}"`,
    inert
      ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}"`
      : "",
    described,
    ` class="project-recent-select${inert ? " is-inert" : ""}"`,
    ` aria-label="${escapeHtml(ctrl.label)}">`,
    `<option value="">No recent projects</option></select>`,
  ].join("");
}

/**
 * The whole closed registry, each code printed with the registry's own sentence.
 *
 * Every code rather than the ones this state happens to use, because a control
 * can become inert in the browser — the profile switch does exactly that to the
 * rail and the assistant — and an `aria-describedby` that resolves to nothing is
 * worse than no description. One code carries one sentence: a renderer variant
 * of it would put two wordings for the same refusal in one document.
 */
/**
 * A sentence for every refusal either registry can put on this surface.
 *
 * The product-loop names are here because the emitted script can print them:
 * a refusal a visitor can read with no explanation is the same gap an unnamed
 * one is. `webCapabilityRequired` is one code in two registries by re-export,
 * so the rows are de-duplicated by code rather than by registry.
 */
function refusalLegend(view: DesktopVisualView): string {
  const messages = new Map<string, string>();
  for (const code of Object.values(DESKTOP_VISUAL_REFUSALS)) {
    messages.set(code, DESKTOP_REFUSAL_MESSAGES[code]);
  }
  for (const code of Object.values(DESKTOP_PRODUCT_REFUSALS)) {
    if (!messages.has(code)) {
      messages.set(code, DESKTOP_PRODUCT_REFUSAL_MESSAGES[code]);
    }
  }
  const rows = [...messages]
    .map(
      ([code, message]) =>
        `<p class="refusal-row" id="refusal-${escapeHtml(code)}"><code>${escapeHtml(code)}</code> ${escapeHtml(message)}</p>`,
    )
    .join("");
  return `${button(
    view.overlay.refusalHelp,
    "Refusal help",
    "state-shortcut refusal-help-toggle",
    ' data-action="refusal-help" aria-expanded="false" aria-controls="refusal-legend"',
  )}<section class="refusal-legend-panel" id="refusal-legend" aria-labelledby="refusal-legend-title" hidden><h2 id="refusal-legend-title">Refusals on this surface</h2>${rows}</section>`;
}

function titleBar(view: DesktopVisualView): string {
  const profiles = view.profiles
    .map((profile) => {
      const policy = profile.policy;
      const detail =
        policy === null
          ? "not in the shared open-path policy"
          : `${policy.demoLevel} · ${policy.sessionKind}`;
      return button(
        profile.control,
        [
          `<span class="dot" data-profile-dot="${escapeHtml(profile.id)}" aria-hidden="true"></span>`,
          `<span>${escapeHtml(profile.label)}</span>`,
          profile.refuseOnly ? `<span class="chip-tag">refuse-only</span>` : "",
        ].join(""),
        "profile-chip",
        [
          ` data-product-action data-action="profile" data-value="${escapeHtml(profile.id)}"`,
          ` aria-pressed="${profile.active ? "true" : "false"}"`,
          ` title="${escapeHtml(`${profile.packageName} — ${detail}`)}"`,
        ].join(""),
      );
    })
    .join("");

  const drawers = view.drawers
    .map((drawer) =>
      button(
        drawer.control,
        escapeHtml(drawer.label),
        "ghost-button drawer-toggle",
        ` data-action="drawer" data-value="${escapeHtml(drawer.id)}" aria-expanded="false" aria-controls="${escapeHtml(drawer.target)}"`,
      ),
    )
    .join("");

  const menus = view.menus
    .map(
      (menu) => `<div class="menu-root" data-menu-root="${escapeHtml(menu.id)}">${button(
        menu.control,
        escapeHtml(menu.label),
        "menu-item",
        ` data-menu-trigger="${escapeHtml(menu.id)}" aria-haspopup="menu" aria-expanded="false"`,
      )}<div class="menu-panel" id="menu-panel-${escapeHtml(menu.id)}" role="menu" hidden>${menu.items
        .map((item) =>
          button(
            item.control,
            `<span>${escapeHtml(item.label)}</span>${item.accelerator === "" ? "" : `<kbd>${escapeHtml(item.accelerator)}</kbd>`}`,
            "menu-command",
            ` role="menuitem" data-command="${escapeHtml(item.commandId)}"`,
          ),
        )
        .join("")}</div></div>`,
    )
    .join("");

  return `
<header class="title-bar">
  <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
  <nav class="menu-bar" aria-label="Application menu">${menus}</nav>
  <div class="profile-switch" role="group" aria-label="Profile">${profiles}</div>
  <div class="title-centre">
    <span class="project-pill" data-project-state="closed"><span class="dot dot-ok" aria-hidden="true"></span><span data-project-status>No project selected</span></span>
  </div>
  <div class="title-actions">
    ${button(view.product.open, "Reload", "ghost-button", ` data-product-action data-action="document-reload"`)}
    ${button(view.product.save, "Save", "primary-button", ` data-product-action data-command="project-save"`)}
    ${drawers}
    ${button(
      view.overlay.search,
      `${escapeHtml(view.overlay.search.label)} <kbd>${escapeHtml(DESKTOP_PALETTE_SHORTCUT.accelerator)}</kbd>`,
      "ghost-button",
      ` data-command="${escapeHtml(DESKTOP_PALETTE_SHORTCUT.id)}"`,
    )}
    ${button(
      view.assistant.toggle,
      `<span class="dot" data-assistant-dot aria-hidden="true"></span><span>Assistant</span>`,
      "assistant-toggle",
      ` data-action="assistant" aria-pressed="${view.assistant.togglePressed ? "true" : "false"}"`,
    )}
  </div>
</header>`;
}

function modeRail(view: DesktopVisualView): string {
  const items = view.modes
    .map((mode) => {
      const def = DESKTOP_MODES.find((candidate) => candidate.id === mode.id);
      return button(
        mode.control,
        [
          `<span class="rail-glyph" aria-hidden="true" style="border-radius:${escapeHtml(def?.glyphRadius ?? "2px")};transform:${escapeHtml(def?.glyphTransform ?? "none")}"></span>`,
          `<span class="rail-label">${escapeHtml(mode.label)}</span>`,
          `<span class="sr-only">${escapeHtml(mode.title)} mode</span>`,
        ].join(""),
        "rail-mode",
        ` data-action="mode" data-value="${escapeHtml(mode.id)}" aria-pressed="${mode.active ? "true" : "false"}" title="${escapeHtml(mode.title)}"`,
      );
    })
    .join("");
  return `<nav class="mode-rail" aria-label="Editor mode"><span class="brand" aria-hidden="true"></span>${items}</nav>`;
}

function note(text: string, tone: "info" | "scene" | "accent"): string {
  const colors = TONE_COLORS[tone];
  return `<p class="panel-note" style="background:${colors.bg};border-color:${colors.line};color:${colors.fg}"><span class="dot" style="background:${colors.dot}" aria-hidden="true"></span>${escapeHtml(text)}</p>`;
}

function leftDock(view: DesktopVisualView): string {
  const active = view.state.mode;
  const project = view.product.surface.project;
  const panels = DESKTOP_MODE_IDS.map((mode) => {
    const panel = MODE_PANELS[mode];
    return `<section class="dock-panel" data-mode-panel="${escapeHtml(mode)}" aria-label="${escapeHtml(panel.leftTitle)}"${mode === active ? "" : " hidden"}>
  <h2 class="panel-head"><span>${escapeHtml(panel.leftTitle)}</span></h2>
  <p class="panel-empty"${mode === "run" ? " data-run-session-report" : ""}>${escapeHtml(panel.leftEmpty)}</p>
  ${note(panel.note, panel.noteTone)}
</section>`;
  }).join("");
  const files = project.files
    .map(
      (file) => `<div class="project-file${file.active ? " is-active" : ""}"${file.active ? ' aria-current="page"' : ""} data-project-file="${escapeHtml(file.path)}">
  <span class="project-file-mark" aria-hidden="true">◇</span>
  <span><b>${escapeHtml(file.path)}</b><em>${escapeHtml(file.label)}</em></span>
</div>`,
    )
    .join("");
  return `<aside class="left-dock" id="left-dock" aria-label="Project files and editor panels">
<section class="project-panel" aria-labelledby="project-files-title">
  <h2 class="panel-head" id="project-files-title"><span>PROJECT / FILES</span><span class="project-name" data-project-name>${escapeHtml(project.name)}</span></h2>
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
    <div class="project-files">${files}</div>
    <div class="scene-entities" data-scene-entities hidden>
      <p class="scene-entities-label">SCENE ENTITY</p>
      ${button(
        view.product.selectStarterEntity,
        `<span data-scene-entity-label>Placed beside the root</span><code data-scene-entity-id>desktop-crate-beside</code>`,
        "scene-entity",
        ` data-product-action data-action="scene-entity-select" data-value="desktop-crate-beside" aria-pressed="false"`,
      )}
    </div>
    <p class="scene-entities-refusal" data-scene-entities-refusal aria-live="polite" hidden></p>
    <p class="project-root" data-project-root></p>
  </div>
  <p class="project-file-state" data-project-file-state>Active · not opened</p>
</section>
${panels}</aside>`;
}

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
  <p>Stored HTML is data, never executed by this chrome.</p>
  <code>&lt;main id=&quot;sceneaxi-mount&quot;&gt;&lt;/main&gt;</code>
  <div class="profile-actions">
    ${button(view.product.stageHtml, "Stage HTML", "ghost-button", ` data-product-action data-action="web-stage-html"`)}
    ${button(view.product.injectAsset, "Inject assets/hero.glb", "ghost-button", ` data-product-action data-action="web-inject-asset"`)}
  </div>
</div>`
          : `<p class="game-runtime-note">FreeJS behavior stays project-local; play reaches the composed scene without a site or billing package.</p>`;
      return `<section class="profile-surface" data-profile-surface="${escapeHtml(surface.profile)}" aria-label="${escapeHtml(surface.profile === "game" ? "Game product surface" : "Web Experience product surface")}">
  <div><span class="profile-kicker">${surface.profile === "game" ? "GAME" : "WEB EXPERIENCE"}</span><strong>${surface.profile === "game" ? "Scene + runtime" : "HTML + site canvas"}</strong></div>
  <ul class="capability-list">${capabilities}</ul>
  ${webTools}
</section>`;
    })
    .join("");
  return `<div class="profile-surfaces">${surfaces}<div class="profile-runtime-actions">
  ${button(view.product.play, "▶ Play composed scene", "primary-button", ` data-product-action data-command="run-play"`)}
  <p class="runtime-report" data-product-run-report aria-live="polite">Ready to run through the desktop host.</p>
</div></div>`;
}

/**
 * The viewport, its source tabs, and the sculpt progress region.
 *
 * The progress region is emitted in every document and hidden when no pass is
 * running, for the reason the assistant bodies and the Kids refusal region are:
 * a region only some renders contain is a region whose modelled controls — here
 * `sculpt.cancel` — exist in the view and in no document, which is exactly the
 * accounting hole `test/control-accounting.test.ts` closes.
 */
function viewport(view: DesktopVisualView): string {
  const sculptRunning = view.sculpt.phase === "running";
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
    <span class="spacer"></span>
    <span class="view-tools" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  </div>
  <div class="viewport">
    <div class="viewport-backdrop" role="img" aria-label="${escapeHtml(view.viewport.inertNote)}"></div>
    <p class="viewport-note viewport-note-inert">${escapeHtml(view.viewport.inertNote)}</p>
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
      ${button(view.sculpt.cancel, escapeHtml(view.sculpt.cancel.label), "ghost-button", ` data-action="sculpt-cancel"`)}
    </div>
  </div>
</section>`;
}

function dock(view: DesktopVisualView): string {
  const tabs = view.dockTabs
    .map((tab) =>
      button(
        tab.control,
        `${escapeHtml(tab.label)}${tab.id === "changes" ? `<span class="badge" data-change-badge>${tab.badge}</span>` : ""}`,
        "dock-tab",
        ` role="tab" data-action="dock-tab" data-value="${escapeHtml(tab.id)}" aria-selected="${tab.active ? "true" : "false"}" aria-controls="dock-panel-${escapeHtml(tab.id)}" tabindex="${tab.active ? "0" : "-1"}"`,
      ),
    )
    .join("");

  const rows = view.changeReview.rows
    .map((row) => {
      const decide = (ctrl: DesktopControl, glyph: string, name: string, className: string): string =>
        button(
          ctrl,
          glyph,
          `decision ${className}`,
          ` data-action="decide-change" data-value="${row.index}" aria-label="${escapeHtml(name)}"`,
        );
      return `<li class="change-row" data-change-index="${row.index}"${row.pending ? "" : ` hidden`}>
  <span class="change-badge" data-change-kind="${escapeHtml(row.kind)}">${escapeHtml(row.badge)}</span>
  <span class="change-path"><span class="dir">${escapeHtml(row.directory)}</span><span class="leaf">${escapeHtml(row.leaf)}</span></span>
  <span class="change-before">${escapeHtml(row.before)}</span>
  <span class="change-arrow" aria-hidden="true">→</span>
  <span class="change-after">${escapeHtml(row.after)}</span>
  <span class="change-actions">
    ${decide(row.reject, "✕", `Reject ${row.path}`, "decision-reject")}
    ${decide(row.accept, "✓", `Accept ${row.path}`, "decision-accept")}
  </span>
</li>`;
    })
    .join("");

  const bodies: Readonly<Record<DesktopDockTabId, string>> = {
    changes: `
      <p class="dock-caption">Fixture review queue. Deciding here changes this view only — no document is written and nothing reaches <code>authoring-core</code>.</p>
      <ol class="change-list">${rows}</ol>
      <p class="change-empty" data-change-empty${view.changeReview.empty ? "" : " hidden"}>Nothing waiting for review. Generated edits land here before they touch the scene.</p>
    `,
    assets: `<p class="panel-empty">No asset library is bound to this surface.</p>`,
    console: `<p class="panel-empty">No session is running, so there is no console output to show.</p>`,
    evidence: `<p class="panel-empty">No evidence packet has been captured here. Evidence digests are produced by <code>sceneaxi project capture</code>, never invented by a viewer.</p>`,
    timeline: `<p class="panel-empty">No clip is loaded, so the timeline has no tracks.</p>`,
  };

  const panels = DESKTOP_DOCK_TAB_IDS.map(
    (id) =>
      `<div role="tabpanel" id="dock-panel-${escapeHtml(id)}" class="dock-tabpanel" data-dock-panel="${escapeHtml(id)}"${id === view.state.dockTab ? "" : " hidden"}>${bodies[id]}</div>`,
  ).join("\n    ");

  // A bulk decision belongs to the Changes tab, so a mode without one must not
  // offer it: `run` and `ship` would otherwise let the operator accept or reject
  // a queue that mode cannot even show.
  const hasChanges = view.dockTabs.some((tab) => tab.id === "changes");

  return `
<section class="dock" aria-label="Dock" style="--dock-h:${view.dockHeight}px">
  <div class="dock-tabs">
    <div class="dock-tablist" role="tablist" aria-label="Dock panel">
      ${tabs}
    </div>
    <span class="spacer"></span>
    <span class="dock-bulk" data-change-bulk${hasChanges && !view.changeReview.empty ? "" : " hidden"}>
      ${button(view.changeReview.rejectAll, "Reject all", "ghost-button", ` data-action="decide-all"`)}
      ${button(view.changeReview.acceptAll, "Accept all", "primary-button", ` data-action="decide-all"`)}
    </span>
  </div>

  <div class="dock-body">
    ${panels}
  </div>
</section>`;
}

function inspector(view: DesktopVisualView): string {
  const active = view.state.mode;
  const panels = DESKTOP_MODE_IDS.map((mode) => {
    const panel = MODE_PANELS[mode];
    return `<section class="inspector-panel" data-mode-panel="${escapeHtml(mode)}" aria-label="${escapeHtml(panel.inspectorTitle)}"${mode === active ? "" : " hidden"}>
  <h2 class="panel-head"><span>${escapeHtml(panel.inspectorTitle)}</span></h2>
  <p class="panel-empty"${mode === "run" ? " data-run-live-report" : ""}>${escapeHtml(panel.inspectorEmpty)}</p>
  ${
    mode === "build"
      ? `<div class="scene-property-editor" data-scene-property-editor hidden>
    <p class="scene-property-entity"><b data-scene-property-entity-label></b><code data-scene-property-entity-id></code></p>
    <label for="${escapeHtml(view.product.translationX.id)}"><span data-scene-property-label>Translation X</span>${numericPropertyInput(view.product.translationX)}</label>
    ${button(
      view.product.stageTranslationX,
      "Stage for review",
      "primary-button block-button",
      ` data-product-action data-action="scene-property-stage"`,
    )}
    <p class="scene-property-diagnostic" data-scene-property-diagnostic aria-live="polite">Select this entity to edit its saved composition.</p>
    <pre class="scene-property-review" data-scene-property-review hidden></pre>
  </div>`
      : ""
  }
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
    ${button(view.sculpt.start, "Sculpt object", "primary-button block-button")}
  </section>
</aside>`;
}

/**
 * The assistant column.
 *
 * Both bodies are always emitted and one is chosen by a
 * `[data-assistant="denied"]` rule, for the reason `profileRefusal()` gives: the
 * refuse-only decision has to be one decision, not a server branch a client
 * profile toggle could walk around. The lock screen therefore reads the
 * state-independent denial, so the bytes say the same thing the model does
 * whichever profile the document was rendered for.
 */
function assistant(view: DesktopVisualView): string {
  const denial = kidsAssistantDenial();
  return `
<aside class="assistant" aria-label="Assistant">
  <div class="assistant-head">
    <span class="assistant-mark" aria-hidden="true"></span>
    <h2>Assistant</h2>
    <span class="assistant-model" data-assistant-model>${escapeHtml(view.assistant.modelLabel)}</span>
    ${button(view.assistant.close, "✕", "icon-button", ` data-action="assistant" aria-label="Close assistant"`)}
  </div>
  <div class="assistant-denied" role="note">
    <p class="assistant-denied-title">The assistant is off on Kids</p>
    <p>${escapeHtml(denial.message)}</p>
    <p><code>${escapeHtml(denial.lockCode)}</code></p>
  </div>
  <div class="assistant-body">
    <p class="assistant-empty">Local runs on-device and is free. BYOK calls only a provider you configure and never touches credits. Hosted AI is metered and refuses here until its identity and credit seam is available.</p>
    <p class="assistant-thinking" role="status" data-assistant-thinking${view.assistant.thinking ? "" : " hidden"}><span class="dot" aria-hidden="true"></span>Thinking…</p>
    <p class="assistant-progress" data-assistant-status role="status">Ready for a local prompt.</p>
    <div class="assistant-result" data-assistant-result hidden></div>
    ${button(view.assistant.retry, "Retry", "ghost-button assistant-retry", ` data-action="assistant-send" hidden`)}
    <p class="assistant-foot">Successful Build output is validated as a Sculpt Artifact, mounted in the center viewport, and remains transformable through the Mount API.</p>
  </div>
  <div class="assistant-composer">
    ${promptInput(view.assistant.prompt)}
    <div class="assistant-routes" role="group" aria-label="Assistant provider route">
      ${view.assistant.routes
        .map((route) =>
          button(
            route.control,
            escapeHtml(route.label),
            "assistant-route",
            ` data-action="assistant-route" data-value="${escapeHtml(route.id)}" aria-pressed="${route.id === view.state.assistantRoute ? "true" : "false"}"`,
          ),
        )
        .join("")}
    </div>
    <div class="composer-actions">
      <div class="assistant-modes" role="group" aria-label="Assistant mode">
        ${view.assistant.modes
          .map((mode) =>
            button(
              mode.control,
              escapeHtml(mode.label),
              "assistant-mode",
              ` data-action="assistant-mode" data-value="${escapeHtml(mode.id)}" aria-pressed="${mode.active ? "true" : "false"}"`,
            ),
          )
          .join("")}
      </div>
      <span class="spacer"></span>
      ${button(view.assistant.send, "↑", "primary-button icon-button", ` data-action="assistant-send" aria-label="Send"`)}
    </div>
  </div>
</aside>`;
}

/**
 * The refuse-only profile's editor body.
 *
 * Replaces the left dock, viewport, dock, and inspector in one region rather
 * than dimming them, because a Kids editor that merely looked disabled would
 * still be a Kids authoring UI. The assistant column stays, showing the
 * archive's lock screen, and the profile switch above stays live.
 *
 * Always emitted, and shown by a `[data-profile="kids"]` rule, so switching
 * profile in the browser reaches the same refusal the model reports — one
 * decision, not a server branch a client toggle could walk around.
 */
function profileRefusal(view: DesktopVisualView): string {
  const refusal = view.profileRefusal ?? kidsProfileRefusal();
  return `
<section class="profile-refusal" role="alert" aria-labelledby="kids-refusal-title">
  <div class="profile-refusal-card">
    <span class="overlay-mark mark-scene" aria-hidden="true">✕</span>
    <h2 id="kids-refusal-title">No editor on the Kids profile</h2>
    <p>${escapeHtml(refusal.summary)}</p>
    <p>${escapeHtml(refusal.message)}</p>
    <p class="profile-refusal-code"><code>${escapeHtml(refusal.code)}</code> · <code>${escapeHtml(refusal.profile)}</code></p>
    <p class="profile-refusal-foot">Switch back to Game or Website above to author.</p>
  </div>
</section>`;
}

/**
 * The status bar is the one region no tier hides, which is why the product
 * loop reports here as well as in the title pill.
 *
 * Below the compact tier the title centre is display:none and the left dock is
 * a closed drawer, so a refusal written only to those two would leave Open,
 * Save, Stage, and Play refusing invisibly at the sizes the recorded browser
 * evidence covers. This mirror carries the live region for the same reason:
 * a hidden `aria-live` announces nothing.
 */
function statusBar(view: DesktopVisualView): string {
  return `
<footer class="status-bar">
  <span class="status-text"><span class="dot dot-ok" aria-hidden="true"></span>${escapeHtml(view.statusText)}</span>
  <span class="divider" aria-hidden="true"></span>
  <span class="status-pin" data-profile-pin>${escapeHtml(view.profilePin)}</span>
  <span class="divider" aria-hidden="true"></span>
  <span class="status-project" data-project-status aria-live="polite">${escapeHtml(view.product.surface.project.activeFile)} · ready to open</span>
  <span class="spacer"></span>
  ${view.overlay.shortcuts
    .map((shortcut) =>
      button(
        shortcut.control,
        escapeHtml(shortcut.label),
        "state-shortcut",
        ` data-command="${escapeHtml(shortcut.commandId)}"`,
      ),
    )
    .join("")}
  ${refusalLegend(view)}
</footer>`;
}

function overlays(view: DesktopVisualView): string {
  const palette = view.overlay.paletteGroups
    .map(
      (group) => `<li class="palette-group"><h3>${escapeHtml(group.title)}</h3><ul>${group.items
        .map(
          (item) =>
            `<li>${button(
              item.control,
              `<span class="palette-name">${escapeHtml(item.name)}</span>${item.shortcut === "" ? "" : `<kbd>${escapeHtml(item.shortcut)}</kbd>`}`,
              "palette-item",
              ` data-command="${escapeHtml(item.commandId)}"`,
            )}</li>`,
        )
        .join("")}</ul></li>`,
    )
    .join("");

  // Server-rendered visibility: the requested overlay is open in the emitted
  // bytes, so a screenshot of one state needs no script to have run.
  const shown = (id: string): string => (view.state.overlay === id ? "" : " hidden");

  const dismissals = (overlay: string): string =>
    view.overlay.dismissals
      .filter((dismissal) => dismissal.overlay === overlay)
      .map((dismissal) =>
        button(
          dismissal.control,
          escapeHtml(dismissal.label),
          dismissal.emphasis === "primary" ? "primary-button" : "ghost-button",
          ` data-action="overlay" data-value="none"`,
        ),
      )
      .join("");

  return `
<div class="overlay-layer" data-overlay-host>
  <div class="overlay" data-overlay="palette" role="dialog" aria-modal="true" aria-label="Command palette"${shown("palette")}>
    <div class="overlay-card overlay-palette">
      <div class="overlay-head"><h2>Commands</h2><kbd>ESC</kbd></div>
      <ul class="palette-list">${palette}</ul>
      <p class="overlay-foot">Every row invokes the same desktop command as its menu item and accelerator.</p>
    </div>
  </div>

  <div class="overlay" data-overlay="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title" hidden>
    <div class="overlay-card overlay-refused">
      <div class="overlay-head"><span class="overlay-mark mark-refuse" aria-hidden="true">!</span><h2 id="outcome-title" data-outcome-title></h2></div>
      <p class="overlay-body"><code data-outcome-code></code><br><span data-outcome-message></span></p>
      <div class="overlay-actions">${dismissals("outcome")}</div>
    </div>
  </div>
</div>`;
}

/** The emitted stylesheet. Archive metrics; contrast-checked text tokens. */
function styles(): string {
  return `
:root{
  --canvas:${SURFACE.canvas};--well:${SURFACE.well};--assistant:${SURFACE.assistant};
  --panel:${SURFACE.panel};--overlay:${SURFACE.overlay};--raised:${SURFACE.raised};
  --header:${SURFACE.header};--hover:${SURFACE.hover};--backdrop:${SURFACE.backdrop};
  --line:${LINE.strong};--line-card:${LINE.card};--line-row:${LINE.row};
  --line-control:${LINE.control};--line-raised:${LINE.raised};--line-hover:${LINE.hover};
  --accent:${ACCENT.base};--accent-hover:${ACCENT.hover};--on-accent:${ACCENT.on};
  --ok:${SIGNAL.ok};--refuse:${SIGNAL.refuse};--info:${SIGNAL.info};--scene:${SIGNAL.scene};
  --text:${TEXT.primary};--text-2:${TEXT.secondary};--text-3:${TEXT.label};
  --dim:${TEXT.dim};--faint:${TEXT.faint};--superseded:${TEXT.superseded};
  --inert:${INERT.text};--inert-on-accent:${INERT.onAccent};--inert-glyph:${INERT.glyph};
  --rail:${METRICS.railWidth}px;--left:${METRICS.leftDockWidth}px;
  --inspector:${METRICS.inspectorWidth}px;--assistant-w:${METRICS.assistantWidth}px;
  --title-h:${METRICS.titleBarHeight}px;--tabs-h:${METRICS.viewTabsHeight}px;
  --status-h:${METRICS.statusBarHeight}px;
  --sans:${TYPE.sans};--mono:${TYPE.mono};
}
*{box-sizing:border-box}
/* Every hidden region here is a model decision (a row decided, a panel its mode
   does not show), so the attribute has to win over the class that lays it out —
   a display rule on .change-row or .dock-bulk otherwise outranks the UA sheet. */
[hidden]{display:none !important}
html,body{margin:0;padding:0;height:100%;overflow:hidden}
body{background:var(--backdrop);color:var(--text);font-family:var(--sans);font-size:13px;-webkit-font-smoothing:antialiased}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
/* An inert control is dimmed by paint, never by element opacity: opacity
   composites the label toward whatever is behind it, and both the token gate and
   a browser's getComputedStyle read the declared colour, so that dimming was
   measured by nothing. --inert is the dimmest tier that still clears 4.5:1, so
   the refusal stays readable. The [aria-pressed]/[aria-selected] pair is here
   because an active tab or mode sets its own colour at a higher specificity. */
button.is-inert{cursor:not-allowed;color:var(--inert)}
button.is-inert[aria-pressed="true"],button.is-inert[aria-selected="true"]{color:var(--inert)}
button.is-inert .rail-glyph{border-color:var(--inert-glyph)}
code,kbd{font-family:var(--mono);font-size:.86em}

.shell{display:grid;grid-template-rows:var(--title-h) 1fr var(--status-h);height:100dvh;min-height:100dvh;background:var(--canvas);position:relative;overflow:hidden}
/* A denied assistant keeps its column: the archive shows the Kids lock screen
   there, and hiding it would turn a named refusal into an absent panel. Only a
   closed assistant removes the column. */
.shell-body{display:grid;grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector) var(--assistant-w);min-height:0}
.shell[data-assistant="closed"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector)}
.shell[data-assistant="closed"] .assistant{display:none}

.title-bar{display:flex;align-items:center;gap:12px;padding:0 11px;background:var(--panel);border-bottom:1px solid var(--line)}
.window-dots{display:flex;gap:7px}
.window-dots i{width:11px;height:11px;border-radius:50%;background:${LINE.raised}}
.menu-bar{display:flex;gap:1px}
.menu-root{position:relative}
.menu-item{font-size:12px;color:var(--text-3);padding:0 8px;height:22px;border-radius:3px}
.menu-item[aria-expanded="true"]{background:var(--hover);color:var(--text)}
.menu-panel{position:absolute;left:0;top:25px;z-index:45;min-width:220px;padding:5px;background:var(--raised);border:1px solid var(--line-raised);border-radius:6px;box-shadow:0 18px 45px -16px ${SCRIM.shadow}}
.menu-command{display:flex;align-items:center;justify-content:space-between;gap:22px;width:100%;padding:7px 9px;border-radius:4px;color:var(--text-2);font-size:12px;text-align:left}
.menu-command:hover,.menu-command:focus-visible{background:var(--hover);color:var(--text)}
.menu-command kbd{font-size:9px;color:var(--dim)}
.profile-switch{display:flex;gap:2px;padding:2px;background:var(--well);border:1px solid var(--line-control);border-radius:5px}
.profile-chip{display:flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:3px;font-size:11px;color:var(--dim);white-space:nowrap}
.profile-chip[aria-pressed="true"]{background:var(--hover);color:var(--text);font-weight:600}
.profile-chip .dot{background:${PROFILE_DOT.idle}}
.profile-chip[aria-pressed="true"] [data-profile-dot="game"]{background:var(--accent)}
.profile-chip[aria-pressed="true"] [data-profile-dot="web"]{background:${PROFILE_DOT.web}}
.profile-chip[aria-pressed="true"] [data-profile-dot="kids"]{background:var(--scene)}
.chip-tag{font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;color:var(--faint)}
.dot{width:5px;height:5px;border-radius:50%;flex:none;display:inline-block}
.dot-ok{background:var(--ok)}
.title-centre{flex:1;display:flex;justify-content:center;min-width:0}
.project-pill{display:flex;align-items:center;gap:8px;height:22px;padding:0 11px;border-radius:11px;background:var(--header);border:1px solid var(--line-control);font-size:11px;white-space:nowrap}
.project-pill[data-project-state="dirty"],.project-pill[data-project-state="recovering"]{border-color:var(--accent);color:var(--accent)}
.project-pill[data-project-state="refused"]{border-color:${SIGNAL.refuseLine};color:var(--refuse)}
.title-actions{display:flex;align-items:center;gap:9px;flex:none}
/* Drawer toggles exist at every size but only matter once a column undocks.
   Scoped so the later .ghost-button rule cannot win on equal specificity. */
.title-actions .drawer-toggle{display:none}
.ghost-button{display:flex;align-items:center;gap:7px;height:22px;padding:0 10px;border-radius:4px;background:var(--header);border:1px solid var(--line-control);font-size:11px;color:var(--dim)}
.ghost-button:hover{border-color:var(--line-hover);color:var(--text)}
/* A single-class :hover outranks button.is-inert, so every control class whose
   hover repaints its label has to say what the inert one does under the pointer
   — otherwise an inert control becomes indistinguishable from a live one there,
   which is the same dimmed-by-nothing state the paint rule above replaced. */
.ghost-button.is-inert:hover{border-color:var(--line-control);color:var(--inert)}
.ghost-button kbd{background:var(--well);border:1px solid var(--line-control);border-radius:2px;padding:1px 4px;color:var(--faint)}
.primary-button{background:var(--accent);color:var(--on-accent);font-weight:600;font-size:11px;border-radius:3px;height:22px;padding:0 11px}
.primary-button:hover{background:var(--accent-hover)}
/* The accent fill stays and only the mark on it is demoted: --inert on orange is
   1.29:1, and the fill is what says which control this is. --inert-on-accent is
   5.72:1 there against the live 7.05:1. */
.primary-button.is-inert,.primary-button.is-inert:hover{color:var(--inert-on-accent)}
.primary-button.is-inert:hover{background:var(--accent)}
.block-button{width:100%;height:32px;font-size:12px;margin-top:10px}
.assistant-toggle{display:flex;align-items:center;gap:7px;height:22px;padding:0 10px;border-radius:4px;font-size:11px;font-weight:500;background:var(--header);border:1px solid var(--line-control);color:var(--dim)}
/* Where the assistant is docked the toggle reads the column's own state; below
   that tier the drawer rule takes over. Which one applies is a stylesheet
   decision on the two complementary media conditions rather than an attribute
   chosen at render time, because the document can be opened at a viewport the
   render never saw and the toggle must never light up over a column that
   viewport does not show. */
@media ${atTierOrAbove("regular")}{
  .shell[data-assistant="open"] .assistant-toggle{background:${ACCENT.surface};border-color:${ACCENT.line};color:var(--accent)}
  .shell[data-assistant="open"] [data-assistant-dot]{background:var(--accent)}
}
.shell[data-assistant="denied"] [data-assistant-dot]{background:var(--scene)}

.mode-rail{background:var(--well);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:9px 0;gap:2px}
.brand{width:28px;height:28px;border-radius:7px;background:var(--accent);margin-bottom:9px;display:grid;place-items:center;box-shadow:0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),0 5px 16px -5px color-mix(in srgb, var(--accent) 60%, transparent)}
.brand::before{content:"";width:10px;height:10px;border:2px solid var(--on-accent);border-radius:1px;transform:rotate(45deg)}
.rail-mode{width:44px;height:42px;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;position:relative;color:var(--faint)}
.rail-mode:hover{background:var(--header)}
.rail-mode[aria-pressed="true"]{background:var(--header);color:var(--accent)}
.rail-mode[aria-pressed="true"]::before{content:"";position:absolute;left:-9px;top:10px;bottom:10px;width:2px;border-radius:0 2px 2px 0;background:var(--accent)}
.rail-glyph{width:14px;height:14px;border:1.5px solid currentColor;display:block}
.rail-label{font-family:var(--mono);font-size:8px;letter-spacing:.05em}

.left-dock,.inspector{background:var(--panel);display:flex;flex-direction:column;min-height:0;overflow-y:auto}
.left-dock{border-right:1px solid var(--line)}
.inspector{border-left:1px solid var(--line)}
.panel-head{margin:0;height:29px;flex:none;display:flex;align-items:center;padding:0 10px;background:var(--header);border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.15em;color:var(--text-3)}
.panel-empty{margin:0;padding:12px 11px;font-size:11px;line-height:1.55;color:var(--dim)}
.panel-note{display:flex;gap:9px;align-items:flex-start;margin:0 10px 11px;padding:10px 11px;border:1px solid;border-radius:4px;font-size:11px;line-height:1.55}
.panel-note .dot{margin-top:5px}
.project-panel{flex:none;border-bottom:1px solid var(--line)}
.project-panel .panel-head{justify-content:space-between}
.project-name{max-width:126px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim);font-size:8px;letter-spacing:.04em}
.project-launcher{display:grid;gap:7px;padding:9px;border-bottom:1px solid var(--line)}
.project-launcher p,.project-root{margin:0;color:var(--dim);font-size:9px;line-height:1.45;overflow-wrap:anywhere}
.project-lifecycle-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.project-lifecycle-actions button{min-width:0;padding-inline:7px}
.project-recent-label{font-family:var(--mono);font-size:8px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}
.project-recent-select{width:100%;min-width:0;height:26px;padding:0 7px;border:1px solid var(--line-control);border-radius:4px;background:var(--raised);color:var(--text);font-family:var(--mono);font-size:9px}
.project-recent-select.is-inert{color:var(--inert);border-color:var(--line-control)}
.project-bound{min-width:0}
.project-files{padding:7px}
.project-file{display:flex;align-items:center;gap:9px;padding:8px 9px;border:1px solid transparent;border-radius:4px;color:var(--dim)}
.project-file.is-active{background:${ACCENT.surface};border-color:${ACCENT.line};color:var(--text)}
.project-file-mark{color:var(--accent);font-size:14px}
.project-file b,.project-file em{display:block}
.project-file b{font-family:var(--mono);font-size:10px;font-weight:500}
.project-file em{font-size:9px;font-style:normal;color:var(--dim);margin-top:2px}
.scene-entities{padding:0 7px 9px}
.scene-entities-label{margin:0 3px 5px;font-family:var(--mono);font-size:8px;letter-spacing:.12em;color:var(--faint)}
.scene-entity{width:100%;min-width:0;padding:8px 9px;border:1px solid var(--line-card);border-radius:4px;background:var(--raised);color:var(--dim);text-align:left}
.scene-entity span,.scene-entity code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scene-entity span{font-size:10px;color:var(--text)}.scene-entity code{margin-top:3px;font-size:8px;color:var(--dim)}
.scene-entity[aria-pressed="true"]{border-color:var(--accent);background:${ACCENT.surface}}
.scene-entities-refusal{margin:0;padding:0 10px 9px;font-size:9px;line-height:1.45;color:var(--dim);overflow-wrap:anywhere}
.project-file-state{margin:0;padding:0 10px 9px;font-family:var(--mono);font-size:9px;color:var(--faint)}
.project-root{padding:0 10px 9px;font-family:var(--mono)}
.scene-property-editor{display:grid;gap:8px;padding:10px 11px}
.scene-property-entity{margin:0;padding-bottom:7px;border-bottom:1px solid var(--line);min-width:0}
.scene-property-entity b,.scene-property-entity code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scene-property-entity b{font-size:11px}.scene-property-entity code{margin-top:3px;font-size:8px;color:var(--dim)}
.scene-property-editor label{display:grid;gap:5px;font-family:var(--mono);font-size:9px;color:var(--dim)}
.scene-property-input{width:100%;min-width:0;height:28px;padding:0 8px;border:1px solid var(--line-control);border-radius:4px;background:var(--raised);color:var(--text);font-family:var(--mono);font-size:11px}
.scene-property-input:focus{outline:1px solid var(--accent);outline-offset:1px}.scene-property-input.is-inert{color:var(--inert)}
.scene-property-diagnostic{margin:0;font-size:9px;line-height:1.45;color:var(--dim);overflow-wrap:anywhere}
.scene-property-review{max-height:150px;margin:0;padding:8px;overflow:auto;border:1px solid var(--line);border-radius:4px;background:var(--well);color:var(--dim);font-family:var(--mono);font-size:8px;line-height:1.45;white-space:pre-wrap}
.pass-list{list-style:none;margin:0;padding:10px 11px;display:flex;flex-direction:column;gap:6px}
.pass-row{display:flex;align-items:center;gap:10px;padding:6px 9px;background:var(--raised);border:1px solid var(--line);border-radius:4px}
.pass-order{width:14px;height:14px;border-radius:3px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:9px;font-weight:700;flex:none}
.pass-row b{display:block;font-size:11px;font-weight:400;color:var(--text)}
.pass-row em{display:block;font-style:normal;font-size:10px;color:var(--dim)}

.viewport-column{display:flex;flex-direction:column;min-width:0;min-height:0}
.viewport-region{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;background:var(--canvas)}
.profile-surfaces{flex:none;background:var(--panel);border-bottom:1px solid var(--line);position:relative}
.profile-surface{min-height:92px;padding:9px 12px;display:grid;grid-template-columns:146px minmax(0,1fr) minmax(220px,.8fr);gap:12px;align-items:center}
.profile-surface[data-profile-surface="web"]{display:none}
.shell[data-profile="web"] .profile-surface[data-profile-surface="game"]{display:none}
.shell[data-profile="web"] .profile-surface[data-profile-surface="web"]{display:grid}
.profile-kicker{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.14em;color:var(--accent);margin-bottom:4px}
.profile-surface strong{font-size:13px}
.capability-list{list-style:none;margin:0;padding:0;display:flex;gap:6px;min-width:0;overflow:hidden}
.capability-list li{min-width:0;flex:1;padding:6px 8px;background:var(--raised);border:1px solid var(--line-card);border-radius:4px}
.capability-list b,.capability-list span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.capability-list b{font-size:10px}.capability-list span{font-size:8.5px;color:var(--dim);margin-top:2px}
.game-runtime-note,.web-authoring-tools p{margin:0;font-size:10px;line-height:1.45;color:var(--dim)}
.web-authoring-tools{display:flex;flex-direction:column;gap:5px;min-width:0}
.web-authoring-tools code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${PROFILE_DOT.web}}
.profile-actions{display:flex;gap:6px;align-items:center}
.profile-runtime-actions{min-height:30px;padding:0 12px 7px;display:flex;align-items:center;justify-content:flex-end;gap:9px}
.runtime-report{margin:0;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:8.5px;color:var(--dim)}
.view-tabs{height:var(--tabs-h);flex:none;display:flex;align-items:stretch;background:var(--panel);border-bottom:1px solid var(--line)}
/* The tablist owns only its tabs: ARIA restricts a tablist's children to tabs,
   so the spacer and the tool glyphs stay siblings in the same flex row. */
.view-tablist{display:flex;align-items:stretch}
.view-tab{padding:0 15px;font-size:11px;color:var(--dim);border-right:1px solid var(--line)}
.view-tab[aria-selected="true"]{color:var(--text);font-weight:600;background:var(--panel);box-shadow:inset 0 2px 0 var(--accent)}
.spacer{flex:1}
.view-tools{display:flex;align-items:center;gap:3px;padding:0 8px}
.view-tools i{width:10px;height:10px;border:1.4px solid var(--faint);border-radius:1px}
.viewport{flex:1;position:relative;min-height:0;overflow:hidden;background:radial-gradient(130% 95% at 50% 0%, ${VIEWPORT_GRADIENT.inner} 0%, ${VIEWPORT_GRADIENT.mid} 48%, ${SURFACE.canvas} 100%);display:grid;place-items:center}
.viewport-backdrop{position:absolute;inset:0;pointer-events:none}
.viewport-note{margin:0;font-size:11px;line-height:1.5;color:var(--dim);max-width:44ch;text-align:center}
.axis-widget{position:absolute;right:12px;top:11px;display:flex;gap:4px}
.axis-widget i{width:18px;height:2px;border-radius:1px;display:block}
.assistant-manipulators{position:absolute;left:12px;top:12px;z-index:8;display:flex;gap:4px}
.assistant-manipulator{border:1px solid var(--line-hover);border-radius:3px;background:var(--header);color:var(--text);padding:5px 7px;font-size:10px}
.assistant-manipulator:hover{border-color:var(--accent);color:var(--accent)}
.assistant-manipulator.is-inert:hover{border-color:var(--line-hover);color:var(--inert)}

.sculpt-progress{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:9px;animation:rise .3s ease-out}
.sculpt-label{margin:0;font-size:14px;font-weight:600}
.sculpt-track{width:320px;height:3px;background:var(--hover);border-radius:2px;overflow:hidden;position:relative}
.sculpt-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent)}
.sculpt-sweep{position:absolute;inset:0;width:28%;background:linear-gradient(90deg,transparent,${SCRIM.sheen},transparent);animation:sweep 1.1s linear infinite}
.sculpt-detail{margin:0;font-family:var(--mono);font-size:9px;color:var(--faint)}

.dock{height:var(--dock-h);flex:none;background:var(--panel);border-top:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.dock-tabs{height:30px;flex:none;display:flex;align-items:stretch;background:var(--header);border-bottom:1px solid var(--line)}
/* Same rule as the viewport strip: the bulk accept/reject are the highest
   consequence controls here, so they must not sit inside the tablist. */
.dock-tablist{display:flex;align-items:stretch}
.dock-tab{display:flex;align-items:center;gap:7px;padding:0 13px;font-size:11px;color:var(--dim);border-right:1px solid var(--line)}
.dock-tab[aria-selected="true"]{color:var(--text);font-weight:600;background:var(--panel);box-shadow:inset 0 2px 0 var(--accent)}
.badge{min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-family:var(--mono);font-size:9px;font-weight:700;display:grid;place-items:center}
.dock-bulk{display:flex;align-items:center;gap:7px;padding:0 10px}
.dock-body{flex:1;min-height:0;overflow-y:auto}
.dock-caption{margin:0;padding:8px 14px;font-size:10.5px;color:var(--dim);border-bottom:1px solid var(--line-row);background:var(--well)}
.change-list{list-style:none;margin:0;padding:0}
.change-row{display:grid;grid-template-columns:22px minmax(0,1fr) 118px 16px 148px 84px;gap:10px;padding:9px 14px;border-bottom:1px solid var(--line-row);align-items:center}
.change-row:hover{background:var(--raised)}
.change-badge{width:17px;height:17px;border-radius:3px;display:grid;place-items:center;font-family:var(--mono);font-size:10px;font-weight:700}
.change-badge[data-change-kind="modified"]{background:${ACCENT.surface};color:var(--accent)}
.change-badge[data-change-kind="added"]{background:${SIGNAL.okSurface};color:var(--ok)}
.change-path{display:flex;align-items:baseline;min-width:0;font-family:var(--mono);font-size:11px}
.change-path .dir{color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.change-path .leaf{color:var(--text);white-space:nowrap}
.change-before{font-family:var(--mono);font-size:11px;color:var(--superseded);text-decoration:line-through}
.change-arrow{color:var(--faint);font-size:10px}
.change-after{font-family:var(--mono);font-size:11px;color:var(--ok)}
.change-actions{display:flex;gap:6px;justify-content:flex-end}
.decision{width:24px;height:24px;border-radius:3px;border:1px solid var(--line-raised);color:var(--dim);display:grid;place-items:center;font-size:11px}
.decision-accept{border-color:${SIGNAL.okLine};background:${SIGNAL.okSurface};color:var(--ok)}
.decision-reject:hover{border-color:${SIGNAL.refuseLine};background:${SIGNAL.refuseSurface};color:var(--refuse)}
/* An inert decision drops its semantic fill rather than wearing a green accept
   badge it cannot honour; --inert is 4.42:1 on that fill and 5.06:1 off it. */
.decision.is-inert,.decision.is-inert:hover{background:none;border-color:var(--line-raised);color:var(--inert)}
.change-empty{margin:0;padding:34px 14px;text-align:center;font-size:12px;color:var(--dim)}

.assistant{background:var(--assistant);border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.assistant-head{height:36px;flex:none;display:flex;align-items:center;gap:9px;padding:0 12px;background:var(--raised);border-bottom:1px solid var(--line)}
.assistant-head h2{margin:0;font-size:12px;font-weight:600;flex:1}
.assistant-mark{width:16px;height:16px;border-radius:4px;background:${ACCENT.surface};display:grid;place-items:center}
.assistant-mark::before{content:"";width:6px;height:6px;border-radius:1px;background:var(--accent);transform:rotate(45deg)}
.shell[data-assistant="denied"] .assistant-mark{background:${SIGNAL.sceneSurface}}
.shell[data-assistant="denied"] .assistant-mark::before{background:var(--scene)}
.assistant-model{font-family:var(--mono);font-size:9px;color:var(--dim);background:var(--header);border:1px solid var(--line-control);border-radius:3px;padding:2px 6px}
.icon-button{width:26px;height:26px;border-radius:4px;display:grid;place-items:center;color:var(--dim)}
/* An icon button on the accent fill keeps the on-accent glyph colour: without
   this the later single-class rule wins and paints --dim on orange (1.1:1). */
.primary-button.icon-button{color:var(--on-accent)}
.primary-button.icon-button.is-inert{color:var(--inert-on-accent)}
.assistant-body{flex:1;min-height:0;overflow-y:auto;padding:13px 12px}
.assistant-empty{margin:0;font-size:11px;line-height:1.55;color:var(--dim)}
.assistant-thinking{display:flex;align-items:center;gap:8px;margin:12px 0 0;font-size:11px;color:var(--dim)}
.assistant-thinking .dot{background:var(--accent)}
.assistant-progress{font-size:11px;line-height:1.5;color:var(--text-2);padding:9px;border:1px solid var(--line-control);border-radius:4px;background:var(--header)}
.assistant-result{font-size:10px;line-height:1.55;color:var(--text-3);white-space:pre-wrap}
.assistant-foot{font-size:10px;color:var(--dim);line-height:1.5;margin:12px 0 0}
.assistant-composer{flex:none;border-top:1px solid var(--line);background:var(--panel);padding:9px 11px 11px;display:flex;flex-direction:column;gap:8px}
.assistant-prompt{width:100%;min-height:58px;resize:vertical;border:1px solid var(--line-control);border-radius:4px;background:var(--well);color:var(--text);font:11px/1.5 var(--sans);padding:8px}
.assistant-prompt.is-inert{color:var(--inert);cursor:not-allowed}
.assistant-routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}
.assistant-route{min-width:0;padding:5px 3px;border:1px solid var(--line-control);border-radius:3px;color:var(--dim);font-size:9px;line-height:1.2}
.assistant-route[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:${ACCENT.surface}}
.composer-actions{display:flex;align-items:center;gap:7px}
.assistant-modes{display:flex;background:var(--header);border:1px solid var(--line-control);border-radius:4px;padding:2px}
.assistant-mode{height:21px;padding:0 9px;font-size:10px;color:var(--dim);border-radius:2px}
.assistant-mode[aria-pressed="true"]{background:var(--accent);color:var(--on-accent);font-weight:600}
.assistant-mode.is-inert[aria-pressed="true"]{color:var(--inert-on-accent)}
/* Both assistant bodies ship in every document and the state chooses between
   them, so a profile switched in the browser reaches the same named denial the
   model reports — the rule the editor body's refusal region already follows. */
.assistant-denied{display:none;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:34px 26px;text-align:center}
.shell[data-assistant="denied"] .assistant-denied{display:flex}
.shell[data-assistant="denied"] .assistant-body,
.shell[data-assistant="denied"] .assistant-composer{display:none}
.assistant-denied p{margin:0;font-size:12px;color:var(--dim);line-height:1.6}
.assistant-denied-title{font-size:14px;font-weight:600;color:var(--text)}
.assistant-denied code{color:${SIGNAL.sceneText};border:1px solid ${SIGNAL.sceneLine};background:${SIGNAL.sceneSurface};border-radius:3px;padding:4px 8px;display:inline-block}

/* Kids: one refusal region replaces the whole editor body, so the grid drops to
   rail + body + assistant. */
.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr) var(--assistant-w)}
.shell[data-profile="kids"] .left-dock,
.shell[data-profile="kids"] .viewport-column,
.shell[data-profile="kids"] .inspector{display:none}
.profile-refusal{display:none;place-items:center;padding:32px;background:var(--canvas);min-width:0}
.shell[data-profile="kids"] .profile-refusal{display:grid}
.profile-refusal-card{max-width:46ch;text-align:center;background:${SIGNAL.sceneSurface};border:1px solid ${SIGNAL.sceneLine};border-radius:9px;padding:26px 28px}
.profile-refusal-card h2{margin:12px 0;font-size:16px}
.profile-refusal-card p{margin:0 0 10px;font-size:12px;line-height:1.65;color:${SIGNAL.sceneText}}
.profile-refusal-code code{color:var(--scene)}
.profile-refusal-foot{color:var(--dim) !important}
.mark-scene{background:${SIGNAL.sceneSurface};border:1px solid ${SIGNAL.sceneLine};color:${SIGNAL.scene};margin:0 auto}

.status-bar{position:relative;background:var(--well);border-top:1px solid var(--line);display:flex;align-items:center;padding:0 12px;gap:13px}
.status-text{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text-3)}
.status-pin{font-family:var(--mono);font-size:10px;color:var(--faint)}
.status-project{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:10px;color:var(--dim)}
.divider{width:1px;height:12px;background:var(--line-card)}
.state-shortcut{font-family:var(--mono);font-size:9px;letter-spacing:.07em;color:var(--faint);border:1px solid var(--line-control);border-radius:3px;padding:2px 7px}
.state-shortcut:hover{border-color:var(--line-hover);color:var(--text)}

.overlay{position:absolute;inset:0;background:${SCRIM.overlay};display:grid;place-items:center;z-index:50;padding:24px}
.overlay-card{width:min(620px,100%);max-height:80%;overflow:auto;background:var(--overlay);border:1px solid var(--line-raised);border-radius:9px;box-shadow:0 40px 90px -20px ${SCRIM.shadow};animation:rise .16s ease-out}
.overlay-card.overlay-refused{border-color:${SIGNAL.refuseLine}}
.overlay-head{display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}
.overlay-head h2{margin:0;font-size:15px;font-weight:600}
.overlay-mark{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;flex:none}
.mark-refuse{background:${SIGNAL.refuseSurface};border:1px solid ${SIGNAL.refuseLine};color:var(--refuse)}
.overlay-body{margin:0;padding:15px 18px;font-size:12px;line-height:1.6;color:var(--text-2)}
.overlay-actions{display:flex;gap:9px;justify-content:flex-end;padding:13px 18px;background:var(--well);border-top:1px solid var(--line)}
.overlay-actions .primary-button,.overlay-actions .ghost-button{height:31px;padding:0 14px;font-size:12px}
.palette-list{list-style:none;margin:0;padding:6px 0;max-height:352px;overflow-y:auto}
.palette-group h3{margin:0;padding:8px 16px 4px;font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.14em;color:var(--faint)}
.palette-group ul{list-style:none;margin:0;padding:0}
.palette-item{display:flex;align-items:center;gap:12px;padding:8px 16px;width:100%;text-align:left}
.palette-item:hover{background:var(--hover)}
.palette-name{flex:1;font-size:13px}
.palette-item kbd{font-size:9px;color:var(--dim);border:1px solid var(--line-control);border-radius:3px;padding:2px 5px}
.overlay-foot{margin:0;padding:10px 16px;background:var(--well);border-top:1px solid var(--line);font-size:10.5px;color:var(--dim)}

.refusal-help-toggle[aria-expanded="true"]{border-color:var(--line-hover);color:var(--text)}
.refusal-legend-panel{position:absolute;right:8px;bottom:calc(100% + 8px);z-index:45;width:min(520px,calc(100vw - 16px));max-height:min(360px,calc(100dvh - var(--title-h) - var(--status-h) - 24px));overflow:auto;padding:10px 12px;background:var(--well);border:1px solid var(--line-raised);border-radius:6px;box-shadow:0 18px 48px -18px ${SCRIM.shadow}}
.refusal-legend-panel h2{margin:0 0 8px;font-family:var(--mono);font-size:9px;font-weight:400;letter-spacing:.15em;color:var(--text-3)}
.refusal-row{margin:0 0 6px;font-size:11px;line-height:1.5;color:var(--dim)}
.refusal-row code{color:var(--accent);margin-right:8px}

.window-refusal{display:none;max-width:52ch;margin:0 auto;padding:48px 24px;text-align:center}
.window-refusal h1{font-size:17px;margin:0 0 12px}
.window-refusal p{font-size:13px;line-height:1.65;color:var(--dim);margin:0 0 10px}
.window-refusal code{color:var(--accent)}

@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@keyframes sweep{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}

/* Compact: the assistant leaves the grid and becomes an overlay drawer. Its
   existing toggle opens and closes it, so nothing becomes unreachable. */
@media ${belowTier("regular")}{
  .shell-body,.shell[data-assistant="closed"] .shell-body,.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector)}
  .shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr)}
  .assistant{position:absolute;top:var(--title-h);bottom:var(--status-h);right:0;width:min(var(--assistant-w),100%);z-index:40;box-shadow:0 0 60px -10px ${SCRIM.shadow}}
  /* An undocked assistant starts closed: a drawer nobody opened must not sit
     on top of the panel it undocked from. Its toggle still opens it. The
     emitted bytes always carry a closed drawer, so this holds at every viewport
     the document is opened at, script or no script. */
  .shell:not([data-drawer-assistant="open"]) .assistant{display:none}
  /* And the toggle follows the drawer here, not the column state: an open
     column that is not on screen must not leave the toggle lit. */
  .shell[data-drawer-assistant="open"] .assistant-toggle{background:${ACCENT.surface};border-color:${ACCENT.line};color:var(--accent)}
  .shell[data-drawer-assistant="open"] [data-assistant-dot]{background:var(--accent)}
  /* Except a denied one, which never becomes a drawer at all. Its body is the
     Kids lock screen — a named refusal — and the only control that could open a
     drawer is the toggle that same refusal makes inert, so undocking it would
     leave THIRD_PARTY_LLM_DENIED_BY_DEFAULT on no reachable surface. It keeps a
     real column at every tier instead. */
  .shell[data-assistant="denied"] .shell-body{grid-template-columns:var(--rail) var(--left) minmax(0,1fr) var(--inspector) var(--assistant-w)}
  .shell[data-profile="kids"][data-assistant="denied"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr) var(--assistant-w)}
  .shell[data-assistant="denied"] .assistant{position:static;display:flex;width:auto;box-shadow:none}
}
/* Narrow: the left dock and the inspector become drawers too, and the two
   title-bar toggles that open them appear. They start closed, because a drawer
   nobody opened should not be covering the viewport. */
@media ${belowTier("compact")}{
  .shell-body,.shell[data-assistant="closed"] .shell-body,.shell[data-profile="kids"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr)}
  .title-actions .drawer-toggle{display:inline-flex}
  .title-centre,.menu-bar{display:none}
  .left-dock,.inspector{position:absolute;top:var(--title-h);bottom:var(--status-h);z-index:35;box-shadow:0 0 60px -10px ${SCRIM.shadow}}
  .left-dock{left:var(--rail);width:min(var(--left),calc(100% - var(--rail)))}
  .inspector{right:0;width:min(var(--inspector),100%)}
  .shell:not([data-drawer-left="open"]) .left-dock{display:none}
  .shell:not([data-drawer-inspector="open"]) .inspector{display:none}
  .change-row{grid-template-columns:22px minmax(0,1fr) 84px}
  .change-before,.change-arrow,.change-after{display:none}
  .profile-surface{grid-template-columns:120px minmax(0,1fr);min-height:76px}
  .profile-surface .capability-list,.game-runtime-note{display:none}
  .runtime-report{display:none}
  .shell[data-assistant="denied"] .shell-body,.shell[data-profile="kids"][data-assistant="denied"] .shell-body{grid-template-columns:var(--rail) minmax(0,1fr) var(--assistant-w)}
}
/* Below the declared minimum the chrome refuses instead of laying out. The
   breakpoints are interpolated from DESKTOP_MINIMUM_WINDOW, so the CSS and the
   model refuse at exactly the same size and cannot be raised apart. */
@media (max-width:${DESKTOP_MINIMUM_WINDOW.width - 1}px),(max-height:${DESKTOP_MINIMUM_WINDOW.height - 1}px){
  .shell{display:none}
  .window-refusal{display:block}
}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
  .sculpt-sweep{display:none}
}
`;
}

/**
 * Every control, on every profile, exactly as the model projects it.
 *
 * `[kind, refusal]` per control id, unioned across the modes because the dock
 * tabs a mode has are part of that mode. The browser-side switch applies these
 * by id, which is what replaced a hand-written selector list: the list had to be
 * edited whenever a control was added, and it was not — the drawer toggles were
 * missing from it and stayed live on a profile whose panels the refusal removes.
 */
function controlsByProfile(
  view: DesktopVisualView,
  runtime = view.state.assistantRuntime,
): Record<string, Record<string, readonly [string, string | null]>> {
  const table: Record<string, Record<string, readonly [string, string | null]>> = {};
  for (const profile of view.profiles) {
    const merged: Record<string, readonly [string, string | null]> = {};
    for (const mode of DESKTOP_MODE_IDS) {
      const projected = desktopVisualView({
        ...view.state,
        profile: profile.id,
        mode,
        assistantRuntime: runtime,
      });
      for (const control of projected.controls) {
        merged[control.id] = [control.kind, control.refusal] as const;
      }
    }
    table[profile.id] = merged;
  }
  return table;
}

/** The emitted behaviour script. Reads only tables serialized from the model. */
function script(view: DesktopVisualView): string {
  const assistantRuntimeRows = Object.fromEntries(
    (["none", "local"] as const).map((runtime) => {
      const projected = desktopVisualView({
        ...view.state,
        assistantRuntime: runtime,
      });
      return [
        runtime,
        {
          controlsByProfile: controlsByProfile(projected, runtime),
          assistantByProfile: Object.fromEntries(
            projected.profiles.map((profile) => [
              profile.id,
              {
                state: profile.assistant.state,
                modelLabel: profile.assistant.modelLabel,
              },
            ]),
          ),
        },
      ];
    }),
  );
  const tables = {
    dockTabsByMode: Object.fromEntries(
      DESKTOP_MODE_IDS.map((mode) => [mode, [...dockTabsFor(mode)]]),
    ),
    dockLabels: { changes: "Changes", assets: "Assets", console: "Console", evidence: "Evidence", timeline: "Timeline" },
    dockHeightByMode: Object.fromEntries(
      DESKTOP_MODE_IDS.map((mode) => [
        mode,
        mode === "animate" ? METRICS.dockHeightAnimate : METRICS.dockHeight,
      ]),
    ),
    changeCount: CHANGE_REVIEW_ROWS.length,
    assistantRuntimeEvent: DESKTOP_ASSISTANT_RUNTIME_EVENT,
    assistantRuntimeRows,
    assistantRuntimeRefusal: DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
    // The status bar names the profile the document is on, so a switch that
    // leaves it behind has the surface asserting a profile it is not on — next
    // to a refusal that says otherwise. The model's own pin, never a local copy.
    pinByProfile: Object.fromEntries(
      view.profiles.map((profile) => [
        profile.id,
        desktopVisualView({ ...view.state, profile: profile.id }).profilePin,
      ]),
    ),
    /** The tier boundary the stylesheet undocks the assistant at. */
    assistantDrawerQuery: belowTier("regular"),
    commands: DESKTOP_INTERACTION_COMMANDS,
    paletteShortcut: DESKTOP_PALETTE_SHORTCUT,
    commandRefusals: {
      undoUnavailable: DESKTOP_VISUAL_REFUSALS.undoUnavailable,
    },
    product: {
      documentPath: view.product.surface.project.activeFile,
      viewportPlayEvent: DESKTOP_VIEWPORT_PLAY_EVENT,
      webStarter: DESKTOP_WEB_STARTER,
      // Every name the script can print, serialized rather than typed out as a
      // literal in the browser body: a refusal the visitor reads is one the
      // registry owns and `refusalLegend()` explains.
      refusals: DESKTOP_PRODUCT_REFUSALS,
      /** The one staging decision's own configuration, not a browser copy. */
      stageConfig: DESKTOP_WEB_STAGE_CONFIG,
    },
    controlsByProfile: controlsByProfile(view),
  };

  return `
const T = ${inlineJson(tables)};
const shell = document.querySelector('.shell');
if (shell) {
  const q = (sel) => Array.from(shell.querySelectorAll(sel));

  // The model's own staging decision, not a paraphrase of it: this is the exact
  // function \`stageWebHtml()\` and \`stageWebAssetInjection()\` call, so the shipped
  // browser path and the tested exports cannot answer differently.
  const webStageDecision = ${String(desktopWebStageDecision)};

  let projectData = null;
  let projectContentHash = null;
  let projectDirty = false;
  let projectRecovering = false;
  let activeProject = null;
  let editableScene = null;
  let selectedSceneEntityId = null;
  let sceneRefusalText = null;
  let undoAvailability = 'unavailable';
  // One product request at a time. Every live control reads \`projectData\` before
  // its first await, so two overlapping clicks would each build a proposal from
  // the same pre-edit document and the second would replace the first in the
  // host's single-proposal session — both reporting success, one edit gone.
  let inFlight = false;

  const productStatus = (state, text) => {
    const pill = shell.querySelector('[data-project-state]');
    if (pill) pill.dataset.projectState = state;
    q('[data-project-status]').forEach((el) => { el.textContent = text; });
    q('[data-project-file-state]').forEach((el) => { el.textContent = text; });
  };

  // The panel's refusal lives beside the entity list rather than inside the
  // editor it would explain: the editor is hidden exactly when there is no
  // inspectable entity, so a reason written in there is a reason nobody reads.
  // The left dock is itself a closed drawer below the compact tier, so the same
  // text also rides the product status the status bar mirrors at every tier.
  const sceneEntitiesRefusal = (text) => {
    sceneRefusalText = text || null;
    const el = shell.querySelector('[data-scene-entities-refusal]');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  };

  const withSceneRefusal = (text) =>
    sceneRefusalText === null ? text : text + ' · ' + sceneRefusalText;

  const clearSceneProperty = () => {
    editableScene = null;
    selectedSceneEntityId = null;
    const entities = shell.querySelector('[data-scene-entities]');
    const editor = shell.querySelector('[data-scene-property-editor]');
    const review = shell.querySelector('[data-scene-property-review]');
    if (entities) entities.hidden = true;
    if (editor) editor.hidden = true;
    if (review) { review.hidden = true; review.textContent = ''; }
    sceneEntitiesRefusal('');
    q('[data-action="scene-entity-select"]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
  };

  const showSceneProperty = (entityId) => {
    const entities = editableScene && Array.isArray(editableScene.entities)
      ? editableScene.entities
      : [];
    const entity = entities.find((candidate) => candidate && candidate.id === entityId);
    const property = entity && Array.isArray(entity.properties) ? entity.properties[0] : null;
    if (!entity || !property || typeof property.value !== 'number') return false;
    selectedSceneEntityId = entity.id;
    q('[data-action="scene-entity-select"]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.value === entity.id));
    });
    q('[data-scene-property-entity-label]').forEach((el) => { el.textContent = entity.label; });
    q('[data-scene-property-entity-id]').forEach((el) => { el.textContent = entity.id; });
    q('[data-scene-property-label]').forEach((el) => { el.textContent = property.label; });
    const input = shell.querySelector('#scene-property-translation-x');
    if (input && input.tagName === 'INPUT') {
      input.value = String(property.value);
      input.step = String(property.step);
    }
    const editor = shell.querySelector('[data-scene-property-editor]');
    if (editor) editor.hidden = false;
    const diagnostic = shell.querySelector('[data-scene-property-diagnostic]');
    if (diagnostic) diagnostic.textContent = 'Typed numeric property · edits stage one E1 proposal and write only on Save.';
    return true;
  };

  // Every path that moves the document — open, stage, save, recovery — re-reads
  // the panel from the host's own inspection, and keeps the operator's selection
  // across that read. Re-selecting is how the value on screen used to be
  // refreshed, so dropping the selection here is what made a stale value
  // survivable in the first place.
  const syncSceneProperties = (status) => {
    const previousSelection = selectedSceneEntityId;
    clearSceneProperty();
    const inspected = status && status.editableScene;
    const entity = inspected && inspected.ok === true && Array.isArray(inspected.entities)
      ? inspected.entities[0]
      : null;
    const property = entity && Array.isArray(entity.properties) ? entity.properties[0] : null;
    if (!entity || typeof entity.id !== 'string' || typeof entity.label !== 'string' ||
        !property || property.id !== 'translation-x' || typeof property.value !== 'number') {
      const refusal = inspected && inspected.ok === false && Array.isArray(inspected.diagnostics)
        ? inspected.diagnostics[0]
        : null;
      if (refusal && typeof refusal.code === 'string') {
        sceneEntitiesRefusal(
          'Scene entities unavailable · ' + refusal.code +
          (typeof refusal.message === 'string' && refusal.message ? ' · ' + refusal.message : ''),
        );
      }
      return false;
    }
    editableScene = inspected;
    const entities = shell.querySelector('[data-scene-entities]');
    if (entities) entities.hidden = false;
    q('[data-scene-entity-label]').forEach((el) => { el.textContent = entity.label; });
    q('[data-scene-entity-id]').forEach((el) => { el.textContent = entity.id; });
    q('[data-action="scene-entity-select"]').forEach((el) => { el.dataset.value = entity.id; });
    if (previousSelection !== null) showSceneProperty(previousSelection);
    return true;
  };

  // The run report is hidden below the compact tier, so a refusal that lives
  // only there is a refusal nobody at 1000x700 can read. Refusals also go to the
  // product status, which the status bar mirrors at every tier.
  const runStatus = (text) => {
    q('[data-product-run-report]').forEach((el) => { el.textContent = text; });
  };

  const runRefusal = (code, detail) => {
    const text = 'Play refused · ' + code + (detail ? ' · ' + detail : '');
    runStatus(text);
    q('[data-run-session-report]').forEach((el) => {
      el.textContent = 'No completed session for the latest Play request · ' + code;
    });
    q('[data-run-live-report]').forEach((el) => {
      el.textContent = 'No viewport frame was acknowledged for the latest Play request.';
    });
    productStatus('refused', text);
    showOutcome('Play refused', code, detail || 'The composed scene was not played.');
  };

  const desktopPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.request === 'function' ? candidate : null;
  };

  const projectPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.project === 'function' ? candidate : null;
  };

  const runtimeRequest = async (request) => {
    const port = desktopPort();
    if (port === null) return null;
    try {
      return await port.request(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: T.product.refusals.runtimeRequestFailed,
        message,
        detail: message,
      };
    }
  };

  const projectRequest = async (request) => {
    const port = projectPort();
    if (port === null) return null;
    try {
      return await port.project(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: T.product.refusals.runtimeRequestFailed,
        message,
        detail: message,
      };
    }
  };

  const applyProjectLifecycleStatus = (status) => {
    if (!status || !Array.isArray(status.recents)) return false;
    const candidate = status.active;
    activeProject = candidate && typeof candidate.name === 'string' &&
      typeof candidate.root === 'string' && candidate.documentPath === T.product.documentPath
      ? candidate
      : null;
    const launcher = shell.querySelector('[data-project-launcher]');
    const bound = shell.querySelector('[data-project-bound]');
    if (launcher) launcher.hidden = activeProject !== null;
    if (bound) bound.hidden = activeProject === null;
    q('[data-project-name]').forEach((el) => {
      el.textContent = activeProject === null ? 'No project' : activeProject.name;
    });
    q('[data-project-root]').forEach((el) => {
      el.textContent = activeProject === null ? '' : activeProject.root;
    });
    const recent = shell.querySelector('#project-recent-select');
    if (recent) {
      recent.replaceChildren();
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = status.recents.length === 0 ? 'No recent projects' : 'Choose a recent project';
      recent.append(empty);
      status.recents.forEach((entry) => {
        if (!entry || typeof entry.root !== 'string' || typeof entry.name !== 'string') return;
        const option = document.createElement('option');
        option.value = entry.root;
        option.textContent = entry.name + ' — ' + entry.root;
        recent.append(option);
      });
    }
    if (activeProject !== null) {
      document.title = activeProject.name + ' — ' + activeProject.root + ' — ' +
        activeProject.documentPath + ' — SceneAxi Engine Desktop';
      productStatus('closed', activeProject.name + ' · ' + activeProject.root + ' · ' +
        activeProject.documentPath + ' · ready to open');
    } else {
      document.title = 'SceneAxi Engine Desktop — Choose a project';
      const recovery = status.recovery && typeof status.recovery.reason === 'string'
        ? ' · recovery: ' + status.recovery.reason + ' · choose New Project or Open Project'
        : '';
      productStatus(recovery ? 'refused' : 'closed', 'No project selected' + recovery);
    }
    return true;
  };

  const syncProjectLifecycle = async () => {
    const port = projectPort();
    if (port === null) return;
    const response = await projectRequest({ action: 'status', profile: shell.dataset.profile });
    if (!response || !response.ok || !applyProjectLifecycleStatus(response.data?.status)) {
      productStatus('refused', 'Project lifecycle refused · ' +
        (response?.reason || T.product.refusals.runtimeRequestRefused));
      return;
    }
    if (activeProject !== null) await openProject();
  };

  const chooseProject = async (action) => {
    if (projectRecovering) {
      productStatus('refused', 'Project change refused · ' + T.product.refusals.recoveryPending);
      showOutcome('Project change refused', T.product.refusals.recoveryPending, 'Resolve the pending Save recovery before changing project roots.');
      return;
    }
    if (projectDirty) {
      productStatus('refused', 'Project change refused · ' + T.product.refusals.profileSwitchDirty);
      showOutcome('Project change refused', T.product.refusals.profileSwitchDirty, 'Save or reload the staged proposal before changing project roots.');
      return;
    }
    const recent = shell.querySelector('#project-recent-select');
    const root = recent && typeof recent.value === 'string' ? recent.value : '';
    if ((action === 'open-recent' || action === 'remove-recent') && root.length === 0) {
      productStatus('refused', 'Recent project refused · no validated recent root selected');
      showOutcome('Recent project refused', T.product.refusals.runtimeRequestRefused, 'Choose a validated recent project first.');
      return;
    }
    productStatus('opening', action === 'choose-new' ? 'Choose a directory for the explicit starter project…' : 'Choose a project directory…');
    const response = await projectRequest({
      action,
      profile: shell.dataset.profile,
      ...((action === 'open-recent' || action === 'remove-recent') ? { root } : {}),
    });
    if (response === null || !response.ok) {
      const code = response === null ? T.product.refusals.runtimeUnavailable : response.reason;
      productStatus('refused', 'Project lifecycle refused · ' + code);
      showOutcome('Project lifecycle refused', code, response?.message || 'The project root was not changed.');
      return;
    }
    if (!applyProjectLifecycleStatus(response.data?.status)) {
      productStatus('refused', 'Project lifecycle refused · ' + T.product.refusals.runtimeRequestRefused);
      showOutcome('Project lifecycle refused', T.product.refusals.runtimeRequestRefused, 'The host returned no valid project status.');
      return;
    }
    if (response.data.outcome === 'cancelled') {
      productStatus(activeProject === null ? 'closed' : 'open', 'Project selection cancelled · no project bytes changed');
      return;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    clearSceneProperty();
    undoAvailability = 'unavailable';
    if (response.data.outcome === 'removed') {
      productStatus(activeProject === null ? 'closed' : 'open', 'Recent project removed · active project unchanged');
      return;
    }
    if (activeProject !== null) await openProject();
  };

  // A refused authoring response carries its own named reason: the document
  // status shape reports \`ok: false\`, a session snapshot reports diagnostics.
  // Both are read here so the host's reason reaches the surface instead of the
  // generic one — \`apply-in-progress\` in particular is the operator's cue that
  // journal recovery, not another click, is what moves this forward.
  const responseDiagnostic = (response) => {
    if (response === null) return {
      code: T.product.refusals.runtimeUnavailable,
      message: T.product.refusals.runtimeUnavailable,
    };
    if (!response.ok) return {
      code: response.reason || T.product.refusals.runtimeRequestRefused,
      message: response.message || T.product.refusals.runtimeRequestRefused,
    };
    const data = response.data;
    const diagnostics = data && Array.isArray(data.diagnostics) ? data.diagnostics : [];
    if (diagnostics.length > 0) {
      return {
        code: diagnostics[0]?.code || T.product.refusals.authoringRefused,
        message: diagnostics[0]?.message || T.product.refusals.authoringRefused,
      };
    }
    if (data && data.ok === false) {
      return {
        code: data.reason || T.product.refusals.authoringRefused,
        message: data.message || T.product.refusals.authoringRefused,
      };
    }
    return null;
  };
  const responseReason = (response) => responseDiagnostic(response)?.code ?? null;

  const restartProject = async (diagnostic) => {
    productStatus('recovering', T.product.documentPath + ' · ' + diagnostic + ' · re-opening fresh session…');
    const response = await runtimeRequest({
      action: 'authoring',
      payload: { op: 'restart', documentPath: T.product.documentPath },
    });
    if (response === null || !response.ok) {
      clearSceneProperty();
      productStatus('recovering', 'Open refused · ' + diagnostic + ' · ' + responseReason(response));
      return false;
    }
    const status = response.data;
    const reason = responseReason(response);
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    undoAvailability = 'unavailable';
    if (reason !== null || !status || status.ok !== true || typeof status.data !== 'object' || status.data === null || typeof status.contentHash !== 'string') {
      clearSceneProperty();
      productStatus('refused', 'Recovery reset · ' + diagnostic + ' · ' + (reason || T.product.refusals.documentDataInvalid));
      return false;
    }
    projectData = status.data;
    projectContentHash = status.contentHash;
    syncSceneProperties(status);
    undoAvailability = status.undoAvailability === 'available' || status.undoAvailability === 'recovery-pending'
      ? status.undoAvailability
      : 'unavailable';
    syncCommandAvailability();
    productStatus('open', withSceneRefusal(T.product.documentPath + ' · re-opened after ' + diagnostic + ' · ' + status.documentId));
    return true;
  };

  // Re-opening re-reads the document from the host, so a proposal the host is
  // still holding has to be discarded there rather than only forgotten here:
  // otherwise the shell reports a clean project while the session stays in
  // \`reviewing\`, and the next Save reports "no staged changes" over an edit the
  // host would still have applied.
  const discardStagedProposal = async () => {
    if (!projectDirty) return true;
    const response = await runtimeRequest({ action: 'authoring', payload: { op: 'reject' } });
    const reason = responseReason(response);
    const snapshot = response?.ok ? response.data : null;
    if (reason !== null || !snapshot || snapshot.phase !== 'rejected') {
      productStatus('refused', 'Open refused · ' + (reason || T.product.refusals.proposalNotDiscarded));
      return false;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    clearSceneProperty();
    return true;
  };

  const openProject = async () => {
    if (activeProject === null && projectPort() !== null) {
      productStatus('refused', 'Open refused · no project root selected');
      showOutcome('Open refused', T.product.refusals.runtimeRequestRefused, 'Choose New Project or Open Project first.');
      return false;
    }
    if (projectRecovering) return restartProject('recovery-pending');
    if (!(await discardStagedProposal())) return false;
    productStatus('opening', T.product.documentPath + ' · opening…');
    const response = await runtimeRequest({
      action: 'authoring',
      payload: { op: 'status', documentPath: T.product.documentPath },
    });
    const reason = responseReason(response);
    const status = response?.ok ? response.data : null;
    if (reason !== null || !status || status.ok !== true || typeof status.data !== 'object' || status.data === null || typeof status.contentHash !== 'string') {
      clearSceneProperty();
      const code = reason || T.product.refusals.documentDataInvalid;
      productStatus('refused', 'Open refused · ' + code);
      showOutcome('Open refused', code, 'The active Scene Document was not opened.');
      return false;
    }
    projectData = status.data;
    projectContentHash = status.contentHash;
    syncSceneProperties(status);
    projectDirty = false;
    projectRecovering = false;
    undoAvailability = status.undoAvailability === 'available' || status.undoAvailability === 'recovery-pending'
      ? status.undoAvailability
      : 'unavailable';
    syncCommandAvailability();
    productStatus('open', withSceneRefusal(T.product.documentPath + ' · open · ' + status.documentId));
    return true;
  };

  const stageWebEdit = async (kind) => {
    // The decision refuses this too; answering before the round trip only keeps
    // a profile that cannot stage from opening a document to be told so.
    if (shell.dataset.profile !== 'web') {
      productStatus('refused', 'Stage refused · ' + T.product.refusals.webCapabilityRequired);
      return;
    }
    if ((projectData === null || projectContentHash === null) && !(await openProject())) return;
    const decision = webStageDecision(
      {
        profile: shell.dataset.profile,
        documentData: projectData,
        contentHash: projectContentHash,
        kind,
        html: T.product.webStarter.html,
        assetPath: T.product.webStarter.assetPath,
      },
      T.product.stageConfig,
    );
    if (!decision.ok) {
      productStatus('refused', 'Stage refused · ' + decision.reason);
      return;
    }
    const response = await runtimeRequest(decision.request);
    const reason = responseReason(response);
    const snapshot = response?.ok ? response.data : null;
    if (reason !== null || !snapshot || snapshot.phase !== 'reviewing') {
      productStatus('refused', 'Stage refused · ' + (reason || T.product.refusals.proposalNotReviewing));
      return;
    }
    projectData = decision.request.payload.newValue;
    projectDirty = true;
    projectRecovering = false;
    productStatus('dirty', T.product.documentPath + ' · staged · Save to apply');
  };

  const stageSceneProperty = async () => {
    // Read what the operator typed before the first await: re-opening re-reads
    // the panel from the document, so a value captured afterwards would be the
    // saved one rather than the edit that was just requested.
    const input = shell.querySelector('#scene-property-translation-x');
    const newValue = input && input.tagName === 'INPUT' ? input.valueAsNumber : Number.NaN;
    if (projectRecovering) {
      productStatus('refused', 'Edit refused · ' + T.product.refusals.recoveryPending);
      return;
    }
    if (projectDirty) {
      productStatus('refused', 'Edit refused · ' + T.product.refusals.profileSwitchDirty);
      return;
    }
    if ((projectData === null || projectContentHash === null) && !(await openProject())) return;
    if (selectedSceneEntityId === null || editableScene === null) {
      productStatus('refused', 'Edit refused · select the starter entity first');
      return;
    }
    const response = await runtimeRequest({
      action: 'authoring',
      payload: {
        op: 'edit-property',
        documentPath: T.product.documentPath,
        expectedContentHash: projectContentHash,
        entityId: selectedSceneEntityId,
        propertyId: 'translation-x',
        newValue,
      },
    });
    const diagnostic = responseDiagnostic(response);
    const snapshot = response?.ok ? response.data : null;
    const message = shell.querySelector('[data-scene-property-diagnostic]');
    if (diagnostic !== null || !snapshot || snapshot.phase !== 'reviewing') {
      const code = diagnostic?.code || T.product.refusals.proposalNotReviewing;
      const detail = diagnostic?.message || T.product.refusals.proposalNotReviewing;
      if (message) message.textContent = code + ' · ' + detail;
      productStatus('refused', 'Edit refused · ' + code + ' · ' + detail);
      return;
    }
    const edit = Array.isArray(snapshot.proposal?.edits) ? snapshot.proposal.edits[0] : null;
    if (edit && edit.jsonPointer === '/data/composedScene' && projectData && typeof projectData === 'object') {
      projectData = { ...projectData, composedScene: edit.newValue };
    }
    syncSceneProperties(snapshot);
    const review = shell.querySelector('[data-scene-property-review]');
    if (review) {
      review.textContent = String(snapshot.renderedDiff || snapshot.unifiedDiff || 'Proposal staged for review.');
      review.hidden = false;
    }
    if (message) message.textContent = 'Proposal staged with base ' + projectContentHash + ' · Save applies atomically.';
    projectDirty = true;
    projectRecovering = false;
    productStatus('dirty', withSceneRefusal(T.product.documentPath + ' · property staged · review before Save'));
  };

  const applySaveSnapshot = (snapshot) => {
    if (!snapshot) return false;
    const diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [];
    if (diagnostics[0]?.code === 'journal-not-found') return false;
    if (snapshot.phase === 'pending' || snapshot.journalRecoveryPending === true) {
      projectRecovering = true;
      productStatus('recovering', T.product.documentPath + ' · recovery pending · Save to refresh or Open to re-read');
      return true;
    }
    if (snapshot.phase === 'applied' && diagnostics.length === 0) {
      projectData = null;
      projectContentHash = null;
      projectDirty = false;
      projectRecovering = false;
      undoAvailability = 'available';
      syncCommandAvailability();
      // The written document, not the diff of how it got there: the applied
      // proposal is spent, so the review panel goes with it while the panel
      // keeps showing the value the next Play will mount.
      syncSceneProperties(snapshot);
      productStatus('saved', withSceneRefusal(T.product.documentPath + ' · saved'));
      return true;
    }
    return false;
  };

  const saveProject = async () => {
    if (!projectDirty && !projectRecovering) {
      productStatus(projectData === null ? 'closed' : 'open', T.product.documentPath + ' · no staged changes');
      return;
    }
    const recovering = projectRecovering;
    productStatus(recovering ? 'recovering' : 'saving', T.product.documentPath + (recovering ? ' · refreshing recovery…' : ' · saving…'));
    const response = await runtimeRequest({ action: 'authoring', payload: { op: recovering ? 'recover' : 'accept' } });
    const snapshot = response?.ok ? response.data : null;
    const reason = responseReason(response);
    if (recovering && reason === 'journal-not-found') {
      await restartProject('journal-not-found');
      return;
    }
    if (applySaveSnapshot(snapshot)) return;
    if (recovering && snapshot && snapshot.journalRecoveryPending !== true) projectRecovering = false;
    productStatus(projectRecovering ? 'recovering' : 'refused', 'Save refused · ' + (reason || T.product.refusals.applyNotCompleted));
    showOutcome('Save refused', reason || T.product.refusals.applyNotCompleted, 'No staged document change was reported as saved.');
  };

  // The host's undo clears its own proposal along with the apply it reverses,
  // so a staged edit would go with it. Every other path here that can lose one
  // either refuses by name or discards it explicitly; this one refuses.
  const undoProject = async () => {
    if (undoAvailability !== 'available') return;
    if (projectDirty) {
      const code = T.product.refusals.undoStagedProposal;
      productStatus('refused', 'Undo refused · ' + code);
      showOutcome('Undo refused', code, 'Save the staged proposal or re-open the project to discard it before undoing the last Save.');
      return;
    }
    productStatus('undoing', T.product.documentPath + ' · undoing last completed Save…');
    const response = await runtimeRequest({ action: 'authoring', payload: { op: 'undo' } });
    const reason = responseReason(response);
    const result = response?.ok ? response.data : null;
    if (reason !== null || !result || result.ok !== true || !Array.isArray(result.restoredPaths)) {
      const code = reason || T.commandRefusals.undoUnavailable;
      productStatus('refused', 'Undo refused · ' + code);
      showOutcome('Undo refused', code, 'The host did not restore a completed Save.');
      return;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    const reopened = await openProject();
    if (reopened) {
      productStatus('open', 'Undid last Save · restored ' + result.restoredPaths.join(', '));
    }
  };

  // Every element that can start a product action, whichever surface it sits on:
  // the same command reachable from a menu, a palette row, and a title-bar
  // button is one operation, so all three carry the in-flight refusal, not only
  // the one that happens to be marked as a product action. The palette opener is
  // excluded because opening the palette is not a product action and stays
  // available while one is outstanding.
  const productActionControls = () => {
    const seen = [];
    q('[data-product-action]').forEach((el) => { if (!seen.includes(el)) seen.push(el); });
    q('[data-command]').forEach((el) => {
      if (el.dataset.command === T.paletteShortcut.id) return;
      if (!seen.includes(el)) seen.push(el);
    });
    return seen;
  };

  // Serialize the product loop: the host holds one session and one proposal, so
  // a second action started before the first answers is not concurrency, it is a
  // lost edit. The controls are inert for the duration, which is the surface's
  // own vocabulary for "this cannot act right now".
  const productAction = async (run) => {
    if (inFlight) return;
    inFlight = true;
    productActionControls().forEach((el) => {
      el.dataset.busy = 'true';
      setRefusal(el, T.product.refusals.requestInFlight);
    });
    try {
      await run();
    } finally {
      inFlight = false;
      // Cleared unconditionally, then re-decided: a control whose id the profile
      // table does not carry must not stay disabled because a request finished.
      productActionControls().forEach((el) => {
        delete el.dataset.busy;
        setRefusal(el, null);
        applyControl(el);
      });
      syncCommandAvailability();
    }
  };

  const playScene = async () => {
    if (projectData === null && !(await openProject())) return;
    runStatus('Opening composed scene…');
    const response = await runtimeRequest({
      action: 'open-path',
      payload: { documentPath: T.product.documentPath },
    });
    if (response === null || !response.ok) {
      runRefusal(
        response === null
          ? T.product.refusals.runtimeUnavailable
          : (response.reason || T.product.refusals.runtimeRequestRefused),
        response === null ? null : response.detail,
      );
      return;
    }
    const exercise = response.data;
    const ticks = Array.isArray(exercise?.tickDigests) ? exercise.tickDigests.length : 0;
    if (exercise?.closed !== true || ticks === 0) {
      runRefusal(T.product.refusals.openPathEvidenceInvalid);
      return;
    }
    const playback = { exercise, accepted: false, frame: null };
    document.dispatchEvent(new CustomEvent(T.product.viewportPlayEvent, { detail: playback }));
    if (!playback.accepted || !Number.isSafeInteger(playback.frame) || playback.frame < 1) {
      runRefusal(T.product.refusals.viewportUnavailable);
      return;
    }
    showModePanels('run');
    const lastDigest = exercise.tickDigests[ticks - 1];
    const played = 'Played composed scene · ' + ticks + ' ticks · viewport frame ' + playback.frame + ' · session closed';
    q('[data-run-session-report]').forEach((el) => {
      el.textContent = 'Completed closed session · ' + ticks + ' ticks · terminal digest ' + String(lastDigest);
    });
    q('[data-run-live-report]').forEach((el) => {
      el.textContent = 'Viewport frame ' + playback.frame + ' acknowledged for ' + exercise.mountable.sceneId + '.';
    });
    runStatus(played);
    productStatus(projectRecovering ? 'recovering' : (projectDirty ? 'dirty' : (projectData === null ? 'closed' : 'open')), played);
  };

  const switchProfile = async (value) => {
    if (shell.dataset.profile === value) return;
    if (projectRecovering) {
      productStatus('refused', 'Profile switch refused · ' + T.product.refusals.recoveryPending);
      return;
    }
    if (projectDirty) {
      productStatus('refused', 'Profile switch refused · ' + T.product.refusals.profileSwitchDirty);
      return;
    }
    shell.dataset.profile = value;
    q('.profile-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === value)));
    setProfile(value);
  };

  const showModePanels = (mode) => {
    shell.dataset.mode = mode;
    q('[data-mode-panel]').forEach((el) => { el.hidden = el.dataset.modePanel !== mode; });
    q('.rail-mode').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.value === mode)));
    const dock = shell.querySelector('.dock');
    if (dock) dock.style.setProperty('--dock-h', T.dockHeightByMode[mode] + 'px');
    buildDockTabs(mode, T.dockTabsByMode[mode][0]);
  };

  const buildDockTabs = (mode, active) => {
    const strip = shell.querySelector('.dock-tablist');
    if (!strip) return;
    const ids = T.dockTabsByMode[mode];
    const chosen = ids.indexOf(active) === -1 ? ids[0] : active;
    q('.dock-tab').forEach((el) => el.remove());
    ids.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-tab';
      b.id = 'dock-' + id;
      b.setAttribute('role', 'tab');
      b.dataset.action = 'dock-tab';
      b.dataset.value = id;
      b.setAttribute('aria-controls', 'dock-panel-' + id);
      b.setAttribute('aria-selected', String(id === chosen));
      b.tabIndex = id === chosen ? 0 : -1;
      b.textContent = T.dockLabels[id];
      if (id === 'changes') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.setAttribute('data-change-badge', '');
        badge.textContent = String(pendingCount());
        b.appendChild(badge);
      }
      // A rebuilt tab is a rendered control like any other, so it takes the
      // active profile's own kind and reason rather than the one the document
      // happened to be rendered with.
      applyControl(b);
      strip.appendChild(b);
    });
    selectDockTab(chosen);
    // The bulk actions belong to the Changes tab, so a mode without one loses
    // them with the tab rather than keeping two live buttons over a hidden queue.
    syncChanges();
  };

  const selectDockTab = (id) => {
    q('.dock-tab').forEach((el) => {
      const on = el.dataset.value === id;
      el.setAttribute('aria-selected', String(on));
      el.tabIndex = on ? 0 : -1;
    });
    q('[data-dock-panel]').forEach((el) => { el.hidden = el.dataset.dockPanel !== id; });
  };

  const pendingCount = () => q('.change-row').filter((el) => !el.hidden).length;

  const syncChanges = () => {
    const n = pendingCount();
    q('[data-change-badge]').forEach((el) => { el.textContent = String(n); });
    const empty = shell.querySelector('[data-change-empty]');
    if (empty) empty.hidden = n !== 0;
    const bulk = shell.querySelector('[data-change-bulk]');
    const changes = shell.querySelector('.dock-tab[data-value="changes"]');
    if (bulk) bulk.hidden = n === 0 || changes === null;
  };

  // Roving tabindex takes the non-active tabs out of the Tab order, so the arrow
  // keys are what makes them reachable at all. Dock tabs activate on move; the
  // viewport tabs only take focus, which is all a click does there either.
  const moveTab = (event) => {
    const from = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (from === null) return;
    const list = from.closest('[role="tablist"]');
    if (list === null) return;
    const stops = Array.from(list.querySelectorAll('[role="tab"]'));
    const at = stops.indexOf(from);
    if (at === -1) return;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % stops.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + stops.length) % stops.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops.length - 1;
    else return;
    event.preventDefault();
    const target = stops[next];
    if (target.dataset.action === 'dock-tab' && target.dataset.value) selectDockTab(target.dataset.value);
    else stops.forEach((el) => { el.tabIndex = el === target ? 0 : -1; });
    target.focus();
  };

  // An overlay declares aria-modal, so the rest of the document must really be
  // out of reach: focus moves in on open, Tab wraps inside the dialog, and the
  // control that opened it gets focus back on close.
  let overlayReturn = null;

  // Every button in the dialog, inert ones included: an inert control keeps its
  // native focus stop, so a trap that dropped it would hand Tab to an element it
  // does not contain and then bounce focus back to the first stop, leaving the
  // rows after it unreachable — and on a profile where every row is inert it
  // would contain nothing at all.
  const overlayStops = () => {
    const open = shell.querySelector('.overlay:not([hidden])');
    return open === null ? [] : Array.from(open.querySelectorAll('button'));
  };

  const setOverlay = (id) => {
    const wasOpen = shell.dataset.overlay !== 'none';
    if (id !== 'none' && !wasOpen) {
      const active = document.activeElement;
      overlayReturn = active !== null && typeof active.focus === 'function' ? active : null;
    }
    shell.dataset.overlay = id;
    q('.overlay').forEach((el) => { el.hidden = el.dataset.overlay !== id; });
    if (id === 'none') {
      const back = overlayReturn;
      overlayReturn = null;
      if (back !== null && shell.contains(back)) back.focus();
      return;
    }
    const stops = overlayStops();
    if (stops.length === 0) return;
    // Containment covers every stop; the opening move prefers one that can act.
    const entry = stops.find((el) => el.getAttribute('aria-disabled') !== 'true');
    (entry || stops[0]).focus();
  };

  // The legend row the document already renders for every registry code is the
  // one copy of that sentence, so the dialog cannot name a reason the disclosure
  // explains differently.
  const refusalMessage = (code) => {
    const row = shell.querySelector('#refusal-' + code);
    if (row === null) return '';
    const text = String(row.textContent);
    return (text.startsWith(code) ? text.slice(String(code).length) : text).trim();
  };

  // A refused command is not a project state: the operation it collided with may
  // still be running, so this names the reason in the outcome dialog and leaves
  // the project pill and its status reporting the project.
  const commandRefusal = (code) => {
    showOutcome(
      'Command refused',
      code,
      refusalMessage(code) || 'This desktop refused the requested command.',
    );
  };

  const showOutcome = (title, code, message) => {
    q('[data-outcome-title]').forEach((el) => { el.textContent = String(title); });
    q('[data-outcome-code]').forEach((el) => { el.textContent = String(code); });
    q('[data-outcome-message]').forEach((el) => { el.textContent = String(message); });
    setOverlay('outcome');
  };

  const menuTrigger = (panel) => {
    const root = panel.closest('[data-menu-root]');
    return root === null ? null : root.querySelector('[data-menu-trigger]');
  };

  const hideMenus = () => {
    q('.menu-panel').forEach((panel) => { panel.hidden = true; });
    q('[data-menu-trigger]').forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  // Hiding the panel under the caret would drop focus to the body and restart
  // the Tab order at the top of the document, so the menu hands focus back to
  // the trigger that owns it — the same return the overlay makes. Only the
  // paths that dismiss a menu while focus is still inside it restore; a
  // dismissal caused by focus leaving must not pull it back.
  const closeMenus = () => {
    const active = document.activeElement;
    let restore = null;
    q('.menu-panel').forEach((panel) => {
      if (!panel.hidden && active !== null && panel.contains(active)) {
        restore = menuTrigger(panel);
      }
    });
    hideMenus();
    if (restore !== null && typeof restore.focus === 'function') restore.focus();
  };

  // The panel declares role="menu", so the arrow keys have to move between its
  // items for that role to be true. The items keep their plain Tab stop as
  // well: an inert control that stays findable is this surface's own rule.
  const moveMenuItem = (event) => {
    const from = event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null;
    if (from === null) return false;
    const panel = from.closest('.menu-panel');
    if (panel === null || panel.hidden) return false;
    const items = Array.from(panel.querySelectorAll('[role="menuitem"]'));
    const at = items.indexOf(from);
    if (at === -1) return false;
    let next = -1;
    if (event.key === 'ArrowDown') next = (at + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return false;
    event.preventDefault();
    const target = items[next];
    if (target && typeof target.focus === 'function') target.focus();
    return true;
  };

  const toggleMenu = (id) => {
    const trigger = shell.querySelector('[data-menu-trigger="' + id + '"]');
    const panel = shell.querySelector('#menu-panel-' + id);
    if (!trigger || !panel) return;
    const open = panel.hidden;
    closeMenus();
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = panel.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
      if (first && typeof first.focus === 'function') first.focus();
    }
  };

  // Below the regular tier the assistant is a drawer that starts closed, so the
  // toggle reports the drawer rather than the column state: otherwise it would
  // announce itself pressed over nothing, and its first press would only turn
  // that claim off. One press opens the drawer at every tier.
  const drawerQuery = window.matchMedia('${belowTier("regular")}');

  const assistantOpen = () => shell.dataset.drawerAssistant === 'open';

  const setAssistant = (state) => {
    shell.dataset.assistant = state;
    const open = state === 'open';
    shell.dataset.drawerAssistant = open ? 'open' : 'closed';
    q('.assistant-toggle').forEach((el) => el.setAttribute('aria-pressed', String(open)));
  };

  // Crossing into a drawer tier closes the drawer for the same reason it starts
  // closed, and crossing back out restores the column's own state.
  const syncAssistantTier = () => {
    const open = drawerQuery.matches ? false : shell.dataset.assistant === 'open';
    shell.dataset.drawerAssistant = open ? 'open' : 'closed';
    q('.assistant-toggle').forEach((el) => el.setAttribute('aria-pressed', String(open)));
  };
  drawerQuery.addEventListener('change', syncAssistantTier);

  // An inert control keeps its focus stop and names its refusal, so a control
  // that becomes inert in the browser has to gain all of that, not just dim.
  const setRefusal = (el, code) => {
    if (el === null) return;
    if (code) {
      el.classList.add('is-inert');
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-describedby', 'refusal-' + code);
      el.dataset.refusal = code;
      if ('readOnly' in el) el.readOnly = true;
    } else {
      el.classList.remove('is-inert');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('aria-describedby');
      delete el.dataset.refusal;
      if ('readOnly' in el) el.readOnly = false;
    }
  };

  // Every rendered control, not a list of selectors: the model already decided
  // what each control is on each profile, and a list of the ones to update is a
  // list that has to be edited whenever a control is added.
  const applyControl = (el) => {
    const runtime = T.assistantRuntimeRows[shell.dataset.assistantRuntime];
    const row = ((runtime && runtime.controlsByProfile[shell.dataset.profile]) || {})[el.id];
    if (!row) return;
    const refusal = row[1];
    el.dataset.kind = refusal ? 'inert' : row[0];
    setRefusal(el, refusal);
  };

  const applyProfileControls = () => q('[data-kind]').forEach(applyControl);

  const syncCommandAvailability = () => {
    q('[data-command]').forEach((el) => {
      if (el.dataset.command !== 'edit-undo') return;
      applyControl(el);
      if (shell.dataset.profile !== 'kids') {
        const available = !inFlight && undoAvailability === 'available';
        el.dataset.kind = available ? 'live' : 'inert';
        setRefusal(
          el,
          available
            ? null
            : inFlight
              ? T.product.refusals.requestInFlight
              : undoAvailability === 'recovery-pending'
              ? T.product.refusals.recoveryPending
              : T.commandRefusals.undoUnavailable,
        );
      }
    });
  };

  // A drawer opened before the switch must not keep announcing itself expanded
  // over a region the new profile's refusal removes. Read after the controls are
  // applied, so the toggle the profile just made inert is the one that closes —
  // the same reset setAssistant() already does for its own drawer.
  const closeRefusedDrawers = () => {
    q('.drawer-toggle').forEach((el) => {
      if (el.getAttribute('aria-disabled') !== 'true') return;
      shell.dataset[el.dataset.value === 'left' ? 'drawerLeft' : 'drawerInspector'] = 'closed';
      el.setAttribute('aria-expanded', 'false');
    });
  };

  const setProfile = (id) => {
    const runtime = T.assistantRuntimeRows[shell.dataset.assistantRuntime];
    const seat = runtime && runtime.assistantByProfile[id];
    if (!seat) return;
    setAssistant(seat.state);
    q('[data-assistant-model]').forEach((el) => { el.textContent = seat.modelLabel; });
    const pin = T.pinByProfile[id];
    if (pin) q('[data-profile-pin]').forEach((el) => { el.textContent = pin; });
    applyProfileControls();
    syncCommandAvailability();
    closeRefusedDrawers();
    // The column the profile restores is still a drawer in the tiers that undock
    // it, and leaving a refusal is not opening a drawer.
    syncAssistantTier();
  };

  document.addEventListener(T.assistantRuntimeEvent, (event) => {
    const detail = event && event.detail;
    if (!detail || !T.assistantRuntimeRows[detail.runtime]) return;
    shell.dataset.assistantRuntime = detail.runtime;
    setProfile(shell.dataset.profile);
    const status = shell.querySelector('[data-assistant-status]');
    if (status && typeof detail.message === 'string') {
      status.textContent = T.assistantRuntimeRefusal + ' — ' + detail.message;
    }
  });

  const commandHandlers = Object.freeze({
    'project-new': () => chooseProject('choose-new'),
    'project-open': () => chooseProject('choose-open'),
    'project-save': saveProject,
    'edit-undo': undoProject,
    'run-play': playScene,
  });

  const executeCommand = (id) => {
    closeMenus();
    if (id === T.paletteShortcut.id) {
      setOverlay('palette');
      return;
    }
    const handler = commandHandlers[id];
    if (typeof handler !== 'function') return;
    // Read the state, not one element's attributes: an accelerator reaches this
    // without ever touching a control, so a second press during a round trip has
    // to name the refusal instead of disappearing.
    if (inFlight) {
      commandRefusal(T.product.refusals.requestInFlight);
      return;
    }
    const representative = q('[data-command]').find((el) => el.dataset.command === id);
    if (representative?.getAttribute('aria-disabled') === 'true') {
      commandRefusal(representative.dataset.refusal || T.product.refusals.runtimeRequestRefused);
      return;
    }
    setOverlay('none');
    void productAction(handler);
  };

  shell.addEventListener('click', (event) => {
    const command = event.target instanceof Element ? event.target.closest('[data-command]') : null;
    if (command && command.getAttribute('aria-disabled') !== 'true') {
      executeCommand(command.dataset.command);
      return;
    }
    const menu = event.target instanceof Element ? event.target.closest('[data-menu-trigger]') : null;
    if (menu && menu.getAttribute('aria-disabled') !== 'true') {
      toggleMenu(menu.dataset.menuTrigger);
      return;
    }
    const el = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    const action = el.dataset.action;
    const value = el.dataset.value;
    if (action === 'drawer' && value) {
      const key = value === 'left' ? 'drawerLeft' : 'drawerInspector';
      const open = shell.dataset[key] !== 'open';
      shell.dataset[key] = open ? 'open' : 'closed';
      el.setAttribute('aria-expanded', String(open));
      return;
    }
    if (action === 'project-open-recent') void productAction(() => chooseProject('open-recent'));
    else if (action === 'project-remove-recent') void productAction(() => chooseProject('remove-recent'));
    else if (action === 'document-reload') void productAction(openProject);
    else if (action === 'scene-entity-select' && value) {
      if (showSceneProperty(value) && shell.dataset.mode !== 'build') showModePanels('build');
    }
    else if (action === 'scene-property-stage') void productAction(stageSceneProperty);
    else if (action === 'web-stage-html') void productAction(() => stageWebEdit('html'));
    else if (action === 'web-inject-asset') void productAction(() => stageWebEdit('asset'));
    else if (action === 'mode' && value) showModePanels(value);
    else if (action === 'dock-tab' && value) selectDockTab(value);
    else if (action === 'overlay') setOverlay(value || 'none');
    else if (action === 'refusal-help') {
      const panel = shell.querySelector('#refusal-legend');
      if (panel) {
        const open = panel.hidden;
        panel.hidden = !open;
        el.setAttribute('aria-expanded', String(open));
      }
    }
    else if (action === 'profile' && value) void productAction(() => switchProfile(value));
    else if (action === 'assistant') {
      if (shell.dataset.assistant === 'denied') return;
      setAssistant(assistantOpen() ? 'closed' : 'open');
    } else if (action === 'assistant-mode' && value) {
      shell.dataset.assistantMode = value;
      q('.assistant-mode').forEach((m) => m.setAttribute('aria-pressed', String(m.dataset.value === value)));
    } else if (action === 'assistant-route' && value) {
      shell.dataset.assistantRoute = value;
      q('.assistant-route').forEach((m) => m.setAttribute('aria-pressed', String(m.dataset.value === value)));
    } else if (action === 'sculpt-cancel') {
      // The model's cancel-sculpt takes the phase back to idle, which is the
      // state this document renders with the progress region hidden.
      const progress = shell.querySelector('[data-sculpt-progress]');
      if (progress) progress.hidden = true;
    } else if (action === 'decide-change' && value !== undefined) {
      const row = shell.querySelector('.change-row[data-change-index="' + value + '"]');
      if (row) row.hidden = true;
      syncChanges();
    } else if (action === 'decide-all') {
      q('.change-row').forEach((r) => { r.hidden = true; });
      syncChanges();
    }
  });

  // Tab is deliberately not captured inside a menu — every item keeps its plain
  // focus stop — so leaving the menu root by keyboard is the one dismissal the
  // click and Escape paths cannot see. Focus is already elsewhere here, so the
  // panel is hidden without the trigger return.
  shell.addEventListener('focusout', (event) => {
    const root = event.target instanceof Element ? event.target.closest('[data-menu-root]') : null;
    if (root === null) return;
    const panel = root.querySelector('.menu-panel');
    if (panel === null || panel.hidden) return;
    const next = event.relatedTarget;
    if (next instanceof Element && root.contains(next)) return;
    hideMenus();
  });

  // A dropped-down menu floats over the surface below it, so any click that is
  // not inside a menu closes it — including one outside the shell entirely,
  // which is why this listens on the document.
  document.addEventListener('click', (event) => {
    const root = event.target instanceof Element ? event.target.closest('[data-menu-root]') : null;
    if (root === null) closeMenus();
  });

  const isTextEntryTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea') !== null) return true;
    if (target instanceof HTMLElement && target.isContentEditable) return true;
    let current = target;
    while (current !== null) {
      const attribute = current.getAttribute('contenteditable');
      if (attribute !== null) {
        const value = attribute.trim().toLowerCase();
        if (value === 'false') return false;
        if (value === '' || value === 'true' || value === 'plaintext-only') return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  // On the document, not the shell: once focus is inside a dialog the shell is
  // still the ancestor, but a restored or lost focus must not silently drop the
  // Escape key, and the trap has to see every Tab.
  document.addEventListener('keydown', (event) => {
    // Shift is not part of any declared accelerator, so Ctrl+Shift+Z must not be
    // Undo: the menus advertise exactly five chords and these are those five.
    const modified = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
    if (modified) {
      const key = String(event.key).toLowerCase();
      const command = key === T.paletteShortcut.key
        ? T.paletteShortcut
        : T.commands.find((candidate) => candidate.key === key);
      if (command) {
        const textEntry = isTextEntryTarget(event.target);
        if (!textEntry || command.allowInTextEntry) {
          event.preventDefault();
          executeCommand(command.id);
          return;
        }
      }
    }
    if (shell.dataset.overlay === 'none') {
      if (event.key === 'Escape') { closeMenus(); return; }
      if (moveMenuItem(event)) return;
      moveTab(event);
      return;
    }
    if (event.key === 'Escape') { setOverlay('none'); return; }
    if (event.key !== 'Tab') return;
    const stops = overlayStops();
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    const inside = stops.indexOf(active) !== -1;
    if (event.shiftKey ? active === first || !inside : active === last || !inside) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });

  syncChanges();
  syncAssistantTier();
  syncCommandAvailability();
  void syncProjectLifecycle();
}
`;
}

export type DesktopChromeOptions = Readonly<{
  /** Document title. Defaults to the surface name. */
  title?: string;
}>;

/**
 * Render the chrome for one visual state as a complete HTML document.
 *
 * Below the minimum window tier the document contains the refusal and no
 * editor: the `.shell` is hidden by a media query at the same breakpoints the
 * model uses, so the refusal is one decision rendered twice rather than a CSS
 * rule and a TypeScript branch that could drift.
 */
export function renderDesktopChrome(
  view: DesktopVisualView,
  options: DesktopChromeOptions = {},
): string {
  const title = options.title ?? "SceneAxi — Engine Desktop";
  // The block is emitted in every document but `view.refusal` is non-null only
  // in the below-minimum render, so the fallback is what a browser actually
  // shows once the viewport crosses the breakpoint. It reads the same registry
  // and the same minimum the model refuses with, never a copy of them.
  const refusal = view.refusal ?? {
    code: DESKTOP_VISUAL_REFUSALS.windowBelowMinimum,
    message: DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.windowBelowMinimum],
    minimum: DESKTOP_MINIMUM_WINDOW,
  };

  return `<!doctype html>
<html lang="en" data-surface="engine-desktop">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="generator" content="@sceneaxi/desktop-shell chrome">
<meta name="sceneaxi-visual-source" content="${escapeHtml(`${VISUAL_SOURCE.member} · sha256 ${VISUAL_SOURCE.sha256}`)}">
<meta name="sceneaxi-pixels-drawn" content="false">
<title>${escapeHtml(title)}</title>
<style>${styles()}</style>
</head>
<body>
<div class="window-refusal" role="alert">
  <h1>Window below the minimum size</h1>
  <p>${escapeHtml(refusal.message)}</p>
  <p>Minimum: <code>${escapeHtml(`${refusal.minimum.width}×${refusal.minimum.height}`)}</code> · refusal <code>${escapeHtml(refusal.code)}</code></p>
</div>
<div class="shell" data-mode="${escapeHtml(view.state.mode)}" data-profile="${escapeHtml(view.state.profile)}" data-assistant="${escapeHtml(view.assistant.state)}" data-assistant-mode="${escapeHtml(view.state.assistantMode)}" data-assistant-route="${escapeHtml(view.state.assistantRoute)}" data-assistant-runtime="${escapeHtml(view.state.assistantRuntime)}" data-assistant-runtime-event="${escapeHtml(DESKTOP_ASSISTANT_RUNTIME_EVENT)}" data-overlay="${escapeHtml(view.state.overlay ?? "none")}" data-tier="${escapeHtml(view.tier)}" data-drawer-left="closed" data-drawer-inspector="closed" data-drawer-assistant="closed">
${titleBar(view)}
<div class="shell-body">
${modeRail(view)}
${leftDock(view)}
<div class="viewport-column">
${viewport(view)}
${dock(view)}
</div>
${inspector(view)}
${profileRefusal(view)}
${assistant(view)}
</div>
${statusBar(view)}
${overlays(view)}
</div>
<script>${script(view)}</script>
</body>
</html>
`;
}
