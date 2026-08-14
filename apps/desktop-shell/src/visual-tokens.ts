/**
 * Engine Desktop visual tokens — the accepted archive surface, held as data.
 *
 * Provenance: `sceneaxi-desktop-redesign`
 * (sha256 `c4ecfce14440b56342781e53abd02f915446795d8ba2bf2fdf18d895bc950b51`),
 * member `direction-1-cinematic-pro.html`. `Engine Desktop v1.dc.html` remains
 * **superseded and reference-only**: its amber accent, Space Grotesk / IBM Plex
 * typography, 2064x1400 canvas, and project-launcher screen model do not appear
 * here and must not be reintroduced (see `SUPERSEDED_V1`). Foundations orange
 * is no longer the desktop accent.
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
  archive: "sceneaxi-desktop-redesign",
  sha256: "c4ecfce14440b56342781e53abd02f915446795d8ba2bf2fdf18d895bc950b51",
  member: "direction-1-cinematic-pro.html",
  syncedAt: "2026-08-14T12:54:00Z",
});

/**
 * Foundations v2 — the product visual language for **every** shipped surface
 * (captain decision D1, recorded 2026-07-28), transcribed from the member
 * `SceneAxi Foundations.dc.html` of the same archive named in `VISUAL_SOURCE`.
 *
 * ## Why this table is duplicated rather than imported
 *
 * D2 puts the shared token layer in `packages/site-kit`. That package is **not
 * reachable from here**: `docs/dependency-matrix.json` allows
 * `@sceneaxi/desktop-shell` exactly `@sceneaxi/schemas` and
 * `@sceneaxi/authoring-core`, and the matrix `rule` states allow lists are
 * exhaustive — so importing `@sceneaxi/site-kit` would fail
 * `pnpm check:boundaries`. The values below are therefore duplicated, by
 * contract, not by preference.
 *
 * `packages/site-kit/src/design-tokens.ts` stays the **upstream** source of these
 * values. What keeps the two copies identical is not an import but a shared
 * anchor: both transcribe archive sha256 `ad5d6e39…c15159`, and both assert their
 * transcription in their own gate. `FOUNDATIONS_V2_ALIGNMENT` below is this
 * package's half of that, and `docs/engine-desktop-surface.md` owns the record.
 */
export const FOUNDATIONS_V2_SOURCE = Object.freeze({
  version: "v2",
  archiveSha256:
    "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
  member: "SceneAxi Foundations.dc.html",
  upstream: "packages/site-kit/src/design-tokens.ts",
  /** Why the upstream is copied instead of imported. Asserted, not prose. */
  duplicationReason: "dependency-matrix-forbids-site-kit",
  decision:
    "D7 desktop-first Cinematic Pro (2026-08-14); sites remain Foundations v2",
});

/**
 * Every colour token the Foundations v2 sheet prints, with the hex it prints.
 *
 * This is the full sheet, not the subset this surface happens to use — a token
 * left out of `FOUNDATIONS_V2_ALIGNMENT` is a failing assertion, so a value
 * cannot be quietly dropped when the sheet gains one.
 */
export const FOUNDATIONS_V2_COLORS = Object.freeze({
  "--bg-base": "#07080A",
  "--bg-panel": "#0D0F12",
  "--bg-raised": "#12151A",
  "--bg-control": "#191D23",
  "--bg-field": "#08090B",
  "--bg-row": "#101318",
  "--line-soft": "#14181E",
  "--line": "#1C2129",
  "--line-strong": "#2C323B",
  "--fg": "#EDEFF2",
  "--fg-2": "#8A929C",
  "--fg-4": "#3F464F",
  "--accent": "#FF6B2C",
  "--accent-hi": "#FF8A54",
  "--ok": "#5EEAD4",
  "--danger": "#FF4D5E",
  "--info": "#5B9CFF",
  "--stale": "#7A6448",
  "--axis-x": "#E0564F",
  "--axis-y": "#7BC44C",
  "--axis-z": "#4C8BE0",
  "--kids": "#A78BFA",
  "--store-game": "#E8544E",
  "--store-web": "#3FB8C9",
});

