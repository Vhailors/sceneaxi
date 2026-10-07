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
 *
 * v6 "Interlocking" (docs/redesign-v6/DIRECTION.md §5, §8, §9): the semantic
 * values below (`SURFACE`, `LINE`, `ACCENT`, `SIGNAL`, `TEXT`, `INERT`) now carry the
 * signal-box materials and lever paints, mirrored from
 * `packages/site-kit/src/design-tokens.ts` `SIGNAL_COLORS` **without importing it**
 * (the dependency matrix still forbids the edge; see `FOUNDATIONS_V2_SOURCE`).
 * `INTERLOCKING` holds the full mirror in both schemes, and `STATE_PLATES` the
 * label + icon + paint + on-ink quadruples. Chrome surfaces map onto the iron family
 * (docks and desk columns are cast-iron frames, §8), which is also where the
 * viewport's own hues (axis, selection, category) keep their measured floors. The
 * Cinematic Pro graphite + cyan values are retired; the archive provenance above is
 * kept for the non-colour metrics only.
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
  // v6 retirement mirrored from site-kit: the v5 orange accent is now enamel.
  "--accent": "#F1EEE4",
  "--accent-hi": "#FFFFFF",
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
    "#F5A524", // amber accent, superseded (v6 accent is enamel)
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

/** Where the v6 mirror comes from, so drift is checkable from either side. */
export const INTERLOCKING_SOURCE = Object.freeze({
  direction: "docs/redesign-v6/DIRECTION.md",
  upstream: "packages/site-kit/src/design-tokens.ts#SIGNAL_COLORS",
  /** Same reason as `FOUNDATIONS_V2_SOURCE`: copied, never imported. */
  duplicationReason: "dependency-matrix-forbids-site-kit",
});

/**
 * The v6 colour tokens in both schemes, value for value with site-kit's
 * `SIGNAL_COLORS` (DIRECTION §5.1–5.3). Desktop follows the system scheme: the
 * chrome reads `dark` today; `light` is here so the desktop lane can emit the
 * `prefers-color-scheme: light` block from data rather than literals.
 */
export const INTERLOCKING = Object.freeze({
  dark: Object.freeze({
    panel: "#2F4A44", panelBand: "#27403A", iron: "#1E2B28", ironRaised: "#263632", well: "#182320",
    ink: "#F1EEE4", ink2: "#BCD0C9", edge: "#86A39B", rule: "#4E6B64", siding: "#7F9A93", track: "#E9E6DC",
    enamel: "#F1EEE4", enamelHi: "#FFFFFF", onEnamel: "#1A2623", focus: "#F1EEE4", disabledInk: "#BCD0C9",
    pending: "#F2C230", onPending: "#1A2623", pendingInk: "#F2C230", route: "#F2C230",
    verified: "#7BDDB0", onVerified: "#12241E", verifiedRoute: "#7BDDB0",
    refused: "#C4362C", onRefused: "#FFFFFF", refusedLamp: "#FF9A8C", refusedLampHi: "#FFB3A8",
    stale: "#A3A9A4", onStale: "#1A2623",
    // A-rich (concepts/a-rich/SPEC-DELTA.md §2-3): lunar = the INSPECT accent, commit = Accept, planes.
    lunar: "#C4B4FF", onLunar: "#16112E", lunarDeep: "#5D4FA8", lunarMark: "#C4B4FF", onLunarMark: "#16112E",
    commit: "#F2C230", onCommit: "#1A2623", commitHi: "#FFD45A", commitEdge: "#F2C230",
    bed: "#141C1A", plate: "#395A53", hair: "#9AB8B0", ink2Plate: "#D2E2DC",
    enamelInk2: "#3F5550", enamelRule: "#4E6B64", enamelFocus: "#1A2623",
  }),
  light: Object.freeze({
    panel: "#E7E9E3", panelBand: "#F4F4EF", iron: "#FBFBF8", ironRaised: "#EEEFEA", well: "#FFFFFF",
    ink: "#17221F", ink2: "#3F5550", edge: "#6B807A", rule: "#C4CDC8", siding: "#6B807A", track: "#17221F",
    enamel: "#17221F", enamelHi: "#000000", onEnamel: "#FFFFFF", focus: "#17221F", disabledInk: "#3F5550",
    pending: "#F2C230", onPending: "#1A2623", pendingInk: "#6B5000", route: "#9A7400",
    verified: "#7BDDB0", onVerified: "#12241E", verifiedRoute: "#1F8A5A",
    refused: "#C4362C", onRefused: "#FFFFFF", refusedLamp: "#A62A21", refusedLampHi: "#A62A21",
    stale: "#A3A9A4", onStale: "#1A2623",
    lunar: "#5B3FD0", onLunar: "#FFFFFF", lunarDeep: "#C4B4FF", lunarMark: "#E4DCFF", onLunarMark: "#17221F",
    commit: "#F2C230", onCommit: "#1A2623", commitHi: "#FFD45A", commitEdge: "#7A5C00",
    bed: "#DFE3DC", plate: "#FFFFFF", hair: "#6B807A", ink2Plate: "#3F5550",
    enamelInk2: "#BCD0C9", enamelRule: "#86A39B", enamelFocus: "#FFFFFF",
  }),
});

