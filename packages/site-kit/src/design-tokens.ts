/**
 * SceneAxi Foundations v2 — the shared visual token layer for the `sites/` tier.
 *
 * Every value here is transcribed from the captain-accepted design source
 * (`SceneAxi Foundations.dc.html`, archive SHA-256
 * `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`). The
 * archive is the authority for purely visual facts; nothing here invents a
 * colour, a size, or a hover shade the sheet does not state. Where the sheet is
 * silent, this module is silent too — see `docs/design-foundations.md` for the
 * two recorded gaps (`--fg-3`, storefront hover accents).
 *
 * This is the S-1 seam: three sites currently carry near-identical copies of one
 * stylesheet, and ADR 0018 makes each of them a separate install root, so the one
 * package all three already depend on is where the tokens can live without any
 * new matrix edge. Per Foundations §06 the surface accent stays a per-site
 * override — the skeleton and the neutrals do not move.
 *
 * The package stays framework-free: this module emits CSS *text* and typed data.
 * It renders nothing, imports nothing from a framework, and needs no browser to
 * be tested.
 */
import { refuse, ok, type SiteResult } from "./refusals.js";

/** Freeze a table and every row in it, preserving the declared element type. */
function freezeAll<T>(rows: readonly T[]): readonly T[] {
  for (const row of rows) Object.freeze(row);
  return Object.freeze(rows);
}

/** Design-system revision this module transcribes. */
export const FOUNDATIONS_VERSION = "v2" as const;

/**
 * Provenance of the transcription, so a reviewer can re-derive every value.
 * `pnpm gate` asserts the token tables against these names, never against a memory.
 */
export const FOUNDATIONS_SOURCE = Object.freeze({
  archive: "SceneAxi Design System.zip",
  archiveSha256: "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
  file: "SceneAxi Foundations.dc.html",
  selfDescription: "design foundations · v2 · matches every shipped surface",
});

// ---------------------------------------------------------------------------
// 01 — COLOUR
// ---------------------------------------------------------------------------

export type FoundationColorGroup = "neutral" | "line-text" | "accent-semantic" | "axis-surface";

/**
 * Contrast role a foreground token is allowed to carry.
 *
 * This is the accessibility contract over the palette: the sheet fixes the hexes,
 * and this classification fixes what each one may be used *for*, so
 * `test/design-tokens.test.ts` can measure it rather than trust it.
 *
 * - `body` — may carry normal-size text; measured ≥ 4.5:1 on every neutral surface.
 * - `large` — may carry large or bold text only; measured ≥ 3.0:1 on every neutral.
 * - `non-text` — never the sole carrier of meaning: disabled labels, units,
 *   timestamps, rules, and fills. No contrast minimum is claimed for it.
 */
export type FoundationContrastRole = "body" | "large" | "non-text";

export type FoundationColor = {
  readonly token: string;
  readonly hex: string;
  readonly use: string;
  readonly group: FoundationColorGroup;
};

/**
 * The four printed colour groups, in sheet order.
 *
 * Recorded gap: the sheet's "four text levels" note prints only three (`--fg`,
 * `--fg-2`, `--fg-4`). `--fg-3` is deliberately absent here rather than guessed.
 */
