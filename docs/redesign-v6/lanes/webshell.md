# Lane log: web-shell Change Review (A9 pilot)

Status: **G4 retry 2 done** (2026-10-07 01:40, the last pilot attempt). It applies the conductor's three-item ruling (lm_147): CSS budget, pending-plate contract, and this log. See "G4 retry 2" and "Copy contract for lanes" directly below. Earlier sections are kept as history; where retry 2 re-measured a number, retry 2 supersedes it.

Visual fidelity vs concepts/a-rich/3-inspector.html: deferred to the human final gate (conductor ruling).
No visual judgment is claimed anywhere here. Nobody viewed the PNGs. Every claim comes from computed styles, DOM geometry or file I/O.

## Copy contract for lanes

This is what lanes A6–A10 copy from the Change Review. Copy nothing else from this page without a ruling.

1. **Tokens: a generated snapshot plus a drift test.** Never hand-copy tokens.
   - The source is `operateCssVars()` in `packages/site-kit/src/design-tokens.ts`.
   - The copy is `apps/web-shell/src/operate-tokens.ts` (`OPERATE_CSS_VARS`), with a header that names the source, version and hash and gives the regenerate command.
   - The drift alarm is the assertion "keeps the web-shell Operate token snapshot byte-identical to operateCssVars()" in `packages/site-kit/test/design-tokens.test.ts`.
   - A lane that cannot import site-kit adds its own snapshot and one assertion of the same kind (desktop already follows this pattern in `apps/desktop-shell/src/visual-tokens.ts`).
2. **Commit-yellow fill and line are one pair.** Any rule that paints `background: var(--commit)` must also draw `box-shadow: inset 0 0 0 1px var(--commit-edge)` in the same rule.
   - Here that rule is `.plate[data-phase=reviewing], .review-state[data-state=pending]` in `inspector-app.ts`.
   - Light: the fill against the page is **1.37**, the line against the page is **5.11** (`#7A5C00`).
   - Dark: the fill and the line are both **5.74** (`--commit-edge` = `--commit`).
   - Enforced by `apps/web-shell/test/visual-postpr.test.ts`, case "ships every commit-yellow fill together with its commit-edge line (pending plate contract)". It finds every CSS rule containing `background: var(--commit)` and fails if any of them lacks `var(--commit-edge)`, or if no such rule exists. Mutation check: deleting the line from the pending rule produces 1 offender, so the test fails.
   - The ideal home for the pair is a site-kit class or token; that is a request (see Open issues), not done here.
3. **CSS budget.** A surface's own inline CSS, excluding the shared generated token block, must be **≤1.3× its main baseline**. For this page that means ≤13,812 bytes (1.3 × 10,625).
   - Do not remove focus styles or `prefers-reduced-motion` / `forced-colors` styles to meet it.
   - Measure it as UTF-8 bytes of the `<style>` text with `${OPERATE_CSS_VARS}` removed.
4. **States use a label plus an icon, never colour alone.**
   - Every state plate carries a visible text label plus a `<use href="#i-…">` glyph: idle "No proposal", pending "Pending review · unwritten", verified "Verified · written", rejected "Rejected · nothing written", refused "Refused · nothing written", stale "Stale · not actionable", outcome-unknown "Outcome unknown".
   - Plate text ≥5.37:1. Each plate keeps a ≥3:1 boundary line against the page, and forced colours keep a solid border.

## G4 retry 2 (2026-10-07): conductor ruling lm_147

### 1. CSS budget: **17,448 → 16,353** total; own CSS **14,871 → 13,776** (cap 13,812; 1.297× main)

The token block is unchanged at 2,577 bytes. No focus, reduced-motion or forced-colours rule was removed; every `@media (prefers-reduced-motion)` and `@media (forced-colors)` block is still present.

What was cut:
- **Indentation:** the 2-space indent and blank lines inside `<style>` (about 900 bytes).
- **Merged rules:** applied route `li::before`/`::after` became one `--route: var(--verified-route)` rescope. The two applied mark/Differs rules became one `:is()` rule, and so did the two uncertain rules. The `:user-invalid`/`[aria-invalid]` pairs became one rule in light, dark and forced colours.
- **Redundant declarations:**
  - `caret-color`, `letter-spacing: 0` and `-webkit-tap-highlight-color`
  - `min-width: 0` on block children
  - the `.sprite` sizing (the SVG already has `width/height=0`)
  - a duplicate `border-color` on `#accept:hover`
  - a second `max-width: 100%`
  - the `pre` `position/overflow/color/font-variant-numeric` (inherited, or unused)
  - the `.review-state` selector, which is already covered by `.plate`
  - the unused `.phase { font: inherit }`
- **Brittle-test duplicate:** the duplicated `code` rule is kept, because `visual-postpr.test.ts` still pins its exact text. Changing that assertion to check computed style is outside this ruling.
- **Regression caught in verify and fixed:** narrowing the light-DOM focus-ring selector dropped the ring on Propose and Accept (sweep ring 1.06 and 2.05, 2px). The full `:is(button,input,a[href],[tabindex])` selector is restored, and the confirm run shows the ring back at 3px everywhere (min 6.55).

### 2. Pending plate contract

Done as described in contract item 2. The pending rule now carries `box-shadow: inset 0 0 0 1px var(--commit-edge)` next to its fill. In light mode the measured line against the page went from 3.44 (the old `--edge` border) to **5.11** (`--commit-edge` on the pending plate). One assertion was added to the existing `apps/web-shell/test/visual-postpr.test.ts`. No new test file was created.

### 3. Confirm round (`a9/metrics-g4r2-confirm.json`, `a9/verify-g4r2.txt`; the same harness, which now also records each state's fill/page and line/page)

None of these numbers fell below the earlier retry; Change Review was not reworked.

