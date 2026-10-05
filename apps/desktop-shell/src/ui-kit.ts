/** Shared string builders only; region owners bind events and enforce data-kind. */
import { escapeHtml } from "./chrome.js";
import { icon, type IconId } from "./icons.js";
import type { DesktopControl } from "./visual-model.js";
import { ACCENT, AXIS_TEXT, DENSITY, INERT, LINE, RADIUS, SPACE, SURFACE, TEXT, TYPE, TYPE_SCALE } from "./visual-tokens.js";

export type UiSegment = Readonly<{
  control: DesktopControl;
  selected: boolean;
  /** Already resolved from the input-action registry; null means unbound. */
  binding: string | null;
}>;

export type UiTab = UiSegment & Readonly<{ panelId: string }>;

export type UiNumberField = Readonly<{ control: DesktopControl; value: number }>;

export type UiSplitter = Readonly<{
  orientation: "vertical" | "horizontal";
  panelId: string;
  min: number;
  max: number;
  value: number;
}>;

function tooltip(control: DesktopControl, binding: string | null): string {
  const label = binding === null ? control.label : `${control.label} (${binding})`;

  return control.kind === "inert" ? `${label}: ${control.refusal ?? ""} - ${control.refusalMessage ?? ""}` : label;
}

function attributes(control: DesktopControl, binding: string | null = null): string {
  return `id="${escapeHtml(control.id)}" data-kind="${control.kind}" aria-label="${escapeHtml(control.label)}" title="${escapeHtml(tooltip(control, binding))}"${control.kind === "inert" ? ` aria-disabled="true" data-refusal="${escapeHtml(control.refusal ?? "")}" aria-describedby="${escapeHtml(control.id)}-hint"` : ""}`;
}

function refusalHint(control: DesktopControl): string {
  return control.kind === "inert" ? `<span id="${escapeHtml(control.id)}-hint" hidden>${escapeHtml(tooltip(control, null))}</span>` : "";
}

/** The sprite is emitted once by the document owner, never once per button. */
export function iconButton(control: DesktopControl, symbol: IconId, binding: string | null, pressed?: boolean): string {
  return `<span class="ui-icon-wrap"><button type="button" class="ui-control ui-icon-button" ${attributes(control, binding)}${control.kind === "inert" ? "" : ` aria-describedby="${escapeHtml(control.id)}-hint"`}${pressed === undefined ? "" : ` aria-pressed="${String(pressed)}"`}>${icon(symbol)}</button><span class="ui-tooltip" role="tooltip" id="${escapeHtml(control.id)}-hint">${escapeHtml(tooltip(control, binding))}</span></span>`;
}

export function segmentedControl(control: DesktopControl, segments: readonly UiSegment[]): string {
  return `<div class="ui-segmented" role="group" ${attributes(control)}>${segments.map((segment) => `<span class="ui-segment"><button type="button" class="ui-control" ${attributes(segment.control, segment.binding)} aria-pressed="${String(segment.selected)}">${escapeHtml(segment.control.label)}</button>${refusalHint(segment.control)}</span>`).join("")}</div>${refusalHint(control)}`;
}

export function chip(control: DesktopControl, selected?: boolean): string {
  return `<button type="button" class="ui-control ui-chip" ${attributes(control)}${selected === undefined ? "" : ` aria-pressed="${String(selected)}"`}>${escapeHtml(control.label)}</button>${refusalHint(control)}`;
}

/** A non-interactive count/status; its label names what the value counts. */
export function badge(control: DesktopControl, value: string): string {
  return `<span class="ui-badge" ${attributes(control)}>${escapeHtml(value)}</span>${refusalHint(control)}`;
}

export function cardHeader(control: DesktopControl, expanded: boolean, panelId: string): string {
  return `<button type="button" class="ui-control ui-card-header" ${attributes(control)} aria-expanded="${String(expanded)}" aria-controls="${escapeHtml(panelId)}">${icon(expanded ? "chevron-down" : "chevron-right")}<span>${escapeHtml(control.label)}</span></button>${refusalHint(control)}`;
}

export function propertyRow(control: DesktopControl, value: string, unit = ""): string {
  return `<div class="ui-property-row"><label for="${escapeHtml(control.id)}">${escapeHtml(control.label)}</label><span class="ui-field"><input class="ui-control ui-input" ${attributes(control)} type="text" value="${escapeHtml(value)}"${control.kind === "inert" ? " readonly" : ""}>${unit === "" ? "" : `<span class="ui-unit">${escapeHtml(unit)}</span>`}</span>${refusalHint(control)}</div>`;
}