export const FOUNDATION_COLORS: readonly FoundationColor[] = freezeAll([
  // Neutrals — "the entire chrome — nine steps, no more"
  { token: "--bg-base", hex: "#07080A", use: "app background, viewport letterbox", group: "neutral" },
  { token: "--bg-panel", hex: "#0D0F12", use: "docked panel body", group: "neutral" },
  { token: "--bg-raised", hex: "#12151A", use: "panel headers, toolbars, tab strip", group: "neutral" },
  { token: "--bg-control", hex: "#191D23", use: "buttons, chips, hovered rows", group: "neutral" },
  { token: "--bg-field", hex: "#08090B", use: "inset inputs and numeric fields", group: "neutral" },
  { token: "--bg-row", hex: "#101318", use: "alternating and hovered list rows", group: "neutral" },
  // Lines & text — "four text levels, three line weights"
  { token: "--line-soft", hex: "#14181E", use: "internal row dividers", group: "line-text" },
  { token: "--line", hex: "#1C2129", use: "panel and control borders", group: "line-text" },
  { token: "--line-strong", hex: "#2C323B", use: "floating layer edge, hover border", group: "line-text" },
  { token: "--fg", hex: "#EDEFF2", use: "primary label, selected row", group: "line-text" },
  { token: "--fg-2", hex: "#8A929C", use: "secondary label, prose", group: "line-text" },
  { token: "--fg-4", hex: "#3F464F", use: "disabled, timestamps, units", group: "line-text" },
  // Accent & semantic — "one accent; semantics are state, never decoration"
  { token: "--accent", hex: "#FF6B2C", use: "primary action, selection, pending", group: "accent-semantic" },
  { token: "--accent-hi", hex: "#FF8A54", use: "hover / active accent", group: "accent-semantic" },
  { token: "--ok", hex: "#5EEAD4", use: "validated, applied, new value", group: "accent-semantic" },
  { token: "--danger", hex: "#FF4D5E", use: "refusal, destructive — nothing else", group: "accent-semantic" },
  { token: "--info", hex: "#5B9CFF", use: "experimental, informational", group: "accent-semantic" },
  { token: "--stale", hex: "#7A6448", use: "the old value in a diff", group: "accent-semantic" },
  // Axis & surface accents — "fixed meanings, never reassigned"
  { token: "--axis-x", hex: "#E0564F", use: "X gizmo, X field chip", group: "axis-surface" },
  { token: "--axis-y", hex: "#7BC44C", use: "Y gizmo, Y field chip", group: "axis-surface" },
  { token: "--axis-z", hex: "#4C8BE0", use: "Z gizmo, Z field chip", group: "axis-surface" },
  { token: "--kids", hex: "#A78BFA", use: "Kids surface, scene composition", group: "axis-surface" },
  { token: "--store-game", hex: "#E8544E", use: "game-asset storefront accent", group: "axis-surface" },
  { token: "--store-web", hex: "#3FB8C9", use: "website-asset storefront + web editor", group: "axis-surface" },
]);

/** The six neutral surface fills, in the order the sheet prints them. */
export const FOUNDATION_NEUTRAL_TOKENS: readonly string[] = Object.freeze([
  "--bg-base",
  "--bg-panel",
  "--bg-raised",
  "--bg-control",
  "--bg-field",
  "--bg-row",
]);

/**
 * What each foreground token may carry. Every entry is measured in the gate, so a
 * token cannot be promoted to `body` by assertion — only by contrast.
 */
export const FOUNDATION_CONTRAST_ROLES: Readonly<Record<string, FoundationContrastRole>> =
  Object.freeze({
    "--fg": "body",
    "--fg-2": "body",
    "--fg-4": "non-text",
    "--accent": "body",
    "--accent-hi": "body",
    "--ok": "body",
    "--danger": "body",
    "--info": "body",
    // The struck-through old value in a diff. It is redundant by construction —
    // the badge and the mint new value carry the change — so it is classified for
    // large/bold text and never as the only signal.
    "--stale": "large",
    "--axis-x": "body",
    "--axis-y": "body",
    "--axis-z": "body",
    "--kids": "body",
    "--store-game": "body",
    "--store-web": "body",
  });

/** The three stated colour laws. These are load-bearing rules, not decoration. */
export const FOUNDATION_COLOR_LAWS: readonly {
  readonly id: "accent-means-pending" | "mint-means-verified" | "red-means-refused";
  readonly title: string;
  readonly rail: string;
  readonly rule: string;
}[] = freezeAll([
  {
    id: "accent-means-pending",
    title: "Accent means pending",
    rail: "#FF6B2C",
    rule: "Selected row, active tool, primary action, and unreviewed changes. If nothing is waiting on you, there is almost no orange on screen — which is how you find work.",
  },
  {
    id: "mint-means-verified",
    title: "Mint means verified",
    rail: "#5EEAD4",
    rule: "A validated artifact, an applied change, a passing check, the new value in a diff. Never used for a button, never for decoration.",
  },
  {
    id: "red-means-refused",
    title: "Red means refused",
    rail: "#FF4D5E",
    rule: "Only a refusal or a destructive action. A diff never uses red for its old value — that is stale bronze, because being replaced is not an error.",
  },
]);

