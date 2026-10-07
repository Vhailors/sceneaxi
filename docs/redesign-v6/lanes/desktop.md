# A10 Desktop lane (part 1): chrome.ts / ui-kit.ts / icons.ts

Owned: apps/desktop-shell/src/{chrome.ts,ui-kit.ts,icons.ts}, this log.

## Timeline
- 2026-10-07T08:41:43Z start; load avg 21.7 (machine NOT quiet -> Lighthouse/timing tests will be UNVERIFIED unless load drops <4)
- 2026-10-07T08:45:25Z scope finding: chrome.ts only assembles the document; title bar/panels CSS+markup live in src/chrome/*/{styles,markup}.ts (not owned); no density toggle or model control exists. Notified parent (question). Proceeding with ui-kit.ts + icons.ts; chrome.ts minimal.
- 2026-10-07T08:45:31Z conductor ruling: scope expanded to apps/desktop-shell/src/chrome/** (styles+markup, presentation only); density = CSS custom props on data-density attr, comfortable default; toggle control logged as open issue.
- 2026-10-07T08:47:51Z pre-edit test run (apps/desktop-shell + tests/e2e/desktop-* + tests/desktop + tests/visual): 115 failed / 652 passed (6 files), all pre-existing (scene-hierarchy-inspect init-call golden drift x114, pnpm-workspace desktop seam x1); list at /tmp/a10/pre-fails.txt, copied to evidence later
- 2026-10-07T08:51:13Z ui-kit.ts: A-rich Operate controls (13px floor via --ui-text clamp, focus = INTERLOCKING focus ink, selected tab bar, inert on well, pending plate pair .sx-plate--pending fill+inset line from INTERLOCKING_PENDING_PLATE, statePlate() label+icon, forced-colors + reduced-motion blocks). icons.ts: stateIcon() mirroring site-kit SIGNAL_ICONS (tool sprite set is pinned by icons.test, unchanged).
- 2026-10-07T08:59:36Z regions pass 1 (frame + core + dock + all styles.ts): 13px text floor across every region (127 lines; 3 test-pinned exceptions kept: .panel-head 11px, .scene-entity-identity code 10px, .asset-browser-card span 10px — pins honoured, logged as open issue); radii moved off Cinematic Pro CHROME_RADIUS 16/13/10 to RADIUS md/sm/xs 6/4/2 and every literal radius onto vars; title bar: well inset rule, square window lamps, project pill on well with pending yellow line+dot for dirty/recovering; brand = enamel plate; rail selection weight; change-review Accept = commit yellow + edge (Yellow=COMMIT); density vars --control-h/--row-h keyed on .shell[data-density], chrome root now emits data-density="comfortable" and uiKitStyles(); removed !important on .profile-refusal-foot (specificity instead)
- 2026-10-07T09:01:41Z viewport: Cinematic Pro radial glow backdrop -> flat well (A-rich flat iron). Moved density aliases after the region cascade (so .panel-head pin rule stays first match). desktop-shell tests: 42/42 files pass.
- 2026-10-07T09:04:12Z inspector/tree/assistant control heights -> var(--control-h) (density-keyed); .scene-property-input:focus 1px -> 2px outline. Batched verify round (dev renderer, file:// of renderDesktopChrome output, both densities x 1280/1920 + forced-colors + reduced motion + 200% zoom): evidence ~/Documents/Reports/sceneaxi-redesign-v6/a10-desktop/{after,before}/. Starting gate.
- 2026-10-07T09:05:55Z gate steps 1-8 run individually: syntax/boundaries/contracts/build green; traceability/sites/desktop/publish-ready red = baseline #4/#1/#2/#3. Running vitest + lint.
- 2026-10-07T09:31Z lint fix (unused SURFACE import after viewport glow removal); eslint apps/desktop-shell/src clean; tsc desktop-shell passes; desktop-shell vitest 42/42 files pass.
- 2026-10-07T09:36Z gate recorded to docs/redesign-v6/gate-latest.log (steps run individually, as GATE-BASELINE does). Log finalized.

## What changed (A-rich Operate dialect, replacing Cinematic Pro)
- `ui-kit.ts`: controls on iron/raised plates. 13px text floor (`--ui-text:max(13px,var(--ui-body))`, so compact's 12px body never ships as text). Focus ring = INTERLOCKING focus ink. Selected tab gets an enamel underline. Inert sits on well with a dashed edge. The pending pair (`.sx-plate--pending`, `.ui-plate[data-state=pending]`) is commit fill + 1px inset commit-edge line from `INTERLOCKING_PENDING_PLATE`. New `statePlate()` is icon + visible word, never paint alone. Forced-colors and reduced-motion blocks added.
- `icons.ts`: `stateIcon()`, with state glyphs mirrored path for path from site-kit `SIGNAL_ICONS`. The pinned 16px tool sprite is unchanged.
- `chrome.ts`: emits `uiKitStyles()` after the region cascade. The shell root carries `data-density="comfortable"` (default). Ids, data-action and script are untouched. No CSP meta existed and none was added.
- `chrome/**/styles.ts`: 127 declarations raised to the 13px floor. Radii moved off Cinematic Pro 16/13/10 to RADIUS 6/4/2, and every literal radius now uses the vars. Title bar has a well inset rule and square lamps. The project pill sits on well; dirty/recovering shows a yellow edge + dot, and the status text names the state. Brand is an enamel plate. Rail selected = enamel + weight. Change Review Accept = commit yellow with its edge (Yellow = COMMIT, same as web-shell `#accept`). Viewport radial glow → flat well. Control heights → `var(--control-h)`, keyed on density. Property input focus goes from 1px to 2px.
- `chrome/**/markup.ts`: no changes were needed.