/**
 * Pairs where lunar is UI/large only (mirrors `uiOnly` in site-kit `SIGNAL_PAIRS`): never body text.
 * Keys are `INTERLOCKING` keys.
 */
export const INTERLOCKING_UI_ONLY = Object.freeze([
  Object.freeze({ fg: "lunar", bg: "plate", scheme: "dark", ratio: 4.1, reason: "rings, bars and large text only" }),
]);

/**
 * The yellow PENDING plate pair, mirroring site-kit `SIGNAL_PENDING_PLATE` / `signalPendingPlateCss()`
 * (`.sx-plate--pending`). Fill, ink and the 1px boundary line ship together, never the fill alone:
 * in light the `commit` fill is 1.37:1 on `panel` and only `commitEdge` (5.11:1) bounds it; in dark
 * the edge is the fill. `forcedColorsBorder` replaces paint + inset line under forced colours.
 * Keys are `INTERLOCKING` keys; desktop emits this as one rule, not separate fill/line rules.
 */
export const INTERLOCKING_PENDING_PLATE = Object.freeze({
  className: "sx-plate--pending",
  fill: "commit",
  ink: "onCommit",
  line: "commitEdge",
  lineWidthPx: 1,
  forcedColorsBorder: "1px solid CanvasText",
  measured: Object.freeze({
    light: Object.freeze({ fillOnPanel: 1.37, lineOnPanel: 5.11, inkOnFill: 9.32 }),
    dark: Object.freeze({ fillOnPanel: 5.74, lineOnPanel: 5.74, inkOnFill: 9.32 }),
  }),
});

/** Depth shadows, value for value with site-kit `SIGNAL_SHADOWS` (offset only, never glow or blur). */
export const INTERLOCKING_SHADOWS = Object.freeze({
  dark: Object.freeze({
    sink: "inset 0 2px 0 #00000066, inset 0 0 0 1px #00000040",
    lift1: "0 1px 0 #FFFFFF14 inset, 0 14px 24px -14px #000000B3",
    lift2: "0 1px 0 #FFFFFF inset, 0 28px 48px -24px #000000CC, 0 4px 10px -6px #00000080",
  }),
  light: Object.freeze({
    sink: "inset 0 2px 0 #17221F1F",
    lift1: "0 1px 0 #FFFFFF inset, 0 10px 20px -14px #17221F66",
    lift2: "0 1px 0 #FFFFFF inset, 0 28px 48px -24px #000000CC, 0 4px 10px -6px #00000080",
  }),
});

/**
 * Six planes on four levels (site-kit `SIGNAL_ELEVATION`). Each value names `INTERLOCKING` /
 * `INTERLOCKING_SHADOWS` keys; `boundary` is the >= 3:1 line for that plane.
 */
