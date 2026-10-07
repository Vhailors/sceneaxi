# Lane: stores CSS reduction (catalog-game + catalog-web, lockstep)

Target (BRIEF A11): game ≤ 40,508 B, web ≤ 40,525 B source `globals.css`.
Start: game 67,274 B, web 67,303 B (diff = header comment + STORE IDENTITY block only).

Rules: delete dead/v5 rules, dedupe, merge layers; no bytes moved elsewhere; tests honoured;
both files edited identically; pixel diff ≤0.5% per shot vs pre-change reference.

## Timeline

- 2026-10-07 16:20 — start. load avg 16–20 (shared host). Read BRIEF A11/A12, GATE-BASELINE, craft-floor.
- 2026-10-07T16:29:04 step 1 REFERENCE captured: lanes/css-catalogs/ref (66 PNG: 7 routes x 390/1440 x {base, forced-colors} x 2 stores + refusal both densities x2 widths + menu-open@390). dev :4581/:4582 with umbrella/catalog origins. contrast 0 fails (min 5.09 game / 5.37 web), axe 0 serious/critical on all 28 base loads. Store tests before: storefronts 86/86, ux-regression 13/13+17/17, session-wiring 15/15 x2; rendered-route-states 2/4 FAIL (`require is not defined`). **CORRECTION (round 8, 2026-10-07):** the original note here called this failure "pre-existing, untouched". That claim was never measured, and it is wrong. The test passes 4/4 on main. Cause: the catalogs lane made `src/app/loading.tsx` and `error.tsx` (both stores) import `./_components/state-plate.js`, and the test evals the transpiled TSX with no `require`. Fix (round 8, source only, test untouched): `loading.tsx`/`error.tsx` in both stores render the plate inline and import nothing. Result: 4/4 pass, SSR markup byte-identical, pixel diff 24/24 0.000%. See "Round 8 fix" below.
- 2026-10-07T16:44:45 step 1b MAIN build CSS (worktree /tmp/sceneaxi-main @2cef2033, next build, sum .next/static/css/*.css): catalog-game 45,277 B, catalog-web 45,277 B (1 file each).
- 2026-10-07T16:44:45 step 2a ANALYSIS (postcss over game sheet): 1,425 declarations (~38 KB), 406 rules (~10.6 KB selectors), 134 comments = 16,552 B. Same-selector/same-context overrides: 3 (.plate-stat position+font-size, .notice-facts dd font-family). Base value restated identically in a min-width query: 6. TSX grep (both stores + site-kit src): 7 of 182 classes have zero hits (chip-dormant, chip-needs-review, chip-ok, chip-refused, chip-validated, plate-detail, plate-lead). Rule-level selector coverage (ref run, every route x 390/1440 x base/fc/motion + hover/focus/busy/density/menu): 40 selector entries never matched in either store (list below); after removing pseudo-class probe artefacts and TSX-present classes (loading.tsx/error.tsx are not drivable), the dead set is the 7 above plus .plate-empty, .footer-col li > span, .hero-plates > li:nth-child(n+4), pre/kbd.
- 2026-10-07T16:44:45 step 2b declaration-level coverage running (declcov.mjs: remove each declaration from the live CSSOM, compare computed value of that property + box size on every matched element, 7 routes x 390/820/1000/1440 x 2 stores + compact density + menu open).
- 2026-10-07T17:12:27 step 1c REFERENCE re-captured on PRODUCTION servers (next build + next start :4581/:4582). The first ref (next dev) was unusable: dev streamed /item/does-not-exist through loading.tsx nondeterministically (390x1240 vs 1911 between runs). Kept as ref-dev/ for coverage only. Two prod refs: ref/ (origins configured: editor link live) and ref-unconf/ (no NEXT_PUBLIC origins at runtime: editor link refused, the refusal/deny state). Branch build CSS before: catalog-game 46,189 B, catalog-web 46,189 B (main 45,277 each). ref facts: contrast 0 fails (min 5.09 game, 5.37 web), axe 0 serious/critical x28, buy (Open in editor) at Tab stop 4 @390, 5 @1440, both stores.

## FINAL (verified 2026-10-07T22:25+02:00, verify finisher round 7)
| Site | Source (main → now) | Build CSS now vs main | 60% limit (source) | Owed | Pixel diff | a11y | Gate |
|---|---|---|---|---|---|---|---|
| catalog-game | 67,513 → **61,659** (sha cd49c464) | **44,353** vs 45,277 (**−924, PASS**) | 40,508 | **21,151 B** | 66 shots (both stores) vs before-CSS prod ref: **0 >0.5%**, max 0.056% | 14 rows: 0 fails at rest/hover/focus (min 5.09), no disabled controls, axe 0, primary action at Tab stop 4 (390) / 5 (1440); 0 rows differ from round 6 | no failures beyond GATE-BASELINE |
| catalog-web | 67,542 → **61,688** (sha 973ea5cf) | **44,353** vs 45,277 (**−924, PASS**) | 40,525 | **21,163 B** | (included above) | 14 rows: 0 fails (min 5.37), axe 0, primary action at stop 4 / 5; 0 rows differ | ″ |

Pinned: catalog-storefronts (in a 204/204 vitest run), catalog-ux-regression 13/13 + 17/17, item-session-wiring 15/15 + 15/15. `sites/catalog-game/test/rendered-route-states.test.mjs`: **FIXED in round 8, now 4/4** (it was 2/4, `require is not defined`; not pre-existing; see the correction in the 16:29 entry and "Round 8 fix" below). The 60% target is recorded as unmet per the operator ruling of 2026-10-07. Remaining CSS is live styling; reaching 60% requires visual change.

## Round 8 fix: route-state import regression (2026-10-07, final release fixer)
- **Cause (measured):** `node --test sites/catalog-game/test/rendered-route-states.test.mjs` gave 2/4 on the branch. Both failures were `ReferenceError: require is not defined`. The test transpiles `loading.tsx`/`error.tsx` to CommonJS and evals them with only `exports` and `React` in scope, so any `import` fails. On v6 both files imported `./_components/state-plate.js`. On main they import nothing.
- **Fix (source only; test, CSS and `state-plate.tsx` unchanged):** `sites/catalog-{game,web}/src/app/loading.tsx` and `error.tsx` drop the import and write out the exact markup `StatePlate` produced:
  - `<p class="sx-plate" data-state="isolated|refused">`
  - the 24px svg with site-kit's `SIGNAL_ICONS.empty` / `.refused` paths
  - the label

  Game and web are byte-identical (lockstep). `not-found.tsx` keeps `StatePlate`, because that harness does not load it and it already imports site config.
- **Verification** (`R` = `~/Documents/Reports/sceneaxi-redesign-v6/`, artifacts in `R/release-r8/`):
  - **Tests:** rendered-route-states **4/4**, ux-regression 13/13 + 17/17, item-session-wiring 15/15 + 15/15.
  - **SSR markup:** loading, error and not-found in both stores are byte-identical before and after (`_work/before.json` vs `after.json`).
  - **Pixels:** clean pre-fix prod build vs fixed prod build, both served by `next start` :4591/:4592. 24 shots: 3 states × 2 stores × 390/1440 × base/forced-colors. Diff **24/24 0.000%** (`states/{before,after}`).
  - **Contrast and a11y:** 0 contrast fails (plate 17.26 isolated, 5.37 refused; page minimum 5.54 game, 6.1 web). axe 0 serious/critical on all 12 base loads. Icon 18×18 in both. The before and after facts files are identical.
  - **Build CSS:** 44,353 B per store, before and after (no change).
- **Not evidence:** `states/{before,after}-flaky/` is a first pair that hit a capture race (first navigation in a fresh context; diffs on web not-found only). The harness was then hardened with a warm-up nav, `fonts.ready` and 2 rAF. After that, three repeat runs of the after build agree at 0.000%.
