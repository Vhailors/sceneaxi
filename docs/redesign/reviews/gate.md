# Repo gate review (independent)

Reviewer: independent gate reviewer. Date: 2026-10-05.
Inputs: E/gate-after.log (written 12:05, after the last tracked change in R at 11:22) and E/backup/gate-baseline.log (main dffefbab).
Method: I split both logs by `=== STAGE`, removed ANSI codes and diffed each stage. For the test stage I diffed the sorted `FAIL` lists, the first error line of each failure and the per-file test counts. I then reran the one differing test myself.

## Result

| Stage | baseline | after | difference |
|---|---|---|---|
| check:syntax | 0 | 0 | 465 -> 467 files (new `form-busy.tsx` and similar), OK |
| check:boundaries | 1 | 1 | identical (umbrella `api/health/route.ts` -> identity-plane) |
| check:contracts | 0 | 0 | identical |
| check:traceability | 1 | 1 | identical (5 errors) |
| check:sites | 1 | 1 | identical |
| check:desktop | 1 | 1 | identical |
| check:publish-ready | 1 | 1 | identical |
| build | 0 | 0 | identical |
| test | 1 | 1 | 20 files / 212 tests failed in both; 1 swap, see below |
| lint | 1 | 1 | byte-identical, 33 errors |
| gate-script exit | 1 | 1 | |

## New failures

None caused by the redesign.

Only one failure appears in after but not in baseline:
- `packages/importers/test/asset-preparation-bounds.test.ts:158` (stage test): heartbeat gap 136.8ms > 100ms.
  - In the baseline, the matching heartbeat test failed instead: `desktop/linux/test/prepared-asset-handoff.test.ts:191`, 139.0ms > 100ms. That test passes in after.
  - Both are timing tests that fail under load in the full parallel suite.
  - `git diff dffefbab -- packages/importers tests` is empty. The test imports only `@sceneaxi/importers`, `authoring-core`, `schemas` and node built-ins. None of these is touched by the redesign.
  - I reran both files together 3 times with a short TMPDIR: 22/22 passed each time.

## Pre-existing failures (identical first error line in both logs)

- Stages boundaries, traceability, sites, desktop and publish-ready fail with the same output.
- Test stage: these all fail with the same assertion messages (socket paths differ only by TMPDIR name):
  - `tests/sites/identity-plane-wiring`, `provider-adapters`, `site-seams` (hermetic workspace)
  - `tests/e2e/desktop-command-interactions-golden` (100)
  - `desktop-chrome-frame`, `palette` and `inspector` command-interactions goldens
  - `desktop-cli-local-bridge-golden`
  - `desktop/linux/test/local-rpc` (listen EINVAL), `viewport-terminal-lifecycle` (14), `byo-terminal-lifecycle` (6, "missing actual BYOK controls", the same in the baseline)
  - `tests/desktop/desktop-linux-seams`
  - `tests/publish/injected-publish-violations` (50)
  - `tests/boundary/injected-{desktop,site,}violations`, `kids-evidence-scan`
  - `tests/docs/traceability-check`, `tests/contracts/injected-traceability-violations`
- Lint: 6 production-swarm scratch files (R-5) plus `scripts/fix-trace-entries.mjs:19`. All are identical in the baseline.

## Other observations

- Test counts grew by 5 (`catalog-storefronts` 84 -> 85, `site-seams` 321 -> 325). No test file changed, so these are parametrized cases picked up from the redesigned files, and they all pass.
- `pnpm-lock.yaml` and `sites/kids/pnpm-lock.yaml` have no diff against main.

## Fixes

1. (advisory) The heartbeat timing tests (`asset-preparation-bounds.test.ts:158`, `prepared-asset-handoff.test.ts:191`) flip under full-suite load on main and on the redesign alike. This is outside the redesign scope. Do not change it in this run.

VERDICT: PASS