// ---------------------------------------------------------------------------
// 02 — TYPE
// ---------------------------------------------------------------------------

export type FoundationFamily = "archivo" | "mono";

export type FoundationTypeStep = {
  readonly token: string;
  readonly family: FoundationFamily;
  readonly weight: 400 | 500 | 600 | 700;
  readonly sizePx: number;
  /** Upper bound where the sheet prints a range (`mono` is 10–12). */
  readonly maxSizePx?: number;
  /** Archivo variable width axis, where the sheet pins one. */
  readonly widthAxis?: number;
  readonly letterSpacingEm?: number;
  readonly sample: string;
};

/** Two families only; the sheet is explicit that mono is never used for prose. */
export const FOUNDATION_FONT_STACKS = Object.freeze({
  archivo: "'Archivo', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
});

export const FOUNDATION_TYPE_SCALE: readonly FoundationTypeStep[] = freezeAll([
  { token: "display-xl", family: "archivo", weight: 700, sizePx: 66, widthAxis: 104, sample: "Describe the object" },
  { token: "display-l", family: "archivo", weight: 700, sizePx: 42, sample: "One runtime, three profiles" },
  { token: "heading", family: "archivo", weight: 700, sizePx: 24, sample: "Sculpt from a reference" },
  { token: "subhead", family: "archivo", weight: 600, sizePx: 17, sample: "Review before anything changes" },
  { token: "lead", family: "archivo", weight: 400, sizePx: 16, sample: "Drop a reference image and describe it." },
  { token: "body", family: "archivo", weight: 400, sizePx: 14, sample: "The editor proposes; you accept or reject." },
  { token: "ui", family: "archivo", weight: 500, sizePx: 12, sample: "Scene · Properties · Assets" },
  { token: "ui-sm", family: "archivo", weight: 500, sizePx: 11, sample: "tab · badge · inline label" },
  { token: "micro", family: "mono", weight: 500, sizePx: 8.5, letterSpacingEm: 0.15, sample: "PANEL HEADER · SECTION LABEL" },
  { token: "mono", family: "mono", weight: 400, sizePx: 10, maxSizePx: 12, sample: "position.y 1.24  a4f2…9c1e" },
]);

// ---------------------------------------------------------------------------
// 03 — SPACE, RADIUS, SURFACE
// ---------------------------------------------------------------------------

/** The 4px base scale. The sheet forbids inventing an in-between step. */
export const FOUNDATION_SPACING: readonly { readonly token: string; readonly px: number }[] =
  freezeAll([
    { token: "space-1", px: 4 },
    { token: "space-2", px: 8 },
    { token: "space-3", px: 12 },
    { token: "space-4", px: 16 },
    { token: "space-6", px: 24 },
    { token: "space-8", px: 32 },
    { token: "space-11", px: 44 },
    { token: "space-18", px: 72 },
  ]);

export const FOUNDATION_SPACING_RULE =
  "Editor chrome lives in 4–14. Marketing sections use 44–108. Never invent an in-between.";

export const FOUNDATION_RADII: readonly {
  readonly token: string;
  readonly px: number;
  readonly use: string;
}[] = freezeAll([
  { token: "radius-xs", px: 2, use: "bars, inline marks" },
  { token: "radius-sm", px: 3, use: "inputs, chips, tree marks" },
  { token: "radius-md", px: 5, use: "buttons, segmented groups" },
  { token: "radius-lg", px: 9, use: "cards, dialogs, panels" },
  { token: "radius-xl", px: 16, use: "Kids only" },
  { token: "radius-full", px: 999, use: "counts, pills, avatars" },
]);

export type FoundationSurface = {
  readonly id: "base" | "panel" | "raised" | "control" | "float";
  readonly name: string;
  readonly bg: string;
  readonly line: string;
  readonly radiusPx: number;
  readonly shadow: string;
};

