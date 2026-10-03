# Authoring implementation — production swarm

Graph `sceneaxi-production-swarm`; node `bg-19`; role `code`. Real root and every command cwd: `/home/devuser/Documents/Projects/sceneaxi`. Baseline HEAD: `4e532e2fbf43e9948741578ab6208a3277870405`. **Production status PARTIAL**, not a whole-application PASS. This node writes only the enumerated authoring-core paths below and this report pair. Existing audit source and shared checks remain read-only.

## Implemented changes and reproduced defects

| ID / severity | Source and impact | Implementation / acceptance |
|---|---|---|
| AUTHORING-001 / high | `packages/authoring-core/src/propose-apply.ts:97` `resolvePath`: proposals/direct edits could select outside-root documents. | Shared `containedProjectPath` in `atomic-write.ts:146` checks lexical and canonical containment; public propose/proposeMany/editDirect/apply translate escapes to diagnostics. Parent traversal, file/directory symlinks and a schema-valid escaping proposal refuse. Victim bytes/artifacts stay unchanged. Valid contained aliases still work. Read-only external proposal artifact inputs retain compatibility. |
| AUTHORING-002 / high | `apply-journal.ts:136` `journalDirectory`, `recoverJournalEntry`: active/archive/sequence resources and recovery documents could escape the project. | Every journal resource and history/recovery document resolves through the same contained helper before mutation. Hostile prepared/undoing/redoing records and redirected journal/active/sequence resources refuse. Recovery preserves unrelated/newer bytes and durable metadata on refusal. |
| AUTHORING-003 / medium | `project-model.ts:644` `writeNativeProjectSeed`: successful writes could contain invalid or mismatched document bytes. | Parse/schema-check both supplied bytes and document, compare their canonical serializations before any write; invalid JSON/shapes/major versions and valid-but-different identity/data produce no seed artifacts. Matching seeds reopen as native projects. |
| AUTHORING-004 / medium | `test/project-model.test.ts:227` onward: old coverage did not detect the above. | Added 22 assertions-as-tests to the original four-test file (now 26 tests), including real spawned CLI new/review/reject/accept/reopen, escaping apply, and actual abrupt process-death recovery. No test file or shared proof catalog added. |
| AUTHORING-005 / low | `project-model.ts:364` `readMigrationJournal`: unconditional Linux procfs dependence. | Keep Linux directory-descriptor anchoring where available; other platforms use verified regular-file descriptors and directory/file identity checks before and after bounded reads. Windows branch never opens a directory descriptor. Linux native migration/recovery and simulated darwin/win32 branches pass. **Native macOS/Windows execution remains unproven**, not substituted with branch tests. |
| AUTHORING-006 / high, newly reproduced | `atomic-write.ts:114` `writeDurableFile`, `atomicWriteAll`: predictable temporary/backup symlinks followed outside-root victims. | Exclusive `wx` creation, byte-preserving backups, per-attempt 128-bit scratch nonce, and ownership-tracked cleanup. Pre-existing attacker/unrelated scratch symlinks remain untouched; canonical write uses separate owned scratch. |
| AUTHORING-007 / high, newly reproduced | `apply-journal.ts:216` `parseJournal`: digest-correct malformed after-images could corrupt a valid scene during recovery. | Both before/after images must parse as Scene Documents before the record is admitted. Malformed image refuses as journal-invalid with scene and active bytes unchanged. |

No new dependency or package edge; no schema/manifest/config/root-test/other-lane edits. No new stack/API dependency; changes reuse existing Node filesystem/crypto APIs and existing schemas parsers/serializers.

## Red → green evidence (not exit-zero-only)

