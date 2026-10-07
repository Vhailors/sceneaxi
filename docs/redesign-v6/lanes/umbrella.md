# A6 Umbrella pilot — umbrella HOME on A-rich

Status: DONE (2026-10-07, G4-FIX retry 3: full gate on the current tree, including site-kit design-tokens.ts:1205; 0 new vs GATE-BASELINE; same-load A/B logged)

## Log
- 00:00 lane started; read plan, DIRECTION (§3, §4.1–4.7, §7, §8, §11, §13, §14), GATE-BASELINE, SPEC-DELTA, a-rich `1-umbrella.html` + `a.css`, slice-1 `_signal/*`.
- 00:20 constraint map (tests that read umbrella sources; none may be edited, none may newly fail):
  - `tests/sites/umbrella-visual.test.ts` pins on HOME: `<HeroViewport`, `resolveLiveOpenScene()`, `heroScene.ok ? (`, `StatePanel … level={2} … reason={heroScene.reason}`, `PROOF_MEDIA`, `LAUNCH_PROOFS.map`, `proof.href === null ? proof.title`, `RELEASE_MARKER`.
  - pins on CSS: no hex; every `var()` resolves in `umbrellaFoundationsCss()`; transitions only `var(--motion-fast|base) var(--ease-standard)`; hover/focus transforms only translateX(3px)/scale(1.015)/none; `.nav {… overflow-x: auto`; `:focus-visible {` + `outline: 2px solid var(--accent-hi)`; 1180/1024/860/620 + `(max-height: 720px) and (min-width: 1025px)` media.
  - pins on components: `proof-figure.tsx` keeps `loading="lazy"`; `site-nav.tsx` has no `useState`/`onClick`.
  - `tests/sites/umbrella-launch-marketing.test.ts`: HOME keeps `<DownloadCta` before `LIVE_OPEN_PATH}`, `ENGINE_COMPARISONS.map`, `PROFILE_RELEASE_MATRIX.capabilities.map`, `scope="col"`/`scope="row"`, no em dash.
  - Consequence: these pins encode the v5 composition and conflict with DIRECTION §7 (no live 3D hero), §7.2 (no lazy gallery) and §13.1 (Menu disclosure). Resolution chosen (no test edits): the hero is the Change Review; the live artifact (`HeroViewport`) moves below the fold into the paths section; the home gallery uses its own eager `capture-figure.tsx` (the lazy `ProofFigure` stays for `/engine`); the Menu disclosure is a separate progressive-enhancement component and `site-nav.tsx` stays stateless (no-JS: the nav wraps). Flagged under Open issues for a ruling.

- RETRY (G4 FAIL) 00:00 restarted after the G4 council. Re-read the test pins: beyond the list above, `tests/sites/umbrella-visual.test.ts:1049-1066` pins the exact `"use client"` component list, so a new client hero component fails the gate. `:1461` pins the `.ed-palette-scrim` `display: none !important;` (it stays). Site-kit already emits every A-rich token (`--lunar`, `--plate`, `--bed`, `--well`, `--hair`, `--lift-1/2`, `--sink`, `--commit`, `--seq-*`) and `.sx-btn/.sx-plate/.sx-icon`, so the port needs no token request.
- RETRY 00:12 plan: the hero is a server-rendered, CSS-only Change Review (no new client component, zero added JS). Decision state is a native radio group (`:has()`), the sequence is CSS animation under `prefers-reduced-motion: no-preference` only, and reduced motion swaps to the 3-still strip by media query. Raised the HeroViewport and client-list pins with the conductor (question sent).

- RETRY-2 (after G4 FAIL verdict) 01:11 restarted. Load average 13 (not quiet; Lighthouse deferred until <4). Inbox empty, so no conductor ruling on the pins: proceeding with the no-test-edit resolution above.

