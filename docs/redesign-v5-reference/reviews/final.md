# Review: final design review (critique + audit + polish), whole redesign, round 4

⚠️ DEGRADED: single-context. This session has no sub-agent tool, no browser-tab tool and no image viewer.
Every browser check ran in headless Chromium (playwright-core) from my own scripts.

Reviewer: independent. I built none of this and ran every check below myself. Date: 2026-10-05.
E = `/home/devuser/Documents/Reports/sceneaxi-redesign`. This round reviews the tree after polish round 3 (only
`sites/umbrella/src/app/globals.css` changed, 05:07; umbrella rebuilt 05:11; gate re-reviewed PASS at 05:20).
Round 3's evidence moved to `E/final-r3/` (its review text: `E/final-r3/final.md.round3`). My scripts are in
`E/final/scripts/` (the `r4-*` files are new this round), data in `E/final/data/`, logs in `E/final/logs/`,
shots in `E/final/<surface>/`. The only file I wrote in R is this one.

Verdict: **FAIL**. Both round 3 blocking fixes hold, and every live check is clean. One blocking defect is left:
the named state panel uses two densities across the deployed sites (fix 1). It is a CSS-only fix in the two
store sheets.

## What I ran

- **Freshness.** No source under `sites/*`, `apps/*`, `packages/*` or `desktop/*` is newer than its build.
  No repo file except `reviews/gate.md` is newer than `E/gate-after.log` (05:19). The desktop chrome and
  web-shell renders come from dists that are newer than their redesign sources (`chrome.ts`, `inspector-app.ts`).
- **Servers.** `next start` on 3101–3104 from the production `.next` builds. The umbrella ran plain, then with
  `SCENEAXI_SITE_EDITOR_PREVIEW=1` for `/editor`, as production renders it (`docs/websites-deploy.md:693-694`).
  I also ran the web-shell bin on 5181, a static server on 3106 for the 18 chrome states rendered from the
  desktop-shell dist plus the Linux `index.html`, and the packaged Electron window under `xvfb-run`.
  TMPDIR was `/home/devuser/.cache/sxg68471`, removed afterwards. Ports 3101–3104, 3106 and 5181 are free.
- **309 PNGs:** umbrella 96, each store 30, Kids 36, web shell 58, desktop 53, Electron 6.
  - Sites: every route and fallback at 390/768/1440.
  - `/editor`: 10 window tiers from 900×600 to 1920×1080, plus title-pill and dock crops.
  - Desktop: 19 states at 1280×800 and 1920×1080, plus menu, outcome, drawer, 1000×700 and 700×500.
- **Reduced motion:**
  - umbrella `/`, `/pricing`, `/docs`, `/open` and `/editor`;
  - each store's home, item and publish;
  - all 9 Kids states and the web-shell idle, reviewing, applied and recovery states;
  - desktop chrome, palette, sculpt and outcome; Electron first run and palette.
- **Live audit on every shot:**
  - overflow, text past the viewport, clipping and overlap;
  - placeholder text, minimum text size and contrast;
  - side stripes, radius, ghost elevation, backdrop, gradient text and eyebrows;
  - running animations and the properties they animate.
- **Interaction probe: 395 controls.** For each: hover, keyboard focus-visible, pointer-held `:active`, disabled
  paint, and the transitions that fire (duration, curve, property). Follow-ups:
  - prose-link press on its own line box;
  - the `/editor` "Local project" controls with the details open;
  - the web-shell `#recover` control.
- **Keyboard order** with a 1.5 s scroll settle on all 28 site routes at 390 and 1440.
- **Clip-aware line-box overlap check:**
  - all 28 site routes at 390/768/1440;
  - `/editor` at 6 tiers;
  - all 19 desktop states at 3 sizes.
- **`/editor` pointer hit-test** of every visible control at 10 tiers. A control in a scroll region is scrolled
  into view first.