| Check | Result |
|---|---|
| Text contrast, 8 combos (dark/light × compact/comfortable × 1440/390) | min **5.67** dark / **6.15** light, 0 fails |
| 7 states × 2 schemes | label + icon on all; plate text min **5.37** (refused); 0 text fails; refusal note **7.89** dark / **7.06** light |
| Plate line vs page | dark ≥**3.54**; light ≥**3.44**, pending **5.11**. Light fills vs page are 1.34–1.96 (verified/rejected/stale/unknown/pending), and each of those plates relies on its line |
| stateSweep rest/hover/active/focus | min **6.55**; ring 3px on all 5 buttons, min 6.55; obscured 0 |
| axe (dark + light, reviewing) | **0** violations |
| Min font / sub-24px targets | 13px / 0 |
| Fold 390×844 | compact clearance **148px**, comfortable **69px** (was 128/49); plate + first row above the fold in all 8 |
| Tab stops to Accept | **5** in all 8 combos and at 200% zoom (no x-overflow; Accept visible on focus) |
| Keyboard | edit→review→apply writes the file; edit→review→reject (propose>accept>reject) leaves it unchanged; refuse keeps focus in `jsonPointer`; copy-digest puts the full 71-char `sha256:` on the clipboard; CSP errors 0 |
| Motion | no-preference 9→4→2→**0**; reduce 0 at every sample |
| Forced colours | plate/tag border solid, mark `Highlight`-mapped, Accept outline solid 2px |
| Tests | `vitest run apps/web-shell packages/site-kit/test/design-tokens.test.ts`: 13 files / **263** pass (incl. `inspector-accessibility` 12/12 and the new contract case) |

The light-mode boundary minimum of 1.37 in the per-combo summary is the plate's *fill* sample. The harness's BOUNDS probe reads the fill and does not see the inset line; the line is measured separately in the state rows above (5.11).

## G4 retry (2026-10-07): conductor conditions

1. **`operateCssVars()` (decision: generated snapshot).**
   - **site-kit (additive, the narrow exception):** `operateCssVars()` in `packages/site-kit/src/design-tokens.ts` emits three plain rules: `:root` (faces, motion, every `SIGNAL_COLORS` + `SIGNAL_SHADOWS` token in dark), `prefers-color-scheme: light` (only the tokens that differ), and `prefers-reduced-motion: reduce` (motion zeroed). It is re-exported from `packages/site-kit/src/index.ts`. No existing token value changed.
   - **Why a snapshot rather than an import:** web-shell may not import site-kit. It is not in web-shell's `allow` list in `docs/dependency-matrix.json`, which `check:boundaries` enforces fail-closed. Adding it would also need edits to `package.json` and the root lockfile, both of which are forbidden.
   - **Conductor ruling:** use a generated snapshot instead, the same pattern as `apps/desktop-shell/src/visual-tokens.ts`. That snapshot is `apps/web-shell/src/operate-tokens.ts`: `OPERATE_CSS_VARS`, 2,577 bytes, css sha256 `5d40c577c974869d…`. Its header carries the provenance and the exact regenerate command.
   - **Inspector:** `inspectorPageHtml` inlines `${OPERATE_CSS_VARS}` as the first rules of its `<style>`. The hand-copied `:root` palette, motion and face blocks are deleted. Local aliases were renamed to the canonical tokens: `--field`→`--panel`, `--raised`→`--iron-raised`, `--mark`/`--on-mark`/`--mark-line`→`--lunar-mark`/`--on-lunar-mark`/`--lunar`, `--refused-text`→`--refused-lamp`, `--route-done`→`--verified-route`, `--lift`→`--lift-1`, `--sans`/`--display`/`--mono`→`--font-prose`/`--font-plate`/`--font-data`.
   - **Drift alarm:** one assertion was added to the existing `packages/site-kit/test/design-tokens.test.ts` ("keeps the web-shell Operate token snapshot byte-identical to operateCssVars()"). `check:boundaries` stays OK, because it checks package-level imports and a test `readFileSync` is not one. **The desktop lane should reuse this pattern.**
2. **CSS trimmed.**
   - **Duplicates removed:** the 4 duplicated `-b` keyframes (`lamps`/`lamps-b` and `reveal`/`reveal-b` merged into one `wipe`) and the 4 `-b` rename rules. The echo now restarts by removing `data-echo` and forcing a reflow, then setting `data-echo=<phase>`.
   - **Dead code removed:** the 5-icon `[data-for]` `:has()` matrix (the phase plate now swaps one `<use href>`, like `#review-state`), the dead `data-tick`/`settle()` hooks (no CSS read them), and the CSS comments.
   - **Bytes:** inline `<style>` is **18,694 → 17,448** (−1,246). main's baseline is 10,625, so the page is still +64%, and 2,577 of the 17,448 are the shared token block.
   - **Budget:** the ruling applies the budget per surface family, so this page is not judged alone. No dead duplication remains that I could find. One duplicate is kept on purpose: the two `code { … }` rules, because `visual-postpr.test.ts` pins the first one verbatim.
3. **Fold at 390×844, comfortable.**
   - **Change:** at `max-width: 480px`, comfortable now uses `--pad: 16px; --gap: 10px; --row-pad: 14px 16px`. The 44px control height is unchanged.
   - **Result:** the first row ends at **795**, so clearance is **49px** (it was 1px; ≥24 was required). Compact, the default, ends at 716 with 128px of clearance.
   - **Accept:** still 5 tab stops in all 8 combos and at 200% zoom.
4. **Housekeeping.** The stray `:5191` server was killed (pid 980633, started 2026-10-06 18:56 from `../sceneaxi-slice-1` with `--cwd /tmp/s1/ws`). `/tmp` (tmpfs) hit 100% during verify. I removed only my own `/tmp/a9-inspector-*` fixtures (58) and re-ran with `TMPDIR=~/.cache/a9-tmp`.

### Re-measured (`a9/metrics-g4.json`, `a9/verify-g4.txt`; same harness, plus `fold.clearance` and `cssBytes`)

