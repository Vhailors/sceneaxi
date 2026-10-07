# Surface brief: Kids dialect

Mode brief for the v6 "Interlocking" world. World tokens and rules: `DESIGN.md` `kids-*` keys and `rounded.kids-radius` (copied, not imported; `signalCss({ surface: "kids" })` refuses with `KIDS_SURFACE_DENIED`). Density values mirror site-kit `SIGNAL_DENSITIES` id `kids` (control 56, body 18, padding 24/32, gap 24, target min 44), which is recorded there but not emitted. Source of truth: `docs/redesign-v6/DIRECTION.md` §3, §5.5, §7, §9.

**Surfaces:** `sites/kids` studio `/`, loading, global-error. Lane A8. `sites/kids/src/lib/**` is never touched. Kids imports no SceneAxi package; tokens, icons and fonts are copies in `sites/kids`. Never linked, named or themed from another surface; no account words.

## Direction contract

THESIS: The same frame as a model-railway layout a child can play with: pick a place, add a few things, press Play, and the train runs. It refuses the category default of a candy-coloured cartoon UI with bouncy motion and tiny targets.

OWN-WORLD: Light sky field #D6ECF4 with ink #13302A, its own blue #1E4FBF for Play (white text 7.18; hover #173F9C), grass board #6FAF55, round stations, plates and label + icon states from the family core with corners scaled 2px → 14px. Same three faces; body 18px.

STORY: The child understands what to do from one short kind sentence ("Pick a place. Add a few things. Press Play when it feels ready."), makes choices on large tiles, and presses Play. If something cannot happen, a kind sentence and an icon say so, with no codes.

FIRST VIEWPORT: The SVG model-railway board with the instruction sentence above it, choice tiles (≥ 120px) beside or below, and Play (76px tall) reachable without scrolling at 390 and 1440.

FORM: SVG board (no WebGL; first and only on the ordered list). Seed key: `concept-a-interlocking` (G2 lock; no impeccable roll was run for this lock). Reference markup: `docs/redesign-v6/concepts/a/5-kids.html`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Dialect rules

- Targets ≥ 44px, aim 56px; Play 76px; choice tiles ≥ 120px; gaps 16–24px.
- Motion: calm. The only loop is the train, 14s linear per lap, only while Play is on; parked under `prefers-reduced-motion: reduce`. No bounce, no overshoot.
- Disabled: #4A625C on #E9F3F6 (5.83) with a dashed border; never fade alone.
- Refusal: kind sentence + icon in #8F241C (7.04); no registry codes shown to the child.
- Copy: short kind sentences from `kids-activity.ts`. No account, pricing or SceneAxi product words.
- CSS ≤ 13,056 B (60% of 21,760).