export const INTERLOCKING_ELEVATION = Object.freeze([
  Object.freeze({ level: -1, plane: "bed", shadow: "sink", boundary: "hair", ink: "ink", ink2: "ink2", focus: "focus" }),
  Object.freeze({ level: -1, plane: "well", shadow: "sink", boundary: "edge", ink: "ink", ink2: "ink2", focus: "focus" }),
  Object.freeze({ level: 0, plane: "panel", shadow: null, boundary: null, ink: "ink", ink2: "ink2", focus: "focus" }),
  Object.freeze({ level: 1, plane: "plate", shadow: "lift1", boundary: "hair", ink: "ink", ink2: "ink2Plate", focus: "focus" }),
  Object.freeze({ level: 1, plane: "iron", shadow: "lift1", boundary: "edge", ink: "ink", ink2: "ink2", focus: "focus" }),
  Object.freeze({ level: 2, plane: "enamel", shadow: "lift2", boundary: "enamelRule", ink: "onEnamel", ink2: "enamelInk2", focus: "enamelFocus" }),
]);

/**
 * The propose -> inspect -> commit sequence (site-kit `SIGNAL_SEQUENCE`), in ms. The autoplay
 * ends ARMED, never committed; `reduced` is the prefers-reduced-motion value of every field
 * (the three-still strip carries the meaning instead).
 */
export const INTERLOCKING_SEQUENCE = Object.freeze({
  phases: Object.freeze({
    propose: Object.freeze({ startMs: 0, endMs: 900, paint: "pending", still: "1 · Propose" }),
    inspect: Object.freeze({ startMs: 1150, endMs: 1900, paint: "lunar", still: "2 · Inspect" }),
    commit: Object.freeze({ startMs: 2250, endMs: 2800, paint: "commit", still: "3 · Commit" }),
  }),
  end: "armed",
  barMs: 280,
  scanMs: 760,
  staggerMs: 80,
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  reduced: Object.freeze({ durationMs: 0, delayMs: 0, staggerMs: 0, ease: "linear" }),
});

/**
 * The v6 type scale in px (site-kit `SIGNAL_TYPE_SCALE`; clamp() steps at their minimum) and its
 * 13px floor. The pinned Cinematic Pro `TYPE_SCALE` below still carries 11/12px steps the
 * desktop lane must retire; new chrome reads this one.
 */
export const INTERLOCKING_TEXT_FLOOR_PX = 13;

export const INTERLOCKING_TYPE_SCALE = Object.freeze({
  display: 56, h2: 32, h3: 24, lede: 19, body: 16, plate: 15, small: 13,
});

/**
 * State plates: label + icon + paint + on-ink, never paint alone (DIRECTION §2.1).
 * `paint`/`on` name `INTERLOCKING` keys; `null` paint is outline-only.
 */
export const STATE_PLATES = Object.freeze({
  pending: Object.freeze({ plate: "Pending", label: "Pending review · unwritten", icon: "pending", paint: "pending", on: "onPending" }),
  verified: Object.freeze({ plate: "Verified", label: "Verified · written", icon: "verified", paint: "verified", on: "onVerified" }),
  refused: Object.freeze({ plate: "Refused", label: "Rejected · nothing written", icon: "refused", paint: "refused", on: "onRefused" }),
  stale: Object.freeze({ plate: "Superseded", label: "Superseded · not actionable", icon: "stale", paint: "stale", on: "onStale" }),
  unknown: Object.freeze({ plate: "Outcome unknown", label: "Apply outcome pending", icon: "stale", paint: "stale", on: "onStale" }),
  test: Object.freeze({ plate: "TEST", label: "TEST", icon: "test", paint: null, on: "ink" }),
});

/**
 * Surfaces and lines, copied from the archive. Non-text: not contrast-gated.
 */
