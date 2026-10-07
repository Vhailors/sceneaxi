---
name: SceneAxi
description: "Interlocking: a signal-box lever frame where every change is a route that is set, read, then committed or refused."
colors:
  # Keys are the CSS custom-property names that signalCss() in packages/site-kit/src/design-tokens.ts
  # emits (SIGNAL_COLORS), minus the leading "--". Unsuffixed = dark scheme (Persuade default, Operate dark).
  # "-light" = the value the same property takes under prefers-color-scheme: light (Operate only).
  # "kids-" = copied into sites/kids, never emitted by site-kit. "store-" = the [data-store] block.
  # ── Layer 1 · primitives: materials (elevation comes from the material) ──
  panel: "#2F4A44"
  panel-band: "#27403A"
  iron: "#1E2B28"
  iron-raised: "#263632"
  well: "#182320"
  # ── Layer 1 · primitives: ink and lines ──
  ink: "#F1EEE4"
  ink-2: "#BCD0C9"
  edge: "#86A39B"
  rule: "#4E6B64"
  siding: "#7F9A93"
  track: "#E9E6DC"
  # ── Layer 2 · semantic: enamel (primary action, default plate, focus) with its on-colour ──
  enamel: "#F1EEE4"
  enamel-hi: "#FFFFFF"
  on-enamel: "#1A2623"
  focus: "#F1EEE4"
  disabled-ink: "#BCD0C9"
  # ── Layer 2 · semantic: the four laws (lever paints), every fill with its on-colour ──
  pending: "#F2C230"
  on-pending: "#1A2623"
  pending-ink: "#F2C230"
  route: "#F2C230"
  verified: "#7BDDB0"
  on-verified: "#12241E"
  verified-route: "#7BDDB0"
  refused: "#C4362C"
  on-refused: "#FFFFFF"
  refused-lamp: "#FF9A8C"
  refused-lamp-hi: "#FFB3A8"
  stale: "#A3A9A4"
  on-stale: "#1A2623"
  # ── A-rich · semantic: lunar, the second accent (exclusive INSPECT role; never a CTA, link or decoration) ──
  lunar: "#C4B4FF"
  on-lunar: "#16112E"
  lunar-deep: "#5D4FA8"
  lunar-mark: "#C4B4FF"
  on-lunar-mark: "#16112E"
  # ── A-rich · semantic: commit (Accept). Yellow stays the COMMIT signal ──
  commit: "#F2C230"
  on-commit: "#1A2623"
  commit-hi: "#FFD45A"
  commit-edge: "#F2C230"
  # ── A-rich · primitives: planes and the lines that bound them (see SIGNAL_ELEVATION) ──
  bed: "#141C1A"
  plate: "#395A53"
  hair: "#9AB8B0"
  ink-2-plate: "#D2E2DC"
  enamel-ink-2: "#3F5550"
  enamel-rule: "#4E6B64"
  enamel-focus: "#1A2623"
  # ── Operate light scheme: same properties re-bound (paints and their on-colours are unchanged) ──
  panel-light: "#E7E9E3"
  panel-band-light: "#F4F4EF"
  iron-light: "#FBFBF8"
  iron-raised-light: "#EEEFEA"
  well-light: "#FFFFFF"
  ink-light: "#17221F"
  ink-2-light: "#3F5550"
  edge-light: "#6B807A"
  rule-light: "#C4CDC8"
  siding-light: "#6B807A"
  track-light: "#17221F"
  enamel-light: "#17221F"
  enamel-hi-light: "#000000"
  on-enamel-light: "#FFFFFF"
  focus-light: "#17221F"
  disabled-ink-light: "#3F5550"
  pending-ink-light: "#6B5000"
  route-light: "#9A7400"
  verified-route-light: "#1F8A5A"
  refused-lamp-light: "#A62A21"
  refused-lamp-hi-light: "#A62A21"
  # Lever paints keep the same value in both schemes; listed so every emitted -light binding is documented.
  pending-light: "#F2C230"
  on-pending-light: "#1A2623"
  verified-light: "#7BDDB0"
  on-verified-light: "#12241E"
  refused-light: "#C4362C"
  on-refused-light: "#FFFFFF"
  stale-light: "#A3A9A4"
  on-stale-light: "#1A2623"
  lunar-light: "#5B3FD0"
  on-lunar-light: "#FFFFFF"
  lunar-deep-light: "#C4B4FF"
  lunar-mark-light: "#E4DCFF"
  on-lunar-mark-light: "#17221F"
  commit-light: "#F2C230"
  on-commit-light: "#1A2623"
  commit-hi-light: "#FFD45A"
  commit-edge-light: "#7A5C00"
  bed-light: "#DFE3DC"
  plate-light: "#FFFFFF"
  hair-light: "#6B807A"
  ink-2-plate-light: "#3F5550"
  enamel-ink-2-light: "#BCD0C9"
  enamel-rule-light: "#86A39B"
  enamel-focus-light: "#FFFFFF"
  # ── Kids (own hue, light only; a copy in sites/kids) ──
  kids-sky: "#D6ECF4"
  kids-ink: "#13302A"
  kids-ink-2: "#2F4D46"
  kids-play: "#1E4FBF"
  kids-play-hi: "#173F9C"
  kids-on-play: "#FFFFFF"
  kids-disabled-bg: "#E9F3F6"
  kids-disabled-ink: "#4A625C"
  kids-refused-ink: "#8F241C"
  kids-board: "#6FAF55"
  # ── Store token block (the only Forge / Vitrine difference; both bind --store-plate) ──
  store-plate-forge: "#D9A066"
  store-plate-vitrine: "#9DBBF2"