## Density
CSS custom properties only: `.shell[data-density=comfortable|compact]` sets `--ui-*`, aliased to `--control-h/--row-h`. Compact also shortens `.panel-head` height. Both were shot by setting the attribute in the harness.

## Verification (one batched round, dev renderer = file:// of renderDesktopChrome output)
Evidence: `~/Documents/Reports/sceneaxi-redesign-v6/a10-desktop/{after,before}/` (PNG + verify.json), `verify.mjs`, `render.mjs`, `vitest-full.log`, `vitest-post-fails.txt`, `desktop-tests-pre-fails.txt`, `lint-full.log`.
- Contrast (computed text vs composited bg, all visible text, default + after hover/focus pass): 0 failures at comfortable/compact × 1280/1920 (124–134 text nodes). Focus ring #F1EEE4 2px on iron. The disabled state is covered by the inert controls in the sweep.
- axe serious/critical: 0 at comfortable/compact × 1280/1920, reduced motion, and 200% zoom. Under forced-colors emulation, 67 `color-contrast` hits. This number is identical on main (before/verify.json), so it is not new, but it is unresolved.
- Keyboard: tab walk reaches File, Edit, Run, Engine, Website, Kidssafe, Reload, Save. Ring visible and nothing obscured at every stop. Save (primary) is stop 8, so it **fails** the ≤5 rule. See Open issues.
- Reduced motion: 0 running animations (30 without reduce). 200% zoom: no horizontal overflow.
- CSS bytes: main 75 708 → 83 686 (1.105×, ≤1.3×). The surface ships no shared site-kit token block.
- Remaining `!important` (both pre-existing): `[hidden]{display:none !important}`, because a hidden region is a model/runtime decision that no region display rule may override. Reduced-motion `*{animation-duration/iteration/transition !important}`, because the user's reduce preference must beat every region animation. Removed: `.profile-refusal-foot` (now uses specificity).
- Visual fidelity: deferred to the human final gate.
- Lighthouse: UNVERIFIED (load average 30–42 for the whole session; never <4).
- Packaged Linux Electron launch in new chrome: not run in this lane (part 2 owns the packaged launch).

## Gate (new vs GATE-BASELINE)
syntax/boundaries/contracts/build green. traceability/sites/desktop/publish-ready red = baseline #4/#1/#2/#3, unchanged.
vitest: 16 files / 199 tests failed, 5 unhandled errors (all from desktop/linux viewport-terminal-lifecycle). Every failing file is in the GATE-BASELINE table, at or below its count. No new failing file or test (diff: vitest-post-fails.txt vs baseline table).
Load-sensitive timing tests could not get a low-load re-run (load ~35).
lint: 33 errors in the same 7 baseline files, 0 in apps/desktop-shell.