| Check | G4 retry |
|---|---|
| Text contrast, every rendered node, 8 combos | min **5.67** dark / **6.15** light, 0 fails |
| 7 states × 2 schemes | each has a label and an icon; plate min **5.37** (refused); 0 text fails |
| Refusal note | **7.89** dark / **7.06** light |
| Disabled controls | min **5.67** across both schemes and all states |
| stateSweep rest/hover/active/focus + ring | min **6.55** dark / **9.32** light; obscured 0 |
| 1.4.11 boundaries | min **3.54** dark / **3.32** light (route track, was 3.28). The light *pending* status-plate yellow fill reads 1.37 against the page; that plate's boundary is its `--edge` line at 3.44, the same as before the retry |
| axe (dark + light, reviewing) | **0** violations |
| Min font / sub-24px targets | 13px / none |
| Fold 390×844 | compact: plate 484, row 716 (**+128**); comfortable: plate 557, row 795 (**+49**) |
| Tab stops to Accept | **5** everywhere, incl. 200% zoom (no overflow, Accept visible on focus) |
| Keyboard apply / reject / refuse | pass, both schemes (file written / unchanged / focus stays in field) |
| Motion | no-preference: 9→4→2→**0 at 1701ms**; reduce: 0 at every sample, no `data-echo` |
| Forced colours | solid plate and tag borders, mark = Mark, Accept outline solid 2px |
| CSP console errors | 0 |

## What changed (`apps/web-shell/src/inspector-app.ts`, `inspectorPageHtml` only)

- **Structured review.** `#rows` (`ol`) is built from `snapshot.proposal.edits`, and each edit becomes one WHERE / BEFORE / AFTER row (ported from `../sceneaxi-slice-1`). WHERE shows the document plus a JSON-Pointer signal route; the last station is ringed in lunar while reviewing. BEFORE is struck through. AFTER carries a lunar `mark` plus a **"Differs" tag with an icon** (or "Same value"). All text goes through `textContent`, with no HTML injection.
- **`#diff` is kept.** It still holds the exact rendered bytes ("Exact diff: the bytes Accept writes"). Its `textContent` contract is unchanged, so the dev-server tests still pass.
- **Decision plate (`#decision`, raised plane).** It has explicit **Consequence** (`#consequence`, recomputed per phase/uncertainty) and **Recovery** (`#review-help`). Accept is the commit and is **yellow** (`--commit #F2C230`, ink `#1A2623`, edge `#7A5C00`/dark `#F2C230`).
- **States: every one has a label and an icon** (`#review-state` plate + SVG symbol sprite):
  - idle "No proposal"
  - pending "Pending review · unwritten"
  - verified "Verified · written"
  - rejected
  - refused "Refused · nothing written"
  - stale "Stale · not actionable"
  - outcome-unknown "Outcome unknown"
  - recovery

  The `#phase` plate also shows a phase icon.
- **Density.** Compact is the default (Operate). Comfortable comes from `?density=comfortable` or the footer toggle `#density` (`aria-pressed`, persisted in localStorage). Comfortable sets the control height to 44px.
- **Echo (DIRECTION §4.7).** On a new review it runs once: route lamps, then the lunar scan, then the AFTER/"Differs" reveal, then the Accept commit paint. It ends by about 1.7s and never loops. Under `prefers-reduced-motion: reduce` it does not run (`data-echo` is never set, `animation: none`), so the reduced-motion form is the final still.
- **390.**
  - The repeated help sentence is gone: `#note` carries the outcome and `#review-help` carries the recovery, and they no longer duplicate each other.
  - The sha256 digest is shown as `sha256:xxxxxxxxxxxx…xxxx` (`aria-hidden`) next to a `Copy` button (`data-action="copy-digest"`). The full value is in the accessible label and in an `.sr` span.
- **Kept.** Every original DOM id (`edit documentPath jsonPointer newValue propose phase note accept reject recover reconcile diff`), the inline-only CSP (no external loads; the inline script/style hash is recomputed by dev-server at runtime), and the `.refused` colour pins that the accessibility test checks.

## Evidence (`~/Documents/Reports/sceneaxi-redesign-v6/a9/`)

- Harness: `_work/verify.mjs` (reuses `baseline/_work/lib.mjs` MEASURE/stateSweep/axe; scroll + `img.decode()` before full-page shots). Metrics: `metrics-verify.json`.
- Shots: `shots/{dark,light}-{compact,comfortable}-{1440,390}-{viewport,full}.png`, `forced-{dark,light}-1440.png`, `zoom200-dark.png`, `echo-dark-1440-700ms.png`. State shots: `states/{dark,light}-{idle,pending,verified,rejected,refused,stale,outcome-unknown}.png`.

### Measured results (all 8 combos: dark/light × compact/comfortable × 1440/390)