typography:
  # t-* keys = the seven --t-* properties signalCss() emits (SIGNAL_TYPE_SCALE); font-data = the --font-data
  # face at body size. body-compact / body-kids / button / button-compact are DERIVED roles, not emitted
  # properties: they combine --font-prose with --density-body (compact 14px; Kids copy 18px).
  t-display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(3.5rem, 1.6rem + 6.2vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "0"
  t-h2:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2vw, 3rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
  t-h3:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.02em"
  t-plate:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  t-lede:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.5
  t-body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"tnum\" 1"
  body-compact:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\" 1"
  body-kids:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
  button-compact:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1
  font-data:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  t-small:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.3
    fontFeature: "\"tnum\" 1"
rounded:
  # radius-* = --radius-cast / --radius-station (SIGNAL_RADII). store-mark-radius-<id> = --store-mark-radius
  # inside [data-store="<id>"] (signalStoreBlockCss). kids-radius is a sites/kids copy, never emitted.
  radius-cast: "2px"
  radius-station: "50%"
  store-mark-radius-forge: "1px"
  store-mark-radius-vitrine: "50%"
  kids-radius: "14px"
spacing:
  # sp-* = --sp-* (SIGNAL_SPACING_PX). density-<prop>-<id> = --density-<prop> under data-density="<id>"
  # (SIGNAL_DENSITIES; kids recorded there with emitted:false, so its values are a sites/kids copy).
  # density-pad-<id> combines --density-pad-block / --density-pad-inline. wrap, mast-*, kids-play, kids-tile,
  # target-min* are layout constants owned by the lanes, not emitted by site-kit.
  sp-4: "4px"
  sp-8: "8px"
  sp-12: "12px"
  sp-16: "16px"
  sp-24: "24px"
  sp-32: "32px"
  sp-48: "48px"
  sp-72: "72px"
  sp-112: "112px"
  wrap: "1320px"
  density-control-comfortable: "44px"
  density-control-compact: "28px"
  density-control-kids: "56px"
  kids-play: "76px"
  kids-tile: "120px"
  target-min: "24px"
  target-min-kids: "44px"
  density-button-pad-comfortable: "22px"
  density-button-pad-compact: "12px"
  density-pad-comfortable: "24px 32px"
  density-pad-compact: "12px 14px"
  density-gap-comfortable: "16px"
  density-gap-compact: "8px"
  density-gap-kids: "24px"
  mast-persuade: "72px"
  mast-compact: "52px"
components:
  # ── Layer 3 · components. Only layer-1/2 references. Names follow the site-kit classes
  # (.sx-btn, .sx-plate[data-state], .sx-interlock[data-density]); review-* and mast are pilot (A6/A9) parts. ──
  sx-btn:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.on-enamel}"
    typography: "{typography.button}"
    rounded: "{rounded.radius-cast}"
    padding: "0 22px"
    height: "{spacing.density-control-comfortable}"
  sx-btn-hover:
    backgroundColor: "{colors.enamel-hi}"
    textColor: "{colors.on-enamel}"
  sx-btn-light:
    backgroundColor: "{colors.enamel-light}"
    textColor: "{colors.on-enamel-light}"
    rounded: "{rounded.radius-cast}"
  sx-btn-light-hover:
    backgroundColor: "{colors.enamel-hi-light}"
    textColor: "{colors.on-enamel-light}"
  sx-btn-compact:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.on-enamel}"
    typography: "{typography.button-compact}"
    rounded: "{rounded.radius-cast}"
    padding: "0 12px"
    height: "{spacing.density-control-compact}"
  sx-btn-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.radius-cast}"
    padding: "0 22px"
    height: "{spacing.density-control-comfortable}"
  sx-btn-quiet-hover:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
  sx-btn-disabled:
    backgroundColor: "{colors.iron-raised}"
    textColor: "{colors.disabled-ink}"
    rounded: "{rounded.radius-cast}"
  sx-btn-disabled-light:
    backgroundColor: "{colors.iron-raised-light}"
    textColor: "{colors.disabled-ink-light}"
    rounded: "{rounded.radius-cast}"
  sx-plate:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.on-enamel}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-plate-pending:
    backgroundColor: "{colors.commit}"
    textColor: "{colors.on-commit}"
    borderColor: "{colors.commit-edge}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-plate-verified:
    backgroundColor: "{colors.verified}"
    textColor: "{colors.on-verified}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-plate-refused:
    backgroundColor: "{colors.refused}"
    textColor: "{colors.on-refused}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-plate-stale:
    backgroundColor: "{colors.stale}"
    textColor: "{colors.on-stale}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-plate-unknown:
    backgroundColor: "{colors.stale}"
    textColor: "{colors.on-stale}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-plate-test:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.t-plate}"
    rounded: "{rounded.radius-cast}"
    padding: "3px 9px 3px 7px"
  sx-interlock-comfortable:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
    typography: "{typography.t-h3}"
    rounded: "{rounded.radius-cast}"
    padding: "{spacing.density-pad-comfortable}"
  sx-interlock-compact:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.radius-cast}"
    padding: "{spacing.density-pad-compact}"
  sx-interlock-reason-refused:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.refused-lamp}"
    typography: "{typography.t-small}"
  review-row:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
    typography: "{typography.font-data}"
    rounded: "{rounded.radius-cast}"
    padding: "12px 16px"
  review-before:
    backgroundColor: "transparent"
    textColor: "{colors.stale}"
    typography: "{typography.font-data}"
  review-before-light:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2-light}"
    typography: "{typography.font-data}"
  review-after-pending:
    backgroundColor: "{colors.pending}"
    textColor: "{colors.on-pending}"
    typography: "{typography.font-data}"
  review-after-verified:
    backgroundColor: "{colors.verified}"
    textColor: "{colors.on-verified}"
    typography: "{typography.font-data}"
  refusal-note:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.refused-lamp}"
    rounded: "{rounded.radius-cast}"
    padding: "{spacing.density-pad-compact}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.font-data}"
    rounded: "{rounded.radius-cast}"
    padding: "0 12px"
    height: "{spacing.density-control-comfortable}"
  mast:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
    typography: "{typography.t-body}"
    height: "{spacing.mast-persuade}"
  mast-compact:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    height: "{spacing.mast-compact}"
  store-acquire:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius-cast}"
    padding: "{spacing.density-pad-comfortable}"
  kids-play:
    backgroundColor: "{colors.kids-play}"
    textColor: "{colors.kids-on-play}"
    typography: "{typography.body-kids}"
    rounded: "{rounded.kids-radius}"
    height: "{spacing.kids-play}"
  kids-play-hover:
    backgroundColor: "{colors.kids-play-hi}"
    textColor: "{colors.kids-on-play}"
  kids-disabled:
    backgroundColor: "{colors.kids-disabled-bg}"
    textColor: "{colors.kids-disabled-ink}"
    rounded: "{rounded.kids-radius}"
    height: "{spacing.density-control-kids}"