- **Web-shell recovery-pending state, reached for the first time.** Round 3 set `journalRecoveryPending` on the
  payload root, but the page reads `snapshot.journalRecoveryPending` (`inspector-app.ts:984`).
- **Width sweep:** 18 routes at 9 widths from 320 to 1920. **Chip check:** the `/pricing` tier chip with all 4
  status strings at 8 widths from 320 to 1440, and every chip on 15 umbrella routes at 320/390/768/1440.
- **Detector:**
  - the 7 source targets;
  - the 19 rendered chrome states and the rendered inspector page;
  - 20 rendered site pages with their linked CSS inlined;
  - again with `--no-config --no-inline-ignores`.
- **Token and consistency checks:**
  - token audit (postcss) of the four site sheets, the chrome sheet and the inspector sheet;
  - computed styles of buttons, chips, masthead, fields, state panels and headings across sites;
  - gutters, section rhythm and state-panel padding per width.
- **BEFORE vs FINAL** pixel diff on 105 site pairs. Every pair differs; the lowest mean is 3.89 (docs loading 1440).
- **Not done:**
  - I did not re-run `pnpm gate`: `reviews/gate.md` is PASS (R-7) and the tree is unchanged since `gate-after.log`;
  - I judged no PNG by eye;
  - I did not measure performance.

## Round 3 fixes re-checked

| R3 | Result |
|---|---|
| 1 tier chip wrap | Holds. `/pricing` with each status string (`credit-pack-offers.ts:64`, `:72`, `:80`, and the rendered one) at 320/360/375/390/414/768/1024/1440: document overflow 0, no chip past its card or the viewport. Long strings wrap to 2 lines (h37). Every other umbrella chip stays on one line; the only chips past the viewport sit inside table scroll regions (`/`, `/profiles`). |
| 2 `/editor` title pill | Holds. The name "umbrella-web-editor" fits inside the pill's content box at all 10 tiers (pill `scrollWidth` = `clientWidth`). `.ed-project-save` ellipsizes (74px at 1180×700, 174px at 1280×800) and is hidden below 1180. Document overflow 0 at every tier. |

## PASS criteria

| Criterion | Result |
|---|---|
| `reviews/gate.md` PASS | Yes (R-7; no file newer than `gate-after.log` apart from `gate.md`). |
| One spacing scale, consistent tokens, same component looks and moves the same | **No: fix 1.** Spacing is otherwise on the scale: the site sheets have 0 off-scale values apart from the 344px drawer geometry (§4); chrome has only the pinned `padding:10px 12px` (`chrome.test.ts:543`); the inspector has 0. Buttons (h46, 5px, Archivo 600 15px), chips (11px mono 500, 0.88px, h24, 2/8, 3px), masthead (h60) and the heading roles (66/42/24/17) compute the same on all three sites. Every hover and press transition is 160 or 120ms quart. |
| Every route visibly better than BEFORE | Yes, by the measures I could run. All 105 pairs differ. Every BASELINE issue I re-measured is gone: 0 eyebrows (apart from the §7.2 pipeline step numbers), 0 radius >16, 0 ghost, 0 backdrop, 0 gradient text, no side rail apart from DV-X1 and the 2px current-item indicators, minimum text 11px (BASELINE: 9px on sites, 8px on desktop). |
| Zero overflow, overlap, clipping, placeholder at any width | Yes. Document overflow is 0 on every shot and every sweep width. I checked each line-box hit by hand: H1 line boxes at 768 overlap by 4px of font box with line-height 1.02 (no descenders); the `/engine` command lines scroll inside their own `overflow:auto` code; at 1180–1439 the compact `/editor` drawer covers the inspector by design. The placeholder hits are "proveNaNce". Clipping hits are designed ellipses (fix 9). |
| Every control: hover, focus-visible, active, disabled, motion per table | Yes. All 395 probes are explained. Selected or current items carry no hover; scroll regions are not controls; the store wordmark nudges its glyph's `::after`; disabled controls are painted and not focusable. Fired motion is 120/160ms quart, 200ms quint and 280ms expo. The only loops are R-1 loops (1200ms, 300ms delay) and Kids `play-float` (R-3). |
| Reduced motion honoured everywhere | Yes. No animation runs at rest under reduce on any surface. Kids, the desktop palette and Electron start none. The web-shell `control-in` and `settle` keep an opacity fade with 0 distance (§6.1). |
| Keyboard order sane | Yes. 56 orders: no positive tabindex, no stop without a ring, no stop out of view after the settle. Backward jumps happen only at column changes (rail → content → TOC on `/docs`). |
| No AI-slop tells (both altitudes) | Yes. No hero-metric template, no card-grid page scaffold, no kicker, no glass. Uppercase appears only in table heads and authored capitals. |
| Detector 0 | Yes for the source targets: sites 0, desktop-shell 0, Linux renderer 0. The findings below are held by contract: the web-shell DV-X1 rail (source and rendered) and `aphoristic-cadence` from refusal copy on the rendered chrome (fix 7). Rendered site pages are not a string-emitted target (fix 8). |

