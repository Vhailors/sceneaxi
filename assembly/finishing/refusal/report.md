# Minimum-window refusal — focused handback

Status: DONE_IMPLEMENTED_VERIFIED_FOCUSED; production/native/browser assurance not assessed.

Owned checkout: `/tmp/sceneaxi-comprehensive-owned-xd4gdfl1`. Read child EARLY.json, chrome-delta-resolutions.json and continuation-refinements.log (64 pass / 1 fail).

## Exact retained failure

Reproduced original `control-accounting.test.ts:530`: `expected 'none' to be 'block'`, exit 1; `before.log`. Assertion text remains unchanged (now line 531). Late private `.window-refusal{display:none}` was overriding the minimum-media `display:block`. Fixed actual cascade; no blank refusal relabel.

## Source changes

- `core/styles.ts`: strengthened minimum-media selector against late base-rule overrides; runtime refused-state visibility; bounded scrolling preserved.
- `core/script.ts`: explicitly mirrors refusal hidden/data-window state before focus; captures refusal focus before hiding so browser blur cannot suppress opener return. Existing inertness, covered-UI dismissal, guarded commands and safe restoration preserved.
- `control-accounting.test.ts`: retained assertion unchanged; added actual emitted-CSS checks for both dimensions/all profiles/runtime-size mismatch/exact minimum and named refusal content.
- `minimum-window.test.ts`: five shipped-client DOM lifecycle tests retained; added real computed-display, hidden-state and data-window assertions on refusal and restoration.

## Focused verification

`./node_modules/.bin/vitest run apps/desktop-shell/test/control-accounting.test.ts apps/desktop-shell/test/minimum-window.test.ts apps/desktop-shell/test/visual-refinement.test.ts apps/desktop-shell/test/visual-model.test.ts apps/desktop-shell/test/legacy-editor-compat.test.ts --reporter=verbose` — exit 0; **5 files / 66 tests passed, 0 failed/skipped**. `retry-focused.log`. Existing keyboard F12/primary/undeclared-modifier negatives and synchronous audio invalidation/current approved-profile confirmation remain green.

Retry baseline: retained assertion already passed in the current owned checkout (19/19 focused tests) before these additional edits. Historical original failure above is preserved, not claimed as a new retry reproduction. Dedicated project test tool could not detect a command; direct installed Vitest used.

DOM emulator only: Happy DOM incorrectly ANDs comma queries and initializes listener history to false; test port supplies OR from its real single-term evaluator plus resize/history events. One trigger receives a layout port for restoration because emulator has no layout. This is not browser pixels/native audio coverage. Initial lifecycle run and intermediate emulator failures retained in logs. Root build/install/browser/native/packaging/typecheck/lint/full tests deliberately unrun. No excluded/shared-source writes or Git/index/publication operations.

## Exact final source SHA-256

- `apps/desktop-shell/src/chrome/core/script.ts` (115499 bytes): `dab3926500881a00b9699a5614ec6ff94fdea626d6f9ff343ba8a6d2cf4f8c05`
- `apps/desktop-shell/src/chrome/core/styles.ts` (44666 bytes): `c9ef0aca16b88f1816608e6948539f71b1b8357c276618596334cbb2edf628a8`
- `apps/desktop-shell/test/control-accounting.test.ts` (28035 bytes, unchanged in retry): `dc2733dea2fdb0fdd92beb8bca0aae28b46681326eba1a1e1c52e7a14ab333c9`
- `apps/desktop-shell/test/minimum-window.test.ts` (6307 bytes): `0f5b9d41b8d26682a4625f3906fb4ba5f5de69135bbf4c54ee27f5ae693b094d`

`handback.json` references these actual owned-checkout bytes; all four files released to parent after this report.