/** base → panel → raised → control → float. Only floating layers cast shadow. */
export const FOUNDATION_SURFACES: readonly FoundationSurface[] = freezeAll([
  { id: "base", name: "base — app background", bg: "#07080A", line: "#12161B", radiusPx: 4, shadow: "none" },
  { id: "panel", name: "panel — docked body", bg: "#0D0F12", line: "#1A1F26", radiusPx: 4, shadow: "none" },
  { id: "raised", name: "raised — header, toolbar", bg: "#12151A", line: "#1C2129", radiusPx: 4, shadow: "inset 0 1px 0 rgba(255,255,255,.03)" },
  { id: "control", name: "control — button, chip", bg: "#191D23", line: "#2C323B", radiusPx: 4, shadow: "inset 0 1px 0 rgba(255,255,255,.05)" },
  { id: "float", name: "float — dialog, menu", bg: "#12151A", line: "#2C323B", radiusPx: 8, shadow: "0 24px 60px -16px rgba(0,0,0,.9)" },
]);

export const FOUNDATION_SURFACE_RULE =
  "Only floating layers cast shadow. Docked panels separate by a 1px hairline plus a 1px inset top highlight at 3% white.";

// ---------------------------------------------------------------------------
// 04 — CONTROLS (status vocabulary)
// ---------------------------------------------------------------------------

export type FoundationStatusId =
  | "validated"
  | "needs-review"
  | "refused"
  | "experimental"
  | "isolated"
  | "dormant";

export type FoundationStatus = {
  readonly id: FoundationStatusId;
  readonly label: string;
  readonly fg: string;
  readonly bg: string;
  readonly line: string;
};

/**
 * The published status chip vocabulary. It is a *presentation* vocabulary: which
 * status a surface is entitled to show is decided by that surface's own contract
 * (refusal registries, entitlement, conformance registry), never here.
 */
export const FOUNDATION_STATUSES: readonly FoundationStatus[] = freezeAll([
  { id: "validated", label: "Validated", fg: "#5EEAD4", bg: "#0D2422", line: "#1E4A45" },
  { id: "needs-review", label: "Needs review", fg: "#FF6B2C", bg: "#191207", line: "#4A3820" },
  { id: "refused", label: "Refused", fg: "#FF4D5E", bg: "#1A1113", line: "#3A2126" },
  { id: "experimental", label: "Experimental", fg: "#5B9CFF", bg: "#0C1620", line: "#223040" },
  { id: "isolated", label: "Isolated", fg: "#A78BFA", bg: "#160F22", line: "#2E2542" },
  { id: "dormant", label: "Dormant", fg: "#8A929C", bg: "#101318", line: "#1C2129" },
]);

/** Button heights the sheet prints. `xl` is the marketing size. */
export const FOUNDATION_BUTTON_SIZES: readonly {
  readonly size: "sm" | "md" | "lg" | "xl";
  readonly heightPx: number;
  readonly fontPx: number;
  readonly radiusPx: number;
  readonly paddingXPx: number;
}[] = freezeAll([
  { size: "sm", heightPx: 22, fontPx: 11, radiusPx: 3, paddingXPx: 10 },
  { size: "md", heightPx: 30, fontPx: 12, radiusPx: 4, paddingXPx: 14 },
  { size: "lg", heightPx: 38, fontPx: 13, radiusPx: 5, paddingXPx: 18 },
  { size: "xl", heightPx: 46, fontPx: 15, radiusPx: 6, paddingXPx: 24 },
]);

// ---------------------------------------------------------------------------
// 06 — SURFACES (accent map)
// ---------------------------------------------------------------------------

export type FoundationSurfaceAccentId =
  | "umbrella"
  | "engine-desktop"
  | "engine-web"
  | "game-assets"
  | "web-assets"
  | "kids";

export type FoundationSurfaceAccent = {
  readonly id: FoundationSurfaceAccentId;
  readonly name: string;
  readonly accent: string;
  /**
   * Hover / active shade. The sheet prints one only for signal orange, so every
   * other surface carries `null` rather than an invented lighter tint.
   */
  readonly accentHi: string | null;
  readonly note: string;
};

/**
 * The archive's surface → accent map, recorded whole so no visual fact is lost.
 *
 * This is descriptive data. `resolveSurfaceAccent()` is the functional path, and it
 * refuses Kids by name — this repository themes no Kids surface (Kids lives on its
 * own origin and nothing here may depend on `@sceneaxi/profile-kids`).
 */
