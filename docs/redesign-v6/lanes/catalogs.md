# A7 Catalogs lane part 1 — log
- 2026-10-07T10:41:38+02:00 start: preflight, reading context
- 2026-10-07T10:43:05+02:00 context read (SPEC-DELTA, copy contract, GATE-BASELINE, site-kit signal layer, catalog test pins). Load avg ~21 (not quiet).
- 2026-10-07T11:01:14+02:00 tests/pins mapped (catalog-storefronts.test.ts: identity markers, skeleton byte-equal, no Foundations literals, 48/64rem, 216px rail, sticky bounds, reduced-motion !important pair, --micro token, forced-colors focus Highlight, .catalog-controls areas). Plan: details Menu header so primary is <=5 tab stops.
- 2026-10-07T11:15:33+02:00 decisions: keep DOM classes the tests pin; add signal layer via shared foundations.ts; header -> skip, storemark, <details> Menu (nav+family) so primary is stop 4 (home) / 5 (detail).
- 2026-10-07T11:31:09+02:00 BUILD start (context phase overran: ~48min)
- 2026-10-07T11:47:12+02:00 BUILD: foundations.ts (both, identical) now appends site-kit signalCss tokens/components/utilities layers with store plate (forge|vitrine); layout sets data-store on <html>; detail page primary action -> .button-commit (commit-yellow + --commit-edge), price block -> data-inspect lunar rule. CSS added identically to both stores (outside STORE IDENTITY).
- 2026-10-07T11:48:41+02:00 VERIFY (partial): vitest catalog-storefronts + site-kit-component-collapse + identity-plane-wiring = 207 pass / 1 fail; the fail is the /api/health DATABASE_URL case already listed in GATE-BASELINE.md (not new). tsc --noEmit clean for both sites. A pnpm exec run rewrote the tracked nested sites/catalog-*/pnpm-lock.yaml; reverted with git checkout. CSS diff between the stores: docs/redesign-v6/lanes/catalogs-css.diff (STORE IDENTITY block + 2 header-comment lines that name the store; same as before this lane).
- 2026-10-07T11:48:41+02:00 NOT DONE (honest scope): full rewrite of globals.css on the layered tokens and deleting the v5 rules, rebuilding store home (A-rich planes) and browse/search, the 5-tab-stop header (<details> Menu), critique/audit/polish round, shots at 1440/390, contrast sweep, axe, keyboard walk, Lighthouse (load average about 30, not quiet), pnpm run gate. All UNVERIFIED.
- Visual fidelity: deferred to the human final gate.
- !important: only the existing reduced-motion pair (animation-duration/iteration-count) remains; reason: it must beat component animations in every layer, and a test pins it.

