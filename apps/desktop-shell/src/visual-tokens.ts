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
  decision: "D1 adopt Foundations v2 across all surfaces (2026-07-28)",
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
  refuse: "#FF4D5E",
  refuseSurface: "#211316",
  refuseLine: "#5A2B32",
  /**
   * Foundations v2 `--info`. The archive member also carries a lighter #8FB7F5
   * for the same note; the shared sheet canonicalises the informational blue to
   * this value, it clears 4.5:1 on every `SURFACE`, and D1 makes the sheet
   * binding — so the shared value is the one that ships.
   */
  info: "#5B9CFF",
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
 * Profile-switch chip dots.
 *
 * Named here rather than written as literals in the stylesheet so every colour
 * the document ships is accounted for by `FOUNDATIONS_V2_ALIGNMENT`: `web` *is*
 * the sheet's `--store-web`, and a token this surface actually paints cannot be
 * declared absent. Game and Kids reuse `ACCENT.base` and `SIGNAL.scene` through
 * their existing custom properties, so they are not restated.
 */
export const PROFILE_DOT = Object.freeze({
  /** Unselected chip. Archive value. */
  idle: "#2A313A",
  /** Website profile — Foundations v2 `--store-web`. */
  web: "#3FB8C9",
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
  inner: "#161A20",
  mid: "#0B0D11",
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
  /** On an accent fill. */
  onAccent: "#07080A",
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
  onAccent: "#331A07",
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
  // Neutrals — the sheet's six fills are this surface's six chrome surfaces.
  Object.freeze({ token: "--bg-base", disposition: "carried", local: "SURFACE.canvas", value: SURFACE.canvas }),
  Object.freeze({ token: "--bg-panel", disposition: "carried", local: "SURFACE.panel", value: SURFACE.panel }),
  Object.freeze({ token: "--bg-raised", disposition: "carried", local: "SURFACE.header", value: SURFACE.header }),
  Object.freeze({ token: "--bg-control", disposition: "carried", local: "SURFACE.hover", value: SURFACE.hover }),
  Object.freeze({ token: "--bg-field", disposition: "carried", local: "SURFACE.well", value: SURFACE.well }),
  Object.freeze({ token: "--bg-row", disposition: "carried", local: "SURFACE.raised", value: SURFACE.raised }),
  // Lines.
  Object.freeze({ token: "--line-soft", disposition: "carried", local: "LINE.row", value: LINE.row }),
  Object.freeze({ token: "--line", disposition: "carried", local: "LINE.card", value: LINE.card }),
  Object.freeze({
    token: "--line-strong",
    disposition: "absent",
    reason:
      "the sheet prints three line weights; the Engine Desktop member draws its own six-step line scale and does not use #2C323B anywhere. Adopting it would change borders the accepted surface specifies, so the member's scale wins for a member-specific value",
  }),
  // Text.
  Object.freeze({ token: "--fg", disposition: "carried", local: "TEXT.primary", value: TEXT.primary }),
  Object.freeze({ token: "--fg-2", disposition: "carried", local: "TEXT.dim", value: TEXT.dim }),
  Object.freeze({
    token: "--fg-4",
    disposition: "raised",
    local: "TEXT.faint",
    value: TEXT.faint,
    deviation: "text-contrast-3F464F",
  }),
  // Accent and semantics.
  Object.freeze({ token: "--accent", disposition: "carried", local: "ACCENT.base", value: ACCENT.base }),
  Object.freeze({ token: "--accent-hi", disposition: "carried", local: "ACCENT.hover", value: ACCENT.hover }),
  Object.freeze({ token: "--ok", disposition: "carried", local: "SIGNAL.ok", value: SIGNAL.ok }),
  Object.freeze({ token: "--danger", disposition: "carried", local: "SIGNAL.refuse", value: SIGNAL.refuse }),
  Object.freeze({ token: "--info", disposition: "carried", local: "SIGNAL.info", value: SIGNAL.info }),
  Object.freeze({
    token: "--stale",
    disposition: "absent",
    reason:
      "the active proposal review renders one unified diff and no struck-through fixture value, so this surface has no stale-text role",
  }),
  // Axis and surface accents.
  Object.freeze({ token: "--axis-x", disposition: "carried", local: "AXIS.x", value: AXIS.x }),
  Object.freeze({ token: "--axis-y", disposition: "carried", local: "AXIS.y", value: AXIS.y }),
  Object.freeze({ token: "--axis-z", disposition: "carried", local: "AXIS.z", value: AXIS.z }),
  Object.freeze({ token: "--kids", disposition: "carried", local: "SIGNAL.scene", value: SIGNAL.scene }),
  Object.freeze({
    token: "--store-game",
    disposition: "absent",
    reason:
      "storefront accent; this app draws no storefront and no commerce, and the Game profile chip is drawn with the accent rather than this value",
  }),
  Object.freeze({ token: "--store-web", disposition: "carried", local: "PROFILE_DOT.web", value: PROFILE_DOT.web }),
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