export const FOUNDATION_SURFACE_ACCENTS: readonly FoundationSurfaceAccent[] = freezeAll([
  { id: "umbrella", name: "Umbrella site", accent: "#FF6B2C", accentHi: "#FF8A54", note: "Product, engine, profiles, docs, pricing, download." },
  { id: "engine-desktop", name: "Engine — desktop", accent: "#FF6B2C", accentHi: "#FF8A54", note: "Seven modes, AI assistant, profile switch, real viewport." },
  { id: "engine-web", name: "Engine — web", accent: "#3FB8C9", accentHi: null, note: "In-page slot editing, embed snippet, enforced budgets, collaborators." },
  { id: "game-assets", name: "Game assets", accent: "#E8544E", accentHi: null, note: "Warmer, denser, rig-led merchandising for playable scenes." },
  { id: "web-assets", name: "Web assets", accent: "#3FB8C9", accentHi: null, note: "Cooler, calmer, live-preview-led. Same skeleton, different catalogue." },
  { id: "kids", name: "Kids", accent: "#A78BFA", accentHi: null, note: "Own origin. Bigger scale, 16px radius, no assistant, grown-ups panel." },
]);

export const FOUNDATION_ACCENT_RULE =
  "Signal orange is the product accent and owns the umbrella site and both engine editors. The storefronts shift accent only — same skeleton, same neutrals, different merchandising. Kids is the one surface allowed to change scale, radius and hue, and it lives on its own origin.";

/**
 * Resolve the accent pair a surface may theme with.
 *
 * Kids refuses by name on this path as it does on every other path in this
 * package: there is no Kids surface here to accent, and minting one would invent a
 * product contract the canonical spec holds closed.
 */
export function resolveSurfaceAccent(
  surface: string,
): SiteResult<{ readonly accent: string; readonly accentHi: string }> {
  if (surface === "kids") return refuse("KIDS_SURFACE_DENIED");
  const found = FOUNDATION_SURFACE_ACCENTS.find((entry) => entry.id === surface);
  if (found === undefined) return refuse("FOUNDATION_SURFACE_UNKNOWN");
  // The sheet states no hover shade outside signal orange. Repeating the accent is
  // the honest fallback; inventing a lighter tint would be a new visual fact.
  return ok(Object.freeze({ accent: found.accent, accentHi: found.accentHi ?? found.accent }));
}

// ---------------------------------------------------------------------------
// Accessibility — measured, not asserted
// ---------------------------------------------------------------------------

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/**
 * WCAG 2.1 contrast ratio between two `#RRGGBB` colours, 1–21.
 *
 * Exported because the surface accent is a per-site override: a lane shifting the
 * accent can measure its own value against the shared neutrals instead of hoping.
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The WCAG AA floor each contrast role must clear. `non-text` claims nothing. */
export const FOUNDATION_CONTRAST_MINIMUMS: Readonly<Record<FoundationContrastRole, number>> =
  Object.freeze({ body: 4.5, large: 3, "non-text": 0 });

/** Whether `foreground` on `background` clears the floor for `role`. */
export function meetsContrast(
  foreground: string,
  background: string,
  role: FoundationContrastRole,
): boolean {
  return contrastRatio(foreground, background) >= FOUNDATION_CONTRAST_MINIMUMS[role];
}

// ---------------------------------------------------------------------------
// CSS emission
// ---------------------------------------------------------------------------

export type FoundationsCssOptions = {
  /**
   * Surface whose accent overrides signal orange (Foundations §06: "accent shifts
   * only"). Omitted leaves the product accent in place. An unknown surface — or
   * Kids — refuses rather than silently falling back.
   */
  readonly surface?: FoundationSurfaceAccentId;
};

/**
 * The `:root` custom properties, using the sheet's own token names.
 *
 * The names are not prefixed on purpose: `--accent`, `--bg-base` and friends *are*
 * the published token names, and renaming them would put this layer and the design
 * source into permanent translation.
 */
