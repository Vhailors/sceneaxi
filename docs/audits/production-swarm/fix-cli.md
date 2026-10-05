# CLI builder outcome — PARTIAL

Graph: `sceneaxi-production-swarm`; node: `fix-cli`; role: `code`. Real root/cwd: `/home/devuser/Documents/Projects/sceneaxi`. Linux Node `v24.21.0`, pnpm `9.15.0`. HEAD rechecked unchanged: `4e532e2fbf43e9948741578ab6208a3277870405`.

## Implementation and preservation

The retry checkout already contained substantial CLI changes and four new package files, despite the retry claiming zero edits. Those changes were preserved, not replaced or falsely attributed to this retry. Audit-era failing-before evidence for CLI-001..004 remains in read-only `audit-cli.json`; this retry did not roll back fixes to reproduce old defects.

Preserved implementations: own-property dispatch, bare-version validation, finite/nonnegative/future clock freshness refusal with currency-first ordering, help/version exclusion from process watch mode, explicit command/map declarations, desktop permission-bound aliases, offline plugin/catalog inspection, evidence verification, current-v1 validation, workshop template initialization, and a private compiled outsider archive. Exact preserved files and task outcomes are in `fix-cli.json`.

Retry-specific changes:

- `packages/cli/src/project-lifecycle.ts:706`: added shared canonical project-containment helper and `runEvidenceShow`/`evidenceShowHelp`. Show refuses escaping carrier/claimed-document paths and labels results `currentDocumentVerified=false`; verify reuses containment. No browser/native/provider/legal proof is inferred.
- `packages/cli/src/commands.ts:24`: wired the real evidence-show implementation/help, rather than misleadingly displaying `project report` help.
- `packages/cli/test/__snapshots__/envelope.snapshot.test.ts.snap:15`: updated exactly the project child list for admitted init/migrate. No assertion was removed or broadened.
- `packages/cli/bin/build-archive.mjs:7`: use `node:path` separator for archive exclusion checks, fixing two actual ESLint errors without disabling rules.
- `packages/cli/test/capabilities.test.ts:21`: actual binary recursion covers all **30** leaves and inherited names at every group depth; template import/application and byte-preservation assertions; positive offline catalog validation with approval/storage refusal; show/verify malformed and escaping-path controls; valid play/build inputs reach real missing-transport refusal. Build input is `{profile:"game",target:"linux"}`, not the previously incorrect `{platform:"linux"}`. Both aliases require `project:read`; wrong permissions refuse before transport.

No source/manifests/locks/root tests/other lane files were edited outside `packages/cli`. No held-key, Kids, LIVE or dependency-matrix weakening. No new stack/API introduced; existing public authoring/importer/schema helpers and existing Node resolver hooks were reused.

## Per-item outcomes

| Task | Outcome |
| --- | --- |
| CLI-001..004 | Implemented, lane-verified, mandatory and real-binary regressions pass |
| CLI-005 | Source comments/tests verified; reserved README/shared documentation still integration-owned |
| CLI-CAP-01 | Play/build aliases and exact tools/permissions verified; neither build nor Ship discovery is signing/publication |
| CLI-CAP-02 | **Local shared-contract blocker**: no admitted asset-removal bridge tool or stable-id removal proposal helper |
| CLI-CAP-03 | Offline plugin list/validate implemented; unknown capability/load refuses; no executable loader or claimed sandbox |
| CLI-CAP-04 | Capture/show/verify tested; verify rejects changed/forged/malformed/escaping evidence; show is captured claims only |
| CLI-CAP-05 | Valid offline metadata validation tested; storage/submission/approval/commerce remain refused/inert |
| CLI-CAP-06 | Current-v1 byte-identical validation; unsupported versions refuse, no conversion invented |
| CLI-CAP-07 | Openable workshop template initializes, imports/applies, refuses overwrite/unknown/escape |
| CLI-PACK-01 | Private extracted compiled archive runs outside repo; serial full gate still required; ordinary manifest tarball is not a release |
| COVERAGE-CLI | Linux actual front doors verified; full-workspace serial gate, genuine packaged host and non-Linux/platform evidence remain |
| LOCAL-PROOF-074, REQ-PROOF-HOLD-001..003, REQ-PROOF-SURFACE-001 | Preserved/revalidated bounded assertions, with freshness hardening |
| GATE-EPOCH / CLI-EXT-01 | Genuine external blocker; default shipped gated refusal remains correct |

## Commands and evidence

All commands below ran with real app cwd and 120000ms timeout; `project(test/lint)` reported no detected command, so existing pnpm commands were recovered through shell.