---

# Design System: SceneAxi

<!-- A-rich amendment 2026-10-06 (docs/redesign-v6/concepts/a-rich/SPEC-DELTA.md, conductor ruling; not a human visual sign-off): adds lunar, commit, the bed/plate planes with hair, the enamel-plaque tokens, SIGNAL_SHADOWS, SIGNAL_ELEVATION, SIGNAL_SEQUENCE and an enforced 13px floor (--t-floor). Re-cross-checked by importing design-tokens.ts: report ~/Documents/Reports/sceneaxi-redesign-v6/a5a/arich-crosscheck.md. -->

<!-- v6 "Interlocking" (signal box). Source of truth: docs/redesign-v6/DIRECTION.md (G2 lock, concept A). Replaces the v5 system wholesale. Every frontmatter key is the CSS custom-property name signalCss() / signalStoreBlockCss() emits from packages/site-kit/src/design-tokens.ts (SIGNAL_VERSION "v6-interlocking") minus the leading "--", with the scheme, density or store as a suffix; keys the code does not emit (kids-*, derived type roles, lane layout constants) are labelled as such in the frontmatter comments. Cross-checked by importing design-tokens.ts on 2026-10-06: 0 name or value mismatches (report: ~/Documents/Reports/sceneaxi-redesign-v6/a5a/token-crosscheck.md). Contrast figures are WCAG 2.x pair math from the exported contrastRatio(); release evidence is browser-computed per state. -->

## Overview

**Creative North Star: "The Signal Box"**

SceneAxi is drawn as a railway signal-box lever frame. The page is a matte slate-green track-diagram panel. Containers are cast-iron frames, labels are cream enamel plates, and only the levers are saturated. Their four regulation paints are the four product laws: pending, verified, refused and stale. A change is a route being set: the JSON Pointer is the route, each segment a station, the leaf the terminal. Committing throws the lever. A refusal is an interlock: the lever will not travel and its plate names the reason. Route, lever and interlock are visual vocabulary only and never appear in UI copy.

The identity is structural, not chromatic. It survives forced colors, the CSP-locked web shell's system fonts, and the Kids hue change because it lives in WHERE / BEFORE / AFTER rows, label-plus-icon state plates, 2px cast corners, and a condensed plate face set over humanist prose. The field is mid-dark, matte and coloured: not near-black with a neon accent, and not cream editorial.

One family, three dialects, and density is chosen by placement, never inherited. **Persuade** (umbrella marketing, store home and item page) is monumental: 56→96px display, 72–112px bands, one detented lever throw in the hero. **Operate** is the frame as an instrument, in two densities: **comfortable** (account, login, pricing panels, errors, the store acquire block) and **compact** (web-shell inspector, umbrella editor dock and ledger, desktop chrome and docks), with no ambient motion; web shell and desktop follow the system light/dark scheme. **Kids** is the model-railway version of the same frame: its own sky and blue, targets of at least 44px (aim 56), round stations, 14px corners, calm motion.

**Key Characteristics:**
- Matte slate-green panel, cast-iron frames, cream enamel; saturation reserved for the four state paints.
- State is always label + icon + paint, never paint alone.
- Change Review (propose → inspect rows → commit or refuse, with consequence and recovery named) is the signature on every surface; only density changes.
- Three faces with one job each: condensed plate for headings and plates, humanist prose for everything read, mono for data only.
- Material elevation on four levels over six planes (bed and well, panel, plate and iron, enamel), each step a lightness change plus an offset shadow; no glass, glow, gradient or blur.
- Two accents with exclusive jobs: lunar marks what is under INSPECTION; caution yellow is the COMMIT signal.
- One authored motion moment in three acts (propose → inspect → commit) that ends armed, never committed; everything else switches instantly; reduced motion is three labelled stills with identical meaning.

