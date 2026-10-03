# Chrome regression repair

SOURCE_VERIFIED (focused source only; not full merge/gate certification).

Root: `/tmp/sceneaxi-comprehensive-owned-xd4gdfl1`. Original shared/foreign roots were not edited. Early IN_PROGRESS report preceded edits.

## Repairs
- `apps/desktop-shell/src/chrome/core/script.ts`: rootless business profile switching no longer fails the audio-root fence. Audio confirmation still requires a non-null bound root and matching generation/root/profile. Audio invalidation dispatch is not skipped.
- `apps/desktop-shell/test/helpers/desktop-chrome-golden.ts`: real DOM event realm, exact startup request transcript asserted separately from business calls; synchronous audio fences and profile confirmation asserted. Only the exact validated initialization calls are consumed.
- `tests/e2e/desktop-command-interactions-golden.test.ts` and `desktop-product-loop-golden.test.ts`: explicit source helper import bypasses stale ignored emitted `.js`; per-open profile confirmation remains explicitly in whole-request transcripts. Added bound/rootless/refused profile audio oracles. Original inert Undo/recovery/Kids/unavailable/Shift, content-hash conflict, Web asset-path, open/save/play, and queued-selection assertions retained.
- `tests/e2e/desktop-linux-bridge-golden.test.ts`: VM receives real Happy DOM Event/CustomEvent constructors and real DOM dispatch, not a fake constructor or disabled audio invalidation. Profile initialization is checked separately from authoring reads. Event records preserve the exact public type/detail envelope.
- `apps/desktop-shell/test/chrome-frame.test.ts`: actual DOM legend tabindex assertion replaces a regex that incorrectly spans CSS; bounded scroll/help assertions remain.

## Verification
- `before.log`: focused old suites reproduced 11 failures / 174 passing tests plus 2 unhandled CustomEvent errors. Actual gate baseline had 22 failures, including separately owned bridge/root/engine/importer cases.
- `after-5.log`: original 5-file focused set, 185 tests passed, zero unhandled errors.
- `focused-final.log`: 10 files / 232 tests passed, including 3 new profile/audio oracles and keyboard geometry, minimum-window, legacy editor, hierarchy and control-inventory regressions.
- `lint.log`: ESLint all six edited files exited 0.
- Intermediate failures retained in `after-{1,2,3,4}.log`; initial precise edit retries did not complete all intended edits. Final assertions do not filter/drop business commands.

No install/full gate/build/browser/Docker/native/staging/commit/push. Typecheck and unrelated cases were not run by this worker. Exact source and evidence SHA-256 handback is in `report.json`.
