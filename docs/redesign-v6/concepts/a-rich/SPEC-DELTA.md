# Concept A-rich · Interlocking, enriched: spec delta vs A

`docs/redesign-v6/concepts/a-rich/` is a copy of `concepts/a/`, which stays untouched for side-by-side comparison. Everything in A's `SPEC.md` still holds unless it is overridden below. The enrichment is a layer appended to the end of `a.css`, below the line `A-RICH LAYER`, so the delta can be read as a block.

**Binding human feedback, applied as given:**
- Keep the green palette and the Propose / Inspect / Commit hero as the signature.
- Fix the flat green field below the hero.
- Fix the empty gallery boxes.
- Add one supporting accent.
- Make the motion play propose → inspect → commit, with a reduced-motion form.

**What an agent could and could not judge.** No agent in this run can view PNGs. Every statement below rests on DOM geometry, computed styles, browser-composited contrast, or luminance statistics decoded in-page. The visual call stays with the human gate.

## 0. Why the gallery was empty (measured)

The diagnosis in the brief was that `concepts/a/assets/desktop-*.png` was missing. That is not what the measurements show:

- The three files **exist** and are byte-identical to `sites/umbrella/public/proof/` (same sha256: change-review `670ccdb0…`, run-viewport `5f9b3a4e…`, local-build `ca17e1f1…`).
- A's `<img>` tags carry `loading="lazy"`. The boxes were empty because A's full-page screenshots were taken without scrolling, so the browser never fetched the lazy images.
- `shots/metrics.json → originalLazy` records this. It loads A's page at 1440 without scrolling, and all three images report `complete: false, naturalWidth: 0`.

A-rich fixes the problem from both sides:
- **Markup:** images use `decoding="async" fetchpriority="low"` without `lazy`, keep `width`/`height`, and sit in a matte `--well`, so a slow fetch never leaves a box that reads as empty.
- **Harness:** `shots/_work/shoot.mjs` scrolls the page and awaits `img.decode()` before every shot.

## 1. What changed vs A, by screen