## Colors

A slate-green and cast-iron field with cream enamel, where colour is spent only on the four regulation lever paints.

Every colour has three layers. **Primitives** are the materials and lines (panel, panel-band, iron, iron-raised, well, ink, ink-2, edge, rule, siding, track). **Semantic** tokens give them a job (enamel, on-enamel, focus, disabled-ink, the four paints with their on-colours, route, refused-lamp). **Component** tokens in the frontmatter reference only those two layers. In CSS the light scheme re-binds the same property names under `prefers-color-scheme: light` (Operate only, via `signalCss({ scheme: "system" })`); the `-light` suffix exists only in this file.

### Primary
- **Cream Enamel** (enamel): the primary button, the default plate face and the wordmark on the dark field. Ink is **Signal-Box Black-Green** (on-enamel) at 13.45:1; hover lifts the fill to **Bare White** (enamel-hi) at 15.61:1 with the same ink. In the light scheme enamel is near-black with white ink (16.34:1), hover pure black (21:1).
- **Focus Enamel** (focus, `--focus`): the 3px focus ring, offset 3px. At least 8.28:1 on every dark surface and 13.36:1 on every light one.

### Secondary: the four laws (lever paints)
Each fill ships with its on-colour; none is ever the only carrier of meaning. Paints and on-colours are identical in both schemes.
- **Caution Yellow** (pending) with on-pending, 9.32:1: "Pending review · unwritten". Also `::selection`. As text on a surface use pending-ink (dark 5.74 on panel; light 6.19); as a route line use route (light 3.52 on panel).
- **Clear Mint** (verified) with on-verified, 9.88:1: "Verified · written". Never on a button. The verified route line is verified-route (light 4.18 on iron).
- **Stop Red** (refused) with on-refused, 5.37:1: refused or rejected, as a filled plate only.
- **Unpainted Iron** (stale) with on-stale, 6.52:1: "Superseded · not actionable" and "Apply outcome pending"; also the BEFORE strike on dark.
- **Signal Lamp** (refused-lamp): refusal text, only on iron (7.16), raised (6.19) or well (7.89). On the panel use **Bright Lamp** (refused-lamp-hi, 5.62). Light scheme: 6.81 on iron, 5.77 on panel. Target ≥ 5.5:1 browser-computed.

### Second accent: lunar (inspect) and commit
In railway signalling, lunar white is the calling-on aspect: proceed at caution, examine the line. Lunar (OKLCH hue ≈ 255°) marks only what is under inspection: the difference ring, the `Differs` tag, the edited leaf station on a pending route, the diff `<mark>` in Change Review and the inspect phase bar. It is never a call to action, a link colour or decoration.
- **Lunar** (lunar, `--lunar`): text-grade on panel 5.18, panel-band 6.02, iron 7.91, iron-raised 6.83, well 8.71, bed 9.35. **On the raised plate it is 4.10:1: UI and large text only, never body text** (the pair carries `uiOnly` in `SIGNAL_PAIRS`). Light scheme #5B3FD0: 5.27–6.85 on every plane, plate included.
- **On Lunar** (on-lunar): ink on a lunar fill (the `Differs` tag), 9.81 dark, 6.85 light.
- **Lunar Deep** (lunar-deep): lunar as ink on the enamel plaque, 5.74 dark, 8.81 light.
- **Lunar Mark** (lunar-mark) with **On Lunar Mark** (on-lunar-mark): the Change Review diff `<mark>`, 9.81 dark, 12.44 light; in light the lunar underline on the mark is 5.21.
- **Commit** (commit, the same paint as pending) with on-commit 9.32 and **Commit Hover** (commit-hi) 11.01: the Accept button, the write that waits for a person's throw. **Commit Edge** (commit-edge) is its 2px boundary: 4.54–9.64 dark; light #7A5C00 5.11–6.25, because the yellow fill alone is 1.68 on the light well.

### Planes
- **Recessed Bed** (bed): level −1, the capture band, image mats, docks and route strip. Ink 14.94, ink-2 10.74, edge 6.38 (light 12.57 / 6.15 / 3.24).
- **Raised Plate** (plate): level +1, spec rows, legend, decision and record. Ink 6.55; secondary text uses **Plate Lichen** (ink-2-plate, 5.67; ink-2 would be 4.71). Light: white, ink 16.34.
- **Plane Hairline** (hair): the line that bounds a plane, ≥ 3:1 on every plane it touches: panel 4.51, panel-band 5.24, iron 6.89, iron-raised 5.95, well 7.58, bed 8.14, plate 3.57 (light 3.24–4.21).
- **Enamel plaque** (level +2) inks: **Enamel Lichen** (enamel-ink-2) 6.89, **Enamel Rule** (enamel-rule) 5.01, and the ring flips to **Enamel Focus** (enamel-focus) 13.45, because `--focus` is cream on cream (1:1) there.

### Tertiary: store plate
- **Forge Brass** (store-plate-forge; panel 4.20, so large text and UI only; iron 6.41) and **Vitrine Glass Blue** (store-plate-vitrine; panel 4.96, iron 7.56). In CSS both bind the single property `--store-plate`, with `--store-mark-radius` 1px (Forge) or 50% (Vitrine), emitted by `signalStoreBlockCss()`. This block is the only CSS difference between catalog-game and catalog-web.