# A7 Catalogs lane part 2 — log (both stores in lockstep)
- 2026-10-07T11:49:07+02:00 start: part 2 (checkout/entitlement, purchase history, refusal, named states). Load avg 40.86 (not quiet). concepts/a-rich/ is not in this checkout; using SPEC-DELTA location search.
- 2026-10-07T11:53:03+02:00 step: lockfiles — sites/catalog-{game,web}/pnpm-lock.yaml are tracked and byte-identical to HEAD (git diff --quiet HEAD passes); root pnpm-lock.yaml clean; nothing deleted (per conductor correction). Commands run from root with --filter only.
- 2026-10-07T11:53:03+02:00 step: impeccable context run (target sites/catalog-game), craft-floor.md read. Build: StatePanel adapter rewritten onto site-kit interlock model (plate label+icon, own data-density, pending plate via sx-plate--pending); CommerceNotice takes placement density (default comfortable); home TEST notice placed compact.
- 2026-10-07T11:57:26+02:00 step: built state CSS rewrite (.state now merges into site-kit .sx-interlock + own data-density; lamp stripe; refusal body in --ink, reason in --refused-lamp), purchase-history block on detail, mirrored to catalog-web (components cp, home/item edits, CSS spliced after STORE IDENTITY). CSS diff = header comments + STORE IDENTITY only (docs/redesign-v6/lanes/catalogs-css.diff).
- 2026-10-07T11:59:37+02:00 step: named states — new _components/state-plate.tsx (label+icon+paint via site-kit statePlateElement, pure state-panel entry so the client error boundary can use it); 404/error/loading chips -> plates; StatePanel head uses it. Mirrored to catalog-web. tsc --noEmit clean for both. Lockfiles: git status shows no pnpm-lock changes.
- 2026-10-07T12:05:05+02:00 step: build — next build compiled both stores (game/web, "Compiled successfully", static pages generated). Post-build scripts/check-vercel-package.mjs FAILS on pnpm symlinks under site-kit→authoring-core→engine-presentation→three (workspace linker, not hoisted locally; environment, not this lane). Pre-existing class with GATE-BASELINE row 1 (sites in root workspace).
- 2026-10-07T12:13:26+02:00 step: desktop lane (bg-104) reported site-seams error.tsx divergence from its 11:58 gate. That was the window between the game edit and the web mirror. error.tsx is byte-identical in both stores now; site-seams re-run below.
- 2026-10-07T12:13:52+02:00 step: site-seams re-run: "error boundaries identical" PASSES; only remaining fail is "keeps sites/ out of the pnpm workspace" = GATE-BASELINE row 1 (ADR-0024), not new.
- 2026-10-07T12:15:33+02:00 step: round-1 measure (a7p2/round1/report.json, 20 route×width loads, both stores): axe 0 serious/critical everywhere (only moderate region on .family-brand, pre-existing); 0 state-panel contrast fails (min 5.37 = white on refused plate); refusal note body --ink 12.64:1, reason --refused-lamp 7.16:1 on --iron (>=5.5); refusal density comfortable 24/32 pad, 24px title, column head / compact 12/14 pad, 16px title, row head, no overflow at 1440 or 390; forced-colors panel 4px solid + plate border + CanvasText icon; no x-overflow at 720px (200%). FINDINGS: minFont 11px (below 13px ruling); detail primary (button-commit) = tab stop 9 by DOM order (skip, family Engine, storemark, 3 nav, crumb, detail-side region, primary).
- 2026-10-07T12:15:33+02:00 step: polish — every reading font-size raised to 0.8125rem (13px) floor (--micro token kept at 0.6875rem per test pin, now unused for text); mirrored. CSS diff still header comments + STORE IDENTITY only.
- 2026-10-07T12:17:02+02:00 step: impeccable detect flagged side-tab (4px lamp stripe) on .state; stripe removed (plate carries state; frame is the interlock 1px edge). detect re-run: [] (0 findings). Targeted vitest: catalog-storefronts + site-seams + maintenance-compat 432/433, the 1 fail = ADR-0024 workspace case (GATE-BASELINE row 1).
- 2026-10-07T12:23:30+02:00 step: CONFIRM round (a7p2/round2-unconfigured.out + round2-editor-origin.out, report.json each; servers with and without NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN): 40 route×width loads, all 200; axe 0 serious/critical on all 40 (axe re-run after the fixes); 0 contrast fails; minFont 13px everywhere; no x-overflow; forced-colors+720px(200%)+reduced: no overflow, panel 1px solid frame, plate solid border, icon CanvasText. Keyboard discover->acquire works (home: listing at stop 9, Enter, detail: button-commit at stop 9). Focus not obscured below the masthead (crumb, region, primary). Target <24: breadcrumb "Catalogue" 59x18 (passes the 2.5.8 spacing exception: nearest target >24px away). Dev servers 4471-4474 killed.
- 2026-10-07T12:23:47+02:00 step: gate started step-by-step (a7p2/gate-steps.sh, same steps/order as package.json gate; the && chain stops at baseline-red steps). Load avg ~36.
- 2026-10-07T12:28:10+02:00 step: gate steps 1-8: syntax 0, boundaries 0, contracts 0, build 0; traceability/sites/desktop/publish-ready red with verbatim GATE-BASELINE rows 4/1/2/3 (nothing new). test step running.
- 2026-10-07T12:33:44+02:00 step: GATE done (docs/redesign-v6/gate-latest.log = /home/devuser/Documents/Reports/sceneaxi-redesign-v6/lanes/a7p2/gate.log). syntax/boundaries/contracts/build 0. traceability/sites/desktop/publish-ready red = GATE-BASELINE rows 4/1/2/3 verbatim. test: 18 files / 201 tests failed, every file in GATE-BASELINE, none above main (diff below; cli capabilities + importers bounds are the listed load-flaky pair, run at load ~35, so no low-load re-run claim). lint: 33 errors in the 7 baseline files. NEW vs baseline: 0.