- 01:45 gate (step-wise, `a6/_work/gate-v6/`, full output `docs/redesign-v6/gate-latest.log`): check:syntax/boundaries/contracts 0, build 0, node-test 0; check:traceability/sites/desktop/publish-ready 1 (baseline #1-#4); lint 33 errors in the same 7 baseline files (0 new); vitest 202 failing tests vs 201 in the accepted A-rich baseline run: **3 new, all mine, in tests/sites/umbrella-visual.test.ts** (outline:none on the radio; `--fg-2` redeclared; my new 620px block became the first one the phone pin slices from). Fixed by merging into base rules (`outline-color: transparent`; `--ink-2` on the three hero rules; .cr phone rules moved into the existing 620 block). Re-run of umbrella-visual + launch-marketing: 106/106 pass. 2 baseline tests no longer fail (load-sensitive). Umbrella `tsc --noEmit` 0. These three post-gate edits were not re-measured in the browser (same token colours as measured).
- 01:45 dev server on :3461 stopped.

## A-rich checklist (file:line)
| Item | Where | Measured |
|---|---|---|
| Hero = Change Review, server component, no JS | `sites/umbrella/src/app/_components/change-review-hero.tsx:18`, used at `page.tsx:70` | client list unchanged (test pin passes) |
| Sequence propose 0-0.9s / inspect 1.15-1.9s / commit 2.25-2.8s, site-kit `--seq-*` tokens | `globals.css:1464` (`@media (prefers-reduced-motion: no-preference)`), keyframes `cr-draw/cr-scan/cr-arm` right after | animations running at 300ms: 6, 1500ms: 4, 2600ms: 2, 3400ms: 0 |
| Ends ARMED, not committed | `change-review-hero.tsx:84` ("Armed. Waits for your decision."), Review radio `defaultChecked` `:100` | after sequence: checked=`review`, plate="Pending review", Accept opacity 1 |
| Replay | choosing "Review" restarts the sequence (animations keyed on `:has([value=review]:checked)`, `globals.css:1464`) | strip captured by Accept→Review |
| 3-still reduced-motion form | `.cr-acts` `globals.css:1316` (static stills by default; motion only declared under no-preference) | reduce: 0 animations, 3/3 stills rendered |
| Lunar = INSPECT only | `globals.css:1282` (`.cr-after` lunar rule), `:1286` (`.cr-diff`, inspect icon), `:1340` (inspect act) | lunar diff vs well 8.71:1 |
| Yellow = COMMIT only | `.cr-accept` `globals.css:1424`, commit act border | accept fill vs plate 4.54:1; pending route yellow vs iron 8.76:1 |
| Elevation planes | panel-band hero `globals.css:1042` → plate + `--lift-2` `.cr` `:1159` → well + `--sink` `.cr-readout` `:1240` → iron acts/route `:1224`/`:1316` → iron-raised choices | plane steps: plate/band 1.47, well/plate 2.12; card hair boundary 5.24 |
| Real captures, placement:'home' only | `page.tsx:40` filter; `site-content.ts:387,401,415` → `/proof/desktop-run-viewport.png`, `desktop-change-review.png`, `desktop-local-build.png` (real files in `public/proof/`); `desktop-run-window` stays on /engine | 3/3 decoded (naturalWidth>0) at all widths after scroll+decode; limitation chips render |
| Live artifact moved below the fold | `page.tsx:106` "The artifact, drawn live." band | — |
| Fonts (OFL, licence file shipped) | `globals.css:33-52` @font-face → `public/fonts/*.woff2`, `public/fonts/OFL.txt` | font-src 'self' satisfied |

## G2 must-fix items
- Nav never clips at 1280 and 1280@200%: stateless wrap (`globals.css:3538` 860px rule). Measured: no clipped link at 1440/1280/1280z2/1024/768; Account + Download reachable. At 390 the nav row scrolls horizontally (navScroll 265px; Docs/Pricing/Login/Account off-row but reachable by Tab/scroll) -> Open issue.
- Dark refusal note >=5.5: `.webxp-refusals` not on home; boundary kept (`--line` border, now by specificity `globals.css:5978`).
- Min font >=13px: `.chip` `globals.css:586`, `th` `:2416`, platform span 11px → 13px. Measured min font 13px at all 4 viewports.
- 1.4.11: choice edge 6.55, accept fill 4.54, cr border 5.24, focus ring vs plate 7.6, radio 10.92.
- Sub-24px targets (WCAG 2.5.8): radio inputs 18x18 sit inside 44px-tall `<label>` targets (whole label is the hit area) → pass by enclosure; "SceneAxi contracts" link 112x21, and at 1440 three external links (Unity/Godot/Three.js) 141-147x21 in the comparison table → pass by inline-text exception (in a sentence/table cell) — itemised, not resized.
- `[hidden]`/390 inspector/sha256 items belong to web-shell lane, not this page.

## `!important`
4 left in `globals.css`. All 4 were already in main (main:3912, 4024, 5880-5881). Each has a reason (line numbers are current; the judge's 4301/4413/6270-6271 are the same rules before G4-FIX added 130 lines above them):
- `:4431` `transform: none !important` (was 4301). **Reduced-motion safety rule.** The hover nudges `.button-arrow:hover::after … .proof-link:hover .glyph` (`:944-949`, 0,2,1) and `.proof-figure:hover .proof-frame img` (`:4080`, 0,3,1) each add `:hover` to the selector they share with the reset, so they out-specify it (for example `.proof-figure:hover .proof-frame img` 0,3,1 vs `.proof-frame img` 0,1,1). Without the flag, the 3px arrow shift and the 1.015 image scale would still apply under `prefers-reduced-motion`. Kept.
- `:4543` `display: none !important` (was 4413). **Narrow-viewport safety rule** inside `@media (max-width: 899px), (max-height: 599px)` at `:4529`. Below the editor minimum, the refusal plate is the whole surface. The flag is needed because the base rules come later in the file at equal specificity (0,1,0) and set `display:flex/grid`: `.ed-titlebar` `:4549`, `.ed-body` `:4743`, `.ed-status` `:5756`, `.ed-palette-scrim` `:5786`. They would otherwise win by source order and paint the shell over the refusal. Test-pinned at `tests/sites/umbrella-visual.test.ts:1461`. Kept.
- `:6400` `animation: none !important` / `:6401` `transition: none !important` (was 6270-6271). **Reduced-motion safety rule.** `.edshell *` (0,1,0) has to win over every component's own animation and transition inside the editor shell. Kept.
- None is decorative, so none was removed. The two `.webxp-refusals button` overrides are gone: selector raised to `.webxp-refusals button[aria-disabled="true"]` (0,2,1 > `.edshell :where(button, …)` 0,1,0), border `var(--line)` kept.

## Numbers (verify-r2: `~/Documents/Reports/sceneaxi-redesign-v6/a6/_work/verify.json`; r1 kept as verify-r1.json)
| Metric | Result |
|---|---|
| Text contrast, hero + nav + gallery chips, states review/accept/reject (dark; umbrella ships one scheme) | lowest 5.37, 0 below 4.5 (r1 had lede/download-context 3.55 → fixed by `--ink-2` in the base rules `.hero-copy .lede` `globals.css:1149`, `.download-context`, `.platform-availability li > span:last-child`) |
| Choice hover | Accept 11.01, Reject 10.92 |
| Focus | ring moved to the 44px label via `:has(:focus-visible)` (`globals.css:1414`), 2px `--accent-hi` |
| axe 1440 | r2: 1 serious (`.proof-kids-isolation > dt` violet `--status-isolated-fg` on panel band) → rule deleted after r2; not re-run (budget: one confirm). Computed: dt now inherits `--fg` |
| Keyboard | radios: ArrowLeft/Right move check+focus, outcome region `aria-live="polite"` text changes; group named by `<legend>` "Decide the proposal" |
| Tab stops to Download, JS off | 12 raw (9 nav links precede it) at 390 and 1440; **2 via skip link** (Skip → Enter → Tab lands on `.download-primary`) |
| Fold 390x844 | hero CTA bottom 397; Change Review starts 657, its head/status plate 674-763 visible; first BEFORE row bottom 884 (40px below fold); 3-still strip 962-1073 → below fold. **Fails the ≥24px-margin ask** (Open issue) |
| Fold 1440x900 | whole Change Review 104-697 incl. acts 418-477 and choices 493-571, CTA 492: all above fold |
| 200% zoom (1280) | no horizontal overflow, masthead 160px, min font 13 |
| Forced colors | choice + plate borders solid, radios visible |
| CSS bytes | `globals.css` 135,123 vs main 126,804 (+6.6%); budget ≤60% of baseline NOT met (Open issue) |
| Lighthouse | NOT RUN: load average 17-28 throughout (rule: <4) |

Visual fidelity vs concepts/a-rich/1-umbrella.html: deferred to the human final gate (conductor ruling; no agent can view PNGs).

Evidence: `a6/shots/home-{1440,768,390,1280-zoom200}-{fold,full}.png`, `a6/shots/home-1440-forced.png`, `a6/motion/cr-{300,1500,2600,3400}ms.png`, `a6/motion/cr-reduced-stills.png`, `a6/_work/verify.mjs`.

## Open issues
1. 390 fold: hero copy (to CTA 397) + "Open the proof" + platform list push the Change Review to 657; first BEFORE row ends 884, 3-still strip 1073. Needs a ruling: reorder at ≤620 (Review above copy, costs h1/CTA position) or trim `.download-context` copy.
2. Tab stops: 12 without skip link; ≤5 only via the skip link. A `<details>` Menu at ≤860 would cut it to ~4; not built (test pin `.nav{overflow-x:auto}` keeps the scroll row).
3. CSS budget: home added ~8.4 KB (.cr block + @font-face); site-wide ≤60% needs the cross-route v5 deletion, not a home-lane change.
4. Lighthouse mobile/desktop not run (machine never quiet).
5. axe after the kids-dt deletion not re-run.
6. `signal-icon.tsx` (from attempt 1) is now used by the hero (`change-review-hero.tsx:1`): kept, justified.
7. Test pins encoding v5 composition (`HeroViewport` on home, lazy ProofFigure) were honoured, not edited.

## G4-FIX (4 conditions)
- 01:48 G4-FIX started. Load average 13.8 (not quiet). Scope: fold@390, tab stops, axe re-run with styled Kids title, !important reasons.
- 01:53 read lane log, layout/page/hero/CSS, test pins (PHONE slice = first 620 block to EOF; breakpoint list is contains-only; layout pins skip-link/main/mark/fonts only). impeccable context + craft-floor read. Kids pair computed: isolated-fg on panel-band 4.10 (the old fail), isolated-fg on isolated-bg 6.86 (chip pair, passes). Dev server :3461 started.
- 02:06 BUILD: layout.tsx wraps SiteNav in a no-script <details class="menu"> (Menu summary + chevron icon); globals.css: .menu base + @supports(::details-content) wide reveal; 860 block swaps the wrapping nav row for an under-bench panel; new <=420 hero block (copy column display:contents, CTA context/platforms and the acts ordered after the board, cr-title 20px); Kids dt on the isolated plate; .launch-proof dd -> --ink-2; menu-toggle edge -> --fg-2.
- 02:06 MEASURE (one batched round, a6/g4fix/g4fix.json): fold margin at 390 is 67px for motion-end and for reduced; tab stop 4 (masthead Download) and 5 (hero Download) at 390. The first axe pass found 4x color-contrast on .launch-proof dd (3.54:1); after the dd fix, axe is 0 serious/critical x4. Dev server killed.
- 02:06 Umbrella pins: umbrella-visual + launch-marketing, 106/106 pass. Full gate started (gate-steps.sh, per-step) -> a6/_work/gate-g4fix.

## G4-FIX retry (2026-10-07)

- 09:28 Retry started. The judge failed (f) and (d). Umbrella sources (globals.css 02:05, layout.tsx 02:02) are unchanged since the 02:06:47 gate-g4fix run, so that run covers the final G4-FIX code. Diffed it against the a5b baseline. Fresh full gate started on the current tree -> a6/_work/gate-g4fix2. Load avg 40.96 20.59 14.06.
- 09:33 !important reasons written, one per rule (see `## !important` above). All 4 are reduced-motion or narrow-viewport safety rules and were already in main, so none was removed. No CSS changed.
- 09:33 POST-GATE RE-MEASURE of the 3 CSS fixes from :19 (a6/_work/postgate.mjs -> a6/g4fix/postgate.json; dev :3417, reduced motion, scrolled + img.decode). (1) Radio `outline-color: transparent`: with keyboard focus the input matches :focus-visible, and the ring moves to the 44px `.cr-choice`: 2px solid rgb(255,255,255) on rgb(57,90,83) = **7.60:1** (>=3). (2) `--ink-2` hero text: every visible text node in .release-hero + .cr (51) passes, min **5.67:1**, 0 below 4.5. (3) The .cr phone rules merged into the 620 block: this already preceded the 02:05 fold/tab measurement (67px, stops 4/5). axe serious/critical **0 x4** (dark/light x 1440/390). Note: umbrella is dark-only (`color-scheme: dark` at globals.css:57, no prefers-color-scheme rule), so the light runs render the same as dark.
- 10:11 GATE RESULT for the G4-FIX tree. Two runs cover the final code (umbrella sources unchanged since globals.css 02:05 / layout.tsx 02:02):
  - **gate-g4fix** (02:06:47-02:17:56, load 28-35). The vitest per-test failure list matches the a5b v6 baseline exactly: 199 = 199, **0 new, 0 gone**. Lint, traceability, sites, desktop and publish-ready logs are byte-identical to baseline (timings stripped). node-test 40/40. This was the run left unlogged at :82.
  - **gate-g4fix2** (fresh, 09:28-09:50, load 38-80). Written in full to `docs/redesign-v6/gate-latest.log`. 210 failed / 5087 passed. The new-vs-baseline diff lists 11 names, all load-timing. None is in sites/umbrella or tests/sites (the full list is in the gate-latest.log appendix):
    - `prepared-asset-handoff` x2: 111.7ms > 100ms heartbeat, plus the E1 stage.
    - `project-model` x1: spawnSync failure.
    - `cli/capabilities` x1: 60s timeout.
    - `asset-preparation-bounds` x2: 455ms > 100ms heartbeat, plus a 60s timeout.
    - `injected-traceability-violations` x5: 60s timeouts.
  - **Isolated re-run of those 5 files** (09:50-10:10; load stayed 33-62, the machine never got quiet):
    - project-model 26/26, capabilities 9/9, asset-preparation-bounds 12/12.
    - prepared-asset-handoff 9/10. The 1 failure is "admits maximum original bytes … 100ms heartbeat", which GATE-BASELINE.md:69 already accepts as load-sensitive (0-1).
    - injected-traceability 19/20. The 1 failure is "control: the unmodified tree passes", the baseline row.
    - **Net new vs GATE-BASELINE.md: 0.** Unhandled errors are 5 in both baseline and here (the readiness/frame sentinels).
- 10:11 No dev server was started this round (:3417 belongs to an earlier session, PID 319832 from 23:07; left alone). DONE.

### Gate tail (gate-g4fix2, from gate-latest.log)
```
check:syntax EXIT 0 | check:boundaries EXIT 0 | check:contracts EXIT 0
check:traceability EXIT 1 | check:sites EXIT 1 | check:desktop EXIT 1 | check:publish-ready EXIT 1   (baseline #1-#4, logs identical to baseline)
build EXIT 0 | node-test EXIT 0 (40/40) | lint EXIT 1 (33 errors, identical to baseline)
vitest:  Test Files  20 failed | 360 passed (380)
         Tests  210 failed | 5087 passed (5297)
         Errors  5 errors   (baseline: 5)
new-vs-baseline after the isolated re-run: 0
```

### New-vs-baseline diff
| step | baseline (a5b gate-v6 / GATE-BASELINE v6) | gate-g4fix (02:06) | gate-g4fix2 (09:28) | after the isolated re-run |
|---|---|---|---|---|
| check:syntax/boundaries/contracts, build, node-test | 0 | 0 | 0 | — |
| check:traceability/sites/desktop/publish-ready | exit 1 (baseline #1-#4) | identical log | identical log | — |
| lint | 33 errors / 7 files | identical | identical | — |
| vitest failing tests | 199 (16 files) | 199, 0 new | 210, 11 new (all timing) | **0 new** (2 remaining = baseline rows 69 and the traceability control) |
| vitest unhandled errors | 5 | 5 | 5 | — |

### G4-FIX numbers (final)
| condition | measure | value | evidence |
|---|---|---|---|
| (a) fold 390x844, motion end | Accept bottom 777 vs vh 844 (plate 501, first row 622) | **+67px** (target 24) | a6/g4fix/g4fix.json |
| (a) fold 390x844, reduced 3-still | same | **+67px** | a6/g4fix/g4fix.json |
| (a) 1440x900 | margin | +329px | a6/g4fix/g4fix.json |
| (b) tab stops, DOM order, no JS, Menu closed | masthead Download / hero Download at 390 | **4 / 5** (1440: 11 / 12) | g4fix.json tabs.390-seq |
| (b) pin: `<DownloadCta` before LIVE_OPEN_PATH | umbrella-launch-marketing | pass (106/106 umbrella pins) | :82 |
| (c) axe serious/critical | dark/light x 1440/390 | **0 x4** (re-run 09:3x) | a6/g4fix/postgate.json |
| (c) Kids title | isolated-fg on isolated-bg, 16px/600 | **6.86:1** | :79, g4fix.json kids |
| post-gate fixes from :19 | radio ring / hero text min / phone block | 7.60:1 / 5.67:1 (51 nodes, 0 fails) / covered by the fold run | a6/g4fix/postgate.json |
| (d) !important | count / with reason | **4 / 4** (2 reduced-motion, 1 narrow-viewport, 1 reduced-motion pair) | `## !important` |
| (f) gate | net new vs GATE-BASELINE (retry 3, tree diff sha 00243aeb…, run after the 09:27 site-kit edit) | **0** (202 = a5b's 199 + 3 existing flaky rows :67-:69; all 3 pass alone on v6 and on main at the same load) | docs/redesign-v6/gate-latest.log, a6/_work/gate-g4fix3/ |

### UNVERIFIED
- Lighthouse LCP/CLS/INP: not run. Load average stayed between 13.8 and 80 for the whole session, never <4.
- Visual fidelity: deferred to the human final gate.
- Low-load confirmation of the timing-sensitive tests: load never fell below 4 (11.5-26 during retry 3). Closed instead under the conductor's same-load A/B ruling (see the retry 3 section).

### Open issues
- Umbrella is dark-only (`color-scheme: dark`, no prefers-color-scheme rule), so the "light" axe and contrast passes render the same as dark. If a light dialect is wanted for Persuade, that is a foundation request, not a lane change.
- The 4 `!important` were inherited from main. Removing them needs specificity restructuring of the hover nudges and the `.ed-*` base rules. Out of G4 scope.

## G4-FIX retry 3: (f) only, no code edits (conductor last retry)
- 2026-10-07T10:12:57+02:00: started. Tree fingerprint: HEAD `2cef2033232a9540d95fbb51ba6bc39acc9d6eae`, `git diff | sha256sum` = `00243aebfaed31a11734ea53b4715498f41449cd1f1fdef3d847fc48974a26c2`. design-tokens.ts mtime 09:27:18 local (= webshell.md 07:28Z edit, its last site-kit entry; no peer agents active), operate-tokens.ts 09:27:33. Full gate started, output gate-g4fix3/.
- 2026-10-07T10:24:42+02:00: full step-wise gate done (gate-g4fix3, 10:12:54-10:23:26, load 26.16 -> 21.74; tree diff sha unchanged before/after). vitest 202 failed / 5095 passed / 5 errors; traceability/sites/desktop/publish-ready/lint logs byte-identical to the a5b baseline. 3 tests beyond the a5b 199 list, all already flaky rows in GATE-BASELINE.md (:67 capabilities, :68 asset-preparation-bounds, :69 prepared-asset-handoff). Started literal `pnpm run gate` + same-load A/B (v6 vs /tmp/sceneaxi-main, 3x each).
- 2026-10-07T10:24:53+02:00: literal `pnpm run gate` ran 10:24:34-10:24:53 (load 26.43 -> 25.87) and exited 1 at check:traceability (baseline #4, log identical).
- 2026-10-07T10:31:45+02:00: A/B pass 1 done. The cli-on-main arm was invalid: `sceneaxi: build output not found`, because the worktree had no build.
- 2026-10-07T10:39:30+02:00: cli A/B re-run after `pnpm run build` on main (EXIT 0). Worktree removed (`git worktree list` shows no sceneaxi-main). gate-latest.log rewritten (sole writer, 7239 lines). No code edits this retry. No servers started.

### Retry-3 tree fingerprint
- `git rev-parse HEAD` = `2cef2033232a9540d95fbb51ba6bc39acc9d6eae`. `git diff | sha256sum` = `00243aebfaed31a11734ea53b4715498f41449cd1f1fdef3d847fc48974a26c2`, the same before and after the gate (meta.txt).
- `packages/site-kit/src/design-tokens.ts`: sha256 `b39a7743…`, mtime 09:27:18, contains the forced-colors line at :1205. `apps/web-shell/src/operate-tokens.ts`: sha256 `36a34496…`, mtime 09:27:33. The gate started at 10:12:54, after both edits. No peer agents were active.

### Retry-3 gate tail (docs/redesign-v6/gate-latest.log)
```
check:syntax EXIT 0 | check:boundaries EXIT 0 | check:contracts EXIT 0
check:traceability EXIT 1 | check:sites EXIT 1 | check:desktop EXIT 1 | check:publish-ready EXIT 1   (baseline #1-#4)
build EXIT 0 | vitest EXIT 1 | node-test EXIT 0 | lint EXIT 1 (baseline 33 errors / 7 files)
pnpm run gate EXIT 1   (&&-chain stops at check:traceability, baseline #4)
 Test Files  19 failed | 361 passed (380)
      Tests  202 failed | 5095 passed (5297)
     Errors  5 errors
   Duration  546.06s   start 10:12:54 load 26.16 34.10 38.89 / end 10:23:26 load 21.74 29.54 35.63
```
The check:traceability/sites/desktop/publish-ready and lint logs are byte-identical (`cmp`) to the a5b baseline. Unhandled errors: 5, the same as baseline.

### Retry-3 new-vs-baseline diff
Method: `comm -13` of the a5b/gate-v6 fail list against the gate-g4fix3 fail list. No baseline failure went away.
```
+ desktop/linux/test/prepared-asset-handoff.test.ts > public prepared asset handoff > admits maximum original bytes with a compact response and the unchanged 100ms heartbeat bound
+ packages/cli/test/capabilities.test.ts > bounded CLI capabilities through the real binary > covers every real command leaf and rejects inherited names at every group depth
+ packages/importers/test/asset-preparation-bounds.test.ts > bounded off-main asset preparation > prepares actual maximum bytes without blocking main heartbeat or changing canonical evidence
```
| test | failure in the gate | GATE-BASELINE row |
|---|---|---|
| cli capabilities › covers every real command leaf | Test timed out in 60000ms | :67 flaky |
| asset-preparation-bounds › prepares actual maximum bytes | heartbeat 103.46 ms > 100 | :68 flaky |
| prepared-asset-handoff › unchanged 100ms heartbeat bound | heartbeat 123.98 ms > 100 | :69 flaky |

Failing tests NOT in GATE-BASELINE.md: **none**.

### Retry-3 same-load A/B
Each file ran alone, interleaved: v6, then the main worktree at /tmp/sceneaxi-main (added, then removed). The 1-minute load never dropped below 4 (minimum 11.49), so the conductor ruling applies.

| file | v6 load (runs 1/2/3) | v6 result | main load (runs 1/2/3) | main result |
|---|---|---|---|---|
| prepared-asset-handoff | 25.87 / 23.58 / 22.44 | 10/10 pass x3 | 25.19 / 23.38 / 21.39 | 10/10 pass x3 |
| cli capabilities (main built) | 14.31 / 14.43 / 12.68 | 9/9 pass x3 (35-45 s) | 14.07 / 13.65 / 11.49 | 9/9 pass x3 (34-37 s) |
| asset-preparation-bounds | 17.26 / 18.12 / 14.09 | 12/12 pass x3 | 21.52 / 15.81 / 14.33 | 12/12 pass x3 |

- The first cli-on-main arm (7/9 failed in 4-5 s, `build output not found`) was an environment fault, not timing. It was discarded and re-run after the main build.
- All 3 tests behave the same on v6 and main at the same load. They fail only inside the loaded full gate and pass when run alone, so they are load-sensitive baseline. They are already flaky rows :67-:69, and the A/B numbers are now appended there. **Real new failures: 0.**
- Conductor ruling (one line): "If the load never drops below 4, run a SAME-LOAD A/B: each test alone on this tree, then immediately on main in /tmp/sceneaxi-main, 3x each with the load logged. A test that fails or passes the same way on main under the same load is load-sensitive baseline and goes into GATE-BASELINE.md's flaky rows with numbers. Only a test that fails here but passes on main at the same load is a real new failure."
- Evidence: ~/Documents/Reports/sceneaxi-redesign-v6/a6/_work/gate-g4fix3/{meta.txt,chain-meta.txt,steps.log,vitest.clean.log,fail-tests.txt,new-vs-baseline.txt,ab.tsv,ab-*.log,ab2-*.log,ab2-wt.log,pnpm-run-gate.log}
- 2026-10-07T10:40:47+02:00: Killed the stale umbrella dev server on :3417 (PID 319832, from 23:07; the umbrella lane used it for the 09:33 measurements). No other umbrella servers are running. Retry 3 DONE.

---

# A6 UMBRELLA LANE part 1 — globals.css restructure + marketing/read routes

Status: DONE with open issues (see end of section)
Evidence root: ~/Documents/Reports/sceneaxi-redesign-v6/a6p1/

## Log
- 10:42 lane started. Load average 21.7 (not quiet). globals.css = 138,482 B (baseline 124K; target <=60% ≈ 74.4 KB). Reading plan, RULINGS, SPEC-DELTA, webshell copy contract, home pilot log.
- 10:50 impeccable context run (no PRODUCT.md; BRIEF/DIRECTION are product truth; proceeding as scoped refinement under the locked A-rich direction). craft-floor.md read. Targeted umbrella tests green before edits (122/122).
- 10:52 inventory: globals.css formatted-without-comments = ~79.0 KB non-editor + ~38.5 KB editor (/editor shell, pinned rule-by-rule in tests/sites/umbrella-visual.test.ts:1258-1449); comments = 25.5 KB; fully-dead class rules ≈ 2.7 KB (35 classes). Measured planes at 1440: every route except the home hero paints v5 near-black (body rgb(7,8,10), text rgb(237,239,242)); A-rich field --panel is not used outside the hero. Dev server :3471 (started by this lane).
- 10:56 markup: masthead primary (Download) moved beside the wordmark in DOM and view (layout.tsx); StatusIcon (label+icon) for every state chip on engine/pricing/docs/open/404/error/proof-figure/state-panel; engine verify blocks carry data-role=inspect + inspect glyph; pricing 'Best rate' no longer yellow (yellow = COMMIT). CSS pass 1: comments stripped, 5 dead rules dropped, v5 aliases rebound to A-rich planes outside the editor block (113,101 B).
- 11:01 verify round 1 started (OUT a6p1/r1): 14 routes x 1440/390, text-contrast scan, axe, tab walk, state sweep, reduced/forced/zoom200.
- 11:03 r1 aborted by harness (axe inline-script blocked by the site CSP; browser died at /docs/faq under load 37) — not counted as the verify round; bypassCSP added. Back to build.
- 11:04 CSS pass 2: masthead (primary beside wordmark, menu pushed right, spacer/divider rules deleted), A-rich type (h1/h2 on --font-plate 800), state glyph sizing, lunar inspect frame [data-role=inspect], yellow removed from tier-featured/panel.tone-accent/button focus ring/::selection (yellow = COMMIT only); 12 sub-13px font sizes raised to --t-floor; --ok/--danger/--info/--bg-row rebound to --verified/--refused-lamp/--ink/--iron-raised.
- 11:04 build done; VERIFY round (r1) started. load 30.27.
- 11:25 r1 results (a6p1/r1/verify.json): 28 route×width loads, all 200 (404 route = 404). axe serious: scrollable-region-focusable /engine (4 @1440, 5 @390: .command code) and /pricing@390 (.scroll-x in capability-table); everything else 0. Text-contrast scan: 0 failing nodes on all 28. Min font 11.375px (code inside .note on /profiles,/open) and 12.25px (/docs). Primary action (masthead Download) = tab stop 3 on every route at 1440, 390 and 200% zoom. Captures decoded: home 3/3 (placement home), /engine desktop-run-window (879px). Reduced motion: 0 running animations on 4 routes. Zoom200 /pricing 'obscured 2' traced to smooth-scroll timing in the walk (scrollY 32 at read), re-measure under reduced motion in confirm. FIXES: .command code wraps (pre-wrap, no scroller); capability-table + 2 docs tables get role=region tabIndex=0 + name; code font-size max(0.875em, --t-floor).
- 11:25 CONFIRM round (r2) started, load 22.85.
- 11:27 r2 (a6p1/r2/confirm.json, reduced motion): axe 0 serious/critical on 7 routes x {1440, 390, 720@2x}; min font 13px everywhere; Download = tab stop 3; 0 obscured focus targets (the r1 zoom finding was a smooth-scroll timing artifact). Dev server :3471 killed (port free). Gate started, load 22.62.
- 11:31 state contrast from r1 stateSweep (20 distinct controls, dedup by signature, 1440+390): min text rest 5.95 / hover 5.95 / active 5.95 / focus 5.95 (nav links on --panel); focus ring min 9.62:1 (2px --focus/--accent-hi, 2px offset); 0 focus targets obscured. Disabled: no disabled control renders on the swept marketing/read routes, so disabled contrast is UNVERIFIED here (part 2 owns the forms that carry it).

## Part 1 result (A6 umbrella lane, part 1)

### Measured
| Check | Result | Evidence |
|---|---|---|
| CSS bytes, `globals.css` | **113,517 B** = 89.5% of main 126,804 B (138,482 B at lane start). Budget ≤ 76,082 B **NOT met** (gap 37.4 KB) | `wc -c`; split below |
| Text contrast, every rendered text node, 14 routes × 1440/390 | 0 failing nodes (28/28 pages) | a6p1/r1/verify.json `.text` |
| Control states | rest/hover/active/focus min 5.95:1; ring ≥ 9.62:1; disabled UNVERIFIED (none rendered) | r1 `.states`, a6p1/r1/states/ |
| axe serious/critical | r1: scrollable-region-focusable on /engine (4/5) and /pricing@390 (1) → fixed → r2 re-run: **0** on 7 routes × 3 viewports | r1, a6p1/r2/confirm.json |
| Primary action by DOM order (no skip link) | masthead **Download = tab stop 3** on every route at 1440, 390 and 720@2x (was 11 at 1440) | r1 `.primaryAt`, r2 |
| Focus obscured | 0 (r2, reduced motion) | r2 |
| Text floor 13px | min 13px in `main` on 7 routes × 3 viewports after fix (r1 found 11.375px `code`) | r2 `.minFont` |
| Reduced motion | 0 running animations on /, /engine, /pricing, /docs | r1 `.extra` |
| Forced colours | `.sx-icon` strokes resolve to CanvasText (rgb 0,0,0); no horizontal overflow | r1 `.extra`, shots/*-forced.png |
| 200% zoom (720×450 @2x) | no horizontal overflow; Download stop 3; 0 obscured | r1 + r2 |
| Real captures | home: 3/3 `placement:'home'` decoded; /engine: `desktop-run-window.png` decoded (879px at 1440); limitation chips now carry the limit glyph | r1 `.imgs` |
| Lighthouse | **UNVERIFIED**: load average 21–63 during the lane (needs < 4) | uptime lines above |
| Visual fidelity | **deferred to the human final gate** (no agent can view PNGs) | shots in a6p1/r1/shots/ |

### What changed
- `sites/umbrella/src/app/globals.css`: commentary cut to one-line section banners plus a 10-line header (−25 KB); 5 dead rules dropped (`.button-sm`, `.form-stack`, `.op-chip`, `.stack-tight`, `.proof-kids-isolation dt`); every v5 alias **outside the /editor block** rebound to the A-rich layer (`--bg-base→--panel`, `--bg-band→--panel-band`, `--bg-panel→--iron`, `--bg-raised/--bg-control/--bg-row→--iron-raised`, `--bg-field→--well`, `--fg→--ink`, `--fg-2→--ink-2`, `--fg-4→--siding`, `--line/--line-soft→--rule`, `--line-strong→--hair`, `--accent→--enamel`, `--ok→--verified`, `--danger→--refused-lamp`, `--info→--ink`, `--sans→--font-prose`, `--mono→--font-data`, `--space-N→--sp-N` (except `--space-11`, which has no v6 step)); h1/h2 on `--font-plate` 800; masthead re-cut; `[data-role="inspect"]` lunar frame (UI only: 3px `--lunar-mark` rule plus a `--lunar` glyph); yellow removed from `.tier-featured`, `.panel.tone-accent`, the button focus halo and `::selection` (yellow = COMMIT only); 12 sub-13px sizes moved to `--t-floor`; `.command code` wraps instead of scrolling; `code` font-size floors at `--t-floor`.
- `layout.tsx`: the masthead primary (Download) sits beside the wordmark in both DOM and view; the masthead-actions wrapper renders only when store links exist. Ids, `#main`, the skip link and CSP are unchanged.
- `_components/signal-icon.tsx`: `StatusIcon` maps the site-kit status ids to A-rich glyphs. It is used by `state-panel.tsx`, `proof-figure.tsx` (level chips and limitation chips), `engine`, `pricing`, `docs`, `open`, `not-found` and `error` (inline glyph, because it is a client boundary). Every state chip now has a label **and** an icon.
- `engine/page.tsx`: the three verify blocks carry `data-role="inspect"` and the inspect glyph. `pricing/page.tsx`: "Best rate per credit" is a plain plate label, not a yellow chip. `docs/page.tsx` and `capability-table.tsx`: scrollable tables are named, focusable regions.

### CSS budget split (why 76 KB is not reachable inside part 1)
Rules by the files that use their classes (`a6p1/_work/owners.cjs`): /editor-only 32.5 KB; home-only 16.1 KB; marketing/read-only (my routes) 15.1 KB; shared shell/forms/states ~45 KB. If the 15.1 KB were deleted outright, the file would still be ~98 KB. Meeting ≤ 76 KB needs the /editor shell (pinned rule by rule in `tests/sites/umbrella-visual.test.ts:1258-1449`, so its text must stay in `globals.css`) to shrink about 50%, or to move into a shared editor-shell sheet. That is a site-kit/test-owner decision, not a lane edit.

### !important (4 remain, each with a reason)
- `globals.css` `.proof-frame img { transform: none !important }` in the `prefers-reduced-motion: reduce` block: it beats the `:hover` scale rule, which has higher specificity, so reduced motion never zooms a capture.
- `.ed-palette-scrim { display: none !important }` under the 900×600 minimum tier: the palette's display is set by script (inline style); the refusal must be the whole surface (comment from issue 184).
- `.edshell *::after { animation/transition: none !important }` (2) in the editor reduced-motion block: they neutralise per-element animation declarations of any specificity inside the editor when reduce is set.

### Not built (no real copy exists)
- `/legal`: `docs/page.tsx:156` states that reviewed terms, privacy, refund and legal contact are not yet published; a legal page would invent policy. `/changelog`: there is no changelog source in the repo (`site-content.ts:327` notes that changelogs do not exist here). `/download`: the download lives on `/engine` (masthead Download → /engine). No routes were invented.
- 11:28 gate steps 1-8: syntax/boundaries/contracts 0, traceability/sites/desktop/publish-ready 1 (baseline #1-#4), build 0; test running.

### Gate (11:37, full output docs/redesign-v6/gate-latest.log, copy a6p1/gate.log)
```
=== STEP check:syntax (11:27:30) load 21.40
=== EXIT check:syntax 0
=== STEP check:boundaries (11:27:32) load 21.37
=== EXIT check:boundaries 0
=== STEP check:contracts (11:27:35) load 21.50
=== EXIT check:contracts 0
=== STEP check:traceability (11:27:36) load 21.50
=== EXIT check:traceability 1
=== STEP check:sites (11:27:50) load 22.81
=== EXIT check:sites 1
=== STEP check:desktop (11:27:52) load 22.81
=== EXIT check:desktop 1
=== STEP check:publish-ready (11:27:53) load 22.81
=== EXIT check:publish-ready 1
=== STEP build (11:27:53) load 22.81
=== EXIT build 0
=== STEP test (11:28:13) load 21.20
=== EXIT test 1
=== STEP lint (11:36:44) load 25.55
=== EXIT lint 1
=== DONE 11:37:11
 Test Files  18 failed | 362 passed (380)
      Tests  202 failed | 5097 passed (5299)
✖ 33 problems (33 errors, 0 warnings)
```
New-vs-baseline (per-file failure counts, GATE-BASELINE v6 column → this run):
```
2a3
> packages/importers/test/asset-preparation-bounds.test.ts 1
14a16
> tests/sites/kids-surface.test.ts 2
```
- check:traceability/sites/desktop/publish-ready exit 1 = baseline #1-#4; build 0; lint 33 errors in the same 7 baseline files (0 new).
- `asset-preparation-bounds` (1): listed in GATE-BASELINE as load-sensitive (main-heartbeat > 100 ms); this run was at load 21-25, and no low-load re-run was possible (the load never fell below 20 during the lane). It does not count until a low-load re-run.
- `tests/sites/kids-surface.test.ts` (2: "keeps its duplicated Foundations neutrals identical…", "The Kids stylesheet declares no colour --fg"): caused by the concurrent Kids lane (A8), which has `sites/kids/src/app/globals.css` modified in the working tree. This lane touched no file under `sites/kids`, and neither test reads umbrella sources. Owner: A8.
- Umbrella-scoped suites (`tests/sites/`, `tests/parity/`): 861 pass, 3 fail, the same 3 baseline failures (identity-plane-wiring, provider-adapters, site-seams) that fail with this lane's CSS stashed.

### Open issues
1. **CSS budget not met**: 113,517 B against ≤ 76,082 B. The split and the reason are above. Request (site-kit/test owners): a shared editor-shell sheet, or a ruling that the /editor block is measured separately. Part 2 should delete the shared v5 form/state/table rules when it rebuilds account/admin/auth.
2. The /editor block still reads v5 aliases (`--bg-base`, `--fg`, `--accent`…). It was deliberately left alone: it is an Operate surface pinned rule-by-rule. The Operate/editor owner should rebind it to the web-shell operate tokens.
3. Lighthouse UNVERIFIED (load 21-63). Disabled-state contrast UNVERIFIED on these routes (no disabled control renders on them).
4. The masthead change (Download beside the wordmark) also changes the home pilot and the part-2 routes. Re-measured on home: axe 0, Download is tab stop 3. Visual sign-off is still owed.
5. `/legal`, `/changelog` and `/download` were not built: there is no real copy (see above).
6. Visual fidelity: deferred to the human final gate.

Status: PART 1 DONE (with open issues above). Dev server :3471 killed; no servers left running.

---
# A6 UMBRELLA LANE part 2 — account/admin/auth + empty/error states (Operate) + batched polish
## Log
- 11:49 start. Branch redesign-v6. Load avg 40.9 (Lighthouse will be UNVERIFIED unless <4). Read part-1 log; globals.css starts at 113517 B.
- 11:52 Conductor lm_182: sites/umbrella/pnpm-lock.yaml showed modified on arrival (not by this part-2 lane: no install run yet); restored with git checkout. `git status --porcelain | grep pnpm-lock` → empty. All later commands from repo root with pnpm --filter.
- 11:57 Context read: DIRECTION §9 rows (login/account/404/error = Operate comfortable; admin/ledger = Operate compact, right-aligned tabular), site-kit sx-plate/sx-interlock/density emitted, test pins on .state-head/.reason-label/StatePanel noted. impeccable context run (no PRODUCT.md; scoped refinement allowed); craft-floor.md read.
- 12:11 Typecheck (tsc --noEmit, umbrella) clean. Lockfile check: sites/umbrella/pnpm-lock.yaml clean; sites/kids/pnpm-lock.yaml shows modified, not this lane (not touched).
- 12:13 Token pin (umbrella-visual "every token the stylesheet reads resolves") failed on var(--density-*): site-kit emits the density declarations on ONE line, which the pin regex (^\s*--x:) cannot see. Tests are not edited: density written on the shared --sp scale + one compact block instead (site-kit request filed below). Re-run of 7 umbrella-scoped suites: 166/166 pass. globals.css now 114,248 B.
- 12:15 Dev server next dev :3471 (pid file /tmp/a6p2-dev.pid). VERIFY r1 started (a6p1 verify.mjs adapted: + /login?reason=KIDS_SURFACE_DENIED, /account?checkout=success; state sweep on part-2 routes; main-primary tab index).
- 12:38 r1 attempt 1 hung on /@390 after all 1440 routes (no per-route timeout; load 30+). 1440 summary kept in r1/run-attempt1.log (all part-2 routes: 200, axe 0, txtBad 0, minFont 13, Download tab stop 3). Re-ran r1 with a 150s per-route race and a partial JSON.
