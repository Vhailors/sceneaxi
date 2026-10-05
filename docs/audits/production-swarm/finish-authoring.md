# Authoring final local acceptance

All nine assigned rows: **DONE_IMPLEMENTED_VERIFIED**. Real root `/home/devuser/Documents/Projects/sceneaxi`; inherited uncommitted fixes preserved. These are local acceptance closures, not native macOS/Windows, provider, held-proof, hardware or production-launch certification.

`T` = `packages/authoring-core/test/final-acceptance.test.ts`; `J` = `packages/authoring-core/src/apply-journal.ts`; `P` = `packages/authoring-core/src/propose-apply.ts`. Files listed are this retry's edits, not attribution of inherited implementation.

id | final status | files touched | proof (test names + counts)
--- | --- | --- | ---
AUTHORING-001 | DONE_IMPLEMENTED_VERIFIED | T | “names proposal/direct/multi refusal” (4); “rechecks canonical containment” (1); existing persisted escaping-apply and real CLI containment oracles pass. `validation-failed`, unchanged victim bytes.
AUTHORING-002 | DONE_IMPLEMENTED_VERIFIED | T, J, P | “names … recovery refusal” (9), “names apply refusal for redirected journal resource” (3), “refuses escaping … archives” (2), “refuses redirected … resource” (3): 17 pass. Archive resolution/empty-journal authority defects reproduced before repair; completion-sequence containment now retains `validation-failed` rather than generic `apply-failed`.
AUTHORING-003 | DONE_IMPLEMENTED_VERIFIED | T | “names invalid seed refusal” (3); “preserves exact valid noncanonical seed bytes, but refuses a valid mismatched document” (1): 4 pass, `PROJECT_MANIFEST_DIAGNOSTICS.malformed`, no invalid-seed artifacts.
AUTHORING-004 | DONE_IMPLEMENTED_VERIFIED | T, J, P | Independent final acceptance: 65 pass; fresh before-repair runs 32 pass/3 fail and 46 pass/1 fail, unchanged assertions pass after fixes.
AUTHORING-005 | DONE_IMPLEMENTED_VERIFIED | T | “recovers on Linux with procfs unavailable and never opens a procfs file” (1); existing “reads and recovers … without procfs” darwin/win32 branches (2): 3 pass. Actual native macOS/Windows execution is not claimed.
AUTHORING-006 | DONE_IMPLEMENTED_VERIFIED | T | “refuses an actual … creation collision” tmp/bak children (2); existing “isolates a pre-existing … artifact symlink” (2): 4 pass, victim bytes and hostile symlinks retained.
AUTHORING-007 | DONE_IMPLEMENTED_VERIFIED | T | “refuses digest-correct … image” (18: before/after × prepared/undoing/redoing × malformed/schema-invalid/major-invalid); existing malformed-after-image oracle (1): 19 pass, `journal-invalid`, scene/active bytes unchanged.
AUTHORING-REPAIR-CRASH-REGRESSION | DONE_IMPLEMENTED_VERIFIED | T | Existing “recovers a genuinely abruptly terminated apply with durable scratch files and stale locks” (1) passes against rebuilt artifacts: child exit91, prepared journal and orphan scratch proven, actual CLI recovers exact after-image, active null, locks cleared. New exclusive-collision children (2) also pass.
COVERAGE-AUTHORING | DONE_IMPLEMENTED_VERIFIED | T, J, P | Package: 10 files/242 pass. CLI lifecycle/CLI golden/editor transaction suites: 3 files/31 pass. Additional real built CLI project front doors: 9 positive + 9 UNKNOWN_FLAG tests (20 actual invocations), all shipped verbs; existing real containment/abrupt-crash front doors also pass. Total focused: 273 pass, zero failures/skips.

## Implementation and red-to-green evidence

- J: archive transaction resolution checks every canonical document path; recovery and transaction resolution validate the authoring-operation resource before empty-journal returns.
- P: journal preparation propagates containment errors to the existing public typed `validation-failed` boundary while preserving generic storage-error handling.
- T: 65 independent public-package/fresh-process cases; no disabled checks or weakened existing assertions.
- First fresh run (35 tests): 32 passed, three failed (`expected ok:false`, received `ok:true`) for completed/undone archive resolution and redirected empty-journal operation authority. After J repair: 35 passed.
- Expanded fresh run (47 tests): 46 passed, one failed (completion-sequence expected `validation-failed`, received `apply-failed`). After P repair: 47 passed; CLI front-door expansion: 65 passed.
- Earlier implementation failing-before receipts remain in `fix-authoring.json:104-107`: containment/seed 13 failures, predictable scratch two failures, invalid recovery image one failure, abrupt crash recovery one failure. Those historical runs were not rerun or attributed to this retry.

## Latest executed verification

All commands ran in the real root and exited 0: `pnpm -s build`; `pnpm exec vitest run packages/authoring-core/test --reporter=dot` (242/10); `pnpm exec vitest run packages/cli/test/project-lifecycle.test.ts tests/e2e/cli-golden-path.test.ts tests/e2e/full-editor-transactions-golden.test.ts --reporter=dot` (31/3); `pnpm exec eslint packages/authoring-core --max-warnings 0`; `pnpm -s check:boundaries` (27 packages); `pnpm -s check:contracts`; owned `git diff --check`. No full repository gate rerun is claimed. No shared-file implementation request remains for these local rows; native-host and full-production assurance remain separate gates.