## Open issues
1. **User-facing density toggle**: it needs a model control in visual-model.ts plus a control-accounting pin update, which is the owner's decision. Until then compact is reachable only via the attribute.
2. **Primary action at tab stop 8** (menus + profile chips precede Save in title-bar DOM). The fix is a DOM reorder in frame/markup.ts, but that risks the control-inventory goldens' order. Deferred to part 2 or the owner.
3. **Test-pinned sub-floor text** (pins honoured, not edited): `.panel-head` 11px (visual-refinement.test.ts:34), `.scene-entity-identity code` 10px (:41), `.asset-browser-card span` 10px (:92). The 3 visible panel-head labels render at 11px. The pins need an owner update to reach 13px.
4. Forced-colors axe color-contrast ×67, the same as main.
5. Token requests (visual-tokens.ts not edited): (a) export the state glyph paths (or a generated snapshot of site-kit `SIGNAL_ICONS`) with a drift assertion, so icons.ts stops hand-mirroring. (b) Retire `CHROME_RADIUS` 16/13/10 and `VIEWPORT_GRADIENT` (Cinematic Pro, now unused by the chrome). (c) Add `commitHi` to the alignment allow-list if the hover tint is wanted; Accept hover currently uses a 2px on-commit inset instead.


# A10 Desktop lane (part 2): app.ts / product-loop.ts / electron main.ts window colors / packaged launch

