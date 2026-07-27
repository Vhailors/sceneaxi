/**
 * Engine Desktop visual tokens — the accepted archive surface, held as data.
 *
 * Provenance: `SceneAxi Design System.zip`
 * (sha256 `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`),
 * member `Engine Desktop.dc.html`. `Engine Desktop v1.dc.html` in the same
 * archive is **superseded and reference-only**: its amber accent, Space Grotesk
 * / IBM Plex typography, 2064x1400 canvas, and project-launcher screen model do
 * not appear here and must not be reintroduced (see `SUPERSEDED_V1`).
 *
 * Two rules this module exists to keep:
 *
 * 1. **Non-text values are the archive's, verbatim.** Surfaces, lines, rails,
 *    chips, and bars are copied and are asserted against the archive digits by
 *    `test/visual-tokens.test.ts`. A "nearly right" surface colour is drift.
 * 2. **Text values are contrast-checked, and where the archive fails WCAG they
 *    are raised here rather than in a renderer.** The archive's four dim greys
 *    (`#6E7681` 4.36:1 down to `#333A42` 1.74:1) do not reach 4.5:1 on the
 *    surfaces they are used on, so they collapse into two passing tiers
 *    (`dim`, `faint`). That is a deliberate, recorded deviation — `DEVIATIONS`
 *    names each one, and `test/visual-tokens.test.ts` recomputes the ratio of
 *    every text token against every surface so the floor cannot be lowered by
 *    editing a hex digit.
 *
 * No DOM, no `node:*`: this package's `src` is type-checked with `lib: es2023`
 * and `types: ["node"]` only, and the chrome renderer is a string builder.
 */

/** The canonical archive this surface is implemented from. */
export const VISUAL_SOURCE = Object.freeze({
  archive: "SceneAxi Design System.zip",
  sha256: "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
  member: "Engine Desktop.dc.html",
  syncedAt: "2026-07-25T12:40:00Z",
});

/**
 * What `Engine Desktop v1.dc.html` carried that this surface must never adopt.
 * Kept as data so a review slip is a failing assertion, not a judgement call —
 * the same shape `LIVE_OPEN_PRESENTATION.retiredLabels` uses in `site-kit`.
 */
export const SUPERSEDED_V1 = Object.freeze({
  member: "Engine Desktop v1.dc.html",
  status: "superseded — reference only",
  /** Values from v1 that must not appear in this surface's output. */
  retiredValues: Object.freeze([
    "#F5A524", // amber accent, replaced by signal orange #FF6B2C
    "#FFC24D", // amber hover
    "Space Grotesk",
    "IBM Plex Sans",
  ] as const),
  /**
   * v1 modelled a project launcher (project list, profile cards, offline
   * capability panel) and had no mode rail, no assistant, no command palette,
   * and no profile switch. The current archive is one stateful editor with the
   * seven-mode rail this package implements.
   */
  retiredModel: "project-launcher storyboard without a mode rail",
});

/**
 * Surfaces and lines, copied from the archive. Non-text: not contrast-gated.
 */
export const SURFACE = Object.freeze({
  /** Page behind the scaled stage. */
  backdrop: "#050607",
  /** Editor body and viewport base. */
  canvas: "#07080A",
  /** Deepest inset wells (inputs, console, footers). */
  well: "#08090B",
  /** Assistant column. */
  assistant: "#0A0C0E",
  /** Docked panels: left dock, inspector, bottom dock. */
  panel: "#0D0F12",
  /** Overlay dialogs and the command palette. */
  overlay: "#0F1216",
  /** Raised rows and cards inside a panel. */
  raised: "#101318",
  /** Panel section headers and chrome chips. */
  header: "#12151A",
  /** Hover / selected chrome. */
  hover: "#191D23",
});

export const LINE = Object.freeze({
  /** Structural borders between regions. */
  strong: "#1A1F26",
  /** Card and control borders. */
  card: "#1C2129",
  /** Row separators inside a scrolling panel. */
  row: "#14181E",
  /** Control borders and dividers. */
  control: "#20262E",
  /** Emphasised control border. */
  raised: "#262C34",
  /** Hover border. */
  hover: "#333A44",
});

/** Signal orange — the accepted accent. v1's amber is retired. */
export const ACCENT = Object.freeze({
  base: "#FF6B2C",
  hover: "#FF8A54",
  /** Text/marks drawn *on* the accent. */
  on: "#07080A",
  /** Accent-tinted surface and line for notes and active chrome. */
  surface: "#191207",
  line: "#4A3820",
  /** Accent-tinted note text (passes on every surface above). */
  noteText: "#E5B98A",
});

