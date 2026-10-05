# Review: repository gate after the redesign

Reviewer: independent (I did not build the redesign). Date: 2026-10-05.
E = /home/devuser/Documents/Reports/sceneaxi-redesign.
This replaces the 04:32 version of this file. That version judged an older `gate-after.log`. The current `E/gate-after.log` was written at 05:19 (test run started 05:12:58).

Verdict: **PASS**. `gate-after.log` has no failure that the baseline lacks.

## What I ran myself

1. Read the last line of both logs. `E/gate-after.log` ends `exit=1`. `E/backup/gate-baseline.log` ends `exit=1`.
2. Diffed every `FAIL` line, `Error` line, `missing control` message and `❯ file:line` location in both logs, after stripping colours, durations and `[n/N]` counters. Outside the three timing tests, the only difference is two baseline `Test timed out` errors that are absent from gate-after.
3. Searched the repo for files newer than `gate-after.log`, skipping node_modules, .next, dist, out, target, .turbo and .git. There are none, so the log matches the current tree.
4. Ran `pnpm -s lint` myself with `TMPDIR=/home/devuser/.cache/sxg<pid>` and removed that directory afterwards. The gate chain is `… && build && test && lint`, so lint never runs inside the gate when test fails. Output: `E/lint-gate-reviewer3.txt` (exit 1).
5. Diffed per-file test counts between the two logs (see fix 2).
6. I did not re-run the full gate and started no servers.

## Stage results

| Stage | baseline | gate-after |
|---|---|---|
| syntax, boundaries, contracts, traceability, sites, desktop, publish-ready | OK | OK |
| build | passed (test was reached) | passed (test was reached) |
| test | 4 files / 19 of 4879 tests failed | 1 file / 16 of 4884 tests failed |
| lint | not reached | not reached. My separate run: 255 errors in 17 files, all R-5 |

## NEW failures

None.

## Pre-existing failures (do not count)

- **`tests/e2e/desktop-editor-command-forms-golden.test.ts`, 16 tests (test stage).** Each fails with `missing control [data-editor-command-…]` from the helper at line 72. Test names, error text and locations are identical to the baseline.
- **Baseline-only timing failures (hard rule 2).** These fail in the baseline and pass in gate-after:
  - `desktop/linux/test/prepared-asset-handoff.test.ts` (baseline: heartbeat gap 101.03 ms > 100).
  - `packages/cli/test/capabilities.test.ts` (baseline: 60 s timeout).
  - `packages/importers/test/asset-preparation-bounds.test.ts` (baseline: 60 s timeout).
- **Lint (R-5).** 255 errors in exactly 17 files, the same file list as `E/lint-gate-reviewer2.txt`: 15 under `docs/audits/production-swarm/**`, 2 under `apps/desktop-shell/test/visual-postpr-evidence/retry/**`. No other file reports a lint error.

## Fixes

1. (advisory) `/home/devuser/.cache/sceneaxi-gate-tmp` from an earlier run is still on disk, against hard rule 3. I did not create it, so I did not remove it.
2. (advisory) The test count rose from 4879 to 4884 with the same 313 files: `tests/sites/catalog-storefronts.test.ts` 82→83 and `tests/sites/site-seams.test.ts` 311→315. Both files are dated 2026-10-01, before the redesign, so the extra cases are data-driven from site content, not new unit tests.

VERDICT: PASS