| Check | Result |
|---|---|
| Text contrast, every rendered text node (idle + reviewing) | min **5.67** dark / **6.09** light, **0 fails** |
| Text contrast across 7 states × 2 schemes | min **5.37** (refused plate), 0 fails |
| Refusal note (`#note.refused`) | **7.89** dark / **7.06** light (needs ≥5.5) |
| Disabled controls (dashed edge + label) | dark 5.67 (Propose 9.08), light 7.25 / 7.71 |
| Controls rest/hover/active/focus (stateSweep) | min 3.54 (Copy hover) … Accept 9.32 rest / 11.01 hover; focus rings 6.55–16.34; focus never obscured |
| 1.4.11 boundaries (rows, decision, wells, inputs, buttons, route tracks/stations, mark, status plate) | min max(outer,inner) **3.54 dark / 3.28 light** (light route track), 0 below 3 |
| axe (dark + light, reviewing) | **0 violations** |
| Min font size | **13px** everywhere (incl. 200% zoom) |
| sub-24px targets (WCAG 2.5.8) | **none**. Smallest is Copy, 60×28. Compact controls are 32px tall; comfortable controls are 44px |
| 390×844 fold, compact | status plate bottom 464, first row bottom 696 ≤ 844 ✓ |
| 390×844 fold, comfortable | plate 591, first row 843 ≤ 844 ✓ (1px margin) |
| Tab stops to Accept (reviewing, all 8 combos + 200% zoom) | **5**: documentPath > jsonPointer > newValue > propose > accept |
| Horizontal overflow | none at 1440, 390 or 200% zoom (720 CSS px) |
| Repeated sentences across note/help/consequence/diff/footer | none |
| Digest at 390 | 1 line; clipboard receives full `sha256:04d7…c573` (64 hex); label "Copied base digest sha256:…" |
| Keyboard edit→review→apply | Enter in New value → reviewing, focus stays in field; Tab path to Accept; Enter → applied, file contains `"x": 7`, focus → Propose |
| Keyboard edit→review→reject | Tab path `propose>accept>reject`, Enter → rejected, file unchanged, focus → Propose |
| Keyboard refuse | bad pointer → refused plate + note, focus stays in the field |
| Stale / outcome unknown | Accept after a superseding proposal gives stale, and a lost `/api/accept` gives unknown. In both cases focus goes to Read authoritative state, Propose/Accept/Reject are disabled, and the consequence text is rewritten |
| CSP console errors in the flows | 0 |
| Motion, no-preference | 9 animations at 150ms → 4 at 700 → 2 at 1200 → **0 at 1700ms** |
| Motion, reduced | 0 animations at every sample; no `data-echo` |
| Forced colours (dark/light) | plates and tags get a solid CanvasText border; the diff mark is `Mark` (rgb 255,255,0); the Accept focus outline is solid 2px |

## Open issues

1. **CSS budget (family level).** The page is 17,448 bytes against main's 10,625. Per the ruling this is judged per surface family, which the release-evidence step has to sum. The snapshot carries every Operate token (2,577 bytes), including some this page does not use. Trimming that is a site-kit decision, not a lane one.
2. **Visual fidelity against `concepts/a-rich/3-inspector.html` is unchecked.** A human who can view `a9/shots/` and `a9/states/` must sign off.
3. ~~Fold~~ and ~~token mirroring~~ are fixed (see G4 retry).
4. **Lunar measurements:** on the light iron plane, lunar `#5B3FD0` is used only for the mark underline and the Differs fill (6.61). The dark lunar `#C4B4FF` is used for fills/marks only, with dark ink (7.91).
5. **Not run here:** Lighthouse, because this is a local loopback tool (the machine load average was 18–27, so it was not quiet anyway). The 390 shots use reduced motion, so they show the final still.

## Gate (G4 retry, 2026-10-07 00:25–00:40; `docs/redesign-v6/gate-latest.log`; load average 29–37)