1. Before source repair, `pnpm exec vitest run packages/authoring-core/test/project-model.test.ts`: **exit 1, 13 failed / 6 passed**. Public propose returned `ok:true` for all three escapes; hostile recovery and journal redirection returned `ok:true`; invalid/mismatched seed writers returned `ok:true`. After containment/seed repair: **19/19 pass**.
2. Scratch-symlink oracle before repair: **exit 1, 2 failed / 21 passed** (`expected function to throw`, writes succeeded). Initial exclusive-creation repair passed. Final nonce-isolation assertion deliberately expects the legitimate write to succeed while the outside victim and pre-existing symlink remain unchanged; this also fails against the original implementation.
3. Malformed recovery image: **exit 1, 1 failed / 24 passed**, recovery returned `ok:true`; after parser repair, refused with exact `journal-invalid` and no byte changes.
4. A genuine child process terminates with **exit 91 inside canonical rename**, after `.active`, staged bytes and backup have been durably written, without executing authoring cleanup. This exposed a follow-on defect in the first exclusive-creation repair: restart recovery exit 1 because old transaction scratch names collided. Per-attempt scratch nonces fix it. Final child exit91/fresh real CLI recovery exit0; exact after-image restored, active record cleared, stale locks reclaimed. This is an implementation regression caught and fixed, **not misrepresented as an original baseline defect**. Orphan scratch files are retained as inert contained data, never overwritten or broadly deleted; owned test roots are removed.
5. Attempt to recreate inherited CLI failing-before evidence was too late: compiled artifacts already contained the repaired helper; outside proposal returned exit2 `VALIDATION`, causing the intentionally vulnerable expectation to fail. **No fresh before-CLI exploit claim** is made. Public red tests above establish before behavior; after-CLI safety is independently asserted by the permanent spawned-binary oracle.

## Commands, results and coverage

All commands execute from the real root. `project(test, absolute owned file)` returned **No test command detected**, so exact existing pnpm/tsc/vitest tools were routed through shell; no checks/config modified.

| Command | Actual result / assertion scope |
|---|---|
| `pnpm exec vitest run packages/authoring-core/test` (latest) | **9 files / 177 tests PASS**, zero disabled assertions. Contains deterministic sculpt/quality/composition, provider Kids deny, history/locks, migration and new safety/bin/crash oracles. |
| `pnpm exec tsc -p packages/authoring-core/tsconfig.json` | **exit0**; owner-only emit, no whole-tree/reference build. Rebuilt before binary crash tests. |
| `pnpm exec tsc -p packages/authoring-core/tsconfig.json --noEmit --incremental false` | **exit2 TS6379**: composite projects cannot disable incremental. Corrected using an owned temporary `--tsBuildInfoFile` with noEmit; **exit0**, removed that file. No compiler assertion weakened. |
| Focused existing owner/package/golden/parity selection listed in JSON | **246 PASS (latest, after all repairs)**; verifies CLI lifecycle, actual process-death recovery, multi-level history, inspector parity, canonical composition/sculpt digests, desktop lifecycle/build, prefab override conflicts and animation non-mutating scrub/replay. |
| `pnpm exec eslint packages/authoring-core --max-warnings 0` | **exit0**, no lint disables. |
| `pnpm check:boundaries` | **exit0**, 27 packages verified, no matrix widening. |
| `pnpm check:contracts` | **exit0**, shared authoring jobs, Kids/refusal/catalog/entitlement contracts intact. |
| `git diff --check -- packages/authoring-core` | **exit0**. No root commit/reset/clean/stash/push/deploy/publication. Existing Git tests emit Git messages from their temporary fixtures, not this checkout. |
| Expanded `packages/cli/test` plus selected authoring goldens | **248 PASS / 1 FAIL**, error-envelope snapshot at `packages/cli/test/envelope.snapshot.test.ts:32`. Independent one-file rerun **15 PASS / 1 FAIL**. Routed to CLI/integration; invocation is unknown `project not-a-verb`, never authoring execution. No snapshot blindly updated by this node. |
| `pnpm check:traceability` | **exit1, four errors**: two declared CLI directory proof lists omit new capabilities/distribution tests; release graph omits new Windows smoke; generated registry21 vs live30 CLI verbs. Routed to integration's reserved catalog regeneration. Not called green because the earlier baseline was green. |