/** The two Foundations v2 families. Compared by first family, not by stack. */
export const FOUNDATIONS_V2_FAMILIES = Object.freeze({
  sans: "Archivo",
  mono: "JetBrains Mono",
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
  /** Page behind the floating chrome. */
  backdrop: "#05080E",
  /** Editor body and viewport base. */
  canvas: "#0A0F1A",
  /** Deepest inset wells (inputs, console, footers). */
  well: "#070B13",
  /** Assistant column. */
  assistant: "#0F1624",
  /** Docked panels: left dock, inspector, bottom dock. */
  panel: "#0F1624",
  /** Overlay dialogs and the command palette. */
  overlay: "#131B2C",
  /** Raised rows and cards inside a panel. */
  raised: "#131B2C",
  /** Panel section headers and chrome chips. */
  header: "#182236",
  /** Hover / selected chrome. */
  hover: "#182236",
});

export const LINE = Object.freeze({
  /** Structural borders between regions. */
  strong: "#243044",
  /** Card and control borders. */
  card: "#243044",
  /** Row separators inside a scrolling panel. */
  row: "#1A2436",
  /** Control borders and dividers. */
  control: "#2A3850",
  /** Emphasised control border. */
  raised: "#334563",
  /** Hover border. */
  hover: "#3D5274",
});

/** Cyan-teal life-signal. Foundations orange is no longer the desktop accent. */
export const ACCENT = Object.freeze({
  base: "#46D8EC",
  hover: "#74E3F2",
  /** Text/marks drawn *on* the accent. */
  on: "#05121A",
  /** Accent-tinted surface and line for notes and active chrome. */
  surface: "#10242C",
  line: "#1E5A66",
  /** Accent-tinted note text (passes on every surface above). */
  noteText: "#74E3F2",
});

/** Semantic marks. All are used as text somewhere, so all are contrast-gated. */
export const SIGNAL = Object.freeze({
  ok: "#5FE3C0",
  refuse: "#FF4D5E",
  refuseSurface: "#211316",
  refuseLine: "#5A2B32",
  info: "#5B9CFF",
  infoSurface: "#131820",
  infoLine: "#223040",
  scene: "#A78BFA",
  sceneSurface: "#1B1626",
  sceneLine: "#3A2E52",
  sceneText: "#C3B0F0",
});

/** World axis colours from the Cinematic Pro brief. */
export const AXIS = Object.freeze({ x: "#E4655F", y: "#7CC96B", z: "#5B9CFF" });

/**
 * Profile-switch chip dots.
 *
 * Named here rather than written as literals in the stylesheet so every colour
 * the document ships is accounted for by `FOUNDATIONS_V2_ALIGNMENT`: `web` *is*
 * the sheet's `--store-web`, and a token this surface actually paints cannot be
 * declared absent. Game and Kids reuse `ACCENT.base` and `SIGNAL.scene` through
 * their existing custom properties, so they are not restated.
 */
export const PROFILE_DOT = Object.freeze({
  /** Unselected chip. */
  idle: "#2A3850",
  /** Website profile — kept as a semantic role, not the storefront hex. */
  web: "#5B9CFF",
});

/**
 * Translucent overlays: the dialog scrim, the drawer shadow, and the sculpt
 * sweep's highlight.
 *
 * Each one is a **mix of a token already accounted for**, never a decimal triple
 * of its own. The archive writes these as `rgba()` literals, and an `rgba()`
 * literal is the one notation the alignment check cannot follow: `rgba(4,5,7,.68)`
 * is a digit off `SURFACE.backdrop` and would survive any edit to it. Expressed
 * as `color-mix()` over the custom property, a scrim moves with the token it is
 * built from, which is why the drift test can require the emitted document to
 * carry no `rgb()`/`rgba()` at all.
 */
