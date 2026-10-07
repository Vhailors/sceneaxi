/**
 * SceneAxi shared visual token layer for the `sites/` tier.
 *
 * Two generations live here during the v6 migration:
 *
 * - **v6 "Interlocking" (signal box)** — `SIGNAL_*` tables and `signalCss()`, at the
 *   bottom of this file. The source of truth is `docs/redesign-v6/DIRECTION.md`
 *   (§2 shared core, §5 palette and on-colour pairs, §9 motion and density). Every
 *   colour ships as an explicit foreground/background pair that `test/design-tokens.test.ts`
 *   measures; every state ships as label + icon + paint, never paint alone.
 * - **Foundations v2 (legacy skeleton)** — the `FOUNDATION_*` tables and `foundations*Css()`
 *   emitters below. Their neutrals stay value-compatible so un-migrated sites keep
 *   rendering, but the v5 signal-orange accent is retired from every live value: the
 *   product accent is now v6 enamel (`#F1EEE4`, hover `#FFFFFF`) and "pending" is v6
 *   lever yellow (`#F2C230`). The emitted CSS sits in cascade layers, carries no global
 *   `a:hover { color }` rule (the v5 1.20:1 button-ink defect, BASELINE defect 1), and
 *   underlines links so they never rely on colour alone.
 *   Lanes replace `foundationsCss()` with `signalCss()` as they migrate.
 *
 * Both generations emit into one layer order, `SIGNAL_LAYER_ORDER`:
 * `@layer reset, tokens, base, components, utilities;`. A site's own unlayered rules
 * therefore always win over the shared sheet, and nothing in the shared sheet can
 * out-specify a site's button ink.
 *
 * --- Foundations v2 provenance (legacy) ---
 *
 * Every value here is transcribed from the captain-accepted design source
 * (`SceneAxi Foundations.dc.html`, archive SHA-256
 * `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`). The
 * archive is the authority for purely visual facts; nothing here invents a
 * colour, a size, or a hover shade the sheet does not state. Where the sheet is
 * silent, this module is silent too — see `docs/design-foundations.md` for the
 * two recorded gaps (`--fg-3`, storefront hover accents). The one visual fact it
 * states anyway is motion: `FOUNDATION_MOTION` is recorded decision D-4 in the same
 * document, stated rather than transcribed.
 *
 * Redesign 2026-10: the approved direction (`docs/redesign/DIRECTION.md` §8, §8.1)
 * changes a few sheet values on the sites. Each changed value names its
 * deviation (DV-F1, DV-F2, DV-F3, DV-F9, DV-F11) beside it, the motion system
 * lands as its own group and emitter (DV-F7, DV-F8, DV-P1), and
 * `docs/design-foundations.md` § "Redesign 2026-10" records old → new → why.
 * Nothing changes silently.
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
  // v6 retirement: the v5 signal orange is gone. The accent is v6 enamel (DIRECTION §5.1:
  // "primary button fill, default plate"), its hover is --enamel-hi.
  { token: "--accent", hex: "#F1EEE4", use: "primary action fill (v6 enamel)", group: "accent-semantic" },
  { token: "--accent-hi", hex: "#FFFFFF", use: "hover / active primary fill (v6 enamel-hi)", group: "accent-semantic" },
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
    title: "Yellow means pending",
    // v6 lever paint --pending (DIRECTION §5.2); always with a plate label and icon.
    rail: "#F2C230",
    rule: "Unreviewed changes and work waiting on you, always as a labelled plate with an icon. If nothing is waiting on you, there is almost no yellow on screen — which is how you find work.",
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

/**
 * The ten type roles. `display-xl` and `display-l` keep the sheet's 66/42: they are
 * the ceiling of the fluid `clamp()` literals sites write on their own selectors
 * (DV-F10), and are never read for a font size. The other sizes are the sites'
 * redesign values; the sheet value each one replaced is in the comment above it.
 */
export const FOUNDATION_TYPE_SCALE: readonly FoundationTypeStep[] = freezeAll([
  { token: "display-xl", family: "archivo", weight: 700, sizePx: 66, widthAxis: 104, sample: "Describe the object" },
  { token: "display-l", family: "archivo", weight: 700, sizePx: 42, sample: "One runtime, three profiles" },
  { token: "heading", family: "archivo", weight: 700, sizePx: 24, sample: "Sculpt from a reference" },
  { token: "subhead", family: "archivo", weight: 600, sizePx: 17, sample: "Review before anything changes" },
  // DV-F2: sheet 16px.
  { token: "lead", family: "archivo", weight: 400, sizePx: 18, sample: "Drop a reference image and describe it." },
  // DV-F2: sheet 14px (the umbrella editor chrome keeps 14px as a literal).
  { token: "body", family: "archivo", weight: 400, sizePx: 16, sample: "The editor proposes; you accept or reject." },
  // DV-F9: sheet 12px.
  { token: "ui", family: "archivo", weight: 500, sizePx: 13, sample: "Scene · Properties · Assets" },
  // DV-F9: sheet 11px.
  { token: "ui-sm", family: "archivo", weight: 500, sizePx: 12, sample: "tab · badge · inline label" },
  // DV-F1 + DV-F11: sheet 8.5px at 0.15em. Machine values and table column heads only.
  { token: "micro", family: "mono", weight: 500, sizePx: 11, letterSpacingEm: 0.08, sample: "PANEL HEADER · SECTION LABEL" },
  // DV-F9: sheet 10–12px.
  { token: "mono", family: "mono", weight: 400, sizePx: 12, maxSizePx: 13, sample: "position.y 1.24  a4f2…9c1e" },
]);

/** No text renders below this size on the sites (DV-F1); aria-hidden marks excepted. */
export const FOUNDATION_TEXT_FLOOR_PX = 11;

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

/**
 * base → panel → raised → control → float. Only floating layers cast shadow.
 *
 * DV-F3: the float shadow was `0 24px 60px -16px rgba(0,0,0,.9)`. A 1px edge plus a
 * ≥16px blur is the banned ghost elevation, so it is now a tight 14px blur at the same
 * ink; the 1px `#2C323B` edge stays and does the separating on near-black.
 */