1. Initial owned suite: `pnpm exec vitest run packages/cli/test --reporter=dot`: **exit1, 235 pass/1 fail**, stale project child-list snapshot. Exact snapshot repair yielded **16/16** focused snapshot tests and clean typecheck.
2. New capability oracle before show fix: **exit1, 5 pass/2 fail**. Actual binary evidence show accepted an escaping path far enough to return NOT_FOUND exit1 instead of containment VALIDATION exit2. The second failure was a test harness signature mistake for `applySceneDocumentImport`, corrected to its actual input contract, not weakening the expectation. Owned CLI emit build plus focused tests after source fix: **exit0, 23/23**.
3. `pnpm exec eslint packages/cli --max-warnings 0`: initial **exit1, two no-useless-escape errors** in archive script; exact separator fix subsequently passes with zero warnings/errors.
4. `pnpm check:boundaries`, `pnpm check:publish-ready`, `pnpm check:contracts`: **exit0**. 27-package matrix;17 publish-readiness checks (no publication authority); shared authoring/plugin/catalog/open-path/Kids contracts valid.
5. `pnpm exec vitest run packages/cli/test/distribution.test.ts --reporter=dot`: **exit0, 1/1**. Actual temporary extracted archive, stock Node, no repo scripts/workspace node_modules; artifact's own bundled third-party `three` is expected. Help/version/new/test/capture/verify/init, inherited-name refusal, gated currency refusal and no-overwrite assertions execute. All temporary stages/extractions are cleaned.
6. Final combined suite:
   ```sh
   pnpm exec vitest run packages/cli/test tests/e2e/cli-golden-path.test.ts tests/e2e/asset-pipeline-golden.test.ts tests/e2e/asset-ingestion-golden.test.ts tests/e2e/desktop-cli-local-bridge-golden.test.ts tests/e2e/importers-plugin-golden.test.ts tests/e2e/plugin-capability-golden.test.ts --reporter=dot
   pnpm exec eslint packages/cli --max-warnings 0
   pnpm exec tsc -p packages/cli/tsconfig.json --noEmit
   ```
   **All exit0: 271 tests pass/0 fail; ESLint clean; TypeScript clean.** Includes unknown/malformed flags, JSON equivalence, lifecycle/review/apply/conflicts, watch edit/SIGINT, registry/import/reload, transport security and mandatory currency regressions.
7. Final owned-package rebuild: `pnpm exec tsc -p packages/cli/tsconfig.json && pnpm exec vitest run packages/cli/test --reporter=dot && git rev-parse HEAD`: **exit0, 238 CLI tests pass/0 fail** against rebuilt binary; unchanged HEAD.

### Recorded failures not hidden

- Intermediate typecheck hit another lane's `packages/engine-presentation/src/three-sculpt.ts:451` TS7006 parameters `t`/`i`. Reported to owner; not edited here. Latest same typecheck and final owned emit both pass.
- Supplemental `pnpm exec oxlint --config .oxlintrc.json packages/cli`: **exit1**, extensive anti-slop diagnostics across existing and changed code (e.g. `verb-support.ts:94` map/filter, `:96` typeof, `:160` assertion safety, numerous spacing rules). Not fixed or suppressed. This supplemental command is **not** a member of unchanged `pnpm gate`; do not claim it green. Output: `/home/devuser/.local/share/empryo/tee/2026-10-01T13-20-51-019Z_shell.txt`.
- Full-workspace build/unchanged gate intentionally **deferred to serial integration by the explicit no-competing-build instruction**, not reported passing. No check was disabled or assertion skipped.

## Exact remaining requests

1. **Local asset-removal contract/helper:** shared schema + authoring/assets owners must admit stable-id asset removal through E1 Change Review or an exact permission-bound bridge tool. Neither `sceneaxi.scene.object.remove` nor `sceneaxi.package.remove` is asset removal. `contained-gltf.ts` has no admitted removal helper. Require exact stable id/document, unknown/absent-id refusal, referenced-instance/dependency checks, containment, no source deletion, review/apply and import/remove/reload parity. Then wire CLI command/map/help/actual-bin oracles. Do not park this as an external blocker.
2. **Reserved docs:** `packages/cli/README.md`, `docs/runnable-surfaces.md`, `docs/held-key-enforcement.md`, dated gaps/backlog: replace categorical NOT_IMPLEMENTED watch/skeleton language with implemented streaming/SIGINT and synchronous one-shot behavior. Document active exit3 and malformed/future freshness refusal; exact alias tools/permissions, bounded offline capabilities and remaining native/epoch authority. Preserve historical backlog facts, add current dispositions. Recommended replacement text is in JSON.
3. **Private archive integration:** document/reuse `node packages/cli/bin/build-archive.mjs --out <new-private.tgz>` and distribution oracle. Build required first. Only Linux GNU tar/Node24 tested; no ordinary manifest-tarball, public release, signing, legal or publication claim. Leave package privacy/version/license and source-backed exports unchanged.
4. **Serial acceptance:** integration executes unchanged full `pnpm gate` after all builders, independently drives real front doors and owns FINAL.md/JSON. Retain unresolved supplemental anti-slop diagnostics, asset-removal local shared task and coverage holes in remaining counts.
5. **Genuine epoch activation inputs:** FirstMate structured export; trusted authenticated current-epoch endpoint with trust/timeout policy; matching current map/snapshot and action-specific authority for an actual held operation. Static fixtures are never production currency.

Only Linux Node24 was exercised. No genuine packaged desktop host connection, macOS/Windows runtime/signing/distribution, sustained-memory/large-document performance SLO or external provider/legal evidence is claimed. Owned temporary fixtures were cleaned; no unrelated work was deleted/reset/stashed, no commit/push/deploy/publish/new spend/production mutation, and no secrets were printed.
