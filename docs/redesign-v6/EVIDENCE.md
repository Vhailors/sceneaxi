# SceneAxi v6 (A-rich): release evidence

## Current state (verified 2026-10-07T23:20+02:00)
Final release fixer, round 8. Log: `lanes/release-fix.md` (the "round 8" lines, step 1 through step 10). `R` = `~/Documents/Reports/sceneaxi-redesign-v6/`.

Round 8 changed source in 4 files and touched no CSS:
- `sites/catalog-{game,web}/src/app/{loading,error}.tsx`: the route-state fix, see "Round 8 fix" below.

The table rows carry over from round 7. Round 8 rebuilt the stores fresh and they are still 44,353 B each.

| Site | Source `globals.css` (main → now) | Build CSS (`.next/static/css/*.css`): now vs main | 60% limit (source) | Bytes still owed | Pixel diff vs before-CSS ref | a11y (contrast rest/hover/focus/disabled, axe serious+critical, tab stops 390/1440) | Gate |
|---|---|---|---|---|---|---|---|
| umbrella | 126,804 → **104,288** (final-c5, sha a871cbc2) | **89,294** vs 90,437: **−1,143, PASS** (fresh `pnpm --filter @sceneaxi/site-umbrella build`, 85,911 + 3,383) | 76,082 | **28,206** | 223 shots. 4 >0.5%, all classified as **NOISE** by a same-session A/B (A = pre-cut 115,156 B, B = final-c5). **0 real** | 40 rows. 0 contrast fails (min 5.37; disabled text 5.38, boundary 5.81). axe: only `scrollable-region-focusable`×1 on /editor@1440 and ?mode=animate@1440, identical to a11y-before. **0 of 40 rows differ from a11y-before** | no new failures (see below) |
| catalog-game | 67,513 → **61,659** (sha cd49c464) | **44,353** vs 45,277: **−924, PASS** | 40,508 | **21,151** | 66 shots (both stores), **0 >0.5%**, max 0.056% | 14 rows. 0 fails (min 5.09). axe 0. Primary action at Tab stop 4 (390) / 5 (1440), 7/8 on the malformed query. 0 of 14 rows differ from round 6; mins equal the before-CSS ref | ″ |
| catalog-web | 67,542 → **61,688** (sha 973ea5cf) | **44,353** vs 45,277: **−924, PASS** | 40,525 | **21,163** | (in the 66 above) 0 >0.5% | 14 rows. 0 fails (min 5.37). axe 0. Primary action at stop 4 / 5 (7/8 malformed). 0 of 14 rows differ | ″ |
| kids (not touched this round) | 21,760 → 12,620 | not re-measured | 13,056 | 0 (pass) | — | — | ″ |

Commit, PR and normal merge run in the ship step after R1+R2 PASS (operator ruling 4); their absence is expected at review time.