### Neutral
- **Track-Diagram Slate** (panel): the page field. Ink 8.28, ink-2 5.95 (the lowest body-text pair in the system).
- **Panel Band** (panel-band): alternating sections and route strips; ink-2 6.91.
- **Cast Iron** (iron): frames, mast, acquire block, interlocks, refusal note box; ink 12.64.
- **Raised Iron** (iron-raised): decision block, lever row, table head, disabled button fill; edge 4.66.
- **Quadrant Well** (well): inputs, code wells, image matte; edge 5.94.
- **Plate Cream** (ink) and **Lichen** (ink-2): text. Nothing on the panel is softer than ink-2. Disabled labels use disabled-ink (`--disabled-ink`; dark 7.85 on raised; light 6.92, above the 5.74 baseline).
- **Boundary Sage** (edge): every control boundary and meaningful region edge; 3.54 on panel, 5.40 on iron (light: 3.44 on panel, 3.64 on raised, 4.06 on iron).
- **Hairline** (rule): decoration only, inside a framed component, 1.65 on panel, 1.57 light. A line that bounds a plane is hair, never rule.
- **Siding Grey** (siding): unset track, scrollbar thumb, nav hover underline; UI only (3.18 panel, 4.85 iron).
- **Track Cream** (track): the set route line on bands; 8.94 dark, 14.81 light.

### Kids
Copied into `sites/kids` (it imports no SceneAxi package; `signalCss({ surface: "kids" })` refuses with `KIDS_SURFACE_DENIED`). Sky with kids-ink 11.57, kids-ink-2 7.56; Play is white on kids-play 7.18, hover kids-play-hi 9.43; kids-play as UI on sky 5.87; kids-refused-ink 7.04; kids-board with kids-ink 5.35; disabled kids-disabled-ink on kids-disabled-bg 5.83 with a dashed border.

### Named Rules
**The Four Laws Rule.** Pending, verified, refused and stale are product law, not decoration. Their paints appear only on state plates, set route, AFTER marks and lamps, always beside a label and one of the authored state icons (clock, check, octagon-bar, rewind-slash, flask for TEST, empty square for Isolated).

**The On-Colour Rule.** Every fill is used with its declared on-colour and nothing else. A pair that is not in `SIGNAL_PAIRS` is not a sanctioned combination.

**The Stop-Red Rule.** Stop red is a fill, never text on dark and never a bare UI shape on the panel (1.79:1); a refused station on the panel gets a 2px edge outline or sits on iron. The old value in a diff is never red.

**The Edge-Not-Rule Rule.** A control or meaningful region is bounded by edge (≥ 3:1). Rule is a hairline that may appear only where edge or a fill difference already identifies the thing.

**The Steady Ink Rule.** Links never change ink: hover thickens the underline from 1px to 3px at zero specificity. Every button declares its own ink in every state through `--b-ink`. No `a:hover { color }` rule exists anywhere.

## Typography

**Display Font:** Big Shoulders Display (with Arial Narrow, sans-serif)
**Body Font:** Atkinson Hyperlegible Next (with system-ui, sans-serif)
**Label/Mono Font:** Atkinson Hyperlegible Mono (with ui-monospace, monospace)

**Character:** A condensed, cast-letter plate face for headings and state plates, set over a humanist face built for legibility. Hierarchy comes from the contrast between the two, not from weight alone. Mono is for pointers, digests, values and codes only.

### Hierarchy
- **Display** (800, 56→96px, 0.88): Persuade h1 only. Sizes are the `--t-display`, `--t-h2`, `--t-h3`, `--t-lede`, `--t-body`, `--t-plate` and `--t-small` tokens; faces are `--font-plate`, `--font-prose`, `--font-data`.
- **H2** (800, 32→48px, 0.95): section heads.
- **H3** (700, 24px, 1.05, +0.02em): the comfortable interlock title (`--density-title`). Compact interlocks set a 16px title in the prose face, inline with the plate.
- **Plate** (700, 15px caps, +0.06em, 1.2): state plates and the TEST plate. Never smaller.
- **Lede** (400, 19px, 1.5): the lede, max 34ch; the umbrella mobile LCP element.
- **Body** (400, 16px, 1.55; compact 14px/1.45; Kids 18px/1.5): prose at 60–68ch, docs 65–75ch. Set through `--density-body`.
- **Button** (700, 16px comfortable / 14px compact, 1): button labels, always the prose face.
- **Data** (400, 16px, 1.4): values and the route leaf (never truncated).
- **Small** (400, 13px, 1.3): digests, path segments, compact evidence. The smallest text in the system.

### Named Rules
**The Plate-Face Rule.** Big Shoulders is used at 15px or larger, for headings and plates only; never for values, prose, labels, buttons or anything read character by character.

**The Thirteen Floor Rule.** No text renders below 13px (`SIGNAL_TEXT_FLOOR_PX`, emitted as `--t-floor`). It is enforced, not advised: design-tokens.ts refuses to load if any `--t-*` step (a clamp() at its minimum) or any density body, title or evidence size is under it, and the base layer pins `<small>` to `max(var(--t-floor), 0.8em)`. A component that needs smaller text is wrong, not the floor (the A-rich 4-refusals screen measured 12.19px and was fixed).

**The Mono-Is-Data Rule.** Mono marks pointers, digests, values and codes. It is never a "technical" costume for labels or headings.