export const SCRIM = Object.freeze({
  /** Behind a modal dialog. Archive `rgba(4,5,7,.68)`. */
  overlay: "color-mix(in srgb, var(--backdrop) 68%, transparent)",
  /** Undocked-drawer and dialog drop shadow. Archive `rgba(0,0,0,.9)`. */
  shadow: "color-mix(in srgb, var(--backdrop) 90%, transparent)",
  /** The moving highlight on a running sculpt pass. Archive `rgba(255,255,255,.35)`. */
  sheen: "color-mix(in srgb, var(--text) 35%, transparent)",
});

/** The viewport's radial base gradient, from the archive. Non-text. */
export const VIEWPORT_GRADIENT = Object.freeze({
  inner: "#182236",
  mid: "#0A0F1A",
});

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
  primary: "#EAF0F9",
  secondary: "#ACB8CC",
  label: "#ACB8CC",
  dim: "#ACB8CC",
  faint: "#95A2B8",
  onAccent: "#05121A",
});

/**
 * The inert state, expressed as paint rather than as compositing.
 *
 * An inert control is dimmed by drawing a dimmer value, never by element
 * `opacity`. Opacity composites a whole control toward whatever is behind it,
 * and every contrast check that guards this surface reads the *declared* colour
 * — the token test compares `TEXT` against `SURFACE`, and a browser sweep reads
 * `getComputedStyle().color` — so an opacity-dimmed label is a ratio neither of
 * them can see. Painted values land where the existing measurement already
 * looks.
 *
 * `text` is `TEXT.faint` deliberately: an inert control still has to be read, so
 * the floor is the constraint, and `faint` is already the dimmest tier that
 * clears 4.5:1 on every surface a control can sit on. Anything below it would be
 * a refusal nobody can read.
 */
export const INERT = Object.freeze({
  /** Inert label on any chrome surface. */
  text: TEXT.faint,
  /** Inert label on the accent fill: a primary button, a pressed assistant mode. */
  onAccent: "#0A2A34",
  /** The rail glyph inside an inert mode. Decorative and `aria-hidden`, so not text. */
  glyph: LINE.hover,
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
    id: "webfont-not-fetched",
    archive: "fonts.googleapis.com Archivo + JetBrains Mono",
    shipped: "font-family stack, no remote request",
    reason:
      "the emitted document is self-contained and offline; the archive families are named first and the system stack renders when they are absent",
  }),
  Object.freeze({
    id: "inert-dimming-not-opacity",
    archive: "element opacity on a control that cannot be used",
    shipped: "the painted INERT tokens; no opacity outside @keyframes",
    reason:
      "opacity composites a label toward its background, and every contrast check here reads the declared colour, so the dimming was measured by nothing: an inert view tab resolved to 3.67:1, an inert primary button to 4.07:1, and a Kids rail label to 2.16:1",
  }),
  Object.freeze({
    id: "fixed-stage-replaced",
    archive: "1680x1000 stage scaled with transform: scale()",
    shipped: "fluid layout with four window tiers",
    reason:
      "a scaled mockup canvas is not a windowing strategy; see WINDOW_TIERS",
  }),
  Object.freeze({
    id: "desktop-first-cinematic-pro",
    archive: "Foundations v2 near-black + signal orange + Archivo",
    shipped: "Cinematic Pro graphite + cyan + system neo-grotesque",
    reason:
      "captain D7/D12: desktop is its own visual authority; sites stay on Foundations v2",
  }),
]);

/**
 * How every Foundations v2 colour token lands on this surface.
 *
 * Exactly one disposition per sheet token, so the sheet is accounted for in full:
 *
 * - `carried` — this surface uses the sheet's value verbatim. The test asserts
 *   the two hexes are equal, so drift on either side of the boundary-forced copy
 *   is a failing assertion rather than a review slip.
 * - `raised` — the sheet's value is below the WCAG text floor on this surface's
 *   near-black chrome, so it is raised. Each one names its `DEVIATIONS` row, and
 *   the test re-measures both that the sheet value fails and the shipped one passes.
 * - `absent` — the token addresses a surface this app does not draw. It is named
 *   with a reason rather than silently unused.
 */