export function foundationsVariablesCss(options: FoundationsCssOptions = {}): SiteResult<string> {
  const lines: string[] = [];
  for (const color of FOUNDATION_COLORS) lines.push(`  ${color.token}: ${color.hex};`);
  for (const step of FOUNDATION_SPACING) lines.push(`  --${step.token}: ${`${step.px}px`};`);
  for (const radius of FOUNDATION_RADII) {
    lines.push(`  --${radius.token}: ${radius.token === "radius-full" ? "999px" : `${radius.px}px`};`);
  }
  lines.push(`  --font-ui: ${FOUNDATION_FONT_STACKS.archivo};`);
  lines.push(`  --font-mono: ${FOUNDATION_FONT_STACKS.mono};`);
  for (const step of FOUNDATION_TYPE_SCALE) {
    lines.push(`  --type-${step.token}-size: ${`${step.sizePx}px`};`);
    lines.push(`  --type-${step.token}-weight: ${step.weight};`);
  }
  for (const surface of FOUNDATION_SURFACES) {
    lines.push(`  --surface-${surface.id}-bg: ${surface.bg};`);
    lines.push(`  --surface-${surface.id}-line: ${surface.line};`);
    lines.push(`  --surface-${surface.id}-shadow: ${surface.shadow};`);
  }

  if (options.surface !== undefined) {
    const accent = resolveSurfaceAccent(options.surface);
    if (!accent.ok) return accent;
    lines.push(`  --accent: ${accent.value.accent};`);
    lines.push(`  --accent-hi: ${accent.value.accentHi};`);
  }

  return ok(`:root {\n${lines.join("\n")}\n}\n`);
}

/**
 * Document-level rules transcribed from the sheet's own `<style>` block: the
 * near-black canvas, Archivo body text, the orange selection wash, and the
 * hairline scrollbar.
 */
export function foundationsBaseCss(): string {
  return [
    "html, body { margin: 0; padding: 0; background: var(--bg-base); }",
    "body { font-family: var(--font-ui); color: var(--fg); -webkit-font-smoothing: antialiased; }",
    "* { box-sizing: border-box; }",
    "a { color: var(--accent); text-decoration: none; }",
    "a:hover { color: var(--accent-hi); }",
    "::selection { background: rgba(255, 107, 44, 0.3); }",
    "::-webkit-scrollbar { width: 11px; }",
    "::-webkit-scrollbar-track { background: var(--bg-base); }",
    "::-webkit-scrollbar-thumb { background: #20262E; border: 3px solid var(--bg-base); border-radius: 6px; }",
    "",
  ].join("\n");
}

/** Surface utility classes, one per step of base → panel → raised → control → float. */
export function foundationsSurfacesCss(): string {
  return `${FOUNDATION_SURFACES.map(
    (surface) =>
      `.sx-surface-${surface.id} { background: ${surface.bg}; border: 1px solid ${surface.line}; border-radius: ${`${surface.radiusPx}px`}; box-shadow: ${surface.shadow}; }`,
  ).join("\n")}\n`;
}

/** Status chip classes for the published status vocabulary. */
export function foundationsStatusCss(): string {
  const base =
    ".sx-status { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--radius-sm); padding: 4px 9px; font-size: 11px; font-weight: 500; }\n" +
    ".sx-status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }\n";
  return `${base}${FOUNDATION_STATUSES.map(
    (status) =>
      `.sx-status-${status.id} { color: ${status.fg}; background: ${status.bg}; border: 1px solid ${status.line}; }`,
  ).join("\n")}\n`;
}

/**
 * The complete Foundations v2 stylesheet a site drops in ahead of its own rules.
 *
 * A site owns its layout; this owns the palette, the scale, and the shared parts.
 */
export function foundationsCss(options: FoundationsCssOptions = {}): SiteResult<string> {
  const variables = foundationsVariablesCss(options);
  if (!variables.ok) return variables;
  return ok(
    [
      `/* SceneAxi Foundations ${FOUNDATIONS_VERSION} — generated by @sceneaxi/site-kit. */`,
      variables.value,
      foundationsBaseCss(),
      foundationsSurfacesCss(),
      foundationsStatusCss(),
    ].join("\n"),
  );
}