## Fixes

1. **(blocking) The named state panel has two densities across the deployed sites.**
   - DIRECTION §4: "Cards and panels: 16 (phone) / 24". §5 names one component (`.state`, the site-kit
     state-panel model). §7.3 asks for a compact panel only for the store home TEST notice.
   - Measured at 1440:
     - umbrella `.state`: padding 24, gap 16 (`sites/umbrella/src/app/globals.css:1814`, `:1817`); 16 at ≤620px (`:3323-3326`);
     - stores: padding 16 and gap 12 at every width (`sites/catalog-web/src/app/globals.css:1782`, `:1780`;
       same lines in `sites/catalog-game`).
   - Result: the publish refusal (768px wide), the item editor-link and commerce refusals, and the fixture panel
     read tighter than the same panel on `/login`, `/account` and `/engine`. The gap differs at 390 too (12 vs 16).
   - Fix (CSS, both store sheets in lockstep; the byte-identical rule must hold):
     - at `:1780` set `gap: var(--space-4)`;
     - add a min-width 621px rule (the umbrella phone boundary, `globals.css:3208`) with `.state { padding: var(--space-6) }`;
     - keep the home notice compact at `:991`: `.hero-copy > .state { padding: var(--space-4); gap: var(--space-3) }`.
   - No test pins these values (`tests/sites/*` checked).
2. **(advisory) Tablet gutters differ.** Umbrella: 24px from 621 to 1024 (`sites/umbrella/src/app/globals.css:3098`).
   Stores: 16px below 960 and 32px above (`sites/catalog-*/src/app/globals.css:74`, `:101`). At 768 text starts
   at 24 vs 16; at 1024 at 24 vs 32. All values are on the scale, and §4 does not pin tablet gutters.
3. **(advisory)** Store publish: the space between sections stacks three sources, giving 80px at every width:
   the `.page` gap of 24 (`sites/catalog-*/src/app/globals.css:1874`), the `.page > .section` margin-top of 24
   (`:1938-1940`) and the `.page-persuade > .section + .section` padding of 32 (`:1943-1944`). The umbrella
   interior pages use one flex gap of 32/44. Use one source.
4. **(advisory) `/editor` Changes dock: the proposed value is a 13,763-character JSON line.** It wraps by design
   (`sites/umbrella/src/app/globals.css:4291-4296`), so row 1 is 3,696–11,105px tall inside a 195px dock.
   Nothing is clipped, and the row's ✕/✓ sit at its top (`vertical-align: top`). A capped scroll well for
   `.ed-cr-proposed` content would keep the review readable. The ✕/✓ are 18×18px (`:4329-4333`, unchanged
   since HEAD) and inert on this surface (lane-umbrella, "Row 14 on /editor").
