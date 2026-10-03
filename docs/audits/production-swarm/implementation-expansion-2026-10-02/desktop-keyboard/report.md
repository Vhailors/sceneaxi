# Desktop keyboard — SOURCE READY; rendered acceptance NOT RUN

## Confirmed gap and repair
Read AGENTS/layout, repair independent-review/ledger IR-06 (VD-03..05, VS-05), historical repair-pass3 failure and capacity keyboard report/harness/proposal. Current public renderer emitted no catalogue layout CSS: Mutation JSON labels remained inline, allowing native multiline textarea baseline paint to collide with Stage at the scroll edge. Historical pass3 records overlapping/clipped `effect-mutation` and occluded `effect-stage`; it remains **FAIL**. Current static reproduction is not a fresh browser geometry reproduction.

- `apps/desktop-shell/src/chrome.ts:1253-1262`, `styles`: inspector sections retain intrinsic height in the existing scroll container; catalogue controls occupy separate grid rows, labels contain block/full-width vertically resizable textareas; long reports wrap without expanding the inspector. Uses existing spacing tokens. No focus stops, actions, host authority or refusal behavior changed.
- `apps/desktop-shell/test/keyboard-geometry.test.ts:18`: permanent public-render rules at 900/1100/1280, unique nonblank inert descriptions/no native disabled, real outcome markup, executable hostile browser-observation oracle.
- `apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs:10`: strict finite/nonzero visible focus oracle; :18 diagnostic oracle refuses blank/missing/zero/occluded refusal evidence; :25 real diagnostic geometry. Browser extension requires actual bidirectional effect stops at 900×600, 1100×800, 1280×900, plus forced colors, and enters real project-open refusal using Tab/Enter. Refusal code/message geometry and modal dismissal remain required. Failed partial rows persist in finally; contexts/browser/owned fixture are cleaned. Current source/model bundle, resolved workspace runtime files, HTML and PNG hashes bind receipts. `--keyboard-only` selects the new acceptance scenarios.
- `visual-tokens.ts` unchanged. No dependencies, public exports, shared wiring, manifests, main, web-shell or existing visual-refinement tests changed. Export requests: **none**.

## Fail before / pass after
Corrected prechange permanent oracle: **3 pass / 5 fail**, with `Missing layout rule .scene-catalog-editor: expected -1 to be greater than or equal to 0` at all three sizes; driver oracle/traversal support absent (`fail-before.log`). Initial test author's nested-description/dismissal-selector assumptions were corrected to actual markup before product editing, not used as purported product defects.

After repair: `pnpm exec vitest run apps/desktop-shell/test/keyboard-geometry.test.ts apps/desktop-shell/test/visual-refinement.test.ts apps/desktop-shell/test/chrome.test.ts --reporter=dot` → **3 files / 84 pass**, exit 0 (`pass-after.log`). Browser-free `--oracle-self-test`: **1 positive + 12 rejected focus observations; 1 positive + 4 rejected diagnostics**. `node --check capture.mjs`, touched TypeScript ESLint, scoped `git diff --check`: exit 0. Exact pre/post SHA-256 values and log hashes are in `report.json` / `prechange-hashes.json`.

## Execution correction and cleanup
The first focused test invocation timed out at 20s. It mistakenly passed unsupported `--oracle-self-test` to the old unguarded capture driver, causing an **unintended partial prechange browser launch**. Two empty-scenario PNGs prove that attempt; preserved as `unintended-before-empty*.png`, explicitly **not acceptance**, removed from retry/. No matching browser/capture process or temporary `sceneaxi-visual-*` directory remains. New tests preflight selftest support; the driver's selftest branch now executes before browser/dependency/build setup. No successful new-layout browser execution is claimed.

## Serial acceptance / source handback
**All three edited paths and unchanged token path handed back; no further source writes by this worker.** Parent/bg-109 exclusively owns rebuilding/frozen-candidate/fullgate/native/browser acceptance. Current new-layout browser, fullbuild/fullgate/typecheck/native/site execution: **NOT RUN**. Static green cannot certify clipping/occlusion, so IR-06 is **NOT READY for closure**.

After all child handbacks and serial workspace rebuild, with the existing desktop esbuild, umbrella Playwright and installed Chromium1223, run from `/home/devuser/Documents/Projects/sceneaxi`:

```sh
node apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs expansion-desktop-keyboard --keyboard-only
```

This must produce nonempty wrapped bidirectional cycles, finite nonzero unclipped/unoccluded effect targets, preserved inert explanations/no activation, nonblank visible actual refusal diagnostics and genuine dismissal. Do not promote the old failed pass or accept a blank/minimum-refusal screen as an admitted editor success.