| Screen | A | A-rich |
|---|---|---|
| 1 Umbrella: hero | Same diagram. Levers throw once. Accept is enamel. | **Same composition** (signature kept). Each act now has a phase bar: propose = yellow, inspect = lunar, commit = hollow `--hair` until a decision, then mint or lamp-red. The after-value carries a lunar inspection ring plus a `Differs` tag (label + icon, so colour is never the only cue). The edited leaf station is ringed lunar. Accept is painted **commit yellow**. A `Replay the sequence` control re-arms the CSS sequence. A three-still strip appears under reduced motion. |
| 1 Umbrella: below the hero | A flat `--panel-band` board of text rows, then a gallery on the same panel whose 3 images did not load. | A composed sequence on **four planes** (§3): **(a)** a full-bleed **capture band** on the recessed `--bed` with all **4 real captures** in raised iron frames over inset `--well` mats; **(b)** dense **spec rows** on a raised `--plate` with ≥ 3:1 hairlines and a 4/8 head column; **(c)** an **editorial pull** on an enamel plaque (`--lift-2`), set in display type with dark ink. The rhythm runs dark/dense imagery → mid/dense text → light/sparse type. |
| 2 Store item | Field-coloured record, acquire block with a 1px edge. | The record mark sits in a recessed `--bed` well. Record rows sit on a raised plate. The acquire block is lifted (`--lift-2`), and its interlock is sunk into a `--bed` well inside it. "From the same creator" becomes a full-bleed recessed band. **No captures:** `MEDIA-PROVENANCE.md` forbids proof media beside catalog listings (spec §3.6). |
| 3 Inspector + Change Review | Diff marks in pending yellow. Flat columns. | **Diff marks are lunar** (the inspect role). Accept is **commit yellow**. Planes: controls = iron (L+1 cast), review = field, route strip = recessed bed, rows table = raised with a shadow, decision = raised `--plate`, rail = recessed dock with lifted interlocks. A light echo of the sequence runs (§5). The light scheme remaps lunar to `#5B3FD0` and the marks to `#E4DCFF` with a lunar underline. |
| 4 Refusals (both densities) | Legend and both columns on one band. | The legend is a raised plate with hairline dividers. Comfortable interlocks are lifted. The compact column sits inside a recessed **dock** labelled "Inspector rail · 340px", so the density reads as a placement (A's rule) through material as well as size. |
| 5 Kids | Sky field with the board and builder on it. | Own dialect, own hue, unchanged copy. The board sits on a raised **table plate** (`#EAF5F9`, offset shadow), and each builder group sits in an inset **tray** (`#BFDDE8`). Lunar and the sequence are **not** used here: Kids keeps its own blue and calm motion (A §dialects). |

## 2. Second accent: lunar

- **Name and source.** In railway signalling, *lunar white* is the bluish-white aspect used by position-light and calling-on signals. It means "proceed at caution, examine the line". It fits the inspect act.
- **Value.** It is pushed to a perceptible violet-white so it reads as an accent beside cream enamel.
- **Hue relationships.** Hue ≈ 255° (OKLCH). That is near-complementary to the panel green (≈ 170°) and split from caution yellow (≈ 90°), so the three never compete. Mint (verified) stays a state paint, not an accent.

**Role (exclusive).** Lunar marks *what is under inspection*:
- the difference ring and the `Differs` tag in the hero
- the edited leaf station on a pending route
- the diff `<mark>` in Change Review
- the inspect phase bar

It is never a call to action, never a link colour, never decoration. **Yellow stays the commit signal:** the pending plate, the pending route, and the Accept button (the write that waits for a person's throw).

| Token | Hex | Pair | Ratio (WCAG 2.x) | Use |
|---|---|---|---|---|
| `--lunar` | #C4B4FF | on `--panel` #2F4A44 | **5.18** | text/UI on the field |
| | | on `--iron` #1E2B28 | **7.91** | |
| | | on `--panel-band` #27403A | **6.02** | ring in the hero board |
| | | on `--well` #182320 | **8.71** | |
| | | on `--plate` #395A53 | 4.10 | **UI / large only.** No lunar body text on the plate. |
| `--on-lunar` | #16112E | on lunar | **9.81** | diff-tag text, mark text |
| `--lunar-deep` | #5D4FA8 | on enamel #F1EEE4 | **5.74** | lunar as ink on light material |
| light scheme `--lunar` | #5B3FD0 | on #FBFBF8 iron-light | **6.61** · on #E7E9E3 5.60 | operate light |
| light mark | #E4DCFF | ink #17221F on it **12.44** · underline #5B3FD0 on it **5.21** | | |
| `--commit` (= pending) | #F2C230 | `--on-commit` #1A2623 **9.32** · hover #FFD45A **11.01** | | Accept |
| light commit edge | #7A5C00 | on #FBFBF8 **6.03** | | Accept boundary in light |

## 3. Elevation: four planes plus frames

Depth comes from **material and lightness steps plus an offset shadow**. It never comes from glow or blur, and hierarchy still reads in greyscale (luminance order below).

| Level | Token | Hex | Rel. luminance | Shadow | Used for |
|---|---|---|---|---|---|
| L−1 recessed bed / well | `--bed`, `--well` | #141C1A / #182320 | 0.011 / 0.015 | `--sink`: inset 0 2px 0 #0006 | capture band, image mats, docks, route strip, wells inside the acquire block |
| L0 field | `--panel` | #2F4A44 | 0.058 | none | page field |
| L+1 raised plate | `--plate` | #395A53 | 0.087 | `--lift-1`: 0 14px 24px −14px #000b, 1px inset top light | spec rows, legend, decision, record |
| L+1 cast frame | `--iron` | #1E2B28 | 0.022 | `--lift-1` | capture frames, hero diagram, controls |
| L+2 enamel plaque | `--enamel` | #F1EEE4 | 0.84 | `--lift-2`: 0 28px 48px −24px #000c + contact 0 4px 10px −6px | editorial pull (the acquire block uses `--lift-2` on iron) |

**Hairlines that bound a plane** use `--hair` #9AB8B0, which passes 3:1 on every plane it touches:
- 4.51 on panel
- 3.57 on plate
- 8.14 on bed
- 6.89 on iron

A's `--rule` (#4E6B64, about 1.5:1) survives only *inside* a framed component, as decoration. On enamel the rule is #4E6B64 at **5.01**.

Secondary text on the plate is `--ink-2-plate` #D2E2DC (**5.67**). A's ink-2 would measure 4.71 there.

## 4. Type and rhythm below the hero

| Section | Plane | Density | Display size | Measure |
|---|---|---|---|---|
| Capture band | L−1, full-bleed | 4 images, 3 captions + 1 side caption | h2 clamp(40 → 68px) | captions ≤ 60ch |
| Spec rows | L+1 plate on L0 | 4 dense rows, 5/7 split | h2 `--t-h2`, dt 24px | dd ≤ 68ch |
| Pull | L+2 enamel plaque | one statement | clamp(48 → 96px) | 40ch |

The pull copy is `ENGINE_NOTES[1]` from `sites/umbrella/src/lib/site-content.ts:111-112`, verbatim. The capture copy is `PROOF_MEDIA` (`site-content.ts:384-441`), verbatim, including every limitation chip.

## 5. Motion: the sequence

There is one authored moment, now in three acts. The CSS is keyed on `[data-armed]`, which JS sets only when `prefers-reduced-motion: no-preference`. Content is visible and final by default (fill `backwards`, never `forwards`), so the first paint and the no-JS paint show the inspect state. Only `transform`, `clip-path`, `box-shadow`, `border-color` and `background-size` animate. There is no layout-measurement JS: Replay drops the arm and re-adds it two frames later.

| Phase | t (ms) | What moves | Duration · easing |
|---|---|---|---|
| **Propose** | 0 | yellow phase bar on act 1 (`scaleX`) | 280 · `--ease-throw` cubic-bezier(.16,1,.3,1) |
| | 120 | lever 1 thrown to reversed (catch at 26 %) | 350 · ease-throw |
| | 300 | lamps light station by station along the route | 360 · steps(6) |
| | 640 | after-value written into place (clip reveal) | 420 · ease-throw |
| **Inspect** | 1000 | lunar phase bar on act 2 | 280 · ease-throw |
| | 1060 | lever 2 to catch (held) | 260 · ease-throw |
| | 1150 | lunar scan gate crosses the readout once (`translateX`) | 760 · ease-throw |
| | 1400 | leaf station ring turns pending → lunar | 300 · ease-throw |
| | 1560 | difference ring closes on the after-value | 320 · ease-throw |
| | 1640 | `Differs` tag revealed | 300 · ease-throw |
| **Commit (armed)** | 2200 | act 3 hollow edge appears | 280 · ease-throw |
| | 2300 | Accept is painted commit yellow, left to right (`background-size`) | 420 · ease-throw |
| **Commit (thrown, on Accept)** | +0 | lever 3 thrown (transition) | 260 · ease-throw |
| | +80 | route relit mint, station by station | 360 · steps(6) |
| | +120 | act 3 bar paints mint | 280 · ease-throw |
| | +200 | `Verified · written` plate revealed | 260 · ease-throw |
| | +260 | after-value settles in mint | 420 · ease-throw |

The sequence ends **armed, not committed**. That is deliberate and product-true: SceneAxi never writes without a person's Accept, so an autoplay that commits would demonstrate the opposite of the product law. The commit act plays when Accept is pressed (Reject plays the same throw to the refused aspect). The intro takes 2.72 s, runs once, does not loop, and nothing moves after it settles.

**Change Review echo** (`3-inspector`, about 1.4 s, once):
1. Route lamps at 120 ms.
2. A lunar scan crosses the rows table, 480 → 1120 ms.
3. The three diff marks are revealed in turn at 620, 700 and 780 ms (260 ms each).
4. Accept is painted yellow at 1080 ms (360 ms).

**Reduced motion:**
- Nothing is armed and A's global rule zeroes every animation and transition.
- The hero shows a **three-still strip**: *1 · Propose* (pending plate, `1 → 42` with the after-value dashed yellow), *2 · Inspect* (`Differs` tag, lunar ring), and *3 · Commit* (`Verified · written`, after-value mint, after-digest).
- Every still is labelled in text, so no state depends on movement or colour.
- Replay is hidden.

## 6. Measured evidence

All values come from Chromium (`chromium-1223`, playwright-core per lib.mjs), using `baseline/_work/lib.mjs` (`MEASURE`, `stateSweep`, `axe`, `PAGE_FACTS`). The harness is `shots/_work/shoot.mjs` and the raw output is `shots/metrics.json`. Two rounds were run: one batched verify round and one confirm round after the fixes listed below.

### Contrast, composited in the browser, every rendered text node

| Page @ width | Text nodes | Min normal text | Min large text | Failures | Boundary checks < 3:1 |
|---|---|---|---|---|---|
| 1-umbrella @1440 / @390 | 96 / 96 | **5.95** | 6.55 | 0 | 0 |
| 2-store-item @1440 / @390 | 52 / 52 | **5.37** (white on stop red) | 8.28 | 0 | 0 |
| 3-inspector @1440 / @390 | 86 / 82 | **5.37** | 7.85 | 0 | 0 |
| 3-inspector @1440, light scheme | 86 | **5.37** | 6.92 | 0 | 0 |
| 4-refusals @1440 / @390 | 77 / 77 | **5.37** | 8.28 | 0 | 0 |
| 4-refusals @1440, light scheme | 77 | **5.37** | 8.28 | 0 | 0 |
| 5-kids @1440 / @390 | 20 / 20 | **5.83** (disabled) | 7.18 | 0 | 0 |

**Control states** (`stateSweep`): 14 distinct control signatures were measured at rest, hover, active and focus. The minimum is **5.83** in every state, and that minimum is the Kids disabled choice. The commit button measures **9.32** at rest and **11.01** on hover.

**Focus rings:** 3px enamel on dark, minimum **6.55** (on the raised plate). On the enamel plaque the ring flips to dark ink, **13.45**.

**Non-text boundaries** (computed border colour against the plane behind it and the plane inside it):

| Boundary | Ratio |
|---|---|
| capture frame | `--hair` on bed **8.14** |
| image mat | `--edge` on iron **5.40** |
| limitation chip | `--edge` on iron **5.40**, on bed 6.38 |
| spec plate | `--hair` on panel **4.51**, inside 3.57 |
| spec row divider | `--hair` on plate **3.57** |
| refusals dock | **5.24** / 8.14 |
| legend | 4.51 / 3.57 |
| light Change Review | `#6B807A` **3.24–4.21** (strip, rows, decision, rail, inputs) |
| light commit edge | `#7A5C00` **6.25** |

**axe-core (lib.mjs `axe`):** 0 violations on all 5 pages at 1440. **Horizontal overflow:** none at 1440 or 390 on any page.

### Fixed between the verify round and the confirm round
1. **Light-scheme Accept measured 1.05:1.** Cause: `.btn.commit` painted its base layer with `--enamel`, which the light scheme remaps to near-black. Fix: the base is now the paint itself, and the wipe keyframe pins a literal cream underlay (ink 13.45 on it).
2. **Store acquire interlock.** It lost its own 3:1 boundary once it was sunk into the well. It now carries a 1px `--edge`.

### Proxy metrics for "too simple"

| Metric (umbrella, below the hero) | A | A-rich |
|---|---|---|
| Distinct painted surfaces covering ≥ 2 % of the area @1440 | **4** (panel, band, well, iron) | **6** (panel, bed, iron, well, enamel, plate) |
| Elevation levels by the §3 definition | 2 (field / band, both flat) plus the footer | **4** (L−1, L0, L+1, L+2), with offset shadows on L+1/L+2 and inset shadows on L−1 |
| Luminance variance @1440 (full-page shot, decoded in-page) | 0.01495 (sd 0.122) | **0.06819** (sd 0.261), **4.6×** |
| Luminance variance @390 | 0.02433 | **0.07050**, **2.9×** |
| Populated luminance bins (16-bin histogram, > 1 % of px) @1440 | 6 | 7 |
| Gallery `<img>` regions in A's **own committed** `a/shots/1-umbrella-1440.png` | variance **0**, **1** distinct colour in each of 3 rects (empty boxes, confirmed) | 4/4 images decoded, every figure has ≥ 1 limitation chip |
| `a.css` raw / gzip | 39,293 / 9,159 B | **57,939 / 12,852 B** (+18,646 / +3,693) |

**Variance caveat.** Part of A-rich's variance comes from the captures themselves, because A's shot had none loaded. The plane count and the elevation levels are the cleaner proxy for layering. Neither one is a visual judgment.

### Motion

| Check | Result |
|---|---|
| Animations driving the sequence | 15 at 150 ms → 8 at 1150 → 2 at 2250 → **0 at 2800** |
| Frames captured | 3 per phase, paused with WAAPI `currentTime`, so there are no wall-clock races |
| Loop | none: animations end with fill `backwards` and are not re-armed except by Replay |
| Accept | `data-act=accepted`, plate `Verified · written`, focus moves to "Show the proposal again" |
| Reduced motion, hero | not armed, `document.getAnimations().length = 0`, all 3 stills rendered with labels `1 · Propose` / `2 · Inspect` / `3 · Commit` |
| Reduced motion, Change Review | not armed, 0 animations |

## 7. Shots (`shots/`)

- **Every screen at 1440 and 390, full page:** `{1-umbrella,2-store-item,3-inspector,4-refusals,5-kids}-{1440,390}.png`, plus `3-inspector-1440-light.png`.
- **Motion strip** (hero frame, 1440): `motion-1440-propose-{1,2,3}-{150,450,900}ms.png`, `motion-1440-inspect-{1,2,3}-{1150,1500,1900}ms.png`, `motion-1440-commit-{1,2,3}-{2250,2450,2800}ms.png` (armed), and `motion-1440-commit-accept-{1,2,3}-{60,200,600}ms.png` (thrown on Accept).
- **Reduced motion:** `1-umbrella-1440-reduced-motion.png` (hero frame showing the three stills) and `-full.png`.

## 8. Open issues

1. **Visual sign-off is still human-only.** No agent viewed any PNG. Whether the lunar accent harmonises, and whether the page now reads as AAA+, is the gate's call.
2. **`desktop-run-window.png` placement.** `PROOF_MEDIA` places it on `/engine`, not home. It is shown here as the closing plate of the capture band to demonstrate the band with all four real captures. The production home should use the three `placement: "home"` captures (the grid is built for three) and move the window plate to `/engine`.
3. **The autoplay ends armed, not committed** (§5). This is a product-truth decision. If the human wants the commit throw to autoplay, it is a one-line change (`set('accepted')` at 2.8 s), but it would demonstrate a write nobody approved.
4. **Lunar on the raised plate measures 4.10.** It is restricted to UI and large use there. No lunar text currently sits on the plate.
5. **Inherited from A, not introduced here:**
   - 4-refusals has a 12.19px minimum font: compact evidence at 0.8125rem × 0.9375em `code`.
   - Target counts from `PAGE_FACTS`: umbrella has 2 targets under 24px and 9 under 44px; inspector 0 / 8; refusals 1 / 4; store 1 / 2; Kids 0 / 0. These were not itemised in this pass, so the sub-24 targets should be checked against the WCAG 2.5.8 inline exception at A5.
6. **CSS grew by 3.7 KB gzip.** The A-rich layer is appended rather than merged, so the delta stays readable. A merge at A5 would drop the overridden A rules (`.gallery`, `.board`, the first `.btn.commit` background, the duplicate `.readout .after .val` animation).
7. **Kids got planes only, no accent or sequence.** That is deliberate (its own dialect). If the gate wants a Kids echo of propose → inspect → commit, it needs its own calm form.