5. **(advisory)** `/editor` at 900×600: the notes band is still a 72px scroller (`clamp(72px, calc(100vh - 640px), 168px)`,
   `sites/umbrella/src/app/globals.css:5112`). Carried from round 3.
6. **(advisory) The store item `.detail-side` scrolls inside a short page.** At ≥1024 it is a sticky scroller of its
   own (`sites/catalog-*/src/app/globals.css:2395-2399`). It is focusable and labelled. Fix 1 makes its panels
   taller, so consider keeping it static when the page is shorter than the aside.
7. **(advisory) Detector findings held by contract (hard rule 4):**
   - `apps/web-shell/src/inspector-app.ts:837`: the DV-X1 busy rail, pinned by `visual-postpr.test.ts:32`. It is
     also found on the rendered inspector page.
   - `aphoristic-cadence` on all 19 rendered chrome states. It comes from refusal and product copy
     (`apps/desktop-shell/src/chrome.ts:177-180`); copy is outside this run's visual-only fixes (Request D1).
8. **(advisory) Rendered site pages with linked CSS inlined report `marquee` (44 findings).** The cause is the R-1
   indeterminate loops: `sa-progress` (`sites/umbrella/src/app/globals.css:174`), and `cat-progress` and
   `cat-sheen` (`sites/catalog-*/src/app/globals.css:274`, `:283`). These are the `translateX(-100%→…)` bars
   that §6.3 rows 5 and 18 specify, and they run only while busy or loading. The source scans report 0. Round 3's
   "rendered sites 0" did not inline the CSS. Recommend that DIRECTION record this as an accepted finding next
   to DV-X1.
9. **(advisory)** The desktop title-bar project pill ellipsizes "Project lifecycle refused · DESKTOP_RUNTIME_UNAVAILABLE"
   at 1280×800 (359px of text in 309px). The outcome dialog shows the full text. A `title` would help pointer
   users. It fits at 1600 and 1920.
10. **(advisory)** The web shell declares `--space-1…18` (`apps/web-shell/src/inspector-app.ts:802`) but reads none
    of them. Every value is a literal on the scale.
11. **(advisory)** The stores' refused browse (`/?sort=random`) has no H1. This is markup; carried forward.
12. **(advisory)** `/home/devuser/.cache/sceneaxi-gate-tmp` from an earlier run is still on disk. I did not create
    it, so I left it.

## Audit health (0–4; performance not measured)

| Surface | A11y | Responsive | Theming | Integrity | Total /16 |
|---|---|---|---|---|---|
| Umbrella | 4 | 4 | 3 (fix 2) | 4 | 15 |
| Stores | 4 | 4 | 2 (fixes 1, 2) | 3 (fix 1) | 13 |
| Kids (not deployed) | 4 | 4 | 4 | 4 | 16 |
| Web shell | 4 | 4 | 3 (fix 10) | 4 | 15 |
| Desktop + Electron | 4 | 4 | 4 | 4 | 16 |

Contrast is at least 4.9 everywhere (lowest: the desktop outcome pill, 12px). Minimum text is 11px (Kids 17,
web shell 13). The recovery-pending state is clean in light and dark at 390/768/1440 and under reduce.
`#recover` has hover (8% layer, 160ms quart), press (scale and 12% layer, 120ms) and a 2px ring.

## Critique (both altitudes)

- **Specificity:** the system reads as authored for this product.
  - Named refusals, chips and reason codes carry its honesty about what is wired.
  - Change Review and the web-shell diff share the one resolution moment.
  - The desktop keeps its instrument identity.
- **What works:** one motion vocabulary on every surface; focus rings on every stop; drawers that read as layers;
  clean narrow edges on the umbrella now.
- **Biggest opportunity:** fix 1, then fixes 2 and 3. They are the last signs that the stores and the umbrella
  were restyled lane by lane.

VERDICT: FAIL