export const SURFACE = Object.freeze({
  /** Page behind the floating chrome: quadrant well. */
  backdrop: INTERLOCKING.dark.well,
  /** Editor body and viewport base: quadrant well. */
  canvas: INTERLOCKING.dark.well,
  /** Deepest inset wells (inputs, console, footers). */
  well: INTERLOCKING.dark.well,
  /** Assistant column: cast iron. */
  assistant: INTERLOCKING.dark.iron,
  /** Docked panels: left dock, inspector, bottom dock. Cast iron (§8 level 2). */
  panel: INTERLOCKING.dark.iron,
  /** Overlay dialogs and the command palette: raised iron. */
  overlay: INTERLOCKING.dark.ironRaised,
  /** Raised rows and cards inside a panel: iron, separated by `LINE.row`. */
  raised: INTERLOCKING.dark.iron,
  /** Panel section headers and chrome chips: raised iron (§8 level 3). */
  header: INTERLOCKING.dark.ironRaised,
  /** Hover / selected chrome. */
  hover: INTERLOCKING.dark.ironRaised,
});

export const LINE = Object.freeze({
  /** Structural borders between regions (decoration; regions also differ in fill). */
  strong: INTERLOCKING.dark.rule,
  /** Card borders (decoration). */
  card: INTERLOCKING.dark.rule,
  /** Row separators inside a scrolling panel. */
  row: INTERLOCKING.dark.panelBand,
  /** Control borders: `--edge`, >= 3:1 on every surface (§2.4). */
  control: INTERLOCKING.dark.edge,
  /** Emphasised control border. */
  raised: INTERLOCKING.dark.edge,
  /** Hover border: enamel, as the quiet button's hover edge. */
  hover: INTERLOCKING.dark.enamel,
});

/** Enamel: the primary action, the default plate and the focus ring (§5.1). */
export const ACCENT = Object.freeze({
  base: INTERLOCKING.dark.enamel,
  hover: INTERLOCKING.dark.enamelHi,
  /** Text/marks drawn *on* the accent, in every state. */
  on: INTERLOCKING.dark.onEnamel,
  /** Active chrome and note surface: raised iron. */
  surface: INTERLOCKING.dark.ironRaised,
  line: INTERLOCKING.dark.edge,
  /** Note text (passes on every surface above). */
  noteText: INTERLOCKING.dark.ink,
});

/**
 * Semantic marks. Everything without `on`/`Paint` in its name is used as text
 * somewhere, so it is contrast-gated. Paints carry their own `on` ink and are
 * never text (refused paint fails 3:1 on the panel; refusal *text* is the lamp).
 */
export const SIGNAL = Object.freeze({
  ok: INTERLOCKING.dark.verified,
  onOk: INTERLOCKING.dark.onVerified,
  warn: INTERLOCKING.dark.pending,
  onWarn: INTERLOCKING.dark.onPending,
  refuse: INTERLOCKING.dark.refusedLamp,
  refusePaint: INTERLOCKING.dark.refused,
  onRefuse: INTERLOCKING.dark.onRefused,
  refuseSurface: INTERLOCKING.dark.well,
  refuseLine: INTERLOCKING.dark.refusedLamp,
  stalePaint: INTERLOCKING.dark.stale,
  onStale: INTERLOCKING.dark.onStale,
  info: "#5B9CFF",
  infoSurface: INTERLOCKING.dark.well,
  infoLine: INTERLOCKING.dark.rule,
  scene: "#A78BFA",
  sceneSurface: INTERLOCKING.dark.well,
  sceneLine: INTERLOCKING.dark.rule,
  sceneText: "#C3B0F0",
});

/** World axis colours from the Cinematic Pro brief. */
export const AXIS = Object.freeze({ x: "#E4655F", y: "#7CC96B", z: "#5B9CFF" });

/** Viewport outlines; selection is distinct from assistant provenance. */
export const SELECTION = Object.freeze({
  outline: "#FF9D3D",
  child: "#5B9CFF",
  hover: "#FFC58A",
});

/** Gizmo interaction paint (non-text). */
export const AXIS_STATE = Object.freeze({
  hoverX: "#F29590",
  hoverY: "#A4DD97",
  hoverZ: "#8DBBFF",
  active: "#FFD84D",
});

