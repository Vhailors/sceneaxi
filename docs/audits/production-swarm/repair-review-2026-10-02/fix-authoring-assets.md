# Authoring/assets repair — verified bounded retry, incomplete lane acceptance

**Lane status: NEEDS_LOCAL_FIX.** Local importer snapshot/cancellation oracles are DONE_VERIFIED; complete assigned acceptance is not. Published artifact and full-production acceptance remain unverified. No independent Astra PASS is claimed.

Actual root: `/home/devuser/Documents/Projects/sceneaxi`. HEAD: `4e532e2fbf43e9948741578ab6208a3277870405`, with inherited shared dirty work. Node `v24.21.0`, pnpm `9.15.0`. No staging, commit, push, publication, spending, provider/account/production database or deployment action performed.

## Changed files in this retry

- `packages/importers/src/index.ts`: read external source text once; validate the already admitted parsed snapshot instead of parsing/allocating a second document; count UTF-8 bytes without a full TextEncoder allocation. Add optional cooperative AbortSignal cancellation before source access, before/after proposal planning and immediately before atomic apply. Do not interrupt apply/rollback.
- `packages/importers/test/document-import.test.ts`: changing-accessor snapshot binding, live signal, pre-aborted propose/apply without reading source text, and planning-time cancellation with unchanged target bytes.
- `docs/audits/production-swarm/repair-review-2026-10-02/fix-authoring-assets.md` and `fix-authoring-assets.json`: retry receipts and explicit unresolved gates.

The Markdown companion was rewritten as this readable summary. Original detailed machine-readable task mappings, commands, per-assertion results, source hashes and shared requests are retained in `fix-authoring-assets.json`; only its new `retry` object represents this fresh run. Historical receipts are not transferred to the retry or published artifact.

## Fail-before/pass-after evidence

All commands below used the actual root above, with 120-second bounds.

| Command | Exit/result |
| --- | --- |
| `pnpm exec vitest run packages/importers/test/document-import.test.ts -t 'cancelled import' --reporter=verbose` | Before: exit 1, one failure; cancelled input incorrectly returned `ok:true`. Log: `/home/devuser/.local/share/rtk/tee/1790933928_vitest_run.log`. |
| `pnpm exec vitest run packages/importers/test/document-import.test.ts -t 'captures external source' --reporter=verbose` | Before: exit 1, one failure; changing accessor was read repeatedly, returning failure instead of accepting the original captured document. Log: `/home/devuser/.local/share/rtk/tee/1790934117_vitest_run.log`. |
| `pnpm exec vitest run packages/authoring-core/test packages/importers/test packages/plugin-host/test --reporter=dot` | After: exit 0, **340 passed, zero failed**. Current source package assertions, not rebuilt production GUI certification. |
| `pnpm exec eslint packages/importers/src/index.ts packages/importers/test/document-import.test.ts` | Exit 0, no issues. |
| `pnpm exec tsc -p packages/importers/tsconfig.json --noEmit --tsBuildInfoFile <owned-temporary-directory>/importers.tsbuildinfo` | Exit 0. Temporary directory/buildinfo removed; no emitted source output. |
| `git diff --check -- packages/importers/src/index.ts packages/importers/test/document-import.test.ts` | Exit 0. |

Tests preserve duplicate-member refusal, 8 MiB exact-byte admission/next-byte refusal, JSON value/depth ceilings, frozen review snapshots, escaped-root/symlink/rollback/seed validity and crash-recovery oracles. Deep-graph/shared-vertex/plugin byte-binding package regressions pass; no unnecessary rewrites were made to inherited repaired implementations. Tests clean up their owned temporary project directories.

**Important:** synchronous cancellation cannot interrupt parsing or an executing proposal. Spawned child tests may use existing dist. No root rebuild, immutable rebuilt-dist proof or actual packaged GUI measurement was performed by this retry.

## Exact SHA-256 receipts

| File | SHA-256 |
| --- | --- |
| `packages/importers/src/index.ts` | `16168577c7d8a1e14a55fcfa615e56e25875d9ff6d056c06f0b9eb5b16cdf508` |
| `packages/importers/test/document-import.test.ts` | `7a74d741281557921f1bc2c1bdecfd132010c798eca6a2ff8573634ab1d17d40` |
| `packages/authoring-core/src/unified-diff.ts` | `7e7129200b9f6536ad141a053d115f7234d25579dc6e765ef77a8c44b7476e9f` |
| `packages/plugin-host/src/pipeline.ts` | `7c18c8d577f42fb5845d2c32bee30e931a0a795e4b45191f1d6a0057433f6b93` |
| `packages/importers/src/contained-gltf.ts` | `a1dd9f305203851ca4141cdf066c8f08b356192689c055b057ea952c1e6cea1b` |

## Task mapping and exact remaining integration inputs

Detailed original row IDs and nonblank acceptance assertions remain in the JSON `tasks` array. Retry assertions support AP-04 and bounded AP-PERF/06-04/REQ-PROOF-AUTH-002 improvements, not complete closure of those broader requirements.

- **AP-PERF / 06-04 — NEEDS_LOCAL_FIX:** desktop owner must execute the actual packaged GUI admitted 8 MiB import/apply/reload with predeclared event-loop, RSS and latency budgets. Retain 16×8 MiB, count 17, next byte, alias and rollback negatives. A direct staging probe is not GUI acceptance. If profiling establishes blocking, offload owned adapter planning and cancellation; compact canonical-storage changes require compatible shared serializer policy. Do not widen limits/timing budgets. This is a local adapter/measurement gap, not a signing blocker.
- **LOCAL-070 / REQ-PROOF-CORE-004 — NEEDS_LOCAL_FIX:** schema owner must define versioned rotation/scale/matrix composition, shear policy, eight-corner transformed bounds and v1 migration preserving old bytes/digests/refusals; provide the shared API for authoring wrapper adaptation. Root schemas remain untouched by this lane.
- **AUTHORING-ASSETS-DIFF-QUADRATIC / REQ-PROOF-AUTH-002 — NEEDS_LOCAL_FIX:** inherited bounded diff fix retains complete review data but changes large (>1 million-cell) encoding. Serial schema/proposal owner must resolve historical serialized proposal compatibility by validated versioned migration or explicit reviewed re-proposal policy. Never bypass exact recomputed review binding.
- **AP-01 / AP-03 / AUTHORING-006 / AUTHORING-REPAIR-CRASH-REGRESSION / DEEP-08-ADDITIONAL-4 / COVERAGE-AUTHORING — NEEDS_LOCAL_FIX for full front-door assurance:** serial integrator must build stable current source, record immutable source/dist hashes, execute existing baseline/cache proof scripts and real CLI/child-91 recovery with retained link/victim/stale-lock invariants. Package test success alone does not certify rebuilt child artifacts.
- **AP-06 and profile/Kids/browser requirement rows:** out-of-lane storefront/profile/production-browser acceptance remains with the existing owners; exact paths and assertions are retained under JSON `sharedRequests`. No claim of closure through unrelated package tests.
- **Gate/proof/marketplace/full requirement rows:** execute every retained semantic positive/refusal/persistence/front-door assertion against its current owning artifact. Full-production intentional scope gaps and genuine external inputs remain separately classified in the retained JSON; none is closed by these local fixes.

## Independent review and publication gate

Astra PASS requires artifact-bound named assertions, preserved negative safety, commands/exits and cleanup, within the existing three-pass bound. Independent review has not been supplied to this retry. Full root/site build/gate, exact published SHA/tree/modes and mandatory CI are serial integration/publication responsibilities; all were skipped here. No local or historical green is a published or full-production guarantee.