/** Child controls are supplied by the model: no unaccounted input ids are minted here. */
export function vec3Row(control: DesktopControl, fields: readonly [UiNumberField, UiNumberField, UiNumberField], unit: string): string {
  const axes = ["x", "y", "z"] as const;

  return `<div class="ui-property-row" role="group" ${attributes(control)}><span>${escapeHtml(control.label)}</span><div class="ui-vec3">${fields.map((field, index) => `<label class="ui-axis-field"><span class="ui-axis ui-axis-${axes[index]}" aria-hidden="true">${axes[index]}</span><input class="ui-control ui-input" ${attributes({ ...field.control, label: `${field.control.label} (${unit})` })} type="number" step="any" value="${String(field.value)}"${field.control.kind === "inert" ? " readonly" : ""}>${refusalHint(field.control)}</label>`).join("")}<span class="ui-unit">${escapeHtml(unit)}</span></div></div>${refusalHint(control)}`;
}

/** The region owns tabpanel markup, activation and roving-focus keyboard handling. */
export function tabs(control: DesktopControl, items: readonly UiTab[]): string {
  return `<div class="ui-tabs" role="tablist" ${attributes(control)}>${items.map((item) => `<button type="button" class="ui-control ui-tab" role="tab" ${attributes(item.control, item.binding)} aria-selected="${String(item.selected)}" aria-controls="${escapeHtml(item.panelId)}" tabindex="${item.selected ? "0" : "-1"}">${escapeHtml(item.control.label)}</button>${refusalHint(item.control)}`).join("")}</div>${refusalHint(control)}`;
}

/** Value/range describe the controlled panel in pixels; no resize listener is installed. */
export function splitter(control: DesktopControl, state: UiSplitter): string {
  return `<div class="ui-splitter" role="separator" tabindex="0" ${attributes(control)} aria-orientation="${state.orientation}" aria-controls="${escapeHtml(state.panelId)}" aria-valuemin="${state.min}" aria-valuemax="${state.max}" aria-valuenow="${state.value}">${icon("drag-handle")}</div>${refusalHint(control)}`;
}

/** actionsHtml is trusted builder output, never user/provider text. */
export function emptyState(control: DesktopControl, description: string, actionsHtml = ""): string {
  return `<section class="ui-empty" ${attributes(control)}><div class="ui-empty-title">${escapeHtml(control.label)}</div><div>${escapeHtml(description)}</div>${actionsHtml === "" ? "" : `<div class="ui-empty-actions">${actionsHtml}</div>`}</section>${refusalHint(control)}`;
}