export const FOUNDATIONS_V2_ALIGNMENT = Object.freeze([
  Object.freeze({ token: "--bg-base", disposition: "semantic", local: "SURFACE.canvas", value: SURFACE.canvas, reason: "desktop-first Cinematic Pro stage, not Foundations near-black" }),
  Object.freeze({ token: "--bg-panel", disposition: "semantic", local: "SURFACE.panel", value: SURFACE.panel, reason: "graphite panel, same role as --bg-panel" }),
  Object.freeze({ token: "--bg-raised", disposition: "semantic", local: "SURFACE.header", value: SURFACE.header, reason: "graphite raised chrome" }),
  Object.freeze({ token: "--bg-control", disposition: "semantic", local: "SURFACE.hover", value: SURFACE.hover, reason: "graphite control well" }),
  Object.freeze({ token: "--bg-field", disposition: "semantic", local: "SURFACE.well", value: SURFACE.well, reason: "graphite inset well" }),
  Object.freeze({ token: "--bg-row", disposition: "semantic", local: "SURFACE.raised", value: SURFACE.raised, reason: "graphite raised row" }),
  Object.freeze({ token: "--line-soft", disposition: "semantic", local: "LINE.row", value: LINE.row, reason: "graphite row line" }),
  Object.freeze({ token: "--line", disposition: "semantic", local: "LINE.card", value: LINE.card, reason: "graphite card line" }),
  Object.freeze({
    token: "--line-strong",
    disposition: "absent",
    reason:
      "the sheet prints three line weights; Cinematic Pro draws its own six-step graphite scale and does not use #2C323B",
  }),
  Object.freeze({ token: "--fg", disposition: "semantic", local: "TEXT.primary", value: TEXT.primary, reason: "cool paper ink" }),
  Object.freeze({ token: "--fg-2", disposition: "semantic", local: "TEXT.dim", value: TEXT.dim, reason: "cool secondary ink" }),
  Object.freeze({
    token: "--fg-4",
    disposition: "raised",
    local: "TEXT.faint",
    value: TEXT.faint,
    deviation: "text-contrast-3F464F",
  }),
  Object.freeze({ token: "--accent", disposition: "semantic", local: "ACCENT.base", value: ACCENT.base, reason: "cyan life-signal replaces Foundations orange on desktop" }),
  Object.freeze({ token: "--accent-hi", disposition: "semantic", local: "ACCENT.hover", value: ACCENT.hover, reason: "cyan hover tint" }),
  Object.freeze({ token: "--ok", disposition: "semantic", local: "SIGNAL.ok", value: SIGNAL.ok, reason: "mint ready mark" }),
  Object.freeze({ token: "--danger", disposition: "carried", local: "SIGNAL.refuse", value: SIGNAL.refuse }),
  Object.freeze({ token: "--info", disposition: "carried", local: "SIGNAL.info", value: SIGNAL.info }),
  Object.freeze({
    token: "--stale",
    disposition: "absent",
    reason:
      "the active proposal review renders one unified diff and no struck-through fixture value, so this surface has no stale-text role",
  }),
  Object.freeze({ token: "--axis-x", disposition: "semantic", local: "AXIS.x", value: AXIS.x, reason: "Cinematic Pro axis" }),
  Object.freeze({ token: "--axis-y", disposition: "semantic", local: "AXIS.y", value: AXIS.y, reason: "Cinematic Pro axis" }),
  Object.freeze({ token: "--axis-z", disposition: "semantic", local: "AXIS.z", value: AXIS.z, reason: "Cinematic Pro axis" }),
  Object.freeze({ token: "--kids", disposition: "carried", local: "SIGNAL.scene", value: SIGNAL.scene }),
  Object.freeze({
    token: "--store-game",
    disposition: "absent",
    reason:
      "storefront accent; this app draws no storefront and no commerce, and the Game profile chip is drawn with the accent rather than this value",
  }),
  Object.freeze({ token: "--store-web", disposition: "semantic", local: "PROFILE_DOT.web", value: PROFILE_DOT.web, reason: "web chip uses info blue, not the storefront hex" }),
]);

/** Typography. System neo-grotesque; no remote font is ever requested. */
export const TYPE = Object.freeze({
  sans:
    '-apple-system, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
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