/** Contrast-gated inspector axis labels. */
export const AXIS_TEXT = Object.freeze({ x: "#EE7A74", y: "#8AD47A", z: "#74AEFF" });

export const PROPOSED = Object.freeze({ base: "#FF8AD0" });

export const PLAY = Object.freeze({ frame: "#4FB0FF" });

/** Entity-type icons only: these colours never express state. */
export const CATEGORY = Object.freeze({
  object: "#8DB4F7",
  group: "#AEB9CA",
  light: "#F5D37A",
  camera: "#B8C4FF",
  audio: "#86E0A8",
  effect: "#F2B279",
  logic: "#D6A8FF",
});

/** Text-bearing mixes; both backgrounds are contrast-tested after compositing. */
export const TINT = Object.freeze({
  play: "color-mix(in srgb, var(--play) 6%, var(--panel))",
  proposed: "color-mix(in srgb, var(--proposed) 8%, var(--raised))",
});

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
  idle: INTERLOCKING.dark.rule,
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
  inner: INTERLOCKING.dark.ironRaised,
  mid: INTERLOCKING.dark.well,
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
  primary: INTERLOCKING.dark.ink,
  secondary: INTERLOCKING.dark.ink2,
  label: INTERLOCKING.dark.ink2,
  dim: INTERLOCKING.dark.ink2,
  /** The edge value as text: 4.66:1 on raised iron, the dimmest passing tier. */
  faint: INTERLOCKING.dark.edge,
  onAccent: INTERLOCKING.dark.onEnamel,
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
  onAccent: INTERLOCKING.light.ink2,
  /** The rail glyph inside an inert mode. Decorative and `aria-hidden`, so not text. */
  glyph: LINE.strong,
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
    id: "v6-interlocking",
    archive: "Cinematic Pro graphite #0A0F1A–#182236 + the v5 cyan accent (retired)",
    shipped: "Interlocking signal-box iron #182320/#1E2B28/#263632, enamel #F1EEE4 on #1A2623, lever paints with on-ink",
    reason:
      "docs/redesign-v6/DIRECTION.md replaces the v5 visual world (v5 is the anti-reference); values mirrored from site-kit SIGNAL_COLORS without importing it",
  }),
  Object.freeze({
    id: "desktop-first-cinematic-pro",
    archive: "Foundations v2 near-black + signal orange + Archivo",
    shipped: "Cinematic Pro graphite + cyan + system neo-grotesque",
    reason:
      "captain D7/D12: desktop is its own visual authority; sites stay on Foundations v2",
  }),
  // Redesign 2026-10 (docs/redesign/DIRECTION.md §8; recorded in
  // docs/engine-desktop-surface.md). The values live in CHROME_RADIUS, TYPE_SIZE,
  // SPACING, ELEVATION and MOTION_SYSTEM below (port names per DV-P5: the pinned
  // MOTION, RADIUS, SPACE and TYPE_SCALE keep their values); the chrome reads them.
  Object.freeze({
    id: "dv-d1-panel-radius",
    archive: "--r-panel: 18px",
    shipped: "CHROME_RADIUS.panel 16px",
    reason: "the card radius ceiling is 16px",
  }),
  Object.freeze({
    id: "dv-d2-text-floor",
    archive: "micro labels at 8–10px",
    shipped: "TYPE_SIZE.floor 11px for text (aria-hidden glyphs excepted); .scene-entity-identity code and .asset-browser-card span stay 10px",
    reason:
      "legibility; .panel-head already pins 11px. The two 10px selectors are pinned by visual-refinement.test.ts and stay until Request R1 lifts them",
  }),
  Object.freeze({
    id: "dv-d3-spacing-scale",
    archive: "SPACING 4, 8, 12, 16, 24",
    shipped: "SPACING adds 32, 44, 72 (--space-8, --space-11, --space-18); SPACE keeps its pinned 5: 20, which no restyled rule reads",
    reason: "one spacing scale on every surface; structural METRICS are unchanged",
  }),
  Object.freeze({
    id: "dv-d4-float-shadow",
    archive: "overlay and drawer shadows 0 0 60px -10px / 0 24px 60px with a 1px edge",
    shipped: "ELEVATION.float 0 10px 14px -6px over SCRIM.shadow, edge kept",
    reason: "a 1px edge plus a blur of 16px or more is the banned ghost elevation",
  }),
  Object.freeze({
    id: "dv-d5-motion-curves",
    archive: "colour transitions .14s ease; rise .3s ease-out and rise .16s ease-out with a 7px keyframe",
    shipped: "instant paint; translate, clip-path and keyframe motion on MOTION_SYSTEM durations, out-quart/quint/expo curves and 4/8/16px distances; no scale",
    reason:
      "motion contract: transform/opacity/clip-path/filter only, quart/quint/expo curves, on-token distances, inside the chrome's no transform:scale( pin and the pinned press without moving glyphs",
  }),
  Object.freeze({
    id: "dv-d6-loading-loop",
    archive: "no loop timing; assistant-bars 0.9s ease-in-out infinite and sweep 1.1s linear infinite",
    shipped: "MOTION_SYSTEM.duration.loop 1200ms and MOTION_SYSTEM.delay.loading 300ms, emitted as --motion-duration-loop / --motion-delay-loading; lane-desktop will retime assistant-bars and sweep onto var(--motion-duration-loop) var(--motion-ease-out-quart) infinite (until then the chrome still ships 0.9s ease-in-out and 1.1s linear)",
    reason:
      "a loop is a progress signal, not a transition; accepted by the run contract owner 2026-10-04 as rulings R-1 and R-2 (docs/redesign/RULINGS.md): indeterminate indicators only, transform/opacity only, static under reduced motion",
  }),
  // DV-D7 to DV-D9: lane-desktop deviations, accepted by ruling R-6
  // (docs/redesign/RULINGS.md, 2026-10-04).
  Object.freeze({
    id: "dv-d7-play-ring-origin",
    archive: "Play ring clip-path grows from circle(50%)",
    shipped: "Play ring clip-path grows from circle(25%)",
    reason:
      "at 50% the circle already covers a 24px-tall button, so nothing visibly grows; accepted by ruling R-6",
  }),
  Object.freeze({
    id: "dv-d8-capability-sentences",
    archive: "capability sentences truncated with an ellipsis",
    shipped: "capability sentences drawn with the details layer only; visually hidden (1px clip) while details are closed",
    reason:
      "a truncated sentence reads as broken copy; the text and its hooks are unchanged and stay in the accessibility tree; accepted by ruling R-6",
  }),
  Object.freeze({
    id: "dv-d9-site-eyebrow-chip",
    archive: "web-preview .site-eyebrow as an uppercase, tracked accent label",
    shipped: "neutral sentence-case chip: 1px --line frame, --text-2, no tracking",
    reason:
      "removes the eyebrow pattern from the mock page; its text is unchanged and any test pin on it still wins; accepted by ruling R-6",
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
  Object.freeze({ token: "--accent", disposition: "semantic", local: "ACCENT.base", value: ACCENT.base, reason: "v6 enamel primary fill, shared with the sites" }),
  Object.freeze({ token: "--accent-hi", disposition: "semantic", local: "ACCENT.hover", value: ACCENT.hover, reason: "v6 enamel-hi hover fill" }),
  Object.freeze({ token: "--ok", disposition: "semantic", local: "SIGNAL.ok", value: SIGNAL.ok, reason: "mint ready mark" }),
  Object.freeze({ token: "--danger", disposition: "semantic", local: "SIGNAL.refuse", value: SIGNAL.refuse, reason: "v6 refusal lamp text; the stop-red paint is SIGNAL.refusePaint with its own on-ink" }),
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

/** Pixel sizes and line heights; weights are unitless. Font stacks stay in TYPE. */
export const TYPE_SCALE = Object.freeze({
  caption: Object.freeze({ size: 11, lineHeight: 16, weight: 400 }),
  small: Object.freeze({ size: 12, lineHeight: 16, weight: 400 }),
  body: Object.freeze({ size: 13, lineHeight: 18, weight: 400 }),
  "body-strong": Object.freeze({ size: 13, lineHeight: 18, weight: 600 }),
  title: Object.freeze({ size: 14, lineHeight: 20, weight: 600 }),
  heading: Object.freeze({ size: 16, lineHeight: 22, weight: 600 }),
  display: Object.freeze({ size: 20, lineHeight: 26, weight: 600 }),
  hero: Object.freeze({ size: 24, lineHeight: 30, weight: 650 }),
  mono: Object.freeze({ size: 12, lineHeight: 16, weight: 400, fontVariantNumeric: "tabular-nums" }),
});

/** Four-pixel spacing grid and radius scale, in pixels. */
export const SPACE = Object.freeze({ 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 });

export const RADIUS = Object.freeze({ xs: 2, sm: 4, md: 6, lg: 10, pill: 999 });

/** Comfortable is the default; both densities retain 24-pixel interactive targets. */
export const DENSITY = Object.freeze({
  comfortable: Object.freeze({
    row: 28, control: 28, toolbarIcon: 32, panelHeader: 32, panelPadding: 12, body: 13,
  }),
  compact: Object.freeze({
    row: 24, control: 24, toolbarIcon: 28, panelHeader: 28, panelPadding: 8, body: 12,
  }),
});

/** Durations in milliseconds. Reduced-motion overrides belong to the stylesheet. */
export const MOTION = Object.freeze({
  fast: 100,
  base: 160,
  slow: 220,
  in: "cubic-bezier(.2,0,0,1)",
  out: "cubic-bezier(.4,0,1,1)",
});

/**
 * Text sizes in px (Cinematic Pro, fixed; product UI is not fluid).
 *
 * `floor` is DV-D2: no text below 11px, `aria-hidden` glyph marks excepted. The
 * one standing exception is `pinnedException`, the two selectors
 * `visual-refinement.test.ts` pins at 10px; no rule may override them. Beside the
 * pinned `TYPE_SCALE`, which does not size chrome headings (DV-P6 withdrawn).
 */
export const TYPE_SIZE = Object.freeze({
  floor: 11,
  panelHead: 11,
  ui: 12,
  mono: 12,
  body: 13,
  heading: 15,
  headingLarge: 17,
  pinnedException: 10,
});

/**
 * A 4px rhythm for panel content; structural archive metrics stay separate.
 * DV-D3 extends it to the sites' eight steps: `block`, `gutter` and `band` are
 * `--space-8`, `--space-11` and `--space-18`.
 */
export const SPACING = Object.freeze({
  unit: 4,
  small: 8,
  medium: 12,
  large: 16,
  section: 24,
  block: 32,
  gutter: 44,
  band: 72,
});

/** The spacing scale under the site names, so the chrome emits the same variables. */
export const SPACING_SCALE = Object.freeze({
  "--space-1": SPACING.unit,
  "--space-2": SPACING.small,
  "--space-3": SPACING.medium,
  "--space-4": SPACING.large,
  "--space-6": SPACING.section,
  "--space-8": SPACING.block,
  "--space-11": SPACING.gutter,
  "--space-18": SPACING.band,
});

/**
 * Chrome corner radii in px (v5 `RADIUS`, port name per DV-P5; the pinned `RADIUS`
 * above is the ui-kit scale and keeps its values). DV-D1: `panel` was 18px; 16px is
 * the card radius ceiling.
 */
export const CHROME_RADIUS = Object.freeze({ panel: 16, card: 13, control: 10 });

/**
 * The one outer shadow: floating layers (overlay card, palette, drawers). DV-D4
 * replaces the 60px blur with a tight 14px one; the 1px edge stays. The ink is
 * `SCRIM.shadow`, so it still moves with `SURFACE.backdrop`.
 */
export const ELEVATION = Object.freeze({
  float: `0 10px 14px -6px ${SCRIM.shadow}`,
});

/**
 * The motion system, shared with the sites (`FOUNDATION_MOTION_SYSTEM` in
 * `packages/site-kit/src/design-tokens.ts`, copied here because the dependency
 * matrix forbids the import, see `FOUNDATIONS_V2_SOURCE`). v5 named it `MOTION`;
 * DV-P5 lands it as `MOTION_SYSTEM` because the pinned `MOTION` above keeps its
 * values. Durations and delays in ms, distances in px.
 *
 * Rules the chrome keeps while reading these: only transform, opacity (inside
 * `@keyframes` only), clip-path and filter animate; **no `scale()` anywhere**, so
 * the sites' two `scale` tokens are not part of this table; anything toggled by
 * `hidden` enters by a keyframe and leaves at once. `duration.loop` and
 * `delay.loading` are the one exception to the 120–320ms band (DV-D6, ruling R-1).
 */
export const MOTION_SYSTEM = Object.freeze({
  duration: Object.freeze({
    press: 120,
    micro: 160,
    state: 200,
    panel: 280,
    panelExit: 200,
    route: 320,
    loop: 1200,
  }),
  delay: Object.freeze({ loading: 300 }),
  ease: Object.freeze({
    outQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
    outQuint: "cubic-bezier(0.22, 1, 0.36, 1)",
    outExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
  }),
  stagger: Object.freeze({ step: 40, max: 200 }),
  distance: Object.freeze({ sm: 4, md: 8, lg: 16 }),
});

/** `MOTION_SYSTEM` under the shared custom-property names, in the order the sites emit them. */
export const MOTION_CUSTOM_PROPERTIES: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(["--motion-duration-press", `${MOTION_SYSTEM.duration.press}ms`] as const),
  Object.freeze(["--motion-duration-micro", `${MOTION_SYSTEM.duration.micro}ms`] as const),
  Object.freeze(["--motion-duration-state", `${MOTION_SYSTEM.duration.state}ms`] as const),
  Object.freeze(["--motion-duration-panel", `${MOTION_SYSTEM.duration.panel}ms`] as const),
  Object.freeze(["--motion-duration-panel-exit", `${MOTION_SYSTEM.duration.panelExit}ms`] as const),
  Object.freeze(["--motion-duration-route", `${MOTION_SYSTEM.duration.route}ms`] as const),
  Object.freeze(["--motion-duration-loop", `${MOTION_SYSTEM.duration.loop}ms`] as const),
  Object.freeze(["--motion-delay-loading", `${MOTION_SYSTEM.delay.loading}ms`] as const),
  Object.freeze(["--motion-ease-out-quart", MOTION_SYSTEM.ease.outQuart] as const),
  Object.freeze(["--motion-ease-out-quint", MOTION_SYSTEM.ease.outQuint] as const),
  Object.freeze(["--motion-ease-out-expo", MOTION_SYSTEM.ease.outExpo] as const),
  Object.freeze(["--motion-stagger-step", `${MOTION_SYSTEM.stagger.step}ms`] as const),
  Object.freeze(["--motion-stagger-max", `${MOTION_SYSTEM.stagger.max}ms`] as const),
  Object.freeze(["--motion-distance-sm", `${MOTION_SYSTEM.distance.sm}px`] as const),
  Object.freeze(["--motion-distance-md", `${MOTION_SYSTEM.distance.md}px`] as const),
  Object.freeze(["--motion-distance-lg", `${MOTION_SYSTEM.distance.lg}px`] as const),
]);

/**
 * What `prefers-reduced-motion: reduce` overrides, after the chrome's pinned blanket
 * `animation-duration:.001ms` rule (`chrome.test.ts`), which stays first.
 */
export const MOTION_REDUCED_CUSTOM_PROPERTIES: readonly (readonly [string, string])[] =
  Object.freeze([
    Object.freeze(["--motion-distance-sm", "0px"] as const),
    Object.freeze(["--motion-distance-md", "0px"] as const),
    Object.freeze(["--motion-distance-lg", "0px"] as const),
    Object.freeze(["--motion-stagger-step", "0ms"] as const),
  ]);

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
