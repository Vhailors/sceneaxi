# 07 — Goal accounting: FAIL

Published PR#312 exact head `346933c105305224d575bf9319256301c1eeabfa`, base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`; dirty local HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Root `/home/devuser/Documents/Projects/sceneaxi`. Separate artifact evidence; product read-only.

**Narrow PR-then-visual-included goal FAIL. Full-production goal FAIL. All-locally-achievable goal FAIL. NOT100%; no valid current percentage.**

## Retry: independently rechecked artifact boundary

Read-only `gh pr view 312 --repo Vhailors/sceneaxi --json url,createdAt,headRefOid,baseRefOid,statusCheckRollup` confirms PR creation **2026-10-01T21:40:09Z**, head `346933c105305224d575bf9319256301c1eeabfa`, and base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`. PR creation alone **PASS**; the compound narrow goal remains **FAIL**. All 11 reported checks completed: **9 FAILURE, 2 SKIPPED, 0 SUCCESS**. Exact-head gate receipt: https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099368.

Independent `git ls-tree -r --name-only` counts confirm **1101 base files versus 456 head files**. `git diff --name-status` confirms **825 D, 204 M, 180 A, 1 R099**. These are file-change counts, never task closures. Neither `finish-visual-postpr-desktop.json` nor `finish-visual-postpr-sites.json` exists at the exact published head. Their absence proves these reports are not published evidence; it does **not**, by itself, prove every claimed visual source change absent. Each visual claim still needs an exact-tree source comparison and attributable execution receipt.

`git show -s --format='%aI %cI' 346933c105305224d575bf9319256301c1eeabfa` returns **2026-10-01T23:53:32+02:00** for both timestamps, equivalent to **21:53:32Z**, not 23:53Z. A report-labelled repair at 23:53Z is later than this revision; timezone transcription is a hypothesis, not an execution receipt.

Current local HEAD independently remains `4e532e2fbf43e9948741578ab6208a3277870405`; tracked worktree status is dirty. Local existence checks confirm all four `finish-{identity,billing}.{md,json}` reports absent. No build or product test was rerun in this retry; the earlier build failure and historical green counts are not new retry results, and no PR result is transferred to the local worktree.

### Missing acceptance map (required before changing any FAIL)

| Goal component | Missing acceptance / precise disposition |
| --- | --- |
| PR creation | Satisfied only for PR #312 at the verified creation time; does not certify its contents. |
| Post-creation visual improvement included | Exact published-tree source hunks attributable to a post-creation revision plus before/after front-door receipts tied to that SHA; local reports alone do not satisfy this. |
| Mergeable production artifact | Complete reviewed file inventory and successful required exact-head CI; skipped checks cannot certify their paths. |
| 113 local task closures | Per-ID source, executable acceptance, artifact SHA, result, and evidence; reconcile 53 IDs with no finish row and distinguish 58 DONE claims from certified closures. |
| Identity and billing | Missing owning finish reports and source-backed positive/negative front-door acceptance, including any genuinely unavailable external inputs. |
| External prerequisites | Deduplicate overlapping native-host/controller inputs; split DR006 local adapter work from signing/publication. External inputs are not completed tasks. |
| Intentional exclusions | Record approved scope and retained broad-goal gaps; intentional dispositions are not production closures. |

**Claim disposition:** 113 closures and unsupported historical 75%/100% claims remain **REFUTED**. Existing accounting totals are recorded status claims, not a newly measured completion percentage. This retry changes only the two numbered review reports.

## Goal acceptance

| Criterion | Published PR | Local worktree |
|---|---|---|
| Actual open PR/creation provenance | PASS:gh OPEN,21:40:09Z | Remote fact only |
| Complete intended safe artifact | FAIL:1101→456files;825deletions;CI9FAIL | Not certified by remote/older greens |
| Subsequent visual improvement included | FAIL:visual blobs unchanged sincef4990b8 | Actual local diffs/receipt bytes exist, unshipped |
| Owning/required current checks green | FAIL:9FAIL/2SKIP/0PASS | Not rerun by accounting reviewer, no green inferred |
| All original/new local tasks accepted | FAIL:53of113 no finish row | FAIL:same accounting,113blank acceptance values |
| Every broad criterion incl external/scope | FAIL | FAIL:retained22external/13intentional rows |

## Top five findings

### GA-001 — P0 FAIL
**Evidence:** `Exact tree 346933c105305224d575bf9319256301c1eeabfa; https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099368`.
**Expected:** Complete intended mergeable PR artifact; required checks successful on exact head.
**Observed:** Live head456 files versus base1101; D825/M204/A180/R0991. Current head9failed checks/2skipped/0passed. Historical4513/544 is not current-head certification. Representative manifest/checker presence separately recorded.
**Reproduced/refuted:** REPRODUCED tree/check failure; historical-green transfer REFUTED.
**Fix/acceptance:** Restore intended complete tree with exact-set reviewed diff, preserve checker enforcement and obtain current-head required CI/owning acceptance.

### GA-002 — P1 FAIL
**Evidence:** `PR-EVIDENCE.md:23-42; finish-visual-postpr-sites.json:9-14; finish-visual-postpr-desktop.json:8-15`.
**Expected:** PR creation THEN actual visual improvement INCLUDED on current PR head, source + attributable receipts.
**Observed:** All8 visual blobs unchanged since f4990b8;7 differ locally (visual-tokens same). Creation-to-head changes4files:3documents + aria literal extraction, not visual styling. Both post-PR reports and12sampled PNGs absent remote. Local PNG hashes/IHDR verify bytes, not aesthetic quality.
**Reproduced/refuted:** Remote inclusion claim REFUTED; actual local byte differences REPRODUCED.
**Fix/acceptance:** Include post-creation visual source/receipts in subsequent complete PR head and run owning/current-head CI; do not claim local report as shipped evidence.

### GA-003 — P1 FAIL
**Evidence:** `finish-integration.json:21-27; remaining-local-113.json:3-9; FINAL.md:20-22; MEGALIST.json:29-45`.
**Expected:** Every original/new local task has objective artifact-specific acceptance and actual closure.
**Observed:** 65 unique finish IDs,58 DONE claims(51noncoverage+7coverage),4external,2intentional,1unresolved.60 original113 matched:54DONE/4external/1intentional/1unresolved;53 no finish row. All113 extracted acceptance strings blank. Identity/billing finish pairs absent; fix-identity absent. FINAL correctly says BLOCKED/NOT_MET.
**Reproduced/refuted:** 113closures and objective75%/100% claims REFUTED;58 status claims are not independently certified production closures.
**Fix/acceptance:** Reconcile all113 plus new IDs to precise source-backed owning/front-door acceptance and missing reports; deduplicate coverage and keep true external/intentional gaps; do not invent percentage.

### GA-004 — P1 FAIL
**Evidence:** `PR-EVIDENCE.md:30,38-42; finish-visual-qa.md:78; SHA 346933c105305224d575bf9319256301c1eeabfa`.
**Expected:** Valid UTC chronology: execution/receipt precedes containing revision and loop changes are published afterward.
**Observed:** Raw authored/committed time23:53:32+02:00 equals21:53:32Z; gh agrees. Repair labelled23:53Z is almost2hours after containing revision. Claimed dispatch21:46:08Z differs actual21:46:40Z. Retry desktop starts22:08:21Z after final remote revision21:53:32Z.
**Reproduced/refuted:** Impossible UTC chronology REPRODUCED; local+02:00 transcription is plausible explanation, not proof of execution23:53Z.
**Fix/acceptance:** Correct timezone from retained execution receipts; distinguish real execution from document generation; establish actual source/receipt/revision order without backdating.

### GA-005 — P1 FAIL
**Evidence:** `finish-cli-desktop.json:31,37,50; packages/schemas/src/desktop-project-build.ts:53-95; finish-integration.json:52-54`.
**Expected:** Genuine external prerequisites do not hide unfinished local positive paths or narrower substituted oracles.
**Observed:** DR006 external classification includes missing local adapter: Failure-only project-build signature, final unconditional refusal. Fresh no-write transpile probe with platform/signing/notarization/releaseAuthority allready returns false on linux/macos/windows. Real signing/native hosts are external, missing adapter is local. DL-PERF08 DONE retains admitted full8MiB GUI reload stall120s; byte-boundary acceptance narrower.
**Reproduced/refuted:** External-only classification REFUTED; genuine external hardware/signing retained. Stall is documented evidence, not freshly rerun here.
**Fix/acceptance:** Split and implement local user-project adapter/unsigned positive verification from signing/publication; fix8MiB reload stall under existing bounds and hostile/rollback tests without loosening acceptance.

## Accounting reconciliation

Four row-bearing finish reports have15+9+24+17=65 distinct IDs, identical local/remote. finish-integration scans16 sources but12 audit files have no rows: rowSources16 does not mean16 finish task reports.58 DONE claims include51 noncoverage IDs and7 COVERAGE IDs, not58 independent release criteria.60of113 original IDs matched,54claimed DONE;53absent. Five extras(AP08,AUTHORING006/007/crash-regression,PK003) cannot close unrelated missing originals. All113 extractor acceptance values blank; JSON contains every-ID map to retained FINAL acceptance/fix and finish status/proof.

Historical FINAL/MEGALIST retain148 root records=113local+22external+13intentional;307 source/mapping records;90backlog and109requirements;4supplemental assurance records(152records,not152disjoint defects).129bounded historical DONE roots and159bounded/mapped rows are not current release acceptance. FINAL explicitly BLOCKED/NOT_MET, not100%. No75% source-backed denominator is established. Identity and billing finish pairs absent both artifacts; fix-identity pair absent. Earlier billing builder fix evidence does not replace final lane acceptance.

Four external finish dispositions contain3genuine external rows in2overlapping input classes(native signed hosts,physical controller) plus1mixed DR006 local adapter/signing row. Two intentional finish rowsAP07/PK003 remain broad gaps.22historical external records include overlapping legal/provider/host/authority/operations needs; they are not22newly verified missing secrets. Intentional exclusions do not satisfy the unchanged full-product goal.

## Original113 IDs without finish row

AI-TRANSPORT-LOCAL, BD-001, BD-002, BD-003, BD-004, BD-005, BD-006, BD-007, BD-008, BILLING-PRICE-POLICY, BILLING-REALPG-REGRESSION, BILLING-RESTORE-LOCAL, CAT-DURABLE-INTAKE, CLI-CAP-01, CLI-CAP-02, CLI-CAP-03, CLI-CAP-04, CLI-CAP-05, CLI-CAP-06, CLI-CAP-07, CLI-PACK-01, COVERAGE-BILLING-DATA, COVERAGE-DELIVERY-OPS, COVERAGE-IDENTITY, COVERAGE-SITES-UI, DELIVERY-PWA-LOCAL, DOPS-001, DOPS-002, DOPS-003, DOPS-004, DOPS-005, DOPS-006, IDENTITY-02, IDENTITY-03, IDENTITY-04, IDENTITY-05, IDENTITY-ADMIN-HARDENING, LOCAL-070, OPS-DELAYED-CONTRACTS, OPS-DOC-REVALIDATION, OPS-TUTORIAL-ORACLE, SH-T01, SH-T02, SH-T03, SH-T04, SH-T05, SH-T06, SH-T07, SH-T08, SITE-CATALOG-IDENTITY, SITE-PERSISTENCE, UI-001, UI-002

## Artifact/chronology evidence

All4CSS sheets,chrome,inspector,BYOK differ locally from remote; visual-tokens remains identical. All8audited remote blobs equal pre-loopf4990b8. Only post-creation source difference extracts literal aria constant while preserving refusal/describedby/assignment behavior; accompanying3documents do not ship local CSS.3site+3desktop before/after pairs(12PNGs) independently verify hash/signature/IHDR; all absent remote. This certifies local retained bytes, not aesthetics/exhaustive accessibility.

Raw revision23:53:32+02:00=21:53:32Z, gh agrees. Report repair23:53Z cannot precede containing revision. Timezone transcription is plausible, not proof of23:53Z execution. Actual sites receipt starts21:46:40Z and ends22:11:07Z; desktop retry22:08:21Z→22:20:45Z after final published21:53:32Z. Both post-PR report JSONs absent remote.

## Bounded live verification and limits

Executed gh provenance/head/checks, exact tree/diff/blob/report presence, JSON distinct-ID/acceptance reconciliation,12PNG hash/IHDR checks, and no-write transpile/current-source all-ready project-build probes for3platforms(allrefuse). Did not rerun whole-repo build or owning suites(assigned reviewer owns them), providers/hardware/native or8MiB stall. No source/config/PR changes, installs/accounts/spend/deploy. Current published checks9FAIL/2SKIP; historical4513/544 and older4297 greens do not transfer. Full113acceptance map,35external/intentional records, exact URLs/hashes and dirty-source fingerprint are in JSON.

Initial report-write command was rejected before execution by existing unrelated oxlint hook: desktop/windows/scripts/package-release.d.mts:6 anti-slop(no-unknown-returns),0warnings/1error. No files written by that failed attempt; no check weakened or source repaired. Report-only persistence retried.