### Actual rebuilt front doors

An independent shell fixture (all temporary roots removed in `finally`) drove 18 recorded real CLI/public-process observations: new/test/dev/propose/apply/capture/report, review discard with no writes, successful accept/reopen, stale acceptance exit1 `CONFLICT`, and traversal/file/directory symlinks exit2 `VALIDATION` with victim unchanged. Two captures were byte-identical. Separate public built-package processes undo and redo restored exact before/after bytes after restart. **Two simultaneous independent apply processes** on one CLI-produced base proposal yielded exactly one success and one `apply-in-progress` refusal, both process exits0; final bytes match the one accepted proposal. A fresh CLI process recovered a prepared journal to the exact after-image. Public native seed/open and explicitly approved legacy migration/reopen preserved all legacy document bytes. Permanent real-CLI regression now also exercises a correctly bound escaping proposal and genuine abrupt child termination; not just test doubles/metadata.

Platform: Linux x64, Node24.21.0, pnpm9.15.0. No provider calls, credentials, public URLs, production data or signing actions were exercised.

## Remaining assigned tasks / honest disposition

- **LOCAL-070 / backlog70 — shared-local integration required.** Current schemas own axis-aligned placement math/resolution/validation and replay projection. `composeScene` already delegates to those helpers; an authoring-only bypass would generate invalid evidence or unopenable scenes. Recommended exact additive contract: `placementMode:"trs-v2"` on intake/result; absence preserves every v1 refusal/digest. Resolve bounded rotated/scaled TRS with uniform parent scale when rotations mix; refuse shear/overflow. Update shared hierarchy projection/replay and shared contract tests; then pass the validated mode into the authoring draft at `scene-composition.ts:595`. This is **local shared work, not external/AFK approval**. Requested proactively; no unapproved schema fork/inert feature landed.
- **AUTHORING-005 full acceptance — native macOS/Windows hosts needed** for actual filesystem execution. Local portability implementation and branch tests are done, native acceptance remains PARTIAL.
- **GATE-PROOF / backlog73 — genuine external authority absent.** General E2 remains specified-not-built; preserve Stage1/6 double gate and structured held-key decisions. Bounded Minimum E2/sculpt-quality fixtures are not executed program proof.
- **SCOPE-GENERAL-E2 — intentional nonlaunch capability still counted.** Supported bounded reconstruction/Minimum E2 replay and unsupported states are exercised; no fabricated autonomous planner/general proof.
- **REQ-PROOF-AUTH001..006, CORE004/009/010/013/016 — bounded semantic coverage exercised**, with exact test/assertion mapping in JSON; cross-lane snapshot/shared traceability failures remain visible.
- **REQ-PROOF-AUTH007 is stale/refuted**, not “done by repeating”: current real CLI dev help/source/package tests implement watch instead of blanket `NOT_IMPLEMENTED`. CLI owner must reconcile normative traceability text without weakening unsupported-target refusals.
- **REQ-PROOF-CORE006 is engine-owned/shared**, with known audited public Three-type/lifecycle gaps; do not infer full closure from the authoring headless suite or claim pixels.
- **COVERAGE-AUTHORING remains PARTIAL at full-production level** pending reserved shared fixes, independent integrated unchanged gate and native platform proof. Full gate/build/browser/native/public/provider evidence belongs to integration, not a competing builder gate.

## Integration and cleanup

`fix-authoring.json` enumerates every assigned task, additional discoveries, source changes, acceptance/evidence, shared requests and external missing inputs. Integration must apply shared changes serially, rerun actual relevant front doors, and route genuine failures back within the three-pass bound. PASS is still only zero full-production gaps.

Owned fixture roots and temporary typecheck file were removed; spawned children terminate/reap. No source ownership crossed, no audit reports altered, no repository action beyond local owned edits/build/test performed. Existing unrelated/shared lane work remains intact. No secret values are in this report.