The chained `pnpm run gate` stops at check:traceability (baseline #4), so every later step was run on its own and appended to the same log.

- **Pass:** syntax, boundaries (`27 packages verified`; baseline #5 is already fixed on v6), contracts, build, `node --test scripts/check-contracts.test.mjs` (40/40).
- **Fail, baseline:**
  - #4 traceability
  - #1 sites
  - #2 desktop
  - #3 publish-ready
  - #7 lint: 33 errors in the same 7 files (`docs/audits/**`, `scripts/fix-trace-entries.mjs`)
- **vitest:** 19 files / 204 tests fail.
  - **18 files are baseline rows:**
    - publish 50
    - site 5
    - desktop 4
    - kids 1
    - site-seams 1
    - linux-seams 1
    - traceability 1+1
    - command golden 100
    - chrome goldens 7+3+3
    - viewport 14
    - byo 6
    - identity 1
    - provider 1
    - flaky `cli/capabilities` 1 (60 s timeout)
    - flaky `importers/asset-preparation-bounds` 2 (heartbeat timing; the baseline row is "1, flaky", and this run had 2 under load 37)
  - **The 19th, `desktop/linux/test/local-rpc.test.ts` (2), was caused by my harness, not the code.** I ran with `TMPDIR=~/.cache/a9-tmp` because /tmp was full, and that made the unix-socket path longer than 108 bytes (`listen EINVAL`). Re-run with the baseline `TMPDIR=~/.vt`: **10/10 pass**. The confirmation is appended to the log.
- **web-shell:** 12 files / 207 tests pass, including `inspector-accessibility.test.ts` (12/12). `site-kit` passes, including the new drift assertion. ESLint on `apps/web-shell` + `packages/site-kit`: clean.

**New vs baseline: none.**

## Gate (G4 retry 2, 2026-10-07 01:13–01:28; `docs/redesign-v6/gate-latest.log`; load average 12–22)

`pnpm run gate` stops at check:traceability (baseline #4). Every later step was then run on its own with `TMPDIR=~/.vt`, and its output was appended to the same log.

- **Pass:** syntax, boundaries (27 packages), contracts, build.
- **Fail, baseline:** #4 traceability (5 errors, stale `tests/` proof paths), #1 sites (workspace globs `sites/`), #2 desktop (workspace globs `desktop/`), #3 publish-ready (2 manifest-hygiene problems), #7 lint: **33 errors in the same 7 files** (`docs/audits/production-swarm/**` ×6, `scripts/fix-trace-entries.mjs`).
- **vitest: 16 files / 199 tests fail, which equals the GATE-BASELINE v6 column exactly (16 / 199).** Per file: publish 50, site-violations 5, desktop-violations 4, kids-evidence 1, site-seams 1, linux-seams 1, traceability 1 + 1, command golden 100, chrome goldens 7 + 3 + 3, viewport 14, byo 6, identity 1, provider 1. None of the flaky rows fired this run. The 5 "Unhandled Rejection" errors (readiness sentinel, WebGL context) come from the desktop/linux renderer harness (baseline rows viewport and byo).
- **web-shell and site-kit:** 13 files / 263 tests pass.

**New vs baseline: none.**

## Open issues (G4 retry 2)

1. **Site-kit request:** move the commit-fill + commit-edge pair into a site-kit class or token, so every surface gets the pair from one source. The web-shell test enforces it only on this page.
2. **Brittle test:** `visual-postpr.test.ts` pins the exact text `code { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }`, so a duplicate `code` rule stays. Changing that test to check computed style is outside this ruling.
3. **Visual fidelity** vs `concepts/a-rich/3-inspector.html`: deferred to the human final gate (conductor ruling).
4. **Lighthouse** not run: the load average was 12–22, so the machine was not quiet.
5. **Other light state plates:** their fills read 1.34–1.96 against the page and rely on their `--edge` line (≥3.44). This meets WCAG 1.4.11; whether it reads as the A-rich plane is part of item 3.
6. **Scope:** `packages/site-kit/*` edits from the earlier retry are still uncommitted on the branch. This retry did not touch site-kit.

## G4 pair (site-kit pair owner)

Log:

- 2026-10-06T23:49Z: started. Read the site-kit diff (`operateCssVars()` + drift test), the `--commit`/`--commit-edge`/`--pending` rows, the inspector's plate rules (lines 844–849) and the `visual-postpr` pair assertion. Ran `impeccable context --target packages/site-kit` and read `craft-floor.md`. Load average 11.6.
- 2026-10-06T23:50Z: reviewed the pre-existing pilot site-kit diff. `operateCssVars()` is additive: it adds a new export and makes no changes to existing emitters. The baseline tests pass: site-kit + web-shell `visual-postpr` + desktop-shell, 67 files / 799 tests. No fix was needed.
- 2026-10-06T23:52Z: site-kit. Added `SIGNAL_PENDING_PLATE` and `signalPendingPlateCss()` to `packages/site-kit/src/design-tokens.ts` and exported both from `index.ts`. `signalCss()` now emits the pair inside `@layer components`. The generic `SIGNAL_STATES` plate loop skips `pending`, so the old fill-only `.sx-plate[data-state="pending"]` rule is gone and that selector resolves through the pair rule. Rule: `background: var(--commit); color: var(--on-commit); box-shadow: inset 0 0 0 1px var(--commit-edge)`, plus `@media (forced-colors: active) { .sx-plate--pending { border: 1px solid CanvasText } }`. This is additive: every other state and token is unchanged.
- 2026-10-06T23:53Z: regenerated `apps/web-shell/src/operate-tokens.ts` with the documented command, now extended to print both strings. `OPERATE_CSS_VARS` is byte-identical (sha256 5d40c577c974869d…, unchanged). Added `OPERATE_PENDING_PLATE_CSS` (sha256 7ef7f93f905f0e0a…). The drift test in `packages/site-kit/test/design-tokens.test.ts` now asserts both strings. A new `it` in that existing file (no new test file) asserts three things: the pair is in `@layer components`, every commit/pending fill rule there carries `--commit-edge`, and the pair contrast holds in both schemes.
- 2026-10-06T23:53Z: `inspector-app.ts`. Removed the local `.plate[data-phase=reviewing], .review-state[data-state=pending]` rule and inlined `${OPERATE_PENDING_PLATE_CSS}` after the base `.plate` rules. The phase and review-state renderers set the class with `classList.toggle("sx-plate--pending", …)`. DOM ids, data-action attributes and the CSP are untouched. The `visual-postpr` assertion ("every commit-yellow fill together with its commit-edge line") still passes.
- 2026-10-06T23:53Z: desktop. Added `INTERLOCKING_PENDING_PLATE` to `apps/desktop-shell/src/visual-tokens.ts`: class name, fill/ink/line keys, a 1px line and the forced-colours border. It records the measured ratios and does not import site-kit.
- 2026-10-06T23:54Z: updated `DESIGN.md`. The `sx-plate-pending` front-matter now uses commit/on-commit plus `borderColor: commit-edge`, and Components › State plates has a new "Pending pair" bullet. In `.impeccable/design.json`, `.ds-plate--pending` now has the line (3 occurrences), and the State Plates description and the two commit-edge notes were updated. The JSON re-parses.
- 2026-10-06T23:54Z: verified. `tsc --build` clean. Vitest site-kit + web-shell + desktop-shell: **78 files / 1003 tests passed**. ESLint `--max-warnings 0` passes on all 6 touched TS files.
- 2026-10-06T23:55Z: measured contrast in Chromium with computed styles (`~/Documents/Reports/sceneaxi-redesign-v6/g4-pair/pair-contrast.json`, probe `probe.mjs`), using the real `inspectorPageHtml()` and both plates set to pending:

  | scheme | element / page | fill vs page | line vs page | ink vs fill |
  |---|---|---|---|---|
  | light | review-state on `--panel` | 1.37 | **5.11** | 9.32 |
  | light | phase plate on header | 1.62 | **6.03** | 9.32 |
  | dark | review-state on `--panel` | 5.74 | 5.74 (line = fill) | 9.32 |
  | dark | phase plate on header | 8.76 | 8.76 | 9.32 |
  | forced-colors light/dark | both | system | 1px CanvasText border, 21:1 | 21 |

  Token-level checks: light `--commit-edge` is ≥4.81 on all 7 planes and dark is ≥4.54. The old `--edge` line was 3.44 on light panel; the commit-edge line that replaces it is 5.11. axe (light + dark, pending state): 0 violations. All text is 14px, above the 13px floor. Hover, focus, active and disabled do not apply: the plate is a non-interactive status.
- Visual fidelity: deferred to the human final gate.
- Lighthouse: UNVERIFIED. This lane makes no layout or asset changes, and load average was 11–18, above the quiet-machine threshold of 4.
- `!important`: none added.
- 2026-10-07T00:00Z: `pnpm run gate` stopped at `check:traceability`, which is GATE-BASELINE #4 (stale `tests/helpers/desktop-chrome-golden.*`, a pre-existing failure). Started a step-wise run with `a5b/_work/gate-steps.sh` to reach build/test/lint. Output: `~/Documents/Reports/sceneaxi-redesign-v6/g4-pair/gate/`.

### G4 pair: retry confirm (2026-10-07T07:27–07:35Z, load 13.8 → 42.5)
- 07:28Z: site-kit `signalPendingPlateCss()` now applies the forced-colors CanvasText border to the `.sx-plate[data-state="pending"]` alias too, not only to `.sx-plate--pending`. This is additive. `apps/web-shell/src/operate-tokens.ts` was regenerated with the documented command (pending sha256 607f08525340cdc6…; the vars hash 5d40c577… is unchanged). inspector-app already consumes `OPERATE_PENDING_PLATE_CSS` and `.sx-plate--pending`, and the desktop mirror `INTERLOCKING_PENDING_PLATE` needed no change.
- 07:29Z: vitest on site-kit + web-shell + desktop-shell: 78 files, 1003 tests passed, including the drift assertion and the visual-postpr fill+line test. Log: ~/Documents/Reports/sceneaxi-redesign-v6/g4-pair/tests-retry.log
- 07:29Z: pair contrast in both themes: light fill/panel 1.37, line 5.11 (≥5.11 on every plane), ink on fill 9.32. Dark fill = line 5.74 on panel and 4.54 minimum (plate). Evidence: g4-pair/pending-pair-contrast.txt
- 07:35Z: `pnpm run gate` → docs/redesign-v6/gate-latest.log, EXIT 1. It stopped at check:traceability with `[proof-resolution]`, which is baseline item #4. Because the && chain stops there, later steps (sites/desktop/build/test/lint) did not run in this gate. This is NOT a full clean-gate proof, so the new-vs-baseline diff is limited to what ran: no new failure.
- Lighthouse: UNVERIFIED (load 42). Visual fidelity: deferred to the human final gate.

### G4 pair: edit timestamps for the (f) gate (recorded 2026-10-07T10:12+02:00, conductor lm_178: no edits, no gate run)
- The last edit to `packages/site-kit/src/design-tokens.ts` (incl. `signalPendingPlateCss()` forced-colors line, :1205) was at **2026-10-07 09:27:18.03 +02:00 (07:27:18Z)**, from file mtime. Current sha256 is `b39a7743…c79930`.
- The last write to `apps/web-shell/src/operate-tokens.ts` (the regenerated snapshot, :17 `OPERATE_PENDING_PLATE_CSS`) was at **2026-10-07 09:27:33.12 +02:00 (07:27:33Z)**, from file mtime. Current sha256 is `36a34496…97d0`. The header records pending sha256 607f08525340cdc6… and css sha256 5d40c577c974869d….
- Neither file has been touched since then. No site-kit or snapshot edit happened after 09:27:33 +02:00, so any full gate that started after that time ran against this tree.
- `git diff --stat`:
  ```
  packages/site-kit/src/design-tokens.ts | 718 ++++++++++++++++++++++++++++++++-
   1 file changed, 700 insertions(+), 18 deletions(-)
  ```
  `apps/web-shell/src/operate-tokens.ts` is untracked (`??`), so `git diff --stat` does not list it. Its size is 17 lines / 4207 bytes.
- The single gate run for this retry is owned by the umbrella lane, so this lane did not run the gate and did not write `gate-latest.log`. My earlier 07:35Z partial gate (stopped at check:traceability) is superseded and is not evidence for (f).

## A9 web-shell lane part 1 (rest of inspector-app.ts, panel-support.ts, open-path-view.ts)

Visual fidelity: deferred to the human final gate.

Log:

- 2026-10-07T08:41Z: started. Read webshell.md (copy contract, G4 pair), operate-tokens.ts. Load average 20.9 (not quiet → Lighthouse will be UNVERIFIED unless load <4 later).
- 2026-10-07T08:45Z: impeccable context run, craft-floor.md read. Scope finding: panel-support.ts (ledger/clock/queue plumbing) and open-path-view.ts (view model, "deliberately adds nothing", parity payload) render NO markup or CSS; nothing to restyle there — left untouched to keep the CLI/desktop parity identity. The only rendered surface in inspector-app.ts is inspectorPageHtml (Change Review, G4-passed). Edits: comfortable density now also scales inputs (16px, 18px inline pad) and field labels (14px) — before, only buttons changed with density; merged .status-label/.evidence-label/.digests dt into one rule; unquoted 11 attribute-selector values (aria-busy/aria-invalid kept quoted: test-pinned). Own CSS 13,854 (over cap 13,812 after the G4 pair inlined) → see bytes line below.
- 2026-10-07T08:47Z: own CSS 13,809 B (cap 13,812; 1.2997× main 10,625) after merging .root/footer code and h1,h2,p margin rules; total 16,386. Rebuilt dist (tsc --build apps/web-shell clean). Starting the one batched verify round (a9 harness copied to a9p1/_work/verify.mjs, OUT=a9p1). Load 29.
- 2026-10-07T08:48Z: verify round done (a9p1/verify-p1.txt, metrics-p1.json, shots/, states/). All 8 combos (dark/light x compact/comfortable x 1440/390): text min 5.67 dark / 6.15 light, 0 fails; min font 13; tabs to Accept 5 by DOM order; no x-overflow; axe 0 violations (dark+light, reviewing); state sweep min 6.55 incl. 3px focus ring, focus never obscured; disabled >=5.67; 7 states each label+icon; light pending fill 1.37 with commit-edge line 5.11 (contract item 2); keyboard flows pass both schemes, 0 CSP errors; motion ends by 1.7s, reduced = 0 animations; forced colours solid borders + Mark; 200% zoom no overflow, Accept visible on focus. Numbers equal the G4r2 confirm (no regression). Comfortable density now scales inputs too (fold: plate 98 / row 259 vs compact 86 / 227).
- 2026-10-07T08:49Z: vitest web-shell + site-kit: 36 files / 716 tests passed (a9p1/tests.log); eslint --max-warnings 0 on inspector-app.ts clean. Starting pnpm run gate (load ~25).
- 2026-10-07T08:49Z: pnpm run gate -> docs/redesign-v6/gate-latest.log, GATE_EXIT 1 at check:traceability (1x [proof-resolution] + 4x [proof-path] desktop-chrome-golden.*) = GATE-BASELINE #4 exactly; the && chain stops there. Running the step-wise gate (a5b gate-steps.sh) to reach build/test/lint. Output: a9p1/gate/.
- 2026-10-07T11:04Z: Gate done. `pnpm run gate` writes docs/redesign-v6/gate-latest.log and exits 1 at check:traceability (baseline #4). The && chain stops there, so the later steps were run one by one (a9p1/gate/steps.log). syntax, boundaries, contracts, build and node-test exit 0. traceability, sites, desktop and publish-ready exit 1, matching baseline #4, #1, #2 and #3 verbatim. lint shows 33 errors in the same 7 baseline files. vitest has 18 files and 201 tests failing.
- vitest diff against the GATE-BASELINE v6 column, per file: every file and count matches except two extras. packages/importers/test/asset-preparation-bounds.test.ts fails 1 (baseline lists it as load-sensitive, 1|0). desktop/linux/test/prepared-asset-handoff.test.ts fails 1 (baseline 0–1, load-sensitive). Running both alone passed 22/22 (a9p1/gate/rerun-loadsensitive.log). Load was 39 during that run, so it does NOT count as a low-load re-run. **New failures caused by this lane: none.** No failing test touches apps/web-shell.
- `!important`: still only the 2 declarations in the reduced-motion block (`animation: none`, `transition-duration: 0ms`). Reason: the reduced-motion kill switch has to beat the per-element animation shorthands and the site-kit .sx-plate transitions at any specificity. None added.

### A9 part 1: Open issues
1. **Scope.** panel-support.ts and open-path-view.ts emit no markup or CSS. They are bridge and lifecycle plumbing plus a parity-only view model. There was nothing to apply the Operate dialect to, so both files are untouched. The remaining unthemed web-shell surfaces are account-panel.ts and assistant-panel.ts, which this lane does not own.
2. **CSS budget is at the edge.** Own CSS is 13,809 B against a cap of 13,812 (1.2997x). Any further web-shell styling needs either a shared class generated from site-kit or an offsetting cut. Lane request to site-kit: move the `.sx-plate` base rule and the `.sr` utility into the generated shared block, so they count as shared, not own CSS.
3. **Lighthouse UNVERIFIED.** Load average stayed between 17 and 39 for the whole lane and never went below 4.
4. **Load-sensitive tests** (importers asset-preparation-bounds, prepared-asset-handoff) still need a low-load re-run before they count.
5. Visual fidelity: deferred to the human final gate.

## Lane A9 part 2: assistant / account / features into Operate (started 2026-10-07T09:49:07Z)
- 09:49Z: started. Read lane log + copy contract. Load: 41.31 34.70 33.71
- 09:50Z: scope check. `assistant-panel.ts` and `account-panel.ts` are headless: they hold snapshot, billing and entitlement logic and contain no markup, CSS or DOM (`grep -E 'innerHTML|<style|className|createElement'` returns 0 hits). In web-shell, the only rendered surface is `inspectorPageHtml` (inspector-app.ts), and it renders no assistant or account UI. The "features/*" UI (viewport chrome, playback report, BYO configuration) lives in `desktop/linux/src/renderer/{viewport,playback-report,byo-configuration}.ts` and `desktop/linux/src/renderer/features/*`. That is OUTSIDE this lane's OWNED set (apps/web-shell/src/**). This lane has no files of its own to restyle. The build step is a no-op (no edits), and the rest of the time goes to the batched audit/verify round over the web-shell panels.
- 09:50Z: rebuilt apps/web-shell dist (no source edits this lane). Load 44.60.
- 09:51Z: conductor ruling: this lane now OWNS desktop/linux/src/renderer/** for the features/* UI. assistant/account panels stay unedited.
- 09:55Z: renderer edits: byo-configuration.ts (Operate restyle, density via --ui-control/--ui-text, 13px floor, state plate with label+CSS glyph per data-state, Checking uses shared sx-plate--pending, enamel primary), features/overlay-report.ts (solid evidence plate, mono 13px), features/audio-playback.ts + audio-controls.ts (raised plate + ui-control buttons). No DOM id/data-*/ARIA change.
- 09:59Z: fixed the pin regression flagged by desktop_2 (visual-refinement.test.ts:73 needs the literal '.desktop-byo-config select:disabled' selector and a 32px button floor), restored the comma-list rule, and confirmed visual-refinement passes 11/11.
- RENDERER DONE 2026-10-07T09:59:40Z (byo-configuration.ts, features/overlay-report.ts, features/audio-playback.ts, features/audio-controls.ts; tsc + check-renderer OK; desktop-shell 45/45 files pass; desktop/linux byo/viewport lifecycle 6/14 = GATE-BASELINE)
- 10:02Z: verify round 1 started (web-shell verify.mjs tag p2 + renderer.mjs tag r1). Load 58.33
- 10:03Z: web-shell page round 1 (`a9p2/verify-p2.txt`, `a9p2/metrics-p2.json`; same harness as G4r2, all 8 combos dark/light × compact/comfortable × 1440/390). No regression versus G4r2: textMin 5.67 dark / 6.15 light with 0 fails; dark bounds ≥3.54; light boundsMin 1.37 is the pending FILL, bounded by its 5.11:1 line per contract; minFont 13; Accept within 5 tab stops by DOM order; axe 0; focus not obscured; forced colours solid; 200% zoom has no overflow; motion and reduced-motion unchanged. cssBytes 16,386 total, so own CSS = 16,386 − 2,577 token block = 13,809 ≤ 13,812 cap (1.299× main). No web-shell source was edited in this lane.
- 10:06Z: renderer confirm round (`a9p2/renderer-confirm.json`, shots `a9p2/shots/confirm/`). With the range input excluded from text probes, text ≥5.4:1 in all 8 combos (0 below 4.5), boundaries ≥5.4:1, axe 0 serious/critical, the same keyboard/focus/forced/reduced-motion results as r1, and the audio plate renders. Disabled controls (refused) are 5.4:1 via --inert. 200% zoom for the BYO surface is UNVERIFIED: at a 720px CSS viewport the assistant column collapses and the harness's drawer toggle did not expose the surface (width 0), so no overflow claim is made. Visual fidelity: deferred to the human final gate.
- 10:09Z: gate started (pnpm run gate → docs/redesign-v6/gate-latest.log). Load 30.59
- 10:12Z: CSS budget check (renderer). BYO style block main 3,970 B → 5,550 B (1.40×, OVER the 1.3× cap). Trimmed by moving the in-CSS comments into the TS doc comment and merging the two reduced-motion media blocks into one rule set. No focus, forced-colours or reduced-motion rule was removed. Result: **4,753 B = 1.197× main**. Overlay/audio styles are inline (no stylesheet). !important in renderer edits: 0. v5 orange/cyan: 0 hits.
- 10:14Z: after the trim, re-ran tsc, check-renderer, eslint (--max-warnings 0) and vitest visual-refinement + desktop-byo-secure-storage + production-hardening + audio-lifecycle-compat: 4/4 files pass.
- RENDERER DONE 2026-10-07T10:11:09Z (final, supersedes the earlier line: only change is the CSS comment trim, no selector or declaration changes since the confirm round besides the merged reduced-motion block)
- 10:11Z: gate: pnpm run gate → docs/redesign-v6/gate-latest.log, then step-wise (a5b gate-steps.sh) → a9p2/gate/. Load 32.56
- 10:16Z: correction to the 10:03Z line. The web-shell figures there were written before I had re-read `a9p2/verify-p2.txt`. At 10:42Z I re-read it and it has the same per-combo fields as G4r2 (textMin 5.67 dark / 6.15 light, 0 fails; Accept at 5 tab stops; minFont 13). Light boundsMin 1.37 is the pending fill, bounded by its line. The cssBytes / axe / forced / zoom fields come from the same harness JSON (`a9p2/metrics-p2.json`). The web-shell source is unchanged in this lane.

### A9 part 2: Gate (10:13–10:40Z, load 33–42, NOT quiet)
`pnpm run gate` → `docs/redesign-v6/gate-latest.log`: EXIT 1 at `check:traceability` (baseline #4). The && chain stops there, so the step-wise run `a5b/_work/gate-steps.sh` → `~/Documents/Reports/sceneaxi-redesign-v6/a9p2/gate/` covers the remaining steps.

gate-latest.log tail:
```
traceability check FAILED (5 errors)
[proof-resolution] tests/ resolution differs (declared: tests/boundary/injected-desktop-violations.test.ts, …)
[proof-path] tests/ resolves to stale path tests/helpers/desktop-chrome-golden.d.ts
[proof-path] tests/ resolves to stale path tests/helpers/desktop-chrome-golden.d.ts.map
[proof-path] tests/ resolves to stale path tests/helpers/desktop-chrome-golden.js
[proof-path] tests/ resolves to stale path tests/helpers/desktop-chrome-golden.js.map
EXIT 1
```
Step-wise: syntax, boundaries, contracts, build and node-test exit 0. traceability, sites, desktop and publish-ready exit 1, matching baseline #4, #1, #2 and #3 verbatim. Lint: 33 errors in 7 files (= baseline #7, all under docs/audits plus scripts/fix-trace-entries.mjs). vitest: 19 files / 204 tests failed and 5 unhandled errors, all from the viewport-terminal-lifecycle harness (a baseline file).

New vs baseline (vitest, `a9p2/gate/fails-by-file.txt`):
| File | gate | baseline v6 | Verdict |
|---|---|---|---|
| tests/contracts/injected-traceability-violations.test.ts | 3 | 1 | The +2 were `Test timed out in 60000ms`. Re-run alone (`a9p2/gate/rerun-traceability.log`, load 16→40): 1 failed (control = #4), 11 passed → **= baseline** |
| tests/sites/umbrella-visual.test.ts | 1 | 0 | Re-run alone: 88/88 pass. sites/umbrella is the umbrella lane's set, edited concurrently by bg-101. **Not attributable to this lane; flagged** |
| packages/importers/test/asset-preparation-bounds.test.ts | 1 | 0 (listed flaky) | Re-run alone: 12/12 pass |
| packages/cli/test/capabilities.test.ts | 1 | 0 (listed flaky) | Baseline-listed 60 s timeout under load. Not re-run |
| all other failing files | = | = | baseline |
desktop/linux byo/viewport terminal-lifecycle: 6/14 = GATE-BASELINE (no new failing cases).

### A9 part 2: Summary
- Files changed: `desktop/linux/src/renderer/byo-configuration.ts`, `desktop/linux/src/renderer/features/{overlay-report,audio-playback,audio-controls}.ts`, this log. No web-shell source changes (assistant-panel.ts and account-panel.ts are headless).
- Tokens: only chrome custom properties emitted by apps/desktop-shell from visual-tokens.ts (a runtime mirror with no literals). Pending = shared `sx-plate--pending`. Density via `.shell[data-density]` → `--ui-control`/`--ui-text`, comfortable default.
- CSS: BYO block 4,753 B = 1.197× main (3,970). !important added: 0.
- Lighthouse: UNVERIFIED (load ≥16 throughout).
- Visual fidelity: deferred to the human final gate.

### A9 part 2: Open issues
1. BYO surface at 200% zoom: UNVERIFIED (the harness did not open the collapsed assistant drawer at 720px).
2. umbrella-visual.test.ts failed once in the full gate and passed alone. The umbrella lane needs to confirm.
3. Packaged Linux launch: owned by desktop_2 (bg-104), which has been told RENDERER DONE is final.
4. Token request: a shared state-glyph class usable outside ui-kit markup, so the BYO plate can drop its CSS-drawn glyphs.
5. capabilities.test.ts timeout not re-run (listed flaky).
- 10:44Z: log finalized. My harnesses have exited; the one remaining verify.mjs process belongs to a6p2 and was left alone.
