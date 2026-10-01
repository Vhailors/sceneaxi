import { EDITOR_COMMAND_REGISTRY, type EditorCommandId } from "@sceneaxi/schemas";
import {
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  WINDOW_TIERS,
  kidsProfileRefusal,
  type DesktopControl,
  type DesktopVisualView,
  type DesktopWindowTierId,
} from "../../visual-model.js";
import { DESKTOP_PRODUCT_REFUSAL_MESSAGES, DESKTOP_PRODUCT_REFUSALS } from "../../product-loop.js";
import { ACCENT, SIGNAL } from "../../visual-tokens.js";

/** The stylesheet and model use the same width and height tier boundaries. */
export function belowTier(id: DesktopWindowTierId): string {
  const tier = WINDOW_TIERS.find((row) => row.id === id);
  const width = (tier?.minWidth ?? 0) - 1;
  const height = (tier?.minHeight ?? 0) - 1;

  return `(max-width:${width}px),(max-height:${height}px)`;
}

/** The exact complement of belowTier. */
export function atTierOrAbove(id: DesktopWindowTierId): string {
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

const TONE_COLORS: Readonly<
  Record<"info" | "scene" | "accent", Readonly<{ bg: string; line: string; dot: string; fg: string }>>
> = Object.freeze({
  info: Object.freeze({ bg: SIGNAL.infoSurface, line: SIGNAL.infoLine, dot: SIGNAL.info, fg: SIGNAL.info }),
  scene: Object.freeze({ bg: SIGNAL.sceneSurface, line: SIGNAL.sceneLine, dot: SIGNAL.scene, fg: SIGNAL.sceneText }),
  accent: Object.freeze({ bg: ACCENT.surface, line: ACCENT.line, dot: ACCENT.base, fg: ACCENT.noteText }),
});

/** Inert controls retain their focus stop and point at the named refusal. */
export function button(
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
    inert ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}" title="${escapeHtml(`${ctrl.refusal ?? ""}: ${ctrl.refusalMessage ?? ""}`)}"` : "",
    described,
    extra,
    `>${content}</button>`,
  ].join("");
}

export function mutationTextarea(control: DesktopControl, extra = ""): string {
  const inert = control.kind === "inert";

  return `<textarea id="${escapeHtml(control.id)}" data-kind="${control.kind}"${inert ? ` aria-disabled="true" readonly data-refusal="${escapeHtml(control.refusal ?? "")}" aria-describedby="refusal-${escapeHtml(control.refusal ?? "")}"` : ""}${extra}></textarea>`;
}

export function editorCommandAttributes(id: EditorCommandId): string {
  const command = EDITOR_COMMAND_REGISTRY.find((candidate) => candidate.id === id);

  if (command === undefined) throw new Error(`Missing emitted editor command ${id}`);

  return ` data-editor-command="${escapeHtml(id)}" data-command-schema-version="${String(command.schemaVersion)}" data-command-permission="${escapeHtml(command.permission)}"`;
}

/** Render the one modelled prompt field through the same refusal contract. */
export function promptInput(ctrl: DesktopControl): string {
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
    ` placeholder="Tell Flash what to make"></textarea>`,
  ].join("");
}

/** Render a bounded numeric Scene Document property through its control. */
export function numericPropertyInput(
  ctrl: DesktopControl,
  bounds: Readonly<{ step: number; min: number; max: number }>,
): string {
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
    ` aria-label="${escapeHtml(ctrl.label)}" step="${String(bounds.step)}" min="${String(bounds.min)}" max="${String(bounds.max)}">`,
  ].join("");
}

export function gitCommitMessageInput(ctrl: DesktopControl): string {
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
    ` type="text" data-project-git-message maxlength="4096"`,
    ` placeholder="Describe the contained change" autocomplete="off"`,
    ` aria-label="${escapeHtml(ctrl.label)}">`,
  ].join("");
}

export function transformSnapInput(ctrl: DesktopControl): string {
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
    ` type="number" data-scene-transform-snap min="0" step="0.1"`,
    ` aria-label="${escapeHtml(ctrl.label)}" placeholder="Off">`,
  ].join("");
}

export function sceneEntitySelect(ctrl: DesktopControl): string {
  const inert = ctrl.kind === "inert";

  const described = inert
    ? ` aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"`
    : "";

  return [
    `<select id="${escapeHtml(ctrl.id)}" data-kind="${ctrl.kind}" data-product-action data-action="scene-entity-select"`,
    inert
      ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}"`
      : "",
    described,
    ` aria-label="${escapeHtml(ctrl.label)}" multiple size="6"><option value="">No validated hierarchy opened</option></select>`,
  ].join("");
}

export function selectControlAttributes(ctrl: DesktopControl): string {
  const inert = ctrl.kind === "inert";

  return [
    `id="${escapeHtml(ctrl.id)}" data-kind="${ctrl.kind}"`,
    inert
      ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}" aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"`
      : "",
  ].join("");
}

/** Render the modelled recent-project chooser through its refusal contract. */
export function recentProjectSelect(ctrl: DesktopControl): string {
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

export function projectFileSelect(
  ctrl: DesktopControl,
  files: DesktopVisualView["product"]["surface"]["project"]["files"],
): string {
  const inert = ctrl.kind === "inert";

  const described = inert
    ? ` aria-describedby="refusal-${escapeHtml(ctrl.refusal ?? "")}"`
    : "";

  return [
    `<select id="${escapeHtml(ctrl.id)}" data-kind="${escapeHtml(ctrl.kind)}"`,
    inert
      ? ` aria-disabled="true" data-refusal="${escapeHtml(ctrl.refusal ?? "")}"`
      : "",
    described,
    ` data-product-action data-action="project-browser-select" size="${Math.max(1, Math.min(5, files.length))}"`,
    files
      .map((file) => `<option value="${escapeHtml(file.path)}"${file.active ? " selected" : ""}>${escapeHtml(file.path)} · ${escapeHtml(file.label)}</option>`)
      .join(""),
    `</select>`,
  ].join("");
}

/** One sentence for every code either registry can put on the surface. */
export function refusalLegend(view: DesktopVisualView): string {
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

export function note(text: string, tone: "info" | "scene" | "accent"): string {
  const colors = TONE_COLORS[tone];

  return `<p class="panel-note" style="background:${colors.bg};border-color:${colors.line};color:${colors.fg}"><span class="dot" style="background:${colors.dot}" aria-hidden="true"></span>${escapeHtml(text)}</p>`;
}

/** Always emitted so a client profile switch reaches the same refusal. */
export function profileRefusal(view: DesktopVisualView): string {
  const refusal = view.profileRefusal ?? kidsProfileRefusal();

  return `
<section class="profile-refusal" role="alert" aria-labelledby="kids-refusal-title">
  <div class="profile-refusal-card">
    <span class="kids-studio-mark" aria-hidden="true">✦</span>
    <h2 id="kids-refusal-title">Kids studio</h2>
    <p>A cheerful, assistant-only place to write ideas. Engine and Website stay off here.</p>
    <p>To make something with Flash, switch to Engine or Website, type, and press Send.</p>
    <p class="profile-refusal-code"><code>${escapeHtml(refusal.code)}</code> · <code>${escapeHtml(refusal.profile)}</code></p>
    <p class="profile-refusal-foot">${escapeHtml(refusal.summary)}</p>
  </div>
</section>`;
}