**Font notes.** All three faces are SIL OFL 1.1 variable woff2 (Big Shoulders Display 2.002, Atkinson Hyperlegible Next 2.001, Atkinson Hyperlegible Mono 2.001; about 85 KB together), self-hosted with `OFL.txt` beside the files, `font-display: swap`, preloading only the prose face. No remote font request on any surface. The web shell's CSP (`default-src 'none'`) means it renders in the declared system fallbacks, and those fallbacks are the reviewed design there. `text-wrap: balance` on headings, `pretty` on paragraphs, `tabular-nums` globally. Pending legibility gate: OCR at 13px mono and 15px plate caps must score ≥ 0.847 at 100% and 200%, or the role falls back (mono → prose 14px; plate → prose 700 caps).

## Layout

The spacing scale is 4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 / 112 (`--sp-4` … `--sp-112`). Persuade wraps at 1320px with 72–112px section bands and gutters of `clamp(32px, 8vw, 112px)`. Operate compact uses a three-column desk (300px / fluid / 340px) under a 52px mast. Kids gaps are 16–24px.

Density is a set of `--density-*` properties. `:root` and `[data-density="comfortable"]` carry comfortable; `[data-density="compact"]` re-binds them on the element that declares it. Kids is a copy in `sites/kids`, not emitted by site-kit.

| Density | `--density-control` | `--density-body` | `--density-pad-block` / `-inline` | `--density-gap` | `--density-title` / `-evidence` | Target rule |
|---|---|---|---|---|---|---|
| Kids | 56 (Play 76) | 18px | 24 / 32 | 24 | 24 / 18 | ≥ 44, aim 56; choice tiles ≥ 120 |
| Comfortable | 44 | 16px | 24 / 32 | 16 | 24 / 14 | ≥ 44 primary, ≥ 24 all |
| Compact | 28 | 14px | 12 / 14 | 8 | 16 / 13 | ≥ 24×24 |

Desktop maps its pinned `DENSITY` setting comfortable/compact onto the same rows and never scales.

The Change Review's DOM order is its visual order and its tab order: status plate, rows, decision (consequence, recovery sentence, actions), then digests, then the raw diff. At ≥ 960px digests may sit beside the rows only if DOM order still matches reading order. Below 760px the route track runs vertically. At 390×844 the status plate and the first complete row sit in the first viewport after Propose, and Accept is ≤ 5 Tab stops from the review heading.

The masthead never scrolls sideways. Below an em-based width it shows the wordmark, Download (always visible), and a Menu disclosure (`aria-expanded`, Escape closes, focus returns) holding the rest, Account included. Every item is reachable at 1280px @ 200% zoom and at 320 CSS px. Sticky chrome sets `scroll-padding-top` so focus is never obscured.

### Named Rules
**The Placement Rule.** Density comes from where a component sits (`data-density` on that element), never from a global state class. An acquire block is comfortable inside a compact grid; a dock is compact on a Persuade page.

**The Status-First Rule.** The status plate is the first thing seen, focused and announced in every review.

## Elevation & Depth

Depth comes from material and lightness steps plus an offset shadow, never from glow or blur, and the hierarchy still reads in greyscale. There are four levels over six planes (`SIGNAL_ELEVATION` in design-tokens.ts; desktop mirrors it as `INTERLOCKING_ELEVATION`):

| Level | Plane | Shadow | Boundary (≥ 3:1) | Secondary text | Focus | Used for |
|---|---|---|---|---|---|---|
| −1 | `--bed` | `--sink` | `--hair` 8.14 | `--ink-2` | `--focus` | capture band, image mats, docks, route strip |
| −1 | `--well` | `--sink` | `--edge` 5.94 | `--ink-2` | `--focus` | inputs, code wells, wells inside the acquire block |
| 0 | `--panel` (`--panel-band` alternates) | none | none (the field) | `--ink-2` | `--focus` | the page field |
| +1 | `--plate` | `--lift-1` | `--hair` 4.51 outside, 3.57 inside | `--ink-2-plate` | `--focus` | spec rows, legend, decision, record |
| +1 | `--iron` (`--iron-raised` is its inner step) | `--lift-1` | `--edge` 5.40 | `--ink-2` | `--focus` | capture frames, hero diagram, interlocks, controls |
| +2 | `--enamel` | `--lift-2` | `--enamel-rule` 5.01 | `--enamel-ink-2` | `--enamel-focus` | editorial pull plaque |

The planes are solid fills with no texture or noise and must stay crisp at 390px on DPR 1 and 2.

### Shadow Vocabulary
`SIGNAL_SHADOWS`, each re-bound under the light scheme:
- **Sink** (`--sink`): `inset 0 2px 0 #00000066, inset 0 0 0 1px #00000040`. Bed and well are pressed in.
- **Lift 1** (`--lift-1`): `0 1px 0 #FFFFFF14 inset, 0 14px 24px -14px #000000B3`. One inset top light plus a negative-spread drop, so the plate or frame sits one step forward.
- **Lift 2** (`--lift-2`): `0 1px 0 #FFFFFF inset, 0 28px 48px -24px #000000CC, 0 4px 10px -6px #00000080`. The enamel plaque and the acquire block on iron.
- **Lever contact** (`box-shadow: 0 6px 10px -6px` in iron): the lever arm in the Persuade hero and comfortable interlock.

### Named Rules
**The Cast-Not-Glass Rule.** No glass, glow, gradient or blur anywhere, and no shadow outside the four above. Every shadow is offset; none spreads light around an edge. If something needs to stand forward, it moves up one level and takes that level's plane, shadow and boundary together.

