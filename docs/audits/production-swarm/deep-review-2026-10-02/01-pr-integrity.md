# 01 — PR integrity review: FAIL

## 1. Artifacts and scope
- Application: `/home/devuser/Documents/Projects/sceneaxi`. Published [PR #312](https://github.com/Vhailors/sceneaxi/pull/312) OPEN, requested/current head `346933c105305224d575bf9319256301c1eeabfa`, base/current remote main `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`.
- Dirty worktree HEAD `4e532e2fbf43e9948741578ab6208a3277870405`; initial status 440 rows. No worktree receipt is transferred to PR. Current worktree build belongs to reviewer02; this reviewer did not rerun it.
- Read AGENTS.md, docs/agents/layout.md relevant public seams/gate/exports/sites sections, FINAL.md and PR-EVIDENCE.md; local EMPRYO.md absent. `/tmp/push-api2.mjs` read only, never executed.
- Exhaustive trees via `git ls-tree -rz BASE/HEAD`; changes via `git diff --name-status BASE HEAD`; live PR/check/main metadata and all5 workflow failure logs via gh. Exact output/inventories are in companion JSON.

## 2. P0 — unintended application deletion (PR-001, reproduced; FAIL)
Expectation: unchanged files survive publication. Observed: **1101→456 files**, **825 deletions,204 modifications,180 additions,1 rename**. Base-path set difference826 includes the old path of the rename; it is not826 deletions. Of825 actual deletions, **821 remain local;818 are byte-identical to main** by Git blob hashing. Three remaining deleted paths have locally changed content; four are also locally deleted tests/helper. Thus this is not an intended825-file cleanup.

Deleted production surfaces: **20 apps/packages manifests,20 apps/packages tsconfigs,18 src/index.ts seams,21 scripts**, plus5 fixture manifests. Retained tsconfig.json:4-23 still references missing projects; package.json:20-28 still calls missing checkers. Examples: `packages/auth/package.json`, `packages/authoring-core/package.json`, `packages/schemas/tsconfig.json`, `apps/desktop-shell/src/index.ts`, `scripts/check-syntax.mjs`, `scripts/check-boundaries.mjs`, `scripts/workspace-dist-resolver.mjs`, `scripts/lib/package-exports.mjs`. [Exact PR tree](https://github.com/Vhailors/sceneaxi/tree/346933c105305224d575bf9319256301c1eeabfa).

Actual deleted files by tier: {".bb": 8, "apps": 49, "db": 9, "desktop": 53, "docs": 70, "packages": 359, "scripts": 21, "sites": 124, "tests": 132}. Full825-path inventory is JSON `treeEvidence.actual_deleted_paths`.

Root cause reproduced by source+tree correlation: `/tmp/push-api2.mjs:22-25` enumerates changed tracked paths only; :38-59 recursively constructs replacement subtrees containing only those paths and supplies **no subtree base_tree**; :67-73 overlays these replacement top-level subtrees into root base_tree. Preserving the root does not preserve contents of a replaced child tree. Initial published a2e41fed already contains only454 files; later two commits add2, not restore lost subtrees.

Executable modes: all4 main100755 paths absent, **zero100755 paths remain PR**. Lost runnable `apps/desktop-shell/bin/sceneaxi-desktop.mjs` and `scripts/check-traceability.mjs` were executable. No retained path has a mode conversion (mode_changes empty); uploader :48,:67 nonetheless hardcodes100644 and cannot preserve a changed executable. Other two lost executable metadata entries are included in JSON; no harness contents were read.

Fix/acceptance: reconstruct complete intended tree using normal Git/index under separate authority, or use correct base_tree at every overlay level; preserve modes and enumerate untracked additions. Compare full path/blob/mode inventory to intended artifact and explicitly approve every deletion; public exports/seams/checker targets and executable inventory must all close.

## 3. P0 — unresolved checkout import (PR-002, reproduced; FAIL)
Expectation: route import target exists on PR. [Published route.ts:5](https://github.com/Vhailors/sceneaxi/blob/346933c105305224d575bf9319256301c1eeabfa/sites/umbrella/src/app/api/checkout/route.ts#L5) imports `./checkout-handler.js`, but `checkout-handler.ts` is absent both base and head. Current local route.ts:5 has same import; handler.ts:37 implements it and `git status --short -- handler` says `??`. Uploader :22 uses git diff, excluding untracked additions. Six bounded `git cat-file -e SHA:path` probes exit128, including this target, missing manifests/config/checkers/binary. Exact diagnostics are JSON `boundedObjectChecks`.

Fix/acceptance: include intended handler and every other approved untracked implementation/test/evidence asset, then verify import/export closure and actual checkout route rejection/success suite on resulting PR artifact.

## 4. P1 — published checks all red (PR-003, reproduced; FAIL)
Expectation: current exact artifact passes required unchanged checks. Observed **9FAIL,2SKIPPED,0PASS**; GitHub conflict status MERGEABLE does not mean safe, mergeStateStatus **BLOCKED**.
- [gate](https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099368): `Error: ENOENT ... packages/schemas/package.json`, exit1.
- Same run3 sites+Kids: `TS6053 ... packages/schemas not found` and every20 project reference, exit2.
- [Linux](https://github.com/Vhailors/sceneaxi/actions/runs/36931652103) and [macOS](https://github.com/Vhailors/sceneaxi/actions/runs/36931652105): `TS5058: specified path does not exist: tsconfig.json`, exit1.
- [Windows static](https://github.com/Vhailors/sceneaxi/actions/runs/36931652104): `TS5083: Cannot read ... packages/schemas/tsconfig.json` and19 other projects, exit1;2 native jobs skipped.
- [SDK](https://github.com/Vhailors/sceneaxi/actions/runs/36931652102): `Cannot find module ... scripts/check-publish-ready.mjs`, exit1.

`gh run view --log-failed` succeeded exit0 for all5 runs (log retrieval, not successful jobs). `gh pr diff312--name-only` failed exit1 HTTP406: diff exceeds300-file limit; exhaustive local Git tree comparison replaced it, not a fabricated diff success. PR body4513/544 and PR-EVIDENCE.md:19 are historical receipts and do not certify this head. FINAL.md:14,:53 also describe older distinct local runs.

Fix/acceptance: after restoring artifact, rerun full required CI unchanged on published immutable SHA and owning required suites; keep worktree outcomes separately identified. No skip/disabled check can count green.

## 5. P1 — subsequent visual loop not published (PR-004, reproduced; FAIL)
Expectation: actual visual changes **after** PR creation included on current PR head, with before/after evidence. Live createdAt21:40:09Z. After initial a2e41fed, exact commit diffs contain only FINAL.md,PR-EVIDENCE.md,finish-visual-qa.md,editor-shell.tsx. **No post-PR CSS/chrome/visual-token changes**. Initial commit may contain earlier visual work; that does not fulfill subsequent-loop inclusion. Both local `finish-visual-postpr-sites.json` and `finish-visual-postpr-desktop.json` exist but are absent PR. PR-EVIDENCE.md:38-44 claim a later included loop without these source/evidence changes.

Fix/acceptance: under separate authority include genuine subsequent visual code and retained before/after report/assets; prove createdAt<loop<change commit in UTC and required artifact-specific suites/current CI pass. Other reviewers assess local visual quality; no browser or image-content certification is claimed here.

## 6. P2 — UTC/current-head receipt mismatch (PR-005, reproduced; FAIL)
Expectation: evidence dates and head identify actual artifact. PR-EVIDENCE.md:13 still identifies a2e41fed initial head; :30,:39 call repair23:53Z. Actual head authored/committed **23:53:32+02:00 =21:53:32Z**; gh reports21:53:32Z. The receipt labeled local wall clock as UTC, placing repair two hours after purported containing commit; CI began21:53:43Z. :42 therefore does not substantiate its stated timeline.

Fix/acceptance: correct UTC from actual Git/gh metadata, distinguish initial/current head and associate every receipt with exact immutable source artifact. Timestamp correction alone cannot create missing post-PR visual changes.

## 7. Goal and merge verdict
- OPEN PR creation alone: **PASS**.
- Intended artifact complete/no unintended loss: **FAIL**.
- Genuine subsequent visual improvements/evidence INCLUDED: **FAIL**.
- Current PR required CI: **FAIL**.
- Worktree equals published artifact: **FAIL** (remote loss, untracked handler/local reports).
- Merge safety: **FAIL / DO NOT MERGE**. Narrow combined100% goal: **FAIL / NOT100%**. Broader fully-production100%: **FAIL / NOT100%**, already unsupported by narrow required failures and FINAL.md:59-61 residual acceptance; exhaustive broader closure counting is reviewer07.

No valid all-goal percentage denominator established here; no invented75% or conditional pass. Coverage limits: no whole-source semantic review, no fresh browser/provider/production operation, no worktree build rerun. Only01-pr-integrity.md/json written. Source/config/Git branches/index/PR unchanged.

## 8. Retry revalidation — 2026-10-02 (FAIL)
The retry changed only this numbered Markdown report and its JSON companion. Previously read instructions, receipts, application files, and `/tmp/push-api2.mjs` were not reread. Earlier source-backed root-cause findings above remain identified as earlier evidence; this retry independently rechecked remote metadata, full Git trees, local file presence/blob identity, handler status, post-initial commit paths, and all five workflow failure logs.

1. **P0 / PR-001 reproduced:** exact base/head remain `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc` / `346933c105305224d575bf9319256301c1eeabfa`; exhaustive `git ls-tree -rz` and `git diff --name-status` again yield 1101→456 files and D825/M204/A180/R1. Of deleted paths, 821 remain local and 818 hash identically to base. All four executable paths disappear; retained paths have no mode changes. This independently refutes an intentional broad cleanup and a complete published artifact.
2. **P0 / PR-002 reproduced:** `sites/umbrella/src/app/api/checkout/checkout-handler.ts` remains absent from both Git trees, present locally, and `??` in bounded worktree status. Missing manifests, seams, checker scripts, and the desktop binary listed in section 2 likewise exist locally but not on PR. Restore these approved paths and require import/export closure on the resulting immutable head.
3. **P1 / PR-003 reproduced:** live `gh pr checks 312` still reports 9 failures, 2 skips, no passes; PR is OPEN/MERGEABLE but BLOCKED. Five successful log retrievals are not successful tests: Linux/macOS fail TS5058 (`tsconfig.json` missing), Windows TS5083 (`packages/schemas/tsconfig.json` missing), sites/Kids TS6053 (referenced projects missing), SDK `Cannot find module ... scripts/check-publish-ready.mjs`. Published CI must rerun unchanged after restoration. `gh pr diff 312 --name-only` again fails HTTP406 at the 300-file limit; exhaustive local Git comparison supplies coverage instead.
4. **P1 / PR-004 reproduced:** `git diff --name-status a2e41fed1c6f16a19e2dfc2075efa282cab6a173 HEAD_PR` again lists only FINAL.md, PR-EVIDENCE.md, finish-visual-qa.md, and editor-shell.tsx. Both post-PR visual JSON receipts remain local-only. This does not certify visual improvement in the published artifact; require actual post-creation visual changes plus retained artifact-specific before/after evidence.
5. **P2 / PR-005 evidence retained:** the timestamp discrepancy in section 6 was not independently rerun during this retry. Correct receipts using exact Git/gh UTC metadata; do not infer current-head green from historical 4513/544 totals.

**Final acceptance remains FAIL / DO NOT MERGE / NOT 100%.** PR creation alone passes; the combined publication-and-visual goal and broader production goal fail. Dirty worktree HEAD is independently still `4e532e2fbf43e9948741578ab6208a3277870405`; its build is deliberately not rerun here, and neither artifact inherits the other's results.