Owned: apps/desktop-shell/src/** except visual-tokens.ts, desktop/linux/src/electron/main.ts (window bg + titlebar colors only), this log.

## Timeline (part 2)
- 2026-10-07T09:49:05Z start; load avg 40.9 (NOT quiet -> Lighthouse/timing UNVERIFIED unless <4)
- 2026-10-07T09:53:37Z step 1 BUILD: app.ts `chrome --density <comfortable|compact>` (pick() over DESKTOP_DENSITY_IDS from DENSITY; usage line; COMMAND_FLAGS; result.density), chrome.ts DesktopChromeOptions.density -> data-density (default bytes unchanged). main.ts backgroundColor #111113 -> SURFACE.backdrop (#182320, = --backdrop/body). product-loop.ts: no presentation (capability copy + refusals only, real product copy, mirrored in desktop-ledger audit) -> left unchanged.
- 2026-10-07T09:57:36Z step 2 TESTS: tsc clean (desktop-shell, desktop/linux). vitest apps/desktop-shell: 41/42 files pass. The 1 failure is visual-refinement.test.ts:72 "disabled BYOK labels". It is caused by webshell_2's renderer edit (byo-configuration.ts :is() merge), not this lane, and bg-103 has been notified. tests/e2e/desktop-chrome-palette golden 3/3 fail identically WITH and WITHOUT my diff (stash A/B): command-planes registry, same class as baseline desktop-command-interactions. Load 39-42. Log: Reports/.../desktop-p2/vitest-desktop-shell.log
- 2026-10-07T10:03:48Z step 3 VERIFY (1 batched round, via the real CLI `chrome --density`): 12 views (w1280, w1920, run, ship, web, palette × comfortable/compact), plus forced/reduced/zoom200. Contrast 0 fails (text+hover). axe 0 serious/critical EXCEPT web profile `scrollable-region-focusable` ×1 on `.stage-host` (serious; pre-existing CSS+markup identical on main; a tabindex fix is forbidden by the control-accounting.test.ts:240 pin -> Open issue). Reduced motion: 0 running animations (default 30). forced-colors axe color-contrast ×67 = part 1 = main. zoom200: no overflow-x. Density measured: comfortable panel-head 32 / Save 28 / --control-h 28; compact 28/24/24. Default `chrome` bytes == `--density comfortable` bytes. Keyboard: Save at tab stop 8 (unchanged, Open issue #2). Evidence: Reports/sceneaxi-redesign-v6/desktop-p2/{shots/*.png,shots/verify.json,density.json,render.json}
- 2026-10-07T10:07Z step 4 PACKAGE+LAUNCH. Done after webshell_2 lm_186 "RENDERER DONE"; the final renderer is byo-configuration.ts + features/{overlay-report,audio-playback,audio-controls}.ts.
  - Build: build-linux.mjs OK, then electron-builder --linux AppImage to /tmp/a10p2-release (repo release/ artifacts untouched; unpacked copy staged at desktop/linux/release/a10p2/, gitignored).
  - Launch: the packaged binary launched under Xvfb via playwright _electron.
  - Colors: BrowserWindow.getBackgroundColor() #182320 = body/shell rgb(24,35,32); title-bar plate rgb(30,43,40) (iron). Document title "SceneAxi Engine Desktop — Choose a project", CSP meta intact.
  - Density: comfortable Save 28 / panel-head 32; compact (set via attribute, no UI toggle) 24 / 28.
  - Keyboard: 12 Tabs, every stop ring=true and obscured=false; Save is at stop 8.
  - Reduced motion: 0 running animations.
  - axe (axe injected via CDP evaluate, because CSP blocks script tags), both densities: 0 serious/critical; only moderate landmark-one-main and page-has-heading-one on the project chooser.
  - smoke.mjs --packaged FAILED at phase "maximum-asset native import" ("Native fixture dialog did not apply a real manifest asset."), after the window had launched and run the earlier phases. This lane changes no asset-import code; not A/B-tested vs main -> Open issue.
  - Evidence: desktop-p2/packaged/{packaged-comfortable,packaged-compact,packaged-reduced}.png, packaged.json, packaged-axe.json; desktop-p2/{packaged-smoke.log,electron-builder.log,build-linux.log}
- 2026-10-07T10:10Z step 5 GATE: ran step-by-step 11:58–12:10 (load 25–30) into desktop-p2/gate.log, copied to docs/redesign-v6/gate-latest.log. Step exits: syntax 0, boundaries 0, contracts 0, traceability 1 (#4), sites 1 (#1), desktop 1 (#2), publish-ready 1 (#3), build 0, test 1, lint 1 (33 errors / 7 files = #7).
- 2026-10-07T10:21Z step 6 CONFIRM (the one confirm round): re-ran the 3 files that exceeded baseline, alone, at load 33–41.

### Gate: new vs baseline (test, per file; baseline = GATE-BASELINE.md v6 column)
| File | baseline v6 | this gate | confirm re-run | verdict |
|---|---|---|---|---|
| desktop-command-interactions-golden | 100 | 100 | — | = |
| desktop-chrome-{frame,inspector,palette} goldens | 7+3+3 | 7+3+3 | — | = (also failed identically with my diff stashed) |
| injected-publish-violations | 50 | 50 | — | = |
| viewport-terminal-lifecycle / byo-terminal-lifecycle | 14 / 6 | 14 / 6 | — | = |
| injected-site / injected-desktop violations | 5 / 4 | 5 / 4 | — | = |
| site-seams | 1 | **2** (+"keeps catalog error boundaries identical") | 1 (only the baseline workspace-glob case) | catalogs lane, transient; bg-102 told (lm_188); passes on re-run |
| injected-traceability-violations | 1 | **2** (+60 s timeout "fails when a real proof link loses its resolved path") | 0 | load timeout |
| prepared-asset-handoff | 0–1 | **2** (+"stages actual worker E1", ok:false) | 1 (baseline heartbeat case) | load-sensitive; passes alone |
| kids-evidence-scan, desktop-linux-seams, traceability-check, identity-plane-wiring, provider-adapters | 1 each | 1 each | — | = |
| importers asset-preparation-bounds, cli capabilities | 0 (flaky, main 1) | 1, 1 | not re-run | load-sensitive flaky rows in baseline |
| **Total** | 16 files / 199 | 19 files / 205 | — | The extras are only the load/transient rows above; none touches desktop-shell or main.ts |
Non-test steps: identical to baseline #1–#4 and #7 (#5 boundaries now passes).
Load never fell below 25, so the timing rows count as UNVERIFIED-at-low-load (rule: they count only after a low-load re-run).

## Part 2 result
- **Visual fidelity: deferred to the human final gate.** No pixel judgment is claimed; the PNGs exist for the human.
- **Lighthouse: UNVERIFIED** (load average 25–42 for the whole session, never <4).
- `!important`: none added in part 2 (`git diff` of the 3 changed files: 0 occurrences).
- CSS budget: part 2 adds 0 bytes of CSS (the density option only switches the existing `data-density` attribute).
- product-loop.ts: unchanged. It holds no colours, classes or markup, only capability copy and refusal messages. That copy is real product copy, rendered by chrome/viewport/markup.ts, which already sits in the v6 chrome; changing it is a copy decision, not chrome.
- main.ts titlebar: Linux uses the native WM frame (no `titleBarStyle` or `titleBarOverlay`), so Electron has no titlebar colour to set without going frameless. That would be a behaviour change, so it was not made. The in-document title bar is the v6 iron plate rgb(30,43,40), and the window background before first paint is now the canvas #182320 (was #111113).

## Open issues (part 2; part-1 items 1–5 still stand)
6. **Web profile axe `scrollable-region-focusable` (serious) ×1 on `.stage-host`**, both densities. The CSS and markup are byte-identical to main (`viewport/styles.ts:50` overflow:auto). The keyboard fix (`tabindex="0"` region) is forbidden by the pin `control-accounting.test.ts:240`, which allows tabindex only on `<pre>` diff/evidence regions. The fix needs an owner decision: widen that allowlist, or move the scroll to a labelled `<pre>`/region the pin accepts.
7. **`smoke.mjs --packaged` fails at "maximum-asset native import"** ("Native fixture dialog did not apply a real manifest asset."). The window launches and the earlier phases run, and this lane changes no import code. The likely cause is the same 4000 ms asset-preparation deadline the baseline records under load, but that is not proven: there was no A/B against main and no low-load run.
8. The packaged build predates webshell_2's lm_187 comment-only CSS trim in byo-configuration.ts (5,550→4,753 B; selectors unchanged per bg-103). A re-package would pick up only that trim.
9. Primary action (Save) is still at tab stop 8 in both the HTML chrome and the packaged app (part-1 #2; DOM reorder in frame/markup.ts not attempted, because of golden order risk).
10. Compact density is still reachable only by CLI flag (`chrome --density compact`) or by setting the attribute. There is still no in-app toggle (part-1 #1).

## Files changed (part 2)
- apps/desktop-shell/src/app.ts: `chrome --density <comfortable|compact>` (usage line, COMMAND_FLAGS, pick(), result.density, passed to renderDesktopChrome). An unknown value is refused with exit 2.
- apps/desktop-shell/src/chrome.ts: `DESKTOP_DENSITY_IDS` / `DesktopDensityId` (derived from visual-tokens `DENSITY`), `DesktopChromeOptions.density` → `.shell[data-density]`. The default output is byte-identical to before.
- desktop/linux/src/electron/main.ts: `backgroundColor: SURFACE.backdrop` (imported from @sceneaxi/desktop-shell, so the value is not a hand-copied literal).

## Evidence (part 2) — ~/Documents/Reports/sceneaxi-redesign-v6/desktop-p2/
- shots/{comfortable,compact}-{w1280,w1920,run-w1680,ship-w1680,web-w1680,palette-w1680}.png, shots/{forced,reduced,zoom200}.png, shots/verify.json
- render.json, density.json
- packaged/{packaged-comfortable,packaged-compact,packaged-reduced}.png, packaged.json, packaged-axe.json
- packaged-smoke.log, electron-builder.log, build-linux.log
- gate.log (= docs/redesign-v6/gate-latest.log), gate-perfile.txt, confirm-rerun.log
- vitest-desktop-shell.log
- scripts: _work/{render,verify,dens,packaged,packaged-axe}.mjs, gate.sh
- Packaged app: /tmp/a10p2-release/SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage, unpacked at desktop/linux/release/a10p2/linux-unpacked (gitignored)
- No dev servers were started; every Electron instance was closed (pgrep clean).