/** Semantic marks. All are used as text somewhere, so all are contrast-gated. */
export const SIGNAL = Object.freeze({
  ok: "#5EEAD4",
  okSurface: "#0D2422",
  okLine: "#1E4A45",
  refuse: "#FF4D5E",
  refuseSurface: "#211316",
  refuseLine: "#5A2B32",
  info: "#8FB7F5",
  infoSurface: "#131820",
  infoLine: "#223040",
  scene: "#A78BFA",
  sceneSurface: "#1B1626",
  sceneLine: "#3A2E52",
  sceneText: "#C3B0F0",
});

/** World axis colours, shared with the archive's gizmo and vector fields. */
export const AXIS = Object.freeze({ x: "#E0564F", y: "#7BC44C", z: "#4C8BE0" });

/**
 * Text scale. Every value here clears 4.5:1 against every `SURFACE` value.
 *
 * `dim` and `faint` are where the deviation lives: the archive spends four
 * greys below the WCAG floor on micro-labels, and lightening them monotonically
 * would have produced four tiers that are visually indistinguishable. Two
 * passing tiers keep a real hierarchy; the archive's remaining separation is
 * carried by size, weight, and letter-spacing, which the chrome preserves.
 */
export const TEXT = Object.freeze({
  /** Primary copy. Archive #EDEFF2. */
  primary: "#EDEFF2",
  /** Emphasised secondary. Archive #C6CCD4 / #B7BEC7. */
  secondary: "#C6CCD4",
  /** Panel labels. Archive #A7AEB8. */
  label: "#A7AEB8",
  /** Body-weight secondary. Archive #8A929C / #8D949E / #969DA7. */
  dim: "#8A929C",
  /** Micro-labels. Archive #6E7681 / #565E68 / #3F464F / #333A42 (all failing). */
  faint: "#7D8694",
  /** The struck-through "current" value in Change Review. Archive #7A6448. */
  superseded: "#A08663",
  /** On an accent fill. */
  onAccent: "#07080A",
});

/**
 * Archive text colours that were raised, and the ratio they had.
 * Recomputed by the test suite; edited here only alongside that evidence.
 */
export const DEVIATIONS = Object.freeze([
  Object.freeze({
    id: "text-contrast-6E7681",
    archive: "#6E7681",
    shipped: TEXT.dim,
    reason: "4.36:1 on #07080A, below the 4.5:1 floor for body text",
  }),
  Object.freeze({
    id: "text-contrast-565E68",
    archive: "#565E68",
    shipped: TEXT.faint,
    reason: "3.05:1 on #07080A",
  }),
  Object.freeze({
    id: "text-contrast-3F464F",
    archive: "#3F464F",
    shipped: TEXT.faint,
    reason: "2.10:1 on #07080A — the archive's most-used micro-label colour",
  }),
  Object.freeze({
    id: "text-contrast-333A42",
    archive: "#333A42",
    shipped: TEXT.faint,
    reason: "1.74:1 on #07080A",
  }),
  Object.freeze({
    id: "text-contrast-7A6448",
    archive: "#7A6448",
    shipped: TEXT.superseded,
    reason: "3.42:1 on #0D0F12 for the struck-through Change Review value",
  }),
  Object.freeze({
    id: "webfont-not-fetched",
    archive: "fonts.googleapis.com Archivo + JetBrains Mono",
    shipped: "font-family stack, no remote request",
    reason:
      "the emitted document is self-contained and offline; the archive families are named first and the system stack renders when they are absent",
  }),
  Object.freeze({
    id: "fixed-stage-replaced",
    archive: "1680x1000 stage scaled with transform: scale()",
    shipped: "fluid layout with four window tiers",
    reason:
      "a scaled mockup canvas is not a windowing strategy; see WINDOW_TIERS",
  }),
]);

/** Typography. Archive families first; no remote font is ever requested. */
export const TYPE = Object.freeze({
  sans:
    "'Archivo', 'Archivo Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
});

/**
 * Region metrics, in archive pixels at the reference width.
 * The chrome scales these with one CSS custom property rather than a transform.
 */
export const METRICS = Object.freeze({
  referenceWidth: 1680,
  referenceHeight: 1000,
  titleBarHeight: 36,
  railWidth: 56,
  leftDockWidth: 274,
  inspectorWidth: 326,
  assistantWidth: 344,
  viewTabsHeight: 32,
  statusBarHeight: 27,
  dockHeight: 228,
  /** `animate` gets a taller dock so six timeline tracks fit. */
  dockHeightAnimate: 252,
});