export const FOUNDATION_SURFACES: readonly FoundationSurface[] = freezeAll([
  { id: "base", name: "base — app background", bg: "#07080A", line: "#12161B", radiusPx: 4, shadow: "none" },
  { id: "panel", name: "panel — docked body", bg: "#0D0F12", line: "#1A1F26", radiusPx: 4, shadow: "none" },
  { id: "raised", name: "raised — header, toolbar", bg: "#12151A", line: "#1C2129", radiusPx: 4, shadow: "inset 0 1px 0 rgba(255,255,255,.03)" },
  { id: "control", name: "control — button, chip", bg: "#191D23", line: "#2C323B", radiusPx: 4, shadow: "inset 0 1px 0 rgba(255,255,255,.05)" },
  { id: "float", name: "float — dialog, menu", bg: "#12151A", line: "#2C323B", radiusPx: 8, shadow: "0 10px 14px -6px rgba(0,0,0,.9)" },
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
  // v6: pending is lever yellow (--pending-ink, dark scheme), not v5 orange.
  { id: "needs-review", label: "Needs review", fg: "#F2C230", bg: "#191207", line: "#4A3820" },
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
   * Hover / active shade. Only the enamel product accent has one (v6 `--enamel-hi`),
   * so every other surface carries `null` rather than an invented lighter tint.
   */
  readonly accentHi: string | null;
  readonly note: string;
};

/**
 * The archive's surface → accent map, recorded whole so no visual fact is lost.
 *
 * This is descriptive data. `resolveSurfaceAccent()` is the functional path, and it
 * refuses Kids by name — the shared emitter themes no Kids surface. The dedicated
 * origin owns its stylesheet without importing this package or `profile-kids`.
 */
export const FOUNDATION_SURFACE_ACCENTS: readonly FoundationSurfaceAccent[] = freezeAll([
  { id: "umbrella", name: "Umbrella site", accent: "#F1EEE4", accentHi: "#FFFFFF", note: "Product, engine, profiles, docs, pricing, download." },
  { id: "engine-desktop", name: "Engine — desktop", accent: "#F1EEE4", accentHi: "#FFFFFF", note: "Seven modes, AI assistant, profile switch, real viewport." },
  { id: "engine-web", name: "Engine — web", accent: "#3FB8C9", accentHi: null, note: "In-page slot editing, embed snippet, enforced budgets, collaborators." },
  { id: "game-assets", name: "Game assets", accent: "#E8544E", accentHi: null, note: "Warmer, denser, rig-led merchandising for playable scenes." },
  { id: "web-assets", name: "Web assets", accent: "#3FB8C9", accentHi: null, note: "Cooler, calmer, live-preview-led. Same skeleton, different catalogue." },
  { id: "kids", name: "Kids", accent: "#A78BFA", accentHi: null, note: "Own origin. Bigger scale, 16px radius, no assistant, grown-ups panel." },
]);

export const FOUNDATION_ACCENT_RULE =
  "Enamel is the product accent and owns the umbrella site and both engine editors. The storefronts shift accent only — same skeleton, same neutrals, different merchandising. Kids is the one surface allowed to change scale, radius and hue, and it lives on its own origin.";

/**
 * Resolve the accent pair a surface may theme with.
 *
 * Kids refuses by name on this path as it does on every other path in this
 * package: there is no Kids surface in site-kit to accent. The dedicated origin's
 * isolated stylesheet is owned by `docs/kids-first-release.md`.
 */
export function resolveSurfaceAccent(
  surface: string,
): SiteResult<{ readonly accent: string; readonly accentHi: string }> {
  if (surface === "kids") return refuse("KIDS_SURFACE_DENIED");
  const found = FOUNDATION_SURFACE_ACCENTS.find((entry) => entry.id === surface);

  if (found === undefined) return refuse("FOUNDATION_SURFACE_UNKNOWN");

  // No hover shade is stated outside enamel. Repeating the accent is
  // the honest fallback; inventing a lighter tint would be a new visual fact.
  return ok(Object.freeze({ accent: found.accent, accentHi: found.accentHi ?? found.accent }));
}

// ---------------------------------------------------------------------------
// D-4 — MOTION (stated, not transcribed)
// ---------------------------------------------------------------------------

/**
 * The only durations and easing a site-sheet transition may read.
 *
 * The sheet states no motion, so these values are recorded decision D-4 in
 * `docs/design-foundations.md` rather than a transcription: changing one changes
 * that decision. D-4 also caps transforms at `translateX(3px)` and `scale(1.015)`
 * and zeroes every duration under `prefers-reduced-motion`; the site sheets own
 * those rules, because they own every transition.
 */
export const FOUNDATION_MOTION: readonly {
  readonly token: string;
  readonly value: string;
  readonly use: string;
}[] = freezeAll([
  { token: "--motion-fast", value: "120ms", use: "colour, background, border, opacity, box-shadow" },
  { token: "--motion-base", value: "200ms", use: "transform" },
  { token: "--ease-standard", value: "cubic-bezier(0.2, 0, 0, 1)", use: "the easing for both" },
]);

// ---------------------------------------------------------------------------
// MOTION SYSTEM (redesign 2026-10; DV-F7, DV-F8, carried by port row DV-P1)
// ---------------------------------------------------------------------------

/**
 * One motion-system token. `desktopKey` is the same value's path in the desktop's
 * frozen `MOTION_SYSTEM` table (`apps/desktop-shell/src/visual-tokens.ts`); `null`
 * means the token is sites-only (the desktop never scales, `chrome.test.ts`).
 */
export type FoundationMotionToken = {
  readonly token: string;
  readonly value: string;
  readonly desktopKey: string | null;
  readonly use: string;
};

/**
 * The motion system: "an instrument settling" — a fast start, a long exponential
 * deceleration, no overshoot (`docs/redesign/DIRECTION.md` §6.1).
 *
 * DV-P1: D-4's `FOUNDATION_MOTION` above stays value for value and is still the only
 * motion group `foundationsVariablesCss()` and `foundationsCss()` emit (both are
 * pinned). This group ships beside it, emitted only by `foundationsMotionCss()`,
 * which each site composes next to the sheet it already serves. Site transitions
 * read D-4 (DV-P2); keyframe animations read these tokens.
 *
 * Every row is a recorded decision (DV-F7). Durations stay inside 120–320ms; the
 * only values outside that band are `--motion-duration-loop` and
 * `--motion-delay-loading`, which serve indeterminate progress/pending indicators
 * only (DV-F8, ruling R-1 in `docs/redesign/RULINGS.md`). Only `transform`,
 * `opacity`, `clip-path` and `filter` animate.
 */
export const FOUNDATION_MOTION_SYSTEM: readonly FoundationMotionToken[] = freezeAll([
  { token: "--motion-duration-press", value: "120ms", desktopKey: "duration.press", use: "press-in, focus halo" },
  { token: "--motion-duration-micro", value: "160ms", desktopKey: "duration.micro", use: "hover state layers, press release, arrows, underline" },
  { token: "--motion-duration-state", value: "200ms", desktopKey: "duration.state", use: "chip/tone change, status line, number change, toast" },
  { token: "--motion-duration-panel", value: "280ms", desktopKey: "duration.panel", use: "panel, drawer, dialog, disclosure open; list item enter" },
  { token: "--motion-duration-panel-exit", value: "200ms", desktopKey: "duration.panelExit", use: "every close/exit (exits are faster)" },
  { token: "--motion-duration-route", value: "320ms", desktopKey: "duration.route", use: "route entrance, hero aperture, focal resolution" },
  { token: "--motion-duration-loop", value: "1200ms", desktopKey: "duration.loop", use: "one cycle of an indeterminate progress/pending indicator only (DV-F8, R-1)" },
  { token: "--motion-delay-loading", value: "300ms", desktopKey: "delay.loading", use: "wait before any loading indicator paints (DV-F8, R-1)" },
  { token: "--motion-ease-out-quart", value: "cubic-bezier(0.25, 1, 0.5, 1)", desktopKey: "ease.outQuart", use: "micro feedback, exits, loops" },
  { token: "--motion-ease-out-quint", value: "cubic-bezier(0.22, 1, 0.36, 1)", desktopKey: "ease.outQuint", use: "state and number changes" },
  { token: "--motion-ease-out-expo", value: "cubic-bezier(0.16, 1, 0.3, 1)", desktopKey: "ease.outExpo", use: "panels, routes, focal moments" },
  { token: "--motion-stagger-step", value: "40ms", desktopKey: "stagger.step", use: "per-item delay in a list" },
  { token: "--motion-stagger-max", value: "200ms", desktopKey: "stagger.max", use: "delay cap (item 6+ shares it)" },
  { token: "--motion-distance-sm", value: "4px", desktopKey: "distance.sm", use: "micro nudges, list items, status lines" },
  { token: "--motion-distance-md", value: "8px", desktopKey: "distance.md", use: "route content, dialogs" },
  { token: "--motion-distance-lg", value: "16px", desktopKey: "distance.lg", use: "drawer content, hero copy" },
  { token: "--motion-scale-press", value: "0.97", desktopKey: null, use: "pressed controls on Kids and the web shell (DV-P3: not on the umbrella or the storefronts)" },
  { token: "--motion-scale-enter", value: "0.98", desktopKey: null, use: "Kids pieces only" },
]);

/**
 * What `prefers-reduced-motion: reduce` sets. Every rule is written against these
 * tokens, so reduced motion removes movement while opacity, colour and state still
 * change.
 */
export const FOUNDATION_MOTION_SYSTEM_REDUCED: readonly { readonly token: string; readonly value: string }[] =
  freezeAll([
    { token: "--motion-distance-sm", value: "0px" },
    { token: "--motion-distance-md", value: "0px" },
    { token: "--motion-distance-lg", value: "0px" },
    { token: "--motion-scale-press", value: "1" },
    { token: "--motion-scale-enter", value: "1" },
    { token: "--motion-stagger-step", value: "0ms" },
  ]);

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
    lines.push(`  --${radius.token}: ${`${radius.px}px`};`);
  }

  lines.push(`  --font-ui: ${FOUNDATION_FONT_STACKS.archivo};`);
  lines.push(`  --font-mono: ${FOUNDATION_FONT_STACKS.mono};`);

  for (const step of FOUNDATION_TYPE_SCALE) {
    lines.push(`  --type-${step.token}-size: ${`${step.sizePx}px`};`);
    lines.push(`  --type-${step.token}-weight: ${step.weight};`);

    if (step.letterSpacingEm !== undefined) {
      lines.push(`  --type-${step.token}-tracking: ${`${step.letterSpacingEm}em`};`);
    }
  }

  for (const surface of FOUNDATION_SURFACES) {
    lines.push(`  --surface-${surface.id}-bg: ${surface.bg};`);
    lines.push(`  --surface-${surface.id}-line: ${surface.line};`);
    lines.push(`  --surface-${surface.id}-shadow: ${surface.shadow};`);
  }

  for (const motion of FOUNDATION_MOTION) lines.push(`  ${motion.token}: ${motion.value};`);

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
 * near-black canvas, Archivo body text, the selection wash (v6 pending yellow), and
 * the hairline scrollbar.
 *
 * v6 (DIRECTION §2.5): the global `a:hover { color: var(--accent-hi); }` rule is
 * deleted. At (0,1,1) it out-specified every single-class button that was also an
 * `<a>` and repainted its label in the button's own fill (1.20:1, BASELINE defect 1).
 * The link rule is now zero-specificity `:where()`, and hover changes only the
 * underline, never the ink.
 *
 * Plus the redesign's reduced-motion override (DV-P1): distances 0, scales 1, no
 * stagger. It is written on one line on purpose, so the D-4 line pin (only lines
 * that start with `--motion-`/`--ease-`) still sees exactly the three D-4 tokens.
 */