### Gate tail (gate-latest.log)
```
  17:1   error  'console' is not defined  no-undef
  19:1   error  'console' is not defined  no-undef
  21:1   error  'process' is not defined  no-undef

scripts/fix-trace-entries.mjs
  19:7  error  'workspaceNames' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 33 problems (33 errors, 0 warnings)

[ELIFECYCLE] Command failed with exit code 1.
=== EXIT lint 1
=== DONE 2026-10-07T12:33:09+02:00
```
### New-vs-baseline diff (per failing test file)
```
desktop/linux/test/byo-terminal-lifecycle.test.ts: 6 failed; baseline main 6 / v6 6
desktop/linux/test/viewport-terminal-lifecycle.test.ts: 14 failed; baseline main 14 / v6 14
packages/cli/test/capabilities.test.ts: 1 failed; baseline main 1 / v6 0
packages/importers/test/asset-preparation-bounds.test.ts: 1 failed; baseline main 1 / v6 0
tests/boundary/injected-desktop-violations.test.ts: 4 failed; baseline main 5 / v6 4
tests/boundary/injected-site-violations.test.ts: 5 failed; baseline main 10 / v6 5
tests/boundary/kids-evidence-scan.test.ts: 1 failed; baseline main 1 / v6 1
tests/contracts/injected-traceability-violations.test.ts: 1 failed; baseline main 1 / v6 1
tests/desktop/desktop-linux-seams.test.ts: 1 failed; baseline main 1 / v6 1
tests/docs/traceability-check.test.ts: 1 failed; baseline main 1 / v6 1
tests/e2e/desktop-chrome-frame-command-interactions-golden.test.ts: 7 failed; baseline main 7 / v6 7
tests/e2e/desktop-chrome-inspector-command-interactions-golden.test.ts: 3 failed; baseline main 3 / v6 3
tests/e2e/desktop-chrome-palette-command-interactions-golden.test.ts: 3 failed; baseline main 3 / v6 3
tests/e2e/desktop-command-interactions-golden.test.ts: 100 failed; baseline main 100 / v6 100
tests/publish/injected-publish-violations.test.ts: 50 failed; baseline main 50 / v6 50
tests/sites/identity-plane-wiring.test.ts: 1 failed; baseline main 1 / v6 1
tests/sites/provider-adapters.test.ts: 1 failed; baseline main 1 / v6 1
tests/sites/site-seams.test.ts: 1 failed; baseline main 1 / v6 1
NEW files: 0
```

### Part 2 summary (A7 catalogs, both stores in lockstep)