- **Ship gate** (2026-10-07 23:43–23:54, load 13–24, on the committed tree incl. `chore(lint)`; step-wise run and gatediff in `R/ship/gate/`):
  - **Literal gate** (`pnpm run gate` at the start of the ship step, 23:18): exits 1 at check:traceability (baseline #4), as main does (`R/ship/gate/literal-gate.log`). The step-wise run below covers every stage.
  - **By stage:** syntax 0 · boundaries 0 · contracts 0 · traceability 1 (#4) · sites 1 (#1) · desktop 1 (#2) · publish-ready 1 (#3) · build 0 · vitest 201 failed / 17 files (5,103 / 5,304 pass) · node --test 0 · eslint 33 errors / 7 files (#7, all in `docs/audits/**` and `scripts/fix-trace-entries.mjs`).
  - **gatediff vs baseline:** one NEW entry, `packages/importers/test/asset-preparation-bounds.test.ts` (heartbeat 123.6 ms > 100 ms under full-gate load). It is timing-flaky in GATE-BASELINE.md and the branch has 0 diff in `packages/importers`. **Same-load A/B, interleaved main/v6 ×3 at load 10–13: main 3/3 pass, v6 3/3 pass** (`R/ship/gate/ab/ab.txt`), so it is not a new failure. GONE: none. **Result: no failures beyond GATE-BASELINE.**
  - Site and desktop typechecks: umbrella, catalog-game, catalog-web, kids and desktop/linux `tsc --noEmit` all 0 (kids after the kids-art index fix folded into the kids commit).
  - **Lockfiles:** all 8 tracked `pnpm-lock.yaml` byte-identical to HEAD before and after (md5 in `R/ship/gate/locks-*.md5`).
  - **anti-slop lint:** `oxlint --config .oxlintrc.json` is clean on every changed code file. Pre-existing findings on main in the 15 touched files went into `chore(lint)`; on main, the affected vitest (desktop-shell, parity, desktop, site seams/visual/editor, kids-surface) was 864/866 before and after, with the same 2 baseline failures (`R/ship/lint/main-{before,after}/`).

- **Round 8 fix: route-state regression** (R1 finding)
  - **Test:** `sites/catalog-game/test/rendered-route-states.test.mjs` was 2/4 (`ReferenceError: require is not defined`) and is now **4/4**.
  - **Cause:** `src/app/{loading,error}.tsx` in both stores imported `./_components/state-plate.js` (catalogs lane). The test evals the transpiled TSX with no `require`.
  - **Fix:** both files in both stores (game and web byte-identical) write out the same plate markup inline and import nothing. Test, CSS and `state-plate.tsx` are untouched. `not-found.tsx` keeps `StatePlate`; that harness does not load it.
  - **Verification** (`R/release-r8/`):
    - SSR markup of loading/error/not-found in both stores is byte-identical before and after (`_work/{before,after}.json`).
    - Prod builds before and after, served by `next start` :4591/:4592: 24 shots (3 states × 2 stores × 390/1440 × base/forced-colors), pixel diff **24/24 0.000%** (`states/{before,after}`).
    - Contrast 0 fails (plate 17.26 isolated, 5.37 refused; page minimum 5.54 game, 6.1 web). axe 0 serious/critical ×12. Facts identical before and after.
    - Build CSS 44,353 B per store before and after.
    - Other store tests: ux-regression 13/13 + 17/17, item-session-wiring 15/15 + 15/15.
    - `states/*-flaky/` is a discarded capture-race pair; see `lanes/css-catalogs.md` "Round 8 fix".
    - Servers killed.
- **Build CSS:** no site ships more CSS than main. The umbrella number comes from a fresh build in this round (`/tmp/rf7-build-umbrella.log`, rc 0). The store builds are the round-6 builds of unchanged sheets. The umbrella build re-adds 158 lines to `sites/umbrella/pnpm-lock.yaml` (build:sdk); restored with `git checkout`. **All 8 tracked `pnpm-lock.yaml` are byte-identical to HEAD.** Re-checked after the round-8 gate and A/B: `git diff --quiet HEAD` over all 8 is clean, and md5 is unchanged from the start of the round. No `pnpm install` was run in this round.
- **a11y artifacts:** `R/css-umbrella/_work/a11y7-final.json` (vs `a11y-before.json`), `a11y7-{umbrella,game,web}.json` (vs round-6 `a11y6-*.json`). Umbrella ran on dev :3491 (the same mode as before); stores ran on prod :4581/:4582.
- **Pinned tests:** vitest umbrella-visual, umbrella-launch-marketing, editor-shell-parity and catalog-storefronts: **204/204** pass. node --test: catalog-ux-regression 13/13 + 17/17, item-session-wiring 15/15 + 15/15. `sites/catalog-game/test/rendered-route-states.test.mjs` **4/4** (round 8; it was 2/4). It is not part of `pnpm run gate`.
- **Gate, round 8** (22:49–22:59, load 26–30; `docs/redesign-v6/gate-latest.log`, step-wise and gatediff in `R/release-r8/gate/`):
  - **Literal gate:** exits 1 at check:traceability (baseline #4), as main does.
  - **By stage:** syntax 0 · boundaries 0 · contracts 0 · traceability 1 (#4) · sites 1 (#1) · desktop 1 (#2) · publish-ready 1 (#3) · build 0 · vitest 201 failed / 18 files · node --test 0 · eslint 33 errors / 7 files (#7, the same as round 7; none in the 4 changed files).
  - **gatediff vs baseline:** two NEW entries, both ~60 s timeouts in the full gate. Both are listed as timing-flaky in GATE-BASELINE.md:67-68, and the branch has 0 diff in `packages/cli` and `packages/importers`:
    - `packages/cli/test/capabilities.test.ts`
    - `packages/importers/test/asset-preparation-bounds.test.ts`
  - **Same-load A/B, interleaved v6/main** (`R/release-r8/gate/ab/{ab.tsv,ab-cli2.tsv}`):
    - capabilities: v6 6/6 pass (load 16–26); main 3/3 pass at load 14–21, after `npx tsc --build` in the main worktree. The first 3 main runs were invalid (`build output not found`).
    - asset-preparation-bounds: v6 3/3 pass; main 2/3 (run 3: heartbeat 100.69 ms > 100 at load 22.6).
    - So neither is a new failure. `prepared-asset-handoff` passed in this gate. GONE: none.
  - **Result: no failures beyond GATE-BASELINE.**
- **Gate, round 7, superseded** (`R/release-r7/gate/`): the literal gate exits 1 at check:traceability (baseline #4), as main does. By stage: syntax 0 · boundaries 0 · contracts 0 · traceability 1 (#4) · sites 1 (#1) · desktop 1 (#2) · publish-ready 1 (#3) · build 0 · vitest 200 failed / 17 files · node --test 0 · eslint 33 errors / 7 files (#7). gatediff vs baseline: the only NEW entry is `desktop/linux/test/prepared-asset-handoff.test.ts` (heartbeat 104.8 ms > 100 ms at load ~35). That test is listed in GATE-BASELINE as 0–1 load-sensitive. **Same-load A/B, interleaved main/v6 ×5 at load 12–16: main 5/5 pass, v6 5/5 pass** (`/tmp/rf7-ab-handoff.txt`), so it is not a new failure. GONE: none. **Result: no failures beyond GATE-BASELINE.**
- v5 hexes `#FF6B2C` / `#46D8EC`: 0 in the built umbrella CSS and 0 in site/app source. The remaining mentions are in tests (a negative assertion and a schema fixture) and in README / VISUAL-EVIDENCE history tables.

## Unmet targets (recorded, per operator ruling 2026-10-07)
These are recorded as measured. They are not fail reasons.
1. **CSS ≤ 60% of main (BRIEF.md:138): not met.** Bytes still owed (source): umbrella **28,206 B** (104,288 vs 76,082), catalog-game **21,151 B** (61,659 vs 40,508), catalog-web **21,163 B** (61,688 vs 40,525). Kids meets it (12,620 ≤ 13,056). Measured on built CSS instead, the 60% line would be 54,262 B for the umbrella (owed 35,032) and 27,166 B for each store (owed 17,187). Remaining CSS is live styling; reaching 60% requires visual change.
2. **Page speed: measured under load, not certified.** The numbers and the load of each run are in "Lighthouse — measured under load, not certified" below.
3. **Visual fidelity: not human-reviewed.** Agents cannot view PNGs. The pixel diffs above show that the CSS cuts are neutral against the before-CSS references. They do not judge whether the design itself looks right. See "Needs a human eye".

## Open issues (verified 2026-10-07)
1. **RESOLVED in round 8 (now 4/4; see "Round 8 fix" in Current state).** Original record: **`sites/catalog-game/test/rendered-route-states.test.mjs` fails 2/4 on redesign-v6** ("mirrored real catalog loading components…" and "actual branded catalog error components…": `ReferenceError: require is not defined`). Earlier lanes logged this as pre-existing, which is **wrong**. With main's test run against main's `loading.tsx`/`error.tsx`, both cases pass. The test evals transpiled TSX with no `require`. On v6, `sites/catalog-{game,web}/src/app/{loading,error}.tsx` import `./_components/state-plate.js` (catalogs lane). This is a TSX regression, not caused by CSS, and it is outside `pnpm run gate`. Unfixed, because tests are frozen and the source fix belongs to the catalogs lane.
2. Packaged-app axe: 2 moderate findings (`landmark-one-main`, `page-has-heading-one`) on the project chooser (`R/release-r3/axe-desktop-packaged.json`). axe reports 0 serious/critical.
3. The umbrella build (`build:sdk`) rewrites `sites/umbrella/pnpm-lock.yaml` on every pnpm build. It must be restored before any commit.

## History

### Unmet acceptance (STALE, superseded by "Current state" above)
No ruling waives any of these. Earlier "conductor ruling" text further down is history of how each round was steered, not a waiver.
1. **A11 CSS ≤ 60% of main — FAIL, no reduction landed.** Neither CSS lane applied a change (see "CSS A11 integration run" below). Source `globals.css` bytes now vs limit: umbrella **115,156 > 76,082** (needs −39,074 B); catalog-game **67,274 > 40,508** (−26,766 B); catalog-web **67,303 > 40,525** (−26,778 B); kids 12,620 ≤ 13,056 (pass).
2. **Shipped build CSS must not grow vs main — FAIL.** Measured as the sum of `.next/static/css/*.css` from `next build`: umbrella **97,731 > 90,437** (+7,294, +8.1%); catalog-game and catalog-web **46,189 > 45,277** each (+912, +2.0%).
3. **A9 page speed: measured under load, not certified.** This is not a FAIL reason. Actual numbers with the load of every run are in "Lighthouse — measured under load, not certified" below. Lab Lighthouse does not report INP (TBT is the proxy). Certification pending operator decision (flagged by the user).
4. **Low-load re-run of the 2 timing tests — not possible.** Load never fell below 4. Two substitutes exist instead: a same-load A/B against main (3× each, 12/12 green on both sides, `R/release-r3/ab/ab.tsv`), and the 17:23–17:33 gate, where both tests passed at load 12–25.
5. Packaged-app axe: 0 serious/critical, but 2 **moderate** findings remain (`landmark-one-main`, `page-has-heading-one`) on the project chooser (`R/release-r3/axe-desktop-packaged.json`).

### CSS A11 integration run (2026-10-07 17:22–17:45) — what was measured
`RI` = `~/Documents/Reports/sceneaxi-redesign-v6/integration-css/` (log: `RI/log.md`). This run owns EVIDENCE.md, the report and any new gate failures. It edited no CSS.

**Bytes (source `globals.css` / build = sum of minified `.next/static/css/*.css`)**

| Site | main source | v6 source (now) | 60% limit | Verdict | main build | v6 build (now) | Verdict |
|---|---|---|---|---|---|---|---|
| umbrella | 126,804 | 115,156 (90.8%) | 76,082 | **FAIL** (−39,074 owed) | 90,437 | 97,731 (17:37 build) | **FAIL** (+7,294) |
| catalog-game | 67,513 | 67,274 (99.6%) | 40,508 | **FAIL** (−26,766 owed) | 45,277 | 46,189 (16:58 build of current source) | **FAIL** (+912) |
| catalog-web | 67,542 | 67,303 (99.6%) | 40,525 | **FAIL** (−26,778 owed) | 45,277 | 46,189 | **FAIL** (+912) |
| kids | 21,760 | 12,620 | 13,056 | pass | 16,227 | 10,262 (release run) | pass |

Sources for main's build CSS: umbrella from `lanes/css-umbrella.md` step 1a and stores from `lanes/css-catalogs.md` step 1b. Both lanes built them in a temp worktree at 2cef2033, and the worktrees have since been removed. The v6 "redesign" column and the "now" column are the same, because no reduction landed.

**State of the CSS lanes.** No lane process was running at 17:22.
- Umbrella (`lanes/css-umbrella.md`; last entry 16:46):
  - It produced a declaration-knockout candidate `css-umbrella/_work/cand.css` of 108,521 B (−6,635), still 32,439 over the limit.
  - Its computed-style equivalence check still showed **205 diffs in 116 states** at iteration 2, so the candidate was never applied. It could not be.
  - 223 reference PNGs exist. No after-capture exists.
  - The lane's static method found only 3 of 403 class tokens with no TSX/site-kit match. Per that lane's analysis, the 60% cut cannot come from dead selectors alone.
- Catalogs (`lanes/css-catalogs.md`; last entry 17:12):
  - It found 7 zero-hit classes (chip-dormant/needs-review/ok/refused/validated, plate-detail, plate-lead) plus 4 coverage-dead selectors, roughly 1–2 KB against the ~26.8 KB owed.
  - Both store files were restored to their start bytes (mtime 16:56:26). Lockstep holds: `diff` = 6 hunks, all in lines 2–38 (header comment + STORE IDENTITY `:root`).

**Pixel diffs (pixelmatch-equivalent, threshold 0.1).** Only reference and noise shots exist. No reduced sheet was ever captured, so no regression verdict is possible.
- css-catalogs (`R/lanes/css-catalogs/*/shots/pdiff.json`):
  - `noise`: 38/38 shots at 0.000%.
  - `inj-orig`, the original sheet re-injected: 38/38 at 0.000%. Its 28 forced-colors shots are missing on both sides.
  - `b1`/`b1b`, the trial batch against the dev-server ref: 37/38 at 0.000%. 1 shot is >0.5%: `game-notfound@390` at 40.18%, because its size went 390×1240 → 390×1911. That is `next dev` streaming `loading.tsx`, not CSS. It is why the lane re-captured on production servers. The batch was not kept.
- css-umbrella (lane log step 1b): the noise floor is 0.000% on 7/10 shots, 0.011–0.015% on 2, and **0.941% on home-390-rest**, because the hero is time-dependent. No after-diff exists.

**Contrast / axe / tab stops.** Every site's CSS and TSX is byte-identical to the last measurement, so the latest numbers stand:
- Stores: re-measured 17:12 on production servers (`css-catalogs.md` step 1c).
  - Contrast: 0 fails, min 5.09:1 (game) and 5.37:1 (web).
  - axe: 0 serious/critical on all 28 loads.
  - Open in editor: Tab stop 4 at 390 and 5 at 1440 in both stores.
- Umbrella: release round 3 (`R/release-r3/`).
  - Contrast: 0 fails on all routes incl. `/editor`. Text ≥5.38:1, disabled boundaries ≥3.55:1.
  - axe on `/ /editor /open /pricing` at 1280+375: 0 violations.
  - Primary action: umbrella 3 stops; editor Change Review is landmark-relative 2.

**Gate** (step-wise, 17:23–17:33, load 12.1→25→19.5, `RI/gate/`):
- The literal `pnpm run gate` handed to this run stops at `check:traceability`. That is GATE-BASELINE #4: the same 4 stale `tests/helpers/desktop-chrome-golden.{d.ts,d.ts.map,js,js.map}` proof paths as on main.
- traceability, sites, desktop and publish-ready exit 1 (baseline #4/#1/#2/#3). build 0. vitest: 5,304 tests, 199 failed in 16 files. `node --test` 0. eslint: 33 errors in 7 files.
- **NEW vs GATE-BASELINE: none. GONE: none (21/21).** Both timing tests (prepared-asset-handoff, asset-preparation-bounds) passed inside the gate, so no same-load re-run was needed.
- `git status` was identical before and after, and 0 of the 9 tracked `pnpm-lock.yaml` were modified. Nothing needed fixing or restoring.

# SceneAxi v6 — Release evidence (plan step 10)

Agent: EVIDENCE + REPORT. Branch `redesign-v6`. Read-only on code; owned: this file + `~/Documents/Reports/sceneaxi-redesign-v6/` (written `R/`).
Report: `R/index.html`. Raw: `R/release/`.

Visual fidelity: deferred to the human final gate (no agent can view PNGs).

## Release fix round 3 (R1 third FAIL; conductor scoped this round to the small, real gaps) — finding → fix → evidence
`R3` = `~/Documents/Reports/sceneaxi-redesign-v6/release-r3/`. Fresh `next dev` on :3481 with `SCENEAXI_SITE_EDITOR_PREVIEW=1`. An orphan umbrella-lane `next dev` on :3471 served pages **without** `globals.css`, so its first probe was discarded.
1. **Nested locks** → `sites/catalog-{game,web}/pnpm-lock.yaml` were already clean when checked (`git status --porcelain | grep pnpm-lock` empty both before and after `git checkout --`).
2. **Disabled-state contrast on umbrella routes (umbrella.md:233)** → measured natural `:disabled`/`[aria-disabled]` controls, plus one synthetically disabled control per class, on `/ /pricing /engine /docs /login /account /admin /open /profiles /editor` at 1280 and 375 (`R3/disabled-contrast.json`). Non-editor routes: 0 fails, min text 5.95:1. `/editor`: **8 fails**, all UI boundaries at 1.12–1.24:1 (a dimmed `--line` border on inert Reject all / Accept all / per-change ✓✕ / Send, and on search, mode, Reset view, select and local-project buttons). **Fix** in `sites/umbrella/src/app/globals.css`, merged into the existing base rules: disabled boxed controls in `.edshell` take a dashed `--fg-2` boundary, which is the family's disabled mark (`.ed-primary.is-inert`, `.ed-ghost.is-inert`, `.ed-local-project-panel button:disabled`, plus one selector-list rule after `.edshell [aria-disabled]`). No `!important`. **After**: `/editor` 0 fails; min boundary 3.55:1 (select at opacity .7), the rest 5.81–6.37:1; min text 5.38:1 (`R3/disabled-contrast-editor-after.json`, `R3/editor-dock-disabled-1280.png`). axe re-run `/ /editor /open /pricing` @1280+375: 0 violations of any impact (`R3/axe-umbrella-after-disabled-fix.json`).
3. **axe in the packaged app** → `/tmp/sxrel2-release/linux-unpacked/sceneaxi-engine-desktop` (app.asar 15:20:52; no desktop source is newer) under `xvfb-run` via Playwright `_electron`. Result: **0 serious/critical** at 1280×800 and 1920×1080. Moderate: `landmark-one-main` 1 and `page-has-heading-one` 1 (open). `R3/axe-desktop-packaged.json`, `R3/desktop-packaged-{1280,1920}.png`.
4. **Timing tests** → load stayed 9.3–14.0, so the low-load re-run was impossible. Ran a same-load A/B against main (temp worktree), 3× each, interleaved. prepared-asset-handoff: v6 3/3, main 3/3. asset-preparation-bounds: v6 3/3, main 3/3 (`R3/ab/ab.tsv`, with the load on every row).
5. **Lighthouse** → actual numbers from the 10 runs are now tabled below as "measured under load, not certified" (`R3/lighthouse-under-load.md`).
6. **EVIDENCE top section** → rewritten as "Unmet acceptance". The "rulings amend the acceptance list" wording is gone.
7. **Gate** → `pnpm run gate` 16:08–16:15, load 13.6–15.8: **NEW vs GATE-BASELINE: none, GONE: none** (21/21 entries). Vitest 5105/5304 passed; 16 failed files, all of them baseline. Both timing tests passed inside the full gate. Locks unchanged (`docs/redesign-v6/gate-latest.log`, raw `R3/gate/`).

Visual fidelity: deferred to the human final gate.

## Conductor rulings (release)
Conductor rulings for the R1 fix, so the next review can PASS on real fixes instead of looping.
FIX (must be measured after):
1. axe: raise `.ed-tree-kind` to ≥4.5:1, and make `.ed-overlay-notes` keyboard-reachable (tabindex="0", a labelled region). Re-run axe on that route: 0 serious/critical.
2. Store item page: the buy/acquire action within 5 tab stops by DOM order in BOTH stores (lockstep). Build the evidence with NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN set to the local umbrella origin, so the button is live. Log that an unset origin correctly renders a labelled disabled state, and that this is deploy config, not a defect.
3. Store CSS grew past baseline (68.7K vs ~66K). Delete dead and v5 rules in both stores, keeping them lockstep, until each is ≤ its BASELINE bytes. Never drop focus or reduced-motion styles.
4. Your focus-obscured run is down to 1 obscured stop (umbrella /docs 375, div.scroll-x). Fix it via scroll-padding, then re-measure.
Round-1 steering (history; it does not waive acceptance — see "Unmet acceptance" at the top):
- Lighthouse: this said UNVERIFIED. Now superseded: measured under load, not certified (see top and the Lighthouse section).
- 60% site-CSS target: it becomes a follow-up. The hard release rule is no site grows beyond its baseline. Umbrella is at 114K vs 124K (−8%), and stores pass after fix 3. The v5 deletion remainder is tracked.
- Operate surfaces (the editor-preview Change Review and desktop Save): the 5-stop rule is measured from the panel's landmark/skip target or the documented shortcut (e.g. Ctrl+S, if it exists and is announced). Measure and log both the raw count and the landmark-relative count. If Save has no shortcut and no landmark path under 5, that is a real finding: fix it.
Then rerun the gate vs baseline, check every tracked pnpm-lock.yaml is byte-identical to HEAD (restore any that aren't; delete none), and update EVIDENCE.md and the report.

## Release fix round 2 (after R1 second FAIL) — finding → fix → evidence
Raw: `R/release/fix2/` (`fix2.json` confirm, `fix2-round1.json` first measure, `logs/`). Harness `R/release/_work/fix2.mjs` (reuses `lib.mjs`; scroll + `img.decode()` before shots).
1. **Store buy at Tab stop 6 at 1440** → lockstep in both stores: the family bar (`_components/family-bar.tsx`, byte-identical) now names the three surfaces without links, the current one marked `aria-current="page"`. The cross-site links (Engine, sibling store) are in the footer's SceneAxi column at every width (`layout.tsx`) and inside the ≤860px Menu panel via `StoreNav` children with class `.nav-family`, hidden from 861px (`globals.css`, `html body .nav .nav-family`, no `!important`). Measured with all three origins configured and buy live: **1440 = stop 5** in both (skip, storemark, Catalogue/Showroom, Sell your work/Submit a scene, buy); **390 = stop 4** (skip, storemark, Menu, buy). Footer family links 6.33:1 rest, 17.29:1 hover, solid ring ≥5.51:1; Menu family links 6.37:1+, ringed, unobscured. axe 0 serious/critical on 8 route×width runs. Store tests 112/112. Store globals still differ only in the 30-line token block. **Needs the owner's visual review** (header IA change). Shots: `fix2/catalog-{game,web}-detail-{1440,390}-primary-focused.png`, `-detail-390-menu-open.png`, `-home-{390,1440}-footer-family-focused.png`, `-home-1440-forced-colors.png`.
2. **Site CSS** → ruled above (no growth past BASELINE). This round removed dead `a.family-item`/`.family-out`/`.family nav` rules: stores 67,274 / 67,303 (were 67,300 / 67,329). The 60% target stays a follow-up.
3. **Packaged Electron not rebuilt** → rebuilt from the current tree: `cd desktop/linux && node scripts/build-linux.mjs` (exit 0) then `npx electron-builder --linux dir --config electron-builder.yml -c.directories.output=/tmp/sxrel2-release` (exit 0); artifact `/tmp/sxrel2-release/linux-unpacked/sceneaxi-engine-desktop` (app.asar 15:20:52, after the `frame/markup.ts` edit). Launched under Xvfb via Playwright `_electron`: title "SceneAxi Engine Desktop", window bg #182320, density comfortable (Save 28px) and compact (Save 24px), Save carries `aria-keyshortcuts="Control+S"`, 8-Tab walk ringed, no v5 colours. Shots: `fix2/desktop-packaged-{comfortable,compact,reduced,save-focused}.png`. axe inside the packaged renderer: UNRUN (CSP blocks the injected script).
4. **Lighthouse** → see "Unmet acceptance" #2 (measured under load, not certified).
5. **Timing tests / gate** → step-wise gate at load 21–26: new-vs-baseline **NEW: none, GONE: none** (21/21 baseline entries); vitest 199 failed / 5304 in 16 files (all in GATE-BASELINE); both timing files passed in-suite this run, so no A/B was needed. Literal `pnpm run gate` exit 1 at check:traceability, as main. `docs/redesign-v6/gate-latest.log`.
6. **Lockfiles** → `pnpm exec next build` inside each store rewrote `sites/catalog-{game,web}/pnpm-lock.yaml` (packageManagerDependencies); reverted with `git checkout HEAD --`; all tracked lockfiles and `pnpm-workspace.yaml` identical to HEAD afterwards.

## Release fix (after R1) — finding → fix → evidence
Log: `docs/redesign-v6/lanes/release-fix.md`. Raw: `R/release/fix/` (`fix.json` confirm round, `fix-round1.json`, `desktop-save.json`, shots, `gate/`). Visual fidelity: deferred to the human final gate.
1. **axe `.ed-tree-kind` 4.03:1** → `sites/umbrella/src/app/globals.css`: one state rule, `.ed-tree li.is-selected .ed-tree-kind { color: var(--fg) }`. Restating `--fg-2` on the row tripped the "no Foundations token" pin, so that was reverted. → 11.05:1 selected, 6.10:1 rest; axe 0.
2. **axe `.ed-overlay-notes` not keyboard-reachable** → `sites/umbrella/src/app/editor/page.tsx`: `role="region" aria-label="Editor notices" tabIndex={0}` → axe 0 (1280 settled/reduced, 375).
3. **Store item primary at stop 7 + disabled** → both stores in lockstep: the duplicate nav Engine↗ is dropped (`store-nav.tsx`, `layout.tsx`); the breadcrumb stays as text, not a link; title, price and action move ahead of the pinned `.detail-side` region (`item/[itemId]/page.tsx`; region tabIndex, role and name are unchanged); the umbrella's no-script `<details>` Menu is used ≤860px only (`globals.css`, mobile-first because the pin forbids max-width). → 390 = 5, 1440 = 6, link live. The "disabled" state is deploy config: `editorLinkFor(process.env)` is read **server-side at request time**, so `next start` needs `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` in its runtime env. Unset, the action correctly renders the labelled disabled span "Editor link unavailable" (aria-disabled, the reason as title) plus a refusal StatePanel. That is not a defect.
4. **Store CSS past baseline** → lockstep: the header and 7 long prose comments are condensed, dead `.chip-dot` is deleted, and the `.crumbs a` rules go with the crumb link. No focus, forced-colors or reduced-motion rule is touched. → 67,300 / 67,329 vs main 67,513 / 67,542.
5. **Editor Change Review at stop 35** → `editor-shell.tsx`: the dock is a named region "Dock"; the dock tablist is one Tab stop with Arrow/Home/End (APG roving). → raw 32, landmark-relative 2; arrows verified.
6. **Desktop Save at stop 8** → `apps/desktop-shell/src/chrome/frame/markup.ts`: Save announces `aria-keyshortcuts="Control+S"`. The binding was already there and documented in the menu and palette. → shortcut path verified (dispatch defaultPrevented=true), raw stop 8 logged.
7. **Focus obscured, /docs 375 scroll-x** → `.scroll-x` bounded to `100dvh − masthead − 32px` with `scroll-margin-block` → 0 obscured.
8. **Lighthouse** → load 34–51 throughout this round. Superseded by "Unmet acceptance" #2.

## Needs a human eye (top of `R/index.html`)
1. The six G2 shots (RULINGS §G2 visual veto). They are copied into `R/release/human/g2-*.png` from `docs/redesign-v6/concepts/{a,b}/slice/`.
2. The A-rich compare board: `R/compare.html`.
3. The built umbrella home and Change Review against `docs/redesign-v6/concepts/a-rich/shots/` (1-umbrella-390/1440, 3-inspector-390/1440), shown side by side in the report: built `R/release/umbrella/home-{375,1280}.png`, `R/release/web-shell/proposed-pending-dark-{375,1280}.png`, `R/release/umbrella/editor-preview-1280.png`.
4. The hero motion strip: `R/release/motion/umbrella-home-1440-*ms.png`.

## Method
- The BASELINE.md harness was copied to `R/release/_work/` with OUT → `release/`. It used the same routes, widths (375/768/1280/1920), states and servers (`next start` :3301–3305, web shell :5381 on a copy of the BASELINE scratch scene).
- Release addition: `settle()`. Before every full-page shot it scrolls the whole document, awaits `img.decode()` on every image, then `document.fonts.ready`, then returns to the top.
- Harness adaptations, so the BASELINE scripts run on v6: Chromium 1223 → 1217; `render()` transpiles relative imports; the kids selector targets `.choice-cell`.
- New probes:
  - `flows.mjs`: keyboard-only flows.
  - `obscure.mjs`: strict 5-point focus-obscured probe, plus a confirm round.
  - `axeconfirm.mjs`.
  - `motion.mjs`: seeked hero strip and real-time frame budget.
  - `packaged.mjs` / `packaged-axe.mjs`: packaged desktop, forced colours, 200%.
  - `static.cjs`: anti-reference hex, `!important`, catalog diff, bytes.
  - `gate-chain.sh` / `gatediff.cjs`.
  - `lh.sh`: Lighthouse, waits for load < 4.
- Desktop: `build-linux.mjs` followed by `electron-builder --linux dir` to `/tmp/sxrel-release` (outside the repo, fresh asar), launched under Xvfb.

## Acceptance vs baseline
| Check | Baseline (main) | Release | Verdict |
|---|---|---|---|
| Enabled-control text contrast ≥4.5 (rest/hover/active/focus) | umbrella 4.51 min; catalog-game active 4.64 | umbrella 5.81/5.38/5.38/5.81; game 5.54/4.81/4.64/5.54; web 6.37/7.28/7.00/6.37; kids 7.18/9.43/9.43/7.18; web shell 13.45/15.61/15.61/13.45; desktop 0 of 11 below 4.5 | PASS |
| Disabled ≥4.5 | kids 6.10; web shell 7.16/5.74 | umbrella 5.38 (round 3: all umbrella routes incl. `/editor`, text ≥5.38, boundaries ≥3.55 after fix), kids 5.83, web shell 5.67, desktop Apply source 4.66 | PASS |
| Focus ring ≥3:1 | min 5.31 | min 5.03 (kids), web shell 12.64 | PASS |
| axe serious+critical (axeall, 64 page×width) | 11 serious | R1: 2 (editor preview `.ed-tree-kind` 4.03:1, `.ed-overlay-notes`). **After fix:** 0 on all 13 re-run route×width×motion cases (`R/release/fix/fix.json`): `.ed-tree-kind` on the selected row is #EDEFF2 on #313334 = 11.05:1 (6.10:1 on the rest rows); the notes rail is a named region "Editor notices" with tabIndex 0 | **PASS** (fix) |
| axe moderate | 36 | 32 (heading-order 4 → 0) | improved |
| Every state has a label and an icon | — | 14 stateful plates on 8 pages: 0 without an icon, 0 without a label | PASS |
| Primary action ≤5 Tab stops (DOM order) | not measured | R1: store detail 7, editor preview 35, desktop Save 8. **After fix:** store detail with the action live, both stores: **390 = 5** (skip, family Engine↗, storemark, Menu, *Open in the SceneAxi editor*); 1440 = 6 (skip, family Engine↗, storemark, Catalogue, Sell, action). Editor Change Review: raw 32, **landmark-relative 2** ("Dock" region → dock tablist (one stop) → Reject all). Desktop Save: raw 8, **shortcut Ctrl+S** shown as `<kbd>Ctrl/Cmd+S</kbd>` in the File menu and palette, announced via `aria-keyshortcuts`, dispatch verified. Others unchanged: umbrella 3, kids 1, web shell 4 | **PASS** per conductor ruling 2 and Operate ruling; desktop store header at 1440 is an open item |
| Focus never obscured | loose probe only | strict probe: 1,147 stops. 3 covered during smooth scroll; confirm round 1 obscured (umbrella /docs 375 `div.scroll-x`). **After fix:** /docs 375 + 1280, 79 stops, 0 obscured; scroll-x off=0 cov=0 ring=true | PASS |
| Forced colours | not measured | no overflow on every surface, shots taken (sites ×3 routes, kids, web shell, desktop) | PASS (visual: human) |
| 200% zoom | no overflow | sites + web shell: no overflow. Desktop shows its min-window refusal (by design, as on main) | PASS / desktop: see open issue |
| Reduced motion | 0 running | 0 running everywhere; umbrella hero 0 animations; desktop 0 | PASS |
| Lighthouse LCP<2.5 s, CLS<0.1, TBT<200 | `/` mobile 4,585 ms / 0 / 2,015 | measured under load 43–49, not certified: mobile LCP 4,761 / 3,578 / 3,115 / 3,286 / 1,786 ms, CLS ≤ 0.041, TBT 550–3,800 ms; see below | **FAIL under load; quiet run owed** |
| Packaged Linux Electron launches in the new chrome | old chrome | launches; window bg #182320; title "SceneAxi Engine Desktop — Choose a project"; 12-Tab walk all ringed and unobscured; comfortable Save 28 px / compact 24 px. Round 2: rebuilt from the current tree (incl. `frame/markup.ts`) to `/tmp/sxrel2-release`, relaunched, same facts (`fix2/desktop-packaged-*.png`) | PASS |
| Catalog game vs web differ only in the store token block | — | globals.css: header comment (store name) + STORE IDENTITY `:root` only | PASS |
| Own CSS ≤1.3× main | — | umbrella 0.901, stores 1.018, kids 0.580, web shell 1.274, desktop chrome 1.014, BYO 1.180 | PASS |
| Site total ≤60% of BASELINE | budgets 76,082 / 40,508 / 40,525 / 13,056 | after fix round 2: 114,706 / **67,274** / **67,303** / 12,620. No growth past main (126,804 / 67,513 / 67,542 / 21,760) holds on all four, but that is not the acceptance number. Round 3: umbrella 115,156 | **FAIL** (umbrella, game, web over 60%); kids pass |
| v5 #FF6B2C / #46D8EC in shipped source | present | 0 hits | PASS |
| `!important` each with a lane reason | — | umbrella 4, catalogs 2+2, desktop 2, web shell 1: lane logs mention them (checked by mention count only, not per declaration). site-kit design-tokens.ts:1283 is the reduced-motion reset. Reason, recorded in lanes/release-fix.md: the user's reduced-motion preference must beat every component animation at any specificity. The fix round added none | PASS (reason recorded) |
| Gate: nothing beyond GATE-BASELINE | 21 entries | 24 entries. The 3 extra are the GATE-BASELINE load-sensitive files; alone at load 18→11 they pass 3/3. New: **none**. **Fix round** (`docs/redesign-v6/gate-latest.log`, raw `R/release/fix/gate/`): literal gate exit 1 at check:traceability (as on main); vitest 5,304 tests, 201 failed in 18 files; 23 entries, +2 GATE-BASELINE load-sensitive files (prepared-asset-handoff, asset-preparation-bounds), which pass alone (10/10, 12/12) at load 25→17. New: **none**. All 8 tracked pnpm-lock.yaml files are byte-identical to HEAD | PASS |

## Lighthouse — measured under load, not certified
The actual numbers from all 10 runs (Lighthouse 12.8.2, simulated throttling, 2026-10-07 14:15–14:19 local, before the round-2/3 fixes), with the load average at the start/end of each run. Extracted from `R/release/lighthouse/*.json` into `R/release-r3/lighthouse-under-load.md`. Lab Lighthouse reports no INP: INP = n/a (navigation) on every run, and TBT is the proxy. Lighthouse was not re-run in the 17:22 CSS integration run, because no CSS or TSX changed since these runs. The sheets are byte-identical to round 3.

Certification pending operator decision (flagged by the user).

| Run | Form | LCP ms | CLS | TBT ms | Perf | Load start/end |
|---|---|---|---|---|---|---|
| umbrella `/` | mobile | 4,761 | 0.000 | 3,800 | 46 | 44.17 / 43.32 |
| umbrella `/engine` | mobile | 3,578 | 0.000 | 550 | 75 | 43.32 / 44.87 |
| catalog-game `/` | mobile | 3,115 | 0.000 | 1,021 | 70 | 44.87 / 44.86 |
| catalog-web `/` | mobile | 3,286 | 0.000 | 1,146 | 66 | 44.86 / 48.20 |
| kids `/` | mobile | 1,786 | 0.000 | 1,222 | 76 | 48.20 / 49.46 |
| umbrella `/` | desktop | 1,368 | 0.041 | 700 | 69 | 49.46 / 48.14 |
| umbrella `/engine` | desktop | 825 | 0.022 | 235 | 91 | 48.14 / 49.05 |
| catalog-game `/` | desktop | 750 | 0.000 | 102 | 98 | 49.05 / 46.56 |
| catalog-web `/` | desktop | 1,152 | 0.000 | 166 | 93 | 46.56 / 47.74 |
| kids `/` | desktop | 706 | 0.000 | 63 | 100 | 47.74 / 47.14 |

History of the wait:
- lh.sh waited 25 minutes (13:50–14:15) for load < 4 and never got one. The machine ran at load 8–49, driven by blender, godot and the krewmi node processes, none from this run.
- All 10 runs started at load 43–49 and are labelled LOADED in `R/release/lighthouse/lh-runs.tsv`. Their numbers are recorded above as measured under load. They do not certify A9.
- Columns are perf / LCP ms / CLS / TBT ms, baseline → release (LOADED):

| Page | Baseline | Release (LOADED) |
|---|---|---|
| umbrella `/` mobile | 55 / 4,585 / 0 / 2,015 | 46 / 4,761 / 0 / 3,800 |
| umbrella `/` desktop | 98 / 954 / 0 / 64 | 69 / 1,368 / 0.041 / 700 |
| umbrella `/engine` mobile | 82 / 3,062 / 0 / 458 | 75 / 3,578 / 0 / 550 |
| umbrella `/engine` desktop | 100 / 666 / 0 / 3 | 91 / 825 / 0.022 / 235 |
| catalog-game mobile | 80 / 2,878 / 0 / 598 | 70 / 3,115 / 0 / 1,021 |
| catalog-game desktop | BLOCKED | 98 / 750 / 0 / 102 |
| catalog-web mobile | 75 / 3,058 / 0 / 818 | 66 / 3,286 / 0 / 1,146 |
| catalog-web desktop | 100 / 638 / 0 / 10 | 93 / 1,152 / 0 / 166 |
| kids mobile | 98 / 1,909 / 0 / 127 | 76 / 1,786 / 0 / 1,222 |
| kids desktop | 100 / 451 / 0 / 0 | 100 / 706 / 0 / 63 |

- CLS is the only figure that depends little on load. It stays < 0.1 everywhere, but it is no longer 0 on umbrella desktop (0.041) and `/engine` desktop (0.022).
- RULINGS G2 reopens if the **quiet** re-run shows A's mobile LCP above 2.5 s. This loaded run shows 4,761 ms (baseline 4,585), so that quiet re-run is still owed.
- The frame budget (load 34.6) is UNVERIFIED for the same reason.

## Gate vs GATE-BASELINE
- Literal `pnpm run gate`: exit 1 at `check:traceability`, as on main. Output: `R/release/gate/gate.log`.
- Step-wise run (`R/release/gate/steps/`):
  - traceability, sites, desktop and publish-ready exit 1 (baseline #4/#1/#2/#3).
  - build 0.
  - vitest: 5,304 tests, 202 failed in 19 files.
  - node --test 0.
  - eslint: 33 errors in 7 files (baseline).
- `R/release/gate/new-vs-baseline.txt`:
  ```
  + vitest desktop/linux/test/prepared-asset-handoff.test.ts      (GATE-BASELINE: load-sensitive)
  + vitest packages/cli/test/capabilities.test.ts                  (GATE-BASELINE: load-sensitive)
  + vitest packages/importers/test/asset-preparation-bounds.test.ts (GATE-BASELINE: load-sensitive)
  GONE: (none)
  alone: capabilities rc=0 (9/9) load 18.1→14.8; asset-preparation-bounds rc=0 (12/12) 14.8→11.9; prepared-asset-handoff rc=0 (10/10) 11.9→11.2
  => NEW failures beyond GATE-BASELINE after the low-load re-run: none
  ```
- `docs/redesign-v6/gate-latest.log` belongs to the integration agent (13:22, the same conclusion: empty diff). I did not overwrite it.

## Open issues
See the "Open issues" section of `R/index.html` (source: `R/release/open-issues.html`). In short:
1. ~~axe editor preview~~ FIXED (Release fix §1–2).
2. Primary action: FIXED in round 2: store 1440 = stop 5, 390 = stop 4 in both stores; Operate surfaces by landmark/shortcut (ruled). Owner visual review owed for the header change (family bar is now a non-link statement; family links in footer + ≤860 Menu). Raw editor Change Review is still stop 32 and raw desktop Save stop 8 (ruled).
3. 60% CSS target: **FAIL, unmet** (see top). Source: umbrella 115,156 vs 76,082; stores 67,274 / 67,303 vs 40,508 / 40,525. Build CSS is also **above** main: umbrella 97,731 vs 90,437, stores 46,189 vs 45,277. (An earlier note here said "no site exceeds main". That was true for source bytes only.)
4. Page speed: measured under load 43–49 (numbers above), not certified. This is not a FAIL reason. Certification pending operator decision (flagged by the user).
5. At 200% zoom, desktop shows its min-window refusal. Whether that counts as usable needs a product decision.
6. Desktop axe: 2 moderate findings (landmark-one-main, page-has-heading-one).
7. The umbrella hero showed transient low contrast mid-animation (once, under load).
8. Focus passes under the masthead only while smooth-scrolling.
9. Kids has no Save.
10. ~~site-kit `!important` reason~~ recorded (reduced-motion reset).
15. impeccable detect (fix round): 1 warning "side-tab" at `sites/umbrella/src/app/globals.css:613` (`[data-role="inspect"] { border-left: 3px solid var(--lunar-mark) }`). Pre-existing lunar INSPECT mark, not part of R1. Owner: umbrella lane + DIRECTION §5.8 decision.
11. The harness needed adaptations.
12. gate-latest.log is overwritten by the release-fix round (it holds the literal gate, the steps and the diff).
13. I caused a lockfile rewrite and reverted it.
14. Visual fidelity is deferred to the human gate.
16. axe under emulated forced-colors reports color-contrast on every text node (author colours, not the forced palette); not counted, forced-colors shots are in `fix2/`.
17. Packaged desktop: axe inside the packaged renderer could not be injected (CSP); the packaged smoke "maximum-asset native import" failure (desktop lane #7) was not re-run.

## Log
- 2026-10-07T13:23+02:00 start. Load average 17.26 (not quiet; Lighthouse at risk of UNVERIFIED). Skeleton written.
- 2026-10-07T13:25:11+02:00 step 1 BUILD started: next build ×4 sites (pnpm run build per site, no install) + tsc --build; logs R/release/_work/logs/. Harness copied from baseline/_work → release/_work (OUT→release).
- 2026-10-07T13:25:35+02:00 step 2 HARNESS: release/_work/lib.mjs gains settle()/shot() (scroll whole doc → img.decode() → fonts.ready → top); every fullPage screenshot in sites/kids/webshell now goes through shot(). impeccable context run once (logs/impeccable-context.txt); craft-floor.md read. Load 17.6.
- 2026-10-07T13:27:32+02:00 step 3 STATIC (static.cjs): anti-reference v5 hex in shipped source = 0 hits; !important counts main vs v6 in css/static.json; catalog game-vs-web globals.css differs in 2 hunks (header comment L1-12, STORE IDENTITY :root L39-65) plus 8 other src files (copy/config, see css/catalog-src.diff); globals bytes umbrella 114,248 (0.901x main), stores 68,721/68,750 (1.018x), kids 12,620 (0.580x). Builds still running (load ~20).
- 2026-10-07T13:28:41+02:00 step 4 SERVE+RUN umbrella: build exit 0 (13:25-13:27); next start :3301 and :3305 (SCENEAXI_SITE_EDITOR_PREVIEW=1) via node_modules/.bin/next (npx refused: devEngines pnpm); sites.mjs umbrella started.
- 2026-10-07T13:30:19+02:00 step 5 harness fix: chromium-1223 gone, EXE → ms-playwright chromium-1217 (same as other lanes). catalog-game build: next build compiled, postbuild check-vercel-package exit 1 = same as BASELINE (pnpm symlink nft warning); .next is fresh (13:28). umbrella run restarted.
- 2026-10-07T13:30:57+02:00 step 6 SERVE: catalog-game :3302, catalog-web :3303 (both: next build compiled, postbuild Vercel nft check exit 1 as in BASELINE), kids :3304, web-shell :5381 --cwd ~/.cache/sxrel-ws/proj (copy of the BASELINE scratch scene). Harness runs started in parallel: sites.mjs ×3, kids.mjs, webshell.mjs → flows.mjs webshell.
- 2026-10-07T13:32:33+02:00 step 7 harness fix: sites.mjs render() now transpiles local relative imports (v6 catalog error/loading import ./_components/state-plate.js); catalog runs restarted. Desktop: build-linux exit 0, electron-builder --linux dir → /tmp/sxrel-release exit 0 (fresh asar incl. byo-configuration trim).
- 2026-10-07T13:34:29+02:00 step 8 FLOWS (flows.mjs, Tab/Enter/Space only, DOM order, no skip-link activation): kids Play=stop 1, world=2, piece=2 (after world), play → Playing; no Save control exists (product copy: Kids never saves a project) so "create→save" is measured as create→play. Store discover: first item link at stop 7 (game+web). Store acquire: production build has NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN unset → primary renders as aria-disabled span "Editor link unavailable"; flows.mjs now records its DOM-order stop. Editor matcher fixed (was matching a notes div). Store+editor flows re-running.
- 2026-10-07T13:35:25+02:00 step 9 DESKTOP packaged launch (Xvfb, fresh /tmp/sxrel-release/linux-unpacked): launches in new chrome, window bg #182320, title "SceneAxi Engine Desktop — Choose a project", 12-Tab walk all ringed + unobscured, Save at stop 8, comfortable Save 28px / compact 24px, running anims 0 under reduced motion, forced-colors no overflow, control contrast 0 below 4.5 (disabled Apply source 4.66). axe: 0 serious/critical, 2 moderate (landmark-one-main, page-has-heading-one). 200% zoom (720x450 CSS) hits the existing min-window media query: .shell collapses to 0x0 (same rule on main).
- 2026-10-07T13:35:43+02:00 step 10 kids harness: v6 wraps world buttons in .choice-cell (Picked tag beside the button), so BASELINE selector .world-choices .choice:nth-child(2) timed out on 4 states; selector adapted to .choice-cell:nth-child(2) .choice, kids re-run. Load 42 (other agents) — Lighthouse deferred.
- 2026-10-07T13:36:47+02:00 step 11 MOTION (motion.mjs on built umbrella / at 1440): 11 seeked frames 0-4000ms (document-timeline animations paused+seeked: 4 hero animations at t0, 2 left past 2250ms, 0 at 4000ms; 1 scroll-driven sa-hairline on masthead not seeked). Real-time frame budget first 4.5s at load 34.6: 212 frames, p50 16.7 / p95 16.8 / max 383ms, 4 frames >50ms, long tasks 218/52/104/294/65ms — load-sensitive, needs a quiet re-run. Reduced motion: 0 animations.
- 2026-10-07T13:37:08+02:00 step 12 FLOW web-shell (keyboard only): edit field #newValue = stop 3, Propose = stop 4, after Propose focus moves to Accept itself (next Tab = Reject), so apply = stop 4 + Enter, refuse = 1 more Tab. Accept wrote x=12 to the scratch scene; Reject wrote nothing (x=1); bad JSON refused with label "new value must be valid JSON" + icon. forced-colors and 200% zoom (640 CSS px): no overflow, focus ring visible, unobscured.
- 2026-10-07T13:38:22+02:00 step 13 SELF-INFLICTED + REVERTED: `pnpm run build` (pnpm 12.6 verify-deps) rewrote the 4 tracked sites/*/pnpm-lock.yaml (added a packageManagerDependencies pnpm@12.6.0 document, +1037/-93). Restored with git checkout of exactly those 4 files; git status now identical to the pre-run snapshot and md5 of all lockfiles match. No other repo file touched. Gate + Lighthouse must not use `pnpm run` inside sites/ for that reason.
- 2026-10-07T13:38:32+02:00 step 14 GATE started (gate-chain.sh): literal `pnpm run gate` → release/gate/gate.log, then every step separately (integration run-steps.sh) → release/gate/steps/, lock md5 + git status snapshot after, then lh.sh (waits ≤25 min for load<4, labels LOADED runs). docs/redesign-v6/gate-latest.log is owned by the integration agent (written 13:22) and is not overwritten.
- 2026-10-07T13:44:26+02:00 step 15 VERIFY batch done: harness reruns (umbrella 92 shots/30 controls, catalogs 36+36, kids 28, web-shell 60), compare.cjs → release/compare.json. Sweep axe in sites.mjs errors on CSP in BOTH runs (no bypassCSP) — axeall.mjs (bypassCSP) is the counted number, as in BASELINE. obscure.mjs strict focus-obscured probe: 1147 stops, 3 fully covered by sticky header.masthead at 375 (umbrella /docs ×2, catalog-web /publish ×1); 535 offscreen-only = smooth-scroll timing artefact. Confirm round (reduced motion, 400ms) running.
- 2026-10-07T13:44:55+02:00 step 16 CONFIRM focus-obscured (reduced motion = scroll-behavior auto, 400ms per stop) on umbrella /docs, catalog-web /publish, catalog-game /publish at 1280+375: 227 stops, 0 covered by a pinned element (1 horizontally part-offscreen .scroll-x table, not covered). The 3 first-pass hits were smooth-scroll transients → focus-not-obscured PASS once scrolling settles.
- 2026-10-07T13:46:29+02:00 step 17 AXE (axeall.mjs, 64 page×width, bypassCSP as BASELINE): serious 11→4, critical 0→0, moderate 36→32 (heading-order 4→0). Confirm round (axeconfirm.mjs: settled 5s / reduced / 600ms): umbrella / 375 color-contrast ×2 (.cr-note, .cr-accept) NOT reproduced in 6 re-runs = transient hero-animation frame under load 40. REAL, reproduced 3/3: editor preview 1280 color-contrast .is-selected > .ed-tree-kind #8a929c on #313334 = 4.03:1 (NEW vs baseline) and scrollable-region-focusable .ed-overlay-notes (carried from BASELINE). Acceptance "axe 0 serious" = FAIL (2 nodes, editor preview only).
- 2026-10-07T13:47:00+02:00 step 18 CSS BYTES: own CSS vs main (≤1.3x): umbrella globals 114,248/126,804 = 0.901x PASS; stores 68,721/67,513 & 68,750/67,542 = 1.018x PASS; kids 12,620/21,760 = 0.580x PASS; web-shell inline <style> own (source minus the 2 interpolated token blocks) 13,533/10,625 = 1.274x PASS (served total 16,386 incl. generated tokens); desktop chrome styles.ts 54,386/53,634 = 1.014x, byo-configuration.ts 17,431/14,768 = 1.18x PASS. 60% site-total budget (BASELINE): umbrella 114,248 > 76,082 FAIL; stores 68,721/68,750 > 40,508/40,525 FAIL; kids 12,620 ≤ 13,056 PASS. Shipped .next css raw/gz: umbrella 90,437/15,993 → 97,254/17,741; stores 45,277/8,299 → 45,414/8,425; kids 16,227/3,828 → 10,262/3,116.
- 2026-10-07T13:48:14+02:00 step 19 FLOW umbrella home: primary Download = stop 3 at 1280 and 375 (skip-link > wordmark > Download) PASS. Catalog token-only: globals.css game vs web differ in 2 hunks — header comment (store name) and the STORE IDENTITY :root block (accent-bg/line/glow, hero/media wash, mark radius, card-min, grid-gap) — PASS with the comment noted. Other catalog src files that differ: layout/page/item/publish/icon/og/global-error/site-config/index (copy + config), see css/catalog-src.diff.
- 2026-10-07T13:51:55+02:00 step 20 GATE done (13:39-13:50, load 24-30): literal `pnpm run gate` exit 1 at check:traceability (same as main/GATE-BASELINE). Step-wise: traceability/sites/desktop/publish-ready exit 1 (baseline #1-#4), build 0, vitest 5304 tests / 202 failed in 19 files, node --test 0, eslint 33 errors / 7 files (baseline). Diff vs GATE-BASELINE (21 entries): +3 = capabilities.test.ts, asset-preparation-bounds.test.ts, prepared-asset-handoff.test.ts, all listed in GATE-BASELINE as load-sensitive; re-run alone at load 18→11: 3/3 rc=0. NEW beyond baseline after the low-load re-run: none. Lockfile md5 + git status unchanged by the gate.
- 2026-10-07T13:53:27+02:00 step 21 gate-chain ended after GATE DONE without starting Lighthouse (chain process gone); lh.sh restarted standalone (waits ≤30 min for load<4). EVIDENCE.md body written (acceptance table, gate diff, open issues). open-issues.html written for the report.
- 2026-10-07T13:53:32+02:00 step 21b correction: the original lh.sh (pid 2840613, from gate-chain) was still in its wait-for-quiet loop; the duplicate standalone lh.sh was killed. One Lighthouse runner remains.
- 2026-10-07T13:53:42+02:00 step 21c no lh.sh survived (both gone after the kill); started exactly one standalone lh.sh (WAIT_MIN=30).
- 2026-10-07T13:53:47+02:00 step 21d correction to 21c: ps grep was unreliable; pgrep shows the original lh.sh (pid 2840613) alive; the new duplicate (2876100) was killed. Single runner confirmed with pgrep.
- 2026-10-07T13:54:11+02:00 step 22 REPORT index.html generated (report.cjs, 106 images, 12 sections, "Needs a human eye" first). axe on the report itself: fixed 2 scrollable <pre> + empty <th>; re-run below.
- 2026-10-07T13:54:15+02:00 step 22b report axe re-run: 0 violations. Waiting for Lighthouse (quiet-machine wait until ~14:15).
- 2026-10-07T14:04:23+02:00 step 23 waiting for quiet: load 8.2-17.0 from 13:56 to 14:04 (other agents/processes, not this run's idle servers). lh.sh gives up waiting at ~14:15 and then runs labelled LOADED.
- 2026-10-07T14:13:31+02:00 step 24 load rose to 26-40 (14:05-14:13); no quiet window. Lighthouse will run LOADED after the wait ends (~14:15) and is reported UNVERIFIED.
- 2026-10-07T14:20:05+02:00 step 25 LIGHTHOUSE ran after the 25-min wait: 10/10 runs at load 43-49, all LOADED → UNVERIFIED (table in EVIDENCE.md and report). Report regenerated; report axe 0.
- 2026-10-07T14:20:37+02:00 step 26 FINAL: servers on 3301-3305 and 5381 are killed (curl 000); no lh.sh or next processes left; Xvfb/electron exited. git status and every pnpm-lock.yaml md5 match the pre-run snapshot. Code edits: none. Visual fidelity: deferred to the human final gate. Elapsed ~60 min.
- 2026-10-07T14:20:54+02:00 step 26b correction: the claim "every !important has a lane reason" was weakened to what was checked (lane logs mention !important; not audited per declaration). Report regenerated.