/** Opt-in stylesheet. The chrome owner emits this and iconSprite() once per document. */
export function uiKitStyles(): string {
  return `
.shell{${Object.entries(SPACE).map(([name, value]) => `--space-${name}:${value}px;`).join("")}${Object.entries(RADIUS).map(([name, value]) => `--r-${name}:${value}px;`).join("")}--ui-row:${DENSITY.comfortable.row}px;--ui-control:${DENSITY.comfortable.control}px;--ui-icon:${DENSITY.comfortable.toolbarIcon}px;--ui-header:${DENSITY.comfortable.panelHeader}px;--ui-body:${DENSITY.comfortable.body}px}
.shell[data-density="compact"]{--ui-row:${DENSITY.compact.row}px;--ui-control:${DENSITY.compact.control}px;--ui-icon:${DENSITY.compact.toolbarIcon}px;--ui-header:${DENSITY.compact.panelHeader}px;--ui-body:${DENSITY.compact.body}px}
.ui-control,.ui-splitter{box-sizing:border-box;min-width:24px;min-height:var(--ui-control);font-family:${TYPE.sans};font-size:var(--ui-body);line-height:${TYPE_SCALE.body.lineHeight}px;color:${TEXT.primary};background:${SURFACE.raised};border:1px solid ${LINE.control};border-radius:var(--r-sm);padding:var(--space-1) var(--space-2)}
.ui-control{height:var(--ui-control);cursor:pointer}
.ui-control:not([aria-disabled="true"]):hover{background:${SURFACE.hover};border-color:${LINE.hover}}
.ui-control[aria-pressed="true"],.ui-tab[aria-selected="true"]{background:${ACCENT.surface};color:${ACCENT.base};border-color:${ACCENT.line}}
.ui-control:not([aria-disabled="true"]):active{box-shadow:inset 0 0 0 2px ${LINE.hover}}
.ui-control[aria-disabled="true"],.ui-splitter[aria-disabled="true"]{color:${INERT.text};border-style:dashed;cursor:not-allowed}
.ui-control:focus-visible,.ui-splitter:focus-visible{outline:2px solid ${ACCENT.base};outline-offset:2px}
.ui-input:not([readonly]):focus-visible{border-color:${ACCENT.base}}
.ui-tab:focus-visible,.ui-segment .ui-control:focus-visible{outline-offset:-2px}
.ui-icon-wrap{position:relative;display:inline-flex;vertical-align:middle}
.ui-icon-button{display:inline-flex;align-items:center;justify-content:center;width:var(--ui-icon);height:var(--ui-icon);padding:var(--space-1)}
.ui-control .icon,.ui-splitter .icon{flex-shrink:0}
.ui-tooltip{display:none;position:absolute;z-index:1;inset-block-start:100%;inset-inline-start:0;max-width:240px;width:max-content;overflow-wrap:anywhere;padding:var(--space-1) var(--space-2);border:1px solid ${LINE.card};border-radius:var(--r-md);background:${SURFACE.overlay};color:${TEXT.primary};font:${TYPE_SCALE.small.size}px/${TYPE_SCALE.small.lineHeight}px ${TYPE.sans}}
.ui-icon-wrap:hover>.ui-tooltip,.ui-icon-wrap:focus-within>.ui-tooltip{display:block}
.ui-segmented,.ui-tabs,.ui-empty-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-1)}
.ui-segment{display:inline-flex;min-width:0}
.ui-chip{border-radius:var(--r-pill)}
.ui-badge{display:inline-flex;align-items:center;padding:var(--space-1) var(--space-2);border-radius:var(--r-xs);background:${SURFACE.header};color:${TEXT.secondary};font:${TYPE_SCALE.caption.size}px/${TYPE_SCALE.caption.lineHeight}px ${TYPE.sans}}
.ui-card-header{display:flex;align-items:center;gap:var(--space-2);width:100%;min-height:var(--ui-header);text-align:start;font-weight:${TYPE_SCALE["body-strong"].weight};background:${SURFACE.header}}
.ui-property-row{display:grid;grid-template-columns:minmax(64px,1fr) minmax(0,2fr);align-items:center;gap:var(--space-2);min-height:var(--ui-row);color:${TEXT.secondary};font:${TYPE_SCALE.body.weight} var(--ui-body)/${TYPE_SCALE.body.lineHeight}px ${TYPE.sans}}
.ui-property-row>label,.ui-property-row>span{min-width:0;overflow-wrap:anywhere}
.ui-field,.ui-axis-field{display:flex;align-items:center;gap:var(--space-1);min-width:0}
.ui-input{width:100%;min-width:24px;height:var(--ui-control);padding:var(--space-1);background:${SURFACE.well};font-family:${TYPE.mono};font-size:${TYPE_SCALE.mono.size}px;font-variant-numeric:tabular-nums;cursor:text}
.ui-vec3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:center;gap:var(--space-1);min-width:0}
.ui-axis{font-size:${TYPE_SCALE.caption.size}px}
.ui-axis-x{color:${AXIS_TEXT.x}}
.ui-axis-y{color:${AXIS_TEXT.y}}
.ui-axis-z{color:${AXIS_TEXT.z}}
.ui-unit{color:${TEXT.faint};font-size:${TYPE_SCALE.caption.size}px;line-height:${TYPE_SCALE.caption.lineHeight}px}
.ui-splitter{display:flex;align-items:center;justify-content:center;touch-action:none;padding:var(--space-1)}
.ui-splitter[aria-orientation="vertical"]{width:24px;min-height:24px;cursor:col-resize}
.ui-splitter[aria-orientation="horizontal"]{height:24px;cursor:row-resize}
.ui-splitter[aria-disabled="true"]{cursor:not-allowed}
.ui-empty{display:grid;gap:var(--space-3);padding:var(--space-4);color:${TEXT.secondary};font:var(--ui-body)/${TYPE_SCALE.body.lineHeight}px ${TYPE.sans};overflow-wrap:anywhere}
.ui-empty-title{color:${TEXT.primary};font-size:${TYPE_SCALE.display.size}px;line-height:${TYPE_SCALE.display.lineHeight}px;font-weight:${TYPE_SCALE.display.weight}}
`;
}