export function foundationsBaseCss(): string {
  const reduced = FOUNDATION_MOTION_SYSTEM_REDUCED.map((entry) => `${entry.token}: ${entry.value};`).join(" ");

  return [
    "html, body { margin: 0; padding: 0; background: var(--bg-base); }",
    "body { font-family: var(--font-ui); color: var(--fg); -webkit-font-smoothing: antialiased; }",
    "* { box-sizing: border-box; }",
    ":where(a) { color: var(--accent); text-decoration: none; }",
    ":where(a:not([class])) { text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.24em; }",
    ":where(a:not([class]):hover) { text-decoration-thickness: 3px; }",
    "::selection { background: rgba(242, 194, 48, 0.3); }",
    "::-webkit-scrollbar { width: 11px; }",
    "::-webkit-scrollbar-track { background: var(--bg-base); }",
    "::-webkit-scrollbar-thumb { background: #20262E; border: 3px solid var(--bg-base); border-radius: 6px; }",
    `@media (prefers-reduced-motion: reduce) { :root { ${reduced} } }`,
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

/**
 * The motion layer a site composes beside `foundationsCss()` (DV-P1): the §6.1
 * custom properties in their own `:root` block, five one-shot keyframes and the R-1
 * progress loop (`sx-progress`, indeterminate indicators only) that a site's own
 * rules may reference, and the reduced-motion token overrides (distances 0, scales
 * 1, no stagger).
 *
 * The keyframes move only `opacity`, `transform` and `clip-path` and set no resting
 * style, so content is never hidden before they run. A site that pins a blanket
 * `animation-duration: .001ms` kill keeps its own block first; this one only removes
 * distance. Declarations are one per line, like `foundationsVariablesCss()`, so a
 * site's "every token I read is emitted" scan finds them. The D-4 line pins apply to
 * `foundationsVariablesCss()` and `foundationsCss()` only, which this never enters.
 */
export function foundationsMotionCss(): string {
  const declare = (entries: readonly { readonly token: string; readonly value: string }[], indent: string): string =>
    entries.map((entry) => `${indent}${entry.token}: ${entry.value};`).join("\n");

  return [
    "/* SceneAxi motion system (redesign 2026-10, DV-P1) — generated by @sceneaxi/site-kit. */",
    SIGNAL_LAYER_ORDER,
    "@layer tokens {",
    `:root {\n${declare(FOUNDATION_MOTION_SYSTEM, "  ")}\n}`,
    "@keyframes sx-fade { from { opacity: 0; } }",
    "@keyframes sx-rise-sm { from { opacity: 0; transform: translateY(var(--motion-distance-sm)); } }",
    "@keyframes sx-rise-md { from { opacity: 0; transform: translateY(var(--motion-distance-md)); } }",
    "@keyframes sx-rise-lg { from { opacity: 0; transform: translateY(var(--motion-distance-lg)); } }",
    "@keyframes sx-draw { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }",
    "@keyframes sx-progress { from { transform: translateX(-100%); } to { transform: translateX(100%); } }",
    `@media (prefers-reduced-motion: reduce) {\n  :root {\n${declare(FOUNDATION_MOTION_SYSTEM_REDUCED, "    ")}\n  }\n}`,
    "}",
    "",
  ].join("\n");
}

/** Status chip classes for the published status vocabulary. */
export function foundationsStatusCss(): string {
  const base =
    ".sx-status { display: inline-flex; align-items: center; gap: var(--space-2); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.08em; line-height: 1.4; }\n" +
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
 * Every part sits in its cascade layer (`SIGNAL_LAYER_ORDER`), so a site's unlayered
 * rules always win; declarations are not re-indented, so the line pins still match.
 */
export function foundationsCss(options: FoundationsCssOptions = {}): SiteResult<string> {
  const variables = foundationsVariablesCss(options);

  if (!variables.ok) return variables;

  return ok(
    [
      `/* SceneAxi Foundations ${FOUNDATIONS_VERSION} — generated by @sceneaxi/site-kit. */`,
      SIGNAL_LAYER_ORDER,
      "@layer tokens {",
      variables.value,
      "}",
      "@layer base {",
      foundationsBaseCss(),
      "}",
      "@layer components {",
      foundationsSurfacesCss(),
      foundationsStatusCss(),
      "}",
      "",
    ].join("\n"),
  );
}

// ===========================================================================
// v6 "INTERLOCKING" — the signal-box token layer (docs/redesign-v6/DIRECTION.md)
// ===========================================================================

/** The one cascade-layer order every shared emitter declares first. */
export const SIGNAL_LAYER_ORDER = "@layer reset, tokens, base, components, utilities;" as const;

/** Design-system revision of the v6 layer. */
export const SIGNAL_VERSION = "v6-interlocking" as const;

export type SignalScheme = "dark" | "light";

/**
 * One colour token with its value in each scheme. Persuade surfaces serve dark only;
 * Operate surfaces (web shell, desktop, account) follow the system scheme (§5.3).
 * Paints (pending, verified, refused, stale) are identical in both schemes.
 */
export type SignalColor = {
  readonly token: string;
  readonly dark: string;
  readonly light: string;
  readonly use: string;
};

/** DIRECTION §5.1–5.4. Nothing here is invented: each hex is in the locked tables. */
export const SIGNAL_COLORS: readonly SignalColor[] = freezeAll([
  // Materials (§8): elevation comes from the material, never from shadow.
  { token: "--panel", dark: "#2F4A44", light: "#E7E9E3", use: "level 0 diagram panel, the page field" },
  { token: "--panel-band", dark: "#27403A", light: "#F4F4EF", use: "level 1 alternating sections, route strips" },
  { token: "--iron", dark: "#1E2B28", light: "#FBFBF8", use: "level 2 cast-iron frame: interlocks, acquire block, note box" },
  { token: "--iron-raised", dark: "#263632", light: "#EEEFEA", use: "level 3 lever row, decision block, table head" },
  { token: "--well", dark: "#182320", light: "#FFFFFF", use: "inputs, lever slots, code wells" },
  // Ink and lines.
  { token: "--ink", dark: "#F1EEE4", light: "#17221F", use: "primary text" },
  { token: "--ink-2", dark: "#BCD0C9", light: "#3F5550", use: "secondary text; the lowest body text in the system" },
  { token: "--edge", dark: "#86A39B", light: "#6B807A", use: "control and region boundary (>= 3:1)" },
  { token: "--rule", dark: "#4E6B64", light: "#C4CDC8", use: "decoration only; never the sole boundary" },
  { token: "--siding", dark: "#7F9A93", light: "#6B807A", use: "scrollbar thumb, inactive track (UI only)" },
  { token: "--track", dark: "#E9E6DC", light: "#17221F", use: "the Change Review route line" },
  // Enamel: the primary action, the default plate, the focus ring.
  { token: "--enamel", dark: "#F1EEE4", light: "#17221F", use: "primary button fill, default plate" },
  { token: "--enamel-hi", dark: "#FFFFFF", light: "#000000", use: "primary button hover fill" },
  { token: "--on-enamel", dark: "#1A2623", light: "#FFFFFF", use: "ink on enamel in every state" },
  { token: "--focus", dark: "#F1EEE4", light: "#17221F", use: "3px focus ring, offset 3px" },
  { token: "--disabled-ink", dark: "#BCD0C9", light: "#3F5550", use: "disabled label (>= 4.5:1; dashed edge carries the state)" },
  // Lever paints (§5.2) — always with plate label + icon.
  { token: "--pending", dark: "#F2C230", light: "#F2C230", use: "pending plate paint, selection wash" },
  { token: "--on-pending", dark: "#1A2623", light: "#1A2623", use: "ink on pending" },
  { token: "--pending-ink", dark: "#F2C230", light: "#6B5000", use: "pending as text on a surface" },
  { token: "--route", dark: "#F2C230", light: "#9A7400", use: "pending route line (UI only)" },
  { token: "--verified", dark: "#7BDDB0", light: "#7BDDB0", use: "verified plate paint; never on a button" },
  { token: "--on-verified", dark: "#12241E", light: "#12241E", use: "ink on verified" },
  { token: "--verified-route", dark: "#7BDDB0", light: "#1F8A5A", use: "verified route line (UI only)" },
  { token: "--refused", dark: "#C4362C", light: "#C4362C", use: "refused plate paint; never text on dark, never a shape on --panel" },
  { token: "--on-refused", dark: "#FFFFFF", light: "#FFFFFF", use: "ink on refused" },
  { token: "--refused-lamp", dark: "#FF9A8C", light: "#A62A21", use: "refusal text on iron, raised, well" },
  { token: "--refused-lamp-hi", dark: "#FFB3A8", light: "#A62A21", use: "refusal text directly on --panel" },
  { token: "--stale", dark: "#A3A9A4", light: "#A3A9A4", use: "superseded / outcome-unknown plate paint" },
  { token: "--on-stale", dark: "#1A2623", light: "#1A2623", use: "ink on stale" },
  // A-rich (concepts/a-rich/SPEC-DELTA.md §2): lunar, the second accent. Exclusive INSPECT role:
  // the difference under review (diff mark, Differs tag, edited leaf station, inspect phase bar).
  // Never a call to action, never a link colour, never decoration.
  { token: "--lunar", dark: "#C4B4FF", light: "#5B3FD0", use: "inspect accent: ring, leaf station, phase bar; text only on the pairs in SIGNAL_PAIRS" },
  { token: "--on-lunar", dark: "#16112E", light: "#FFFFFF", use: "ink on a lunar fill (Differs tag)" },
  { token: "--lunar-deep", dark: "#5D4FA8", light: "#C4B4FF", use: "lunar as ink on the enamel plaque" },
  { token: "--lunar-mark", dark: "#C4B4FF", light: "#E4DCFF", use: "diff <mark> fill in Change Review" },
  { token: "--on-lunar-mark", dark: "#16112E", light: "#17221F", use: "ink on the diff mark" },
  // A-rich §2: yellow stays the COMMIT signal (Accept = the write awaiting a person's throw).
  { token: "--commit", dark: "#F2C230", light: "#F2C230", use: "Accept fill; the same paint as --pending" },
  { token: "--on-commit", dark: "#1A2623", light: "#1A2623", use: "ink on Accept in every state" },
  { token: "--commit-hi", dark: "#FFD45A", light: "#FFD45A", use: "Accept hover fill" },
  { token: "--commit-edge", dark: "#F2C230", light: "#7A5C00", use: "Accept 2px boundary (light: the fill alone is 1.68 on well)" },
  // A-rich §3: planes. Depth = lightness step + offset shadow (SIGNAL_ELEVATION), never glow or blur.
  { token: "--bed", dark: "#141C1A", light: "#DFE3DC", use: "level -1 recessed bed: capture band, image mats, docks, route strip" },
  { token: "--plate", dark: "#395A53", light: "#FFFFFF", use: "level +1 raised plate: spec rows, legend, decision, record" },
  { token: "--hair", dark: "#9AB8B0", light: "#6B807A", use: "hairline that bounds a plane (>= 3:1 on every plane it touches)" },
  { token: "--ink-2-plate", dark: "#D2E2DC", light: "#3F5550", use: "secondary text on the raised plate (--ink-2 is 4.71 there)" },
  { token: "--enamel-ink-2", dark: "#3F5550", light: "#BCD0C9", use: "secondary text on the enamel plaque" },
  { token: "--enamel-rule", dark: "#4E6B64", light: "#86A39B", use: "hairline on the enamel plaque" },
  { token: "--enamel-focus", dark: "#1A2623", light: "#FFFFFF", use: "focus ring on the enamel plaque (--focus is 1:1 there)" },
]);

export type SignalPairRole = "text" | "ui";

/**
 * One measured foreground/background pair. `min` is the floor the gate measures:
 * 4.5 for text, 3 for UI boundaries and route paints, higher where DIRECTION sets a
 * stricter target (refusal text >= 5.5, G2 must-fix 2). A token pair absent from this
 * table is not a sanctioned combination.
 */
export type SignalPair = {
  readonly fg: string;
  readonly bg: string;
  readonly role: SignalPairRole;
  readonly min: number;
  readonly schemes: readonly SignalScheme[];
  /**
   * Set when a token that is text elsewhere measures under 4.5:1 on this background:
   * the pair is sanctioned for UI and large shapes only, never for body text. The
   * string says why.
   */
  readonly uiOnly?: string;
};

const BOTH: readonly SignalScheme[] = Object.freeze(["dark", "light"]);

const DARK: readonly SignalScheme[] = Object.freeze(["dark"]);

const LIGHT: readonly SignalScheme[] = Object.freeze(["light"]);

const textPair = (fg: string, bg: string, min = 4.5, schemes = BOTH): SignalPair => ({ fg, bg, role: "text", min, schemes });

const uiPair = (fg: string, bg: string, schemes = BOTH): SignalPair => ({ fg, bg, role: "ui", min: 3, schemes });

const uiOnlyPair = (fg: string, bg: string, schemes: readonly SignalScheme[], uiOnly: string): SignalPair => ({ fg, bg, role: "ui", min: 3, schemes, uiOnly });

const SURFACE_TOKENS = ["--panel", "--panel-band", "--iron", "--iron-raised", "--well"] as const;

/** Every plane a hairline may bound (A-rich §3): the five materials plus bed and plate. */
const PLANE_TOKENS = [...SURFACE_TOKENS, "--bed", "--plate"] as const;

/** Every sanctioned pair. The test and the swatch page measure each one in both schemes. */
export const SIGNAL_PAIRS: readonly SignalPair[] = freezeAll([
  ...SURFACE_TOKENS.flatMap((bg) => [textPair("--ink", bg), textPair("--ink-2", bg), uiPair("--edge", bg), uiPair("--focus", bg)]),
  // Buttons declare their ink in every state (§2.5): default, hover, focus, active, disabled.
  textPair("--on-enamel", "--enamel"),
  textPair("--on-enamel", "--enamel-hi"),
  textPair("--disabled-ink", "--iron-raised"),
  textPair("--disabled-ink", "--iron"),
  // Plates: paint + on-paint ink.
  textPair("--on-pending", "--pending"),
  textPair("--on-verified", "--verified"),
  textPair("--on-refused", "--refused"),
  textPair("--on-stale", "--stale"),
  // Refusal text (G2 must-fix 2: >= 5.5 browser-computed).
  textPair("--refused-lamp", "--iron", 5.5),
  textPair("--refused-lamp", "--iron-raised", 5.5),
  textPair("--refused-lamp", "--well", 5.5),
  textPair("--refused-lamp-hi", "--panel", 5.5),
  textPair("--pending-ink", "--panel"),
  textPair("--pending-ink", "--iron"),
  // Route paints and siding as UI.
  uiPair("--route", "--panel"),
  uiPair("--route", "--iron"),
  uiPair("--verified-route", "--iron"),
  uiPair("--siding", "--iron"),
  uiPair("--siding", "--panel", DARK),
  uiPair("--track", "--panel-band"),
  // A-rich planes (SPEC-DELTA §3). Bed takes the surface set; the plate swaps ink-2 and edge for
  // its own ink-2-plate and hair (ink-2 4.71, edge 2.80 there in dark).
  textPair("--ink", "--bed"),
  textPair("--ink-2", "--bed"),
  uiPair("--edge", "--bed"),
  uiPair("--focus", "--bed"),
  textPair("--ink", "--plate"),
  textPair("--ink-2-plate", "--plate"),
  uiPair("--focus", "--plate"),
  ...PLANE_TOKENS.map((bg) => uiPair("--hair", bg)),
  // Enamel plaque (level +2).
  textPair("--enamel-ink-2", "--enamel"),
  uiPair("--enamel-rule", "--enamel"),
  uiPair("--enamel-focus", "--enamel"),
  textPair("--lunar-deep", "--enamel"),
  // Lunar: text on every material and the bed; UI only on the raised plate in dark (4.10).
  ...[...SURFACE_TOKENS, "--bed"].map((bg) => textPair("--lunar", bg)),
  textPair("--lunar", "--plate", 4.5, LIGHT),
  uiOnlyPair("--lunar", "--plate", DARK, "4.10:1 in dark: rings, bars and large text only, never body text"),
  textPair("--on-lunar", "--lunar"),
  textPair("--on-lunar-mark", "--lunar-mark"),
  uiPair("--lunar", "--lunar-mark", LIGHT),
  // Commit (Accept): ink in rest and hover; the boundary on every plane Accept sits on.
  textPair("--on-commit", "--commit"),
  textPair("--on-commit", "--commit-hi"),
  ...[...SURFACE_TOKENS, "--plate"].map((bg) => uiPair("--commit-edge", bg)),
]);

/** Resolve a token's hex in one scheme. Throws on an unknown token: a typo is a bug. */
export function signalColor(token: string, scheme: SignalScheme): string {
  const found = SIGNAL_COLORS.find((color) => color.token === token);

  if (found === undefined) throw new Error(`Unknown signal colour token: ${token}`);

  return scheme === "dark" ? found.dark : found.light;
}

/** The measured ratio of one pair in one scheme. */
export function signalPairRatio(pair: SignalPair, scheme: SignalScheme): number {
  return contrastRatio(signalColor(pair.fg, scheme), signalColor(pair.bg, scheme));
}

// --- States: label + icon + paint, never paint alone (§2.1) -----------------

export type SignalStateId = "pending" | "verified" | "refused" | "stale" | "unknown" | "test" | "isolated";

export type SignalIconId = "pending" | "verified" | "refused" | "stale" | "test" | "empty";

export type SignalState = {
  readonly id: SignalStateId;
  /** Short plate text (caps in the plate face). */
  readonly plate: string;
  /** The full product label, e.g. for the Change Review status plate. */
  readonly label: string;
  readonly icon: SignalIconId;
  /** Paint token, or `null` for outline-only plates (TEST, Isolated). */
  readonly paint: string | null;
  /** Ink token on the paint (or on the surface when outline-only). */
  readonly on: string;
};

export const SIGNAL_STATES: readonly SignalState[] = freezeAll([
  { id: "pending", plate: "Pending", label: "Pending review · unwritten", icon: "pending", paint: "--pending", on: "--on-pending" },
  { id: "verified", plate: "Verified", label: "Verified · written", icon: "verified", paint: "--verified", on: "--on-verified" },
  { id: "refused", plate: "Refused", label: "Rejected · nothing written", icon: "refused", paint: "--refused", on: "--on-refused" },
  { id: "stale", plate: "Superseded", label: "Superseded · not actionable", icon: "stale", paint: "--stale", on: "--on-stale" },
  { id: "unknown", plate: "Outcome unknown", label: "Apply outcome pending", icon: "stale", paint: "--stale", on: "--on-stale" },
  { id: "test", plate: "TEST", label: "TEST", icon: "test", paint: null, on: "--ink" },
  { id: "isolated", plate: "Isolated", label: "Isolated", icon: "empty", paint: null, on: "--ink" },
]);

/**
 * The authored icon set: 24px grid, 2px round stroke, `currentColor`, so label + icon
 * survive forced colours. Path data only (circles and rects are written as paths), so
 * any renderer — the neutral tree, React, an inline sprite — draws the same glyph.
 */
export const SIGNAL_ICONS: Readonly<Record<SignalIconId, readonly string[]>> = Object.freeze({
  pending: Object.freeze(["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M12 7v5l3 2"]),
  verified: Object.freeze(["M4 12.5l5 5L20 6.5"]),
  refused: Object.freeze(["M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z", "M8 12h8"]),
  stale: Object.freeze(["M4 12a8 8 0 1 0 2.4-5.7", "M4 4v4h4", "M9 15l6-6"]),
  test: Object.freeze(["M9 3h6", "M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3", "M7.5 15h9"]),
  empty: Object.freeze(["M4 4h16v16H4z"]),
});

/** Resolve a state by id. Throws on an unknown id. */
export function signalState(id: SignalStateId): SignalState {
  const found = SIGNAL_STATES.find((state) => state.id === id);

  if (found === undefined) throw new Error(`Unknown signal state: ${id}`);

  return found;
}

// --- Type, space, radius, faces (§6) ----------------------------------------

export const SIGNAL_FONT_STACKS = Object.freeze({
  plate: '"Big Shoulders Display", "Arial Narrow", sans-serif',
  prose: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
  data: '"Atkinson Hyperlegible Mono", ui-monospace, monospace',
});

/** Seven steps. The 13px floor is for mono data only; the plate face only at >= 15px. */
export const SIGNAL_TYPE_SCALE: readonly { readonly token: string; readonly value: string; readonly use: string }[] = freezeAll([
  { token: "--t-display", value: "clamp(3.5rem, 1.6rem + 6.2vw, 6rem)", use: "Persuade h1, plate face, lh 0.88" },
  { token: "--t-h2", value: "clamp(2rem, 1.4rem + 2vw, 3rem)", use: "section heads, plate face, lh 0.95" },
  { token: "--t-h3", value: "1.5rem", use: "comfortable interlock title, lh 1.05" },
  { token: "--t-lede", value: "1.1875rem", use: "lede, max 34ch" },
  { token: "--t-body", value: "1rem", use: "body (compact 14px, Kids 18px via density)" },
  { token: "--t-plate", value: "0.9375rem", use: "state plates, caps, +0.06em" },
  { token: "--t-small", value: "0.8125rem", use: "mono data only: digests, path segments, compact evidence" },
]);

/**
 * The minimum rendered text size, in px. Enforced, not advised: `signalTypeMinPx()` resolves
 * every scale step and every density text size at module load and throws below it, and the
 * base layer pins `<small>` to it (its UA `smaller` gives 11.67px inside 14px compact body).
 */
export const SIGNAL_TEXT_FLOOR_PX = 13;

/** Smallest px a type-scale value can render at: rem x 16, and a clamp() resolves to its first argument. */
export function signalTypeMinPx(value: string): number {
  const match = /^(?:clamp\(\s*)?([\d.]+)rem\b/.exec(value);

  if (match === null) throw new Error(`Unparseable type step: ${value}`);

  return Number(match[1]) * 16;
}

/** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 / 112 (§9). */
export const SIGNAL_SPACING_PX: readonly number[] = Object.freeze([4, 8, 12, 16, 24, 32, 48, 72, 112]);

export const SIGNAL_RADII = Object.freeze({ cast: "2px", station: "50%" });

// --- Density (§3, §9): chosen by placement, never inherited ----------------

export type SignalDensityId = "comfortable" | "compact" | "kids";

export type SignalDensity = {
  readonly id: SignalDensityId;
  readonly controlPx: number;
  readonly bodyPx: number;
  readonly padBlockPx: number;
  readonly padInlinePx: number;
  readonly gapPx: number;
  readonly titlePx: number;
  readonly evidencePx: number;
  readonly buttonPadPx: number;
  /** Smallest hit target any control may have (WCAG 2.5.8 floor or stricter). */
  readonly targetMinPx: number;
  /** Whether `signalCss()` emits it. Kids imports no package; its copy lives in `sites/kids`. */
  readonly emitted: boolean;
};

export const SIGNAL_DENSITIES: readonly SignalDensity[] = freezeAll([
  { id: "comfortable", controlPx: 44, bodyPx: 16, padBlockPx: 24, padInlinePx: 32, gapPx: 16, titlePx: 24, evidencePx: 14, buttonPadPx: 22, targetMinPx: 24, emitted: true },
  { id: "compact", controlPx: 28, bodyPx: 14, padBlockPx: 12, padInlinePx: 14, gapPx: 8, titlePx: 16, evidencePx: 13, buttonPadPx: 12, targetMinPx: 24, emitted: true },
  { id: "kids", controlPx: 56, bodyPx: 18, padBlockPx: 24, padInlinePx: 32, gapPx: 24, titlePx: 24, evidencePx: 18, buttonPadPx: 28, targetMinPx: 44, emitted: false },
]);

// The 13px floor, enforced at load: a step under it is a build failure, not a review note.
for (const step of SIGNAL_TYPE_SCALE) {
  if (signalTypeMinPx(step.value) < SIGNAL_TEXT_FLOOR_PX) throw new Error(`${step.token} renders under ${String(SIGNAL_TEXT_FLOOR_PX)}px`);
}

for (const density of SIGNAL_DENSITIES) {
  for (const px of [density.bodyPx, density.titlePx, density.evidencePx]) {
    if (px < SIGNAL_TEXT_FLOOR_PX) throw new Error(`${density.id} density sets text under ${String(SIGNAL_TEXT_FLOOR_PX)}px`);
  }
}

const DENSITY_PROPERTIES: readonly (readonly [string, keyof SignalDensity])[] = [
  ["--density-control", "controlPx"],
  ["--density-body", "bodyPx"],
  ["--density-pad-block", "padBlockPx"],
  ["--density-pad-inline", "padInlinePx"],
  ["--density-gap", "gapPx"],
  ["--density-title", "titlePx"],
  ["--density-evidence", "evidencePx"],
  ["--density-button-pad", "buttonPadPx"],
];

// --- Motion (§9): detented, no overshoot; reduced = 0ms ----------------------

export const SIGNAL_MOTION: readonly { readonly token: string; readonly value: string; readonly reduced: string; readonly use: string }[] = freezeAll([
  { token: "--catch", value: "90ms", reduced: "0ms", use: "the hold before commitment (linear)" },
  { token: "--throw", value: "260ms", reduced: "0ms", use: "lever travel, stops dead" },
  { token: "--ease-throw", value: "cubic-bezier(0.16, 1, 0.3, 1)", reduced: "linear", use: "no overshoot, no bounce" },
  { token: "--lamp", value: "360ms", reduced: "0ms", use: "lamps light station by station" },
  { token: "--lamp-steps", value: "steps(6)", reduced: "steps(1)", use: "the lamp timing function" },
  { token: "--settle", value: "420ms", reduced: "0ms", use: "clip-reveal of the after-value (ease-out)" },
  { token: "--state", value: "0ms", reduced: "0ms", use: "plate and colour switches are instant everywhere" },
]);

// --- Elevation (A-rich SPEC-DELTA §3): 4 levels over 6 planes ----------------

/** The three depth shadows. Offset, never glow (no zero-offset spread) and never a blur filter. */
export const SIGNAL_SHADOWS: readonly { readonly token: string; readonly dark: string; readonly light: string; readonly use: string }[] = freezeAll([
  { token: "--sink", dark: "inset 0 2px 0 #00000066, inset 0 0 0 1px #00000040", light: "inset 0 2px 0 #17221F1F", use: "level -1: bed and well are pressed in" },
  { token: "--lift-1", dark: "0 1px 0 #FFFFFF14 inset, 0 14px 24px -14px #000000B3", light: "0 1px 0 #FFFFFF inset, 0 10px 20px -14px #17221F66", use: "level +1: raised plate and cast frame" },
  { token: "--lift-2", dark: "0 1px 0 #FFFFFF inset, 0 28px 48px -24px #000000CC, 0 4px 10px -6px #00000080", light: "0 1px 0 #FFFFFF inset, 0 28px 48px -24px #000000CC, 0 4px 10px -6px #00000080", use: "level +2: enamel plaque; the acquire block on iron" },
]);

export type SignalElevationLevel = -1 | 0 | 1 | 2;

/**
 * Six planes on four levels. Hierarchy reads in greyscale: luminance rises bed < well < iron <
 * panel < plate < enamel, and every plane has a boundary token that is >= 3:1 against it
 * (pinned in `SIGNAL_PAIRS`). `ink2` is the secondary-text token that passes on that plane.
 */
export const SIGNAL_ELEVATION: readonly {
  readonly level: SignalElevationLevel;
  readonly plane: string;
  readonly shadow: string | null;
  readonly boundary: string | null;
  readonly ink: string;
  readonly ink2: string;
  readonly focus: string;
  readonly use: string;
}[] = freezeAll([
  { level: -1, plane: "--bed", shadow: "--sink", boundary: "--hair", ink: "--ink", ink2: "--ink-2", focus: "--focus", use: "capture band, image mats, docks, route strip" },
  { level: -1, plane: "--well", shadow: "--sink", boundary: "--edge", ink: "--ink", ink2: "--ink-2", focus: "--focus", use: "inputs, code wells, wells inside the acquire block" },
  { level: 0, plane: "--panel", shadow: null, boundary: null, ink: "--ink", ink2: "--ink-2", focus: "--focus", use: "the page field (--panel-band alternates at the same level)" },
  { level: 1, plane: "--plate", shadow: "--lift-1", boundary: "--hair", ink: "--ink", ink2: "--ink-2-plate", focus: "--focus", use: "spec rows, legend, decision, record" },
  { level: 1, plane: "--iron", shadow: "--lift-1", boundary: "--edge", ink: "--ink", ink2: "--ink-2", focus: "--focus", use: "capture frames, hero diagram, interlocks, controls (--iron-raised is the inner step)" },
  { level: 2, plane: "--enamel", shadow: "--lift-2", boundary: "--enamel-rule", ink: "--on-enamel", ink2: "--enamel-ink-2", focus: "--enamel-focus", use: "editorial pull plaque" },
]);

// --- Sequence (A-rich SPEC-DELTA §5): propose -> inspect -> commit ------------

/**
 * The three acts of the one authored moment, in ms from `[data-armed]`. The autoplay ends
 * ARMED, never committed: the thrown commit plays only on a person's Accept (or Reject).
 * `still` is the visible label of each frame of the reduced-motion three-still strip.
 */
export const SIGNAL_SEQUENCE_PHASES: readonly {
  readonly id: "propose" | "inspect" | "commit";
  readonly startMs: number;
  readonly endMs: number;
  readonly paint: string;
  readonly still: string;
}[] = freezeAll([
  { id: "propose", startMs: 0, endMs: 900, paint: "--pending", still: "1 · Propose" },
  { id: "inspect", startMs: 1150, endMs: 1900, paint: "--lunar", still: "2 · Inspect" },
  { id: "commit", startMs: 2250, endMs: 2800, paint: "--commit", still: "3 · Commit" },
]);

/** Where the autoplay stops. Product truth: SceneAxi never writes without a person's Accept. */
export const SIGNAL_SEQUENCE_END = "armed" as const;

/** Sequence tokens; emitted beside `SIGNAL_MOTION` and zeroed with it under reduced motion. */
export const SIGNAL_SEQUENCE: readonly { readonly token: string; readonly value: string; readonly reduced: string; readonly use: string }[] = freezeAll([
  { token: "--seq-propose-delay", value: "0ms", reduced: "0ms", use: "propose act starts (yellow phase bar)" },
  { token: "--seq-propose-duration", value: "900ms", reduced: "0ms", use: "propose act: lever, lamps, after-value written" },
  { token: "--seq-inspect-delay", value: "1150ms", reduced: "0ms", use: "inspect act starts (lunar scan gate)" },
  { token: "--seq-inspect-duration", value: "750ms", reduced: "0ms", use: "inspect act: scan, leaf ring to lunar, Differs tag" },
  { token: "--seq-commit-delay", value: "2250ms", reduced: "0ms", use: "commit act starts (armed: hollow edge, Accept painted)" },
  { token: "--seq-commit-duration", value: "550ms", reduced: "0ms", use: "commit act, ending ARMED, never committed" },
  { token: "--seq-bar", value: "280ms", reduced: "0ms", use: "phase bar scaleX in each act" },
  { token: "--seq-scan", value: "760ms", reduced: "0ms", use: "lunar scan gate crosses the readout once" },
  { token: "--seq-stagger", value: "80ms", reduced: "0ms", use: "step between diff marks or rows revealed in turn" },
  { token: "--seq-ease", value: "cubic-bezier(0.16, 1, 0.3, 1)", reduced: "linear", use: "every sequence move: no overshoot, no bounce" },
]);

// The phase table and the tokens are one fact written twice; refuse to load if they drift.
for (const phase of SIGNAL_SEQUENCE_PHASES) {
  const delay = SIGNAL_SEQUENCE.find((entry) => entry.token === `--seq-${phase.id}-delay`);
  const duration = SIGNAL_SEQUENCE.find((entry) => entry.token === `--seq-${phase.id}-duration`);

  if (delay?.value !== `${String(phase.startMs)}ms` || duration?.value !== `${String(phase.endMs - phase.startMs)}ms`) {
    throw new Error(`sequence tokens drift from phase ${phase.id}`);
  }
}

// --- Store token block (§5.6): the only Forge / Vitrine difference ---------

export type SignalStoreId = "forge" | "vitrine";

export const SIGNAL_STORES: readonly { readonly id: SignalStoreId; readonly plate: string; readonly markRadius: string }[] = freezeAll([
  { id: "forge", plate: "#D9A066", markRadius: "1px" },
  { id: "vitrine", plate: "#9DBBF2", markRadius: "50%" },
]);

/** The store block alone. `catalog-game` and `catalog-web` CSS differ only in this. */
export function signalStoreBlockCss(store: SignalStoreId): string {
  const found = SIGNAL_STORES.find((entry) => entry.id === store);

  if (found === undefined) throw new Error(`Unknown store: ${store}`);

  return `[data-store="${found.id}"] { --store-plate: ${found.plate}; --store-mark-radius: ${found.markRadius}; }`;
}

// --- Emission ---------------------------------------------------------------

/**
 * The yellow PENDING plate as one inseparable pair (G4 ruling): commit-yellow fill + on-commit
 * ink + a 1px `--commit-edge` boundary line. In light the fill alone is 1.37:1 on `--panel`
 * (fails WCAG 1.4.11), so the line (5.11:1 on `--panel`) is what makes the plate a plate; in
 * dark the edge is the fill itself (yellow on dark planes passes on its own). Forced colours
 * drop paint and box-shadow, so the class carries a system border there too. Any element may
 * take `.sx-plate--pending`; `.sx-plate[data-state="pending"]` resolves to the same rule.
 */
export const SIGNAL_PENDING_PLATE = Object.freeze({
  className: "sx-plate--pending",
  fill: "--commit",
  ink: "--on-commit",
  line: "--commit-edge",
  lineWidthPx: 1,
});

/**
 * The pending pair as plain CSS, unlayered: `signalCss()` wraps it in `@layer components`; the
 * Operate snapshot (`OPERATE_PENDING_PLATE_CSS` in apps/web-shell/src/operate-tokens.ts) inlines
 * this exact string after its own base plate rule.
 */
export function signalPendingPlateCss(): string {
  const { className, fill, ink, line, lineWidthPx } = SIGNAL_PENDING_PLATE;

  return [
    `.${className}, .sx-plate[data-state="pending"] { background: var(${fill}); color: var(${ink}); box-shadow: inset 0 0 0 ${String(lineWidthPx)}px var(${line}); }`,
    `@media (forced-colors: active) { .${className}, .sx-plate[data-state="pending"] { border: 1px solid CanvasText; } }`,
  ].join("\n");
}

export type SignalCssOptions = {
  /** `dark` (Persuade, the default) or `system` (Operate: follows prefers-color-scheme). */
  readonly scheme?: "dark" | "system";
  /** Appends the one store token block (storefronts only). */
  readonly store?: SignalStoreId;
  /** Refused by name: Kids imports no package and is never themed from here. */
  readonly surface?: string;
};

const schemeDeclarations = (scheme: SignalScheme, indent: string): string =>
  [...SIGNAL_COLORS, ...SIGNAL_SHADOWS].map((color) => `${indent}${color.token}: ${scheme === "dark" ? color.dark : color.light};`).join("\n");

/** Motion then sequence, one list: both are emitted in :root and zeroed together under reduce. */
const TIMING = [...SIGNAL_MOTION, ...SIGNAL_SEQUENCE];

const densityDeclarations = (density: SignalDensity): string =>
  DENSITY_PROPERTIES.map(([property, key]) => `${property}: ${String(density[key])}px;`).join(" ");

const ICON_RULE = "fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;";

/**
 * The v6 shared sheet, in `SIGNAL_LAYER_ORDER`.
 *
 * Guarantees, each pinned in the test:
 * - no rule in this sheet sets `color` under `:hover` except the button's own `--b-ink`;
 * - links never change ink (hover thickens the underline only), at zero specificity;
 * - every button declares `--b-ink` for default, hover, focus, active and disabled;
 * - state plates carry paint + on-paint ink; the icon and label are in the markup;
 * - density is set on the element that declares `data-density`, never by a global `.state`;
 * - `prefers-reduced-motion: reduce` zeroes every motion token and kills animation.
 */
export function signalCss(options: SignalCssOptions = {}): SiteResult<string> {
  if (options.surface === "kids") return refuse("KIDS_SURFACE_DENIED");

  const scheme = options.scheme ?? "dark";
  const emitted = SIGNAL_DENSITIES.filter((density) => density.emitted);
  const comfortable = emitted.find((density) => density.id === "comfortable");

  if (comfortable === undefined) throw new Error("comfortable density missing");

  const root = [
    `  color-scheme: ${scheme === "dark" ? "dark" : "light dark"};`,
    schemeDeclarations("dark", "  "),
    `  --font-plate: ${SIGNAL_FONT_STACKS.plate};`,
    `  --font-prose: ${SIGNAL_FONT_STACKS.prose};`,
    `  --font-data: ${SIGNAL_FONT_STACKS.data};`,
    ...SIGNAL_TYPE_SCALE.map((step) => `  ${step.token}: ${step.value};`),
    ...SIGNAL_SPACING_PX.map((px) => `  --sp-${String(px)}: ${String(px)}px;`),
    `  --radius-cast: ${SIGNAL_RADII.cast};`,
    `  --radius-station: ${SIGNAL_RADII.station};`,
    `  --t-floor: ${String(SIGNAL_TEXT_FLOOR_PX / 16)}rem;`,
    ...TIMING.map((motion) => `  ${motion.token}: ${motion.value};`),
  ].join("\n");

  const tokens = [
    "@layer tokens {",
    `:root {\n${root}\n}`,
    `:root, [data-density="comfortable"] { ${densityDeclarations(comfortable)} }`,
    ...emitted.flatMap((density) =>
      density.id === "comfortable" ? [] : [`[data-density="${density.id}"] { ${densityDeclarations(density)} }`],
    ),
    ...(scheme === "system" ? [`@media (prefers-color-scheme: light) {\n  :root {\n${schemeDeclarations("light", "    ")}\n  }\n}`] : []),
    `@media (prefers-reduced-motion: reduce) { :root { ${TIMING.map((motion) => `${motion.token}: ${motion.reduced};`).join(" ")} } }`,
    ...(options.store === undefined ? [] : [signalStoreBlockCss(options.store)]),
    "}",
  ];

  const reset = [
    "@layer reset {",
    "*, *::before, *::after { box-sizing: border-box; }",
    "html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }",
    "body { margin: 0; }",
    ":where(img, svg, video, canvas) { display: block; max-width: 100%; }",
    ":where(button, input, select, textarea) { font: inherit; }",
    "@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; } }",
    "}",
  ];

  const base = [
    "@layer base {",
    "html { background: var(--panel); color: var(--ink); font: 400 var(--t-body)/1.55 var(--font-prose); font-variant-numeric: tabular-nums; scrollbar-color: var(--siding) var(--iron); }",
    ":where(h1, h2, h3) { text-wrap: balance; }",
    ":where(p) { text-wrap: pretty; }",
    ":where(code, kbd, samp, pre) { font-family: var(--font-data); }",
    ":where(small) { font-size: max(var(--t-floor), 0.8em); }",
    ":where(a) { color: inherit; text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.24em; }",
    ":where(a:hover) { text-decoration-thickness: 3px; }",
    ":focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }",
    "::selection { background: var(--pending); color: var(--on-pending); }",
    "}",
  ];

  const components = [
    "@layer components {",
    // Buttons: ink is declared, never inherited from a link rule.
    ".sx-btn { --b-bg: var(--enamel); --b-ink: var(--on-enamel); --b-edge: var(--enamel); display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-8); min-height: var(--density-control); min-width: 24px; padding: 0 var(--density-button-pad); font: 700 var(--density-body)/1 var(--font-prose); color: var(--b-ink); background: var(--b-bg); border: 2px solid var(--b-edge); border-radius: var(--radius-cast); text-decoration: none; cursor: pointer; transition: background-color var(--catch) linear, transform var(--catch) linear; }",
    ".sx-btn:is(:link, :visited, :hover, :focus-visible, :active) { color: var(--b-ink); text-decoration: none; }",
    ".sx-btn:hover { --b-bg: var(--enamel-hi); --b-edge: var(--enamel-hi); }",
    ".sx-btn:active { transform: translateY(2px); }",
    ".sx-btn[data-variant=\"quiet\"] { --b-bg: transparent; --b-ink: var(--ink); --b-edge: var(--edge); }",
    ".sx-btn[data-variant=\"quiet\"]:hover { --b-bg: var(--iron); --b-edge: var(--enamel); }",
    ".sx-btn:is(:disabled, [aria-disabled=\"true\"]), .sx-btn:is(:disabled, [aria-disabled=\"true\"]):is(:hover, :active) { --b-bg: var(--iron-raised); --b-ink: var(--disabled-ink); --b-edge: var(--edge); border-style: dashed; cursor: not-allowed; transform: none; }",
    // Plates: label + icon + paint.
    ".sx-plate { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px 3px 7px; border-radius: var(--radius-cast); font: 700 var(--t-plate)/1.2 var(--font-plate); letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; background: var(--enamel); color: var(--on-enamel); }",
    `.sx-icon { width: 18px; height: 18px; flex: none; ${ICON_RULE} }`,
    ...SIGNAL_STATES.flatMap((state) =>
      state.id === "pending"
        ? []
        : [
            state.paint === null
              ? `.sx-plate[data-state="${state.id}"] { background: transparent; color: var(${state.on}); box-shadow: inset 0 0 0 2px var(--edge); }`
              : `.sx-plate[data-state="${state.id}"] { background: var(${state.paint}); color: var(${state.on}); }`,
          ],
    ),
    // Pending: fill and boundary line ship together, never the fill alone.
    signalPendingPlateCss(),
    // Interlock (state / refusal panel): density comes from its own data-density.
    ".sx-interlock { display: grid; gap: var(--density-gap); padding: var(--density-pad-block) var(--density-pad-inline); background: var(--iron); color: var(--ink); border: 1px solid var(--edge); border-radius: var(--radius-cast); font-size: var(--density-body); line-height: 1.5; }",
    ".sx-interlock-head { display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-8); }",
    ".sx-interlock[data-density=\"compact\"] .sx-interlock-head { flex-direction: row; align-items: center; flex-wrap: wrap; }",
    ".sx-interlock :is(h2, h3) { margin: 0; font: 700 var(--density-title)/1.1 var(--font-plate); letter-spacing: 0.02em; }",
    ".sx-interlock[data-density=\"compact\"] :is(h2, h3) { font-family: var(--font-prose); }",
    ".sx-interlock-reason { font: 400 var(--density-evidence)/1.4 var(--font-data); color: var(--ink-2); overflow-wrap: anywhere; }",
    ".sx-interlock[data-state=\"refused\"] .sx-interlock-reason { color: var(--refused-lamp); }",
    ".sx-interlock-evidence { display: grid; grid-template-columns: max-content 1fr; gap: var(--sp-4) var(--sp-12); margin: 0; font: 400 var(--density-evidence)/1.4 var(--font-data); color: var(--ink-2); }",
    ".sx-interlock-evidence dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }",
    "@media (forced-colors: active) { .sx-plate, .sx-interlock { border: 1px solid CanvasText; } .sx-btn { border-color: ButtonText; } .sx-icon { stroke: CanvasText; } }",
    "}",
  ];

  const utilities = [
    "@layer utilities {",
    ".sx-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }",
    "}",
  ];

  return ok(
    [
      `/* SceneAxi ${SIGNAL_VERSION} — generated by @sceneaxi/site-kit. */`,
      SIGNAL_LAYER_ORDER,
      ...reset,
      ...tokens,
      ...base,
      ...components,
      ...utilities,
      "",
    ].join("\n"),
  );
}

/**
 * The Operate dialect's custom properties (web shell, desktop, account) as three plain rules:
 * every colour and depth token at `:root` in dark, the tokens that differ in light under
 * `prefers-color-scheme: light` (paints shared by both schemes are emitted once), the three
 * faces, and the motion tokens, zeroed under reduced motion. No layer, no selector beyond
 * `:root`: a self-contained page (CSP `default-src 'none'`, no bundler) inlines it as-is.
 * Packages that may not import site-kit keep a generated snapshot of this exact string
 * (apps/web-shell/src/operate-tokens.ts); the site-kit test fails when the snapshot drifts.
 */
export function operateCssVars(): string {
  const rows = [...SIGNAL_COLORS, ...SIGNAL_SHADOWS];
  const declare = (pairs: readonly (readonly [string, string])[]): string => pairs.map(([token, value]) => `${token}: ${value};`).join(" ");

  const faces = declare([
    ["--font-plate", SIGNAL_FONT_STACKS.plate],
    ["--font-prose", SIGNAL_FONT_STACKS.prose],
    ["--font-data", SIGNAL_FONT_STACKS.data],
  ]);

  return [
    `:root { color-scheme: light dark; ${faces} ${declare(SIGNAL_MOTION.map((m) => [m.token, m.value]))} ${declare(rows.map((row) => [row.token, row.dark]))} }`,
    `@media (prefers-color-scheme: light) { :root { ${declare(rows.flatMap((row) => (row.light === row.dark ? [] : [[row.token, row.light] as const])))} } }`,
    `@media (prefers-reduced-motion: reduce) { :root { ${declare(SIGNAL_MOTION.map((m) => [m.token, m.reduced]))} } }`,
  ].join("\n");
}
