# CSS-UMBRELLA lane — sites/umbrella/src/app/globals.css to <=60% of main (A11)

Target: <=76,082 B (main 126,804 B). Start: 115,156 B (6,180 lines; comments 2,691 B; indentation 7,959 B; 845 blank lines).
Owned: sites/umbrella/src/app/globals.css, dead classNames in sites/umbrella/src/**/*.tsx, this log.
Evidence root: ~/Documents/Reports/sceneaxi-redesign-v6/css-umbrella/

## Log
- 2026-10-07T16:17:37+02:00 step 0 START. branch redesign-v6, load avg 14.74 19.49 20.06. No peers. Read BRIEF A11, umbrella.md (a6p1 inventory: editor shell ~38.5 KB pinned rule-by-rule in tests/sites/umbrella-visual.test.ts), release-fix.md round 3 (A11 FAIL open).
- 2026-10-07T16:19:07+02:00 step 0b killed orphan umbrella next dev :3471 (pid 1553264 tree, a6p2 leak, served pages without globals.css per EVIDENCE.md:16). Started own next dev :3491 with SCENEAXI_SITE_EDITOR_PREVIEW=1 (pid file /tmp/cssu-dev.pid). Lockfile sha256 snapshot /tmp/cssu-locks.sha. load 16.95
- 2026-10-07T16:31:58+02:00 step 1a MAIN build-CSS measured: temp worktree /tmp/sceneaxi-main-cssu @2cef2033 (frozen offline install 0, tsc build 0, next build OK; postbuild check-vercel-package exit 1 = nft symlink notice, host linker issue, CSS already emitted). main umbrella .next/static/css = 87,054 + 3,383 = **90,437 B**; main globals.css source 126,804 B. Worktree removed. load 17.7 (log _work/main-build.log)
- 16:36 step 1b REFERENCE capture started (css-umbrella/_work/cap.mjs -> css-umbrella/ref/). Scope: 20 routes (incl. ?checkout/?reason states, /admin/ledger compact density, /editor preview, 404) x 390/1440 x {rest, reduced-motion, forced-colors} full-page. Extra viewport shots: focus (4 tabs), hover, menu-open (390), palette (editor 1440), editor tiers 1100x700/1200x800/880x580. Canvas masked because WebGL output is nondeterministic. Each shot waits for a scroll pass + img.decode() + fonts.ready. The harness lib.mjs EXE path (chromium-1223) no longer exists on this box, so cap.mjs launches chromium-1217 directly; lib.mjs was not edited. Source snapshot _work/globals.before.css sha256 ddc0d394…
- 16:40 step 2a METHOD.
  - Static TSX grep (sites/umbrella/src + packages/site-kit/src, incl. dynamic `prefix-${}` classes): of 403 class tokens, only 3 have no source match (dl-row, field-well; woff2 is a url). All _components are imported.
  - Same-selector duplicate groups: 15. Overridden declarations: 16 (~0.4 KB).
  - So the sheet has little classic dead weight, and the cut has to come from declaration-level no-ops.
  - Built a declaration KNOCKOUT (_work/prep.cjs + knock.mjs + agg.cjs). The source loads as a constructed sheet with a --cssu-id per rule. `<html>` is set to display:none, so getComputedStyle returns computed values instead of layout-resolved ones. Each declaration is removed in turn, and its longhands are compared on every matched element, plus descendants and ::before/::after for inherited props and custom properties.
  - A declaration counts as a no-op only if it was evaluated in >=1 state AND changed nothing in EVERY state where its rule matched.
  - KEPT WHOLE, never analysed: reduced-motion / forced-colors / print media, @keyframes, @font-face, @container, any rule with a user-action pseudo (:hover/:focus*/:active/::selection/::marker/::placeholder/::-webkit-*), every !important, and repeated props inside one rule (fallback pairs).
  - Quick probe (/ and /editor, 23 states): 29 whole rules (1.8 KB) + 191 decls (4.3 KB) were no-ops.
  - Full run started -> _work/knock-full.json (21 routes x 390/768/1280/1440, +details-open, editor 7 modes x dock tabs, view tabs, assistant, local project, palette, palette-empty, editor tiers, menu open, short-height hero).
  - Safety net, run after every batch: _work/equiv.mjs compares the FULL computed style of every element plus ::before/::after, original vs candidate, in every state above plus reduced-motion, forced-colors and print.
- 16:46 step 1b done: 223 reference PNGs; coverage 737/944 selector parts matched. NOISE FLOOR: re-capturing 10 shots with no CSS change gave 0.000% on 7, 0.011–0.015% on 2, and **0.941% on home-390-rest** (hero state is time-dependent). A home-390 diff is therefore judged against this floor.

## FINAL (verified 2026-10-07T22:25+02:00, verify finisher round 7)
| Site | Source (main → now) | Build CSS now vs main | 60% limit (source) | Owed | Pixel diff | a11y | Gate |
|---|---|---|---|---|---|---|---|
| umbrella | 126,804 → **104,288** (final-c5, sha a871cbc2) | **89,294** vs 90,437 (**−1,143, PASS**; fresh `pnpm --filter @sceneaxi/site-umbrella build`) | 76,082 | **28,206 B** | 223 shots; 4 >0.5%, all NOISE by same-session A/B, **0 real** | 40 rows: 0 contrast fails at rest/hover/focus/disabled (min 5.37), axe = the same 2× scrollable-region-focusable on /editor@1440 as before, **0 of 40 rows differ from a11y-before** (`_work/a11y7-final.json`, `a11y7-umbrella.json`) | no failures beyond GATE-BASELINE (prepared-asset-handoff timing: same-load A/B main 5/5 = v6 5/5) |

Ships: final-c5. No revert to globals.before. The 60% target is recorded as unmet per the operator ruling of 2026-10-07. Remaining CSS is live styling; reaching 60% requires visual change. Details: `docs/redesign-v6/EVIDENCE.md` "Current state".