| Check | Result | Evidence |
|---|---|---|
| Refusal panel at comfortable | pad 24/32, gap 16, title 24px, reason 14px, body 16px, head stacked; no overflow at 1440 (485px) or 390 (358px) | a7p2/round2-*/report.json `refusal`, shots `*-refusal-comfortable@*.png` |
| Refusal panel at compact | pad 12/14, gap 8, title 16px, reason 13px, body 14px, head in a row; no overflow | same, `*-refusal-compact@*.png` |
| Density source | the panel's own `data-density` (site-kit `.sx-interlock`), chosen by placement: acquire block comfortable, hero TEST notice compact | state-panel.tsx, commerce-notice.tsx |
| Dark refusal note | body `--ink` 12.64:1, reason `--refused-lamp` 7.16:1 on `--iron` (target >=5.5) | probe3 output / report.json |
| Plates | label + icon + paint on every state panel and on 404/error/loading; pending uses `sx-plate--pending` (fill+line); refused plate 5.37:1, pending 9.32:1 | state-plate.tsx |
| Contrast | 0 text/boundary fails on 40 loads; min 5.37 | round2-*.out |
| axe | 0 serious/critical on 40 loads (re-run after fixes); 1 moderate `region` on `.family-brand` (pre-existing BASELINE) | round2-*/report.json |
| Text floor | min computed font 13px on every route (was 11px) | round2-*.out |
| Keyboard discover->acquire | home: Tab to listing (stop 9), Enter, detail: Tab to `button-commit` (stop 9). Focus never obscured below the masthead | round2-editor-origin.out |
| Forced colors + 200% (720px) + reduced motion | no x-overflow; panel 1px solid frame; plate solid border; icon CanvasText; only hover transitions remain (reduced block sets those transforms to none) | report.json `forcedZoom`, `*-detail-forced-zoom200.png` |
| Store parity | globals.css differ only in 2 header-comment hunks + STORE IDENTITY block; all .tsx except site-config identical (error.tsx byte-equal, site-seams pin green) | docs/redesign-v6/lanes/catalogs-css.diff |
| CSS budget | own CSS 68,721 B vs main 67,513 B = 1.018x (<=1.3x). Shipped 45,414 B (gz 8,421). The 60% target (40,508 B) is NOT met: no v5 rule deletion in this lane | wc -c |
| impeccable detect | 1 side-tab finding (my 4px lamp stripe) -> removed -> [] | — |
| Lighthouse | **UNVERIFIED**: load average 17–42 for the whole lane (never <4) | — |
| Lockfiles | sites/catalog-{game,web}/pnpm-lock.yaml byte-identical to HEAD; root lock clean | git diff --quiet |

!important: still only the reduced-motion pair (`animation-duration`, `animation-iteration-count`). Reason: it must beat component animations in every cascade layer, and catalog-storefronts.test.ts pins it.

Visual fidelity: deferred to the human final gate. No PNG was viewed, and no visual judgment is claimed.

Open issues:
1. Primary action is tab stop 9 by DOM order (needs <=5). The stops before it: skip, family Engine, storemark, 3 nav links, crumb, detail-side region (tabIndex+role+name pinned by catalog-storefronts.test.ts), primary. Fix: collapse family bar + store nav into one `<details>` Menu (-4 stops -> 5). This is a header restructure in layout/store-nav/family-bar, which the sticky-offset pins constrain. Not done in this lane.
2. The CSS 60% budget is unmet (68.7 KB vs 40.5 KB target). It needs the v5 rule deletion/rewrite onto site-kit layers that part 1 deferred.
3. Lighthouse unverified (machine never quiet).
4. Purchase history is an honest empty record: no purchase store exists for these origins. A real history list needs a site-kit read model (request for site-kit, not built here).
5. Breadcrumb link is 59x18 (<24px tall). It passes the WCAG 2.5.8 spacing exception and was not enlarged.
6. site-kit request: export `SIGNAL_DENSITIES` title sizes as CSS custom properties that survive unlayered h2/h3 rules. The store currently restates 1.5rem/1rem for `.state :is(h2,h3)`.

## Round 8 (2026-10-07): route-state regression fixed in source
`sites/catalog-{game,web}/src/app/loading.tsx` and `error.tsx` no longer import `./_components/state-plate.js`. They now write out the same plate markup directly: `sx-plate`, `data-state` isolated/refused, and the site-kit `SIGNAL_ICONS` paths. The import had broken `sites/catalog-game/test/rendered-route-states.test.mjs` 2/4 with `require is not defined`, because that test evals the transpiled TSX without `require`. The failure was never pre-existing. It now passes 4/4. The rendered markup is byte-identical to before, and the pixel diff is 24/24 0.000% with contrast and axe unchanged. Full record: `lanes/css-catalogs.md` "Round 8 fix", artifacts `R/release-r8/`.