**The Hair-Bounds-Planes Rule.** A plane that meets another plane is bounded by `--hair` or `--edge` as the table says, never by `--rule` alone.

**The Forced-Colors Rule.** Under `forced-colors: active`, plates, interlocks, rows and the decision block take `1px solid CanvasText`, buttons take `ButtonText` borders, the AFTER mark uses `Mark`/`MarkText`, track uses `CanvasText`, and icons stroke in `CanvasText`/`currentColor`, so label + icon survive.

## Shapes

Cast corners: 2px (`--radius-cast`) on frames, controls, plates and inputs; the store mark takes `--store-mark-radius` (1px Forge, 50% Vitrine). Round junctions (`--radius-station`, 50%) appear only on route stations, the Vitrine store mark and Kids pieces. Kids scales the same corner family up to 14px. Borders are 1px edge on interlocks, 1px rule on decorative frames, and 2px on buttons (the button's own `--b-edge`). Outline-only plates (TEST, Isolated) draw a 2px inset edge. Disabled is drawn as a dashed edge border. Icons are authored on a 24px grid, 2px round stroke, `currentColor`. No coloured side rails over 1px.

## Components

### Buttons
Enamel lever plates: solid, square-cornered, declared ink in every state (`.sx-btn`, ink through `--b-bg` / `--b-ink` / `--b-edge`).
- **Shape:** cast corners (2px), 2px border in `--b-edge`.
- **Primary:** enamel fill, on-enamel ink, prose 700 at `--density-body`, height `--density-control` (44 comfortable, 28 compact), padding `--density-button-pad` (22 / 12), minimum width 24px.
- **Hover / Focus / Active:** hover moves fill and border to enamel-hi with the same ink. Focus is the 3px focus ring offset 3px. Active presses down 2px over `--catch` (90ms linear). `:link`, `:visited`, `:hover`, `:focus-visible` and `:active` all re-assert `--b-ink`.
- **Quiet** (`data-variant="quiet"`): transparent, ink text, edge border; hover fills iron and the border turns enamel.
- **Disabled** (`:disabled` or `aria-disabled="true"`, including while hovered or pressed): raised-iron fill, disabled-ink text, dashed edge border, `not-allowed`, no press. Never fade alone.

### State plates
- **Style:** `.sx-plate[data-state]` for pending, verified, refused, stale, unknown, test and isolated. Plate face, 15px caps, the state paint with its on-colour, one 18px `.sx-icon` in `currentColor`, and the product label from `SIGNAL_STATES` ("Pending review · unwritten", "Verified · written", "Rejected · nothing written", "Superseded · not actionable", "Apply outcome pending"). TEST and Isolated are outline-only.
- **Pending pair (`.sx-plate--pending`, `@layer components`):** the yellow plate is ONE class: commit fill, on-commit ink (9.32:1) and a 1px inset `--commit-edge` line, never the fill alone. In light the fill is 1.37:1 on panel and so not a boundary; the line is #7A5C00 (5.11:1 on panel, ≥ 4.81 on every plane). In dark the line is the fill (5.74:1 on panel). Under forced colours it adds a 1px CanvasText border. `.sx-plate[data-state="pending"]` resolves to the same rule. Surfaces that cannot import site-kit inline `OPERATE_PENDING_PLATE_CSS` (web-shell, drift-tested) or read `INTERLOCKING_PENDING_PLATE` (desktop mirror). Lanes do not write their own yellow fill rule.
- **State:** switches instantly (`--state`, 0ms).

### Frames / Containers
- **Corner Style:** 2px.
- **Background:** iron on the panel, raised iron for decision blocks and table heads; plate for spec rows, legend, decision and record; bed for capture bands and docks.
- **Shadow Strategy:** the level's shadow from the Elevation table (`--sink`, `--lift-1`, `--lift-2`), nothing else.
- **Border:** hair when the frame bounds a plane, edge when it bounds a control or meaningful region, rule only for decoration inside a frame.
- **Internal Padding:** `--density-pad-block` / `--density-pad-inline`.

### Inputs / Fields
- **Style:** well fill, edge border, 2px corners, data face for pointer and value fields, height `--density-control`.
- **Focus:** 3px focus ring, offset 3px; never obscured by sticky chrome.
- **Error / Disabled:** `:user-invalid` border in refused-lamp (light value re-binds) plus a text reason; disabled as for buttons.

### Navigation
- **Style:** iron mast, 72px Persuade / 52px compact, wordmark in the plate face. Links are prose 500 with a 3px inset underline: siding on hover, enamel and 700 for `aria-current="page"`. Ink never changes. Narrow and zoomed widths collapse to Download + Menu disclosure; no horizontal scroller.

### Interlock (refusal and state panel)
`.sx-interlock[data-density]` on iron with a 1px edge: plate, title, reason (`.sx-interlock-reason`, mono, verbatim registry text, refused-lamp when `data-state="refused"`), evidence `dl` (`.sx-interlock-evidence`), one forward path. **Comfortable:** 24/32 padding, plate stacked over a 24px plate-face title, lever drawn; Persuade pages and the store acquire block. **Compact:** 12/14 padding, no lever, 16px prose title inline with the plate, 13px evidence; inspector, docks, editor. **Kids:** a kind sentence and icon, no codes.

### Change Review (signature)
Propose → inspect → commit or refuse, identical on the umbrella hero, web-shell inspector, umbrella editor dock and desktop changes dock.
- **Rows:** an ordered list, one row per edit. WHERE shows the document path and the pointer drawn as route (leaf never truncated; long routes wrap onto a second line of track; the edited leaf station is lunar while under review). BEFORE is mono, struck through in stale (light: ink-2), never red. AFTER is a `mark`: lunar-mark with on-lunar-mark while it is inspected, verified once written.
- **Decision:** the consequence ("Accept writes all N edits … whole or not at all"), the single recovery sentence, then Accept, Reject, Recover and Reconcile. Accept is the commit button: commit fill, on-commit ink, commit-hi on hover, 2px commit-edge.
- **Digests:** after the actions; `sha256:` + first 12 and last 4 hex with an ellipsis, one line at 390, each with a Copy button whose accessible name carries the full value.
- **Sequence (hero autoplay and the Change Review echo):** `SIGNAL_SEQUENCE`, keyed on `[data-armed]`, which JS sets only under `prefers-reduced-motion: no-preference`. Propose `--seq-propose-delay` 0ms for `--seq-propose-duration` 900ms (yellow phase bar); inspect `--seq-inspect-delay` 1150ms for `--seq-inspect-duration` 750ms (lunar scan `--seq-scan` 760ms, leaf ring to lunar, `Differs` tag); commit `--seq-commit-delay` 2250ms for `--seq-commit-duration` 550ms. Each act's phase bar takes `--seq-bar` 280ms; marks and rows revealed in turn step by `--seq-stagger` 80ms; every move eases on `--seq-ease` (cubic-bezier(0.16, 1, 0.3, 1)). The autoplay ends **ARMED, not committed** (`SIGNAL_SEQUENCE_END`): Accept is painted commit yellow and waits; the thrown commit plays only when a person presses Accept (Reject throws to refused). Content is final by default (fill `backwards`), runs once, never loops. Under reduced motion every `--seq-*` token is 0ms, `--seq-ease` is linear, nothing is armed, and the hero shows three labelled stills: "1 · Propose", "2 · Inspect", "3 · Commit".
- **Motion (the thrown commit):** Commit plays `--catch` 90ms linear, `--throw` 260ms on `--ease-throw` (cubic-bezier(0.16, 1, 0.3, 1), no overshoot), `--lamp` 360ms on `--lamp-steps` (steps(6)) station by station, `--settle` 420ms ease-out clip reveal of the after value; ≤ 780ms, once, only when JS sets `[data-armed]`. Reject or refuse turns the blocked station into a red square (outlined on the panel) and the track beyond to siding. Only `transform`, `clip-path` and `offset-distance` animate. Under `prefers-reduced-motion: reduce` every duration token is 0ms, `--ease-throw` is linear, `--lamp-steps` is steps(1), and the final state renders in place.

### Kids Play
Kids-play fill with white ink, 76px tall, 14px corners, hover to kids-play-hi. The only loop is the train, 14s per lap, while Play is on; parked under reduced motion.

## Do's and Don'ts

### Do:
- **Do** pair every state paint with its plate label and icon; check the page in grayscale and forced colors.
- **Do** bound every control with edge (≥ 3:1) and measure contrast in default, hover, focus, active and disabled, in both schemes, in the browser.
- **Do** set button ink through `--b-ink` in every state, and let links change only underline thickness (1px → 3px).
- **Do** choose density by placement with `data-density`: comfortable for the store acquire block and account pages, compact for docks and the inspector, the Kids copy for the studio.
- **Do** keep the status plate first in DOM, focus and announcement order, and keep one copy of the recovery sentence.
- **Do** theme the browser surfaces: `::selection` pending on on-pending, the 3px focus ring offset 3px, `scrollbar-color` siding on iron, `text-underline-offset: 0.24em`, tabular numerals.
- **Do** scope `[hidden] { display: none !important }` to each world root, not globally.
- **Do** show a static, server-rendered Change Review as the hero; any later 3D must demonstrate the review at 60fps, keep LCP < 2.5s and ship this static hero as its fallback.

### Don't:
- **Don't** reuse the v5 signal-orange bench or the Cinematic Pro cyan, their near-black fields, their soft 10–16px radii, or Archivo with mono labels over everything.
- **Don't** build new UI on the legacy `foundationsCss()` sheet or its `--accent`, `--bg-*`, `--fg-*` properties; they are the v5 world awaiting removal, not part of this system.
- **Don't** write an `a:hover` colour rule; it produced the v5 1.20:1 button-ink defect.
- **Don't** use stop red as text on dark, or show the old value in red; this is not a git red/green diff.
- **Don't** put mint on a button.
- **Don't** use rule as the only boundary of a control.
- **Don't** use glass, glow, gradients, blur, hard offset shadows or coloured side rails over 1px.
- **Don't** put an eyebrow or kicker above a heading, build pages from icon-heading-text card grids, or use hero-metric blocks.
- **Don't** use mono as a technical costume, emoji as icons, or the plate face below 15px.
- **Don't** fade a control to show it is disabled without the dashed edge border.
- **Don't** add rivets, wood grain, rust or skeuomorphic levers in Operate; the lever is drawn only in the Persuade hero and the comfortable interlock.
- **Don't** let "lever", "route" or "interlock" into UI copy.
- **Don't** link, name or theme Kids from any other surface, or import SceneAxi packages into it.
