# task-proof — read-only crosswalk acceptance

**STRUCTURAL_PASS; PRODUCT ACCEPTANCE OPEN.** Auxiliary proof only; no duplicate full review, production verdict, or completion percentage. Authoritative ledger and source are unchanged.

## Actual inputs and fingerprints

- `repair-review-2026-10-02/ledger.json:7,178,235` — original IDs, row IDs/owners/source anchors, command and predicate contract. SHA256 `8b21183bb55cf95100def45d467081add749612614901e94bffd167f22905844`.
- `repair-review-2026-10-02/fix-missing-capabilities.json:127,6658,41398` — `originalAcceptanceMap`, `taskOutcomes`, overlapping families. Its Markdown companion lines 11–25 and 29–54 preserves the local native/rotation/own-session handoffs.
- `deep-review-2026-10-02/08-FINAL.md:20,70–79` — 35 overlapping findings, historical missing finish IDs, mixed local/external predicates. Historical claims are not refreshed runtime evidence.
- `repair-review-2026-10-02/integration.md:19–27` — serial integration still requires named acceptance reconciliation.
- All read JSON hashes/bytes are in `report.json#/fingerprints`; current declared-target inventory SHA256 `bab138d3b52caff73529433bc1953281899052876940e9d1bf12abaed73fb4f5`. This is NOT a complete Git-tree fingerprint.

Paths above are relative to `docs/audits/production-swarm/`. Source anchors, symbols, recorded and observed hashes are retained per row in `report.json#/acceptancePackets`.

## Executable proof

Run from actual repository root:

```sh
python3 docs/audits/production-swarm/capacity-work-2026-10-02/task-proof/validate_crosswalk.py
python3 docs/audits/production-swarm/capacity-work-2026-10-02/task-proof/validate_crosswalk.py --negative-control missing-id
python3 docs/audits/production-swarm/capacity-work-2026-10-02/task-proof/validate_crosswalk.py --strict-proof
```

Observed exits **0 / 1 / 2**, respectively; exact argv/output hashes are in `execution.json`. The validator only reads and prints; it never runs embedded product commands. Executable mode is set. Harness SHA256 `53b3d7aea149a9c8ea4eab6596ef5d37ba605b6ad2d6481267ed91121d2521bc`.

Ten in-memory negative controls PASS: missing ID, blank command, blank predicate, blank owner, absent evidence hash, wrong JSON rows format, and external-only reclassification of DR-006, LOCAL-070, ENG-012, ENG-013. CLI negative input removes AUTHORING-001 only in memory: output reports 354 rows and `ROW_COUNT_EXPECTED_355`, `MISSING_ID`, `MISSING_CAPABILITIES_CROSSWALK_MISMATCH`. No authoritative fixture edits.

## Findings and exact reconciliation queue

- Crosswalk confirms **355 records, 113 original IDs, 35 overlapping review findings, five judge aliases, four supplements**. These are not unique-defect or completion counts. Ledger commands, owners, predicates and declared-present target hash syntax are nonblank.
- **53 original IDs lack historical finish rows**, exactly matching ledger `missing53Ids`. Full precise list: `report.json#/missingOriginalFinishIds`. Missing finish is an assurance gap, not proof that code is absent.
- **81 DONE claims across 73 IDs** require current serial reconciliation: 58 historical finish claims and 23 repair claims. Exact report paths, JSON pointers, original rows and named-evidence presence: `report.json#/unexplainedClosures`; deduplicated IDs: `unexplainedClosureIds`. This queue is NOT 81 disproved tests or fabricated closures: authoring and billing contain genuine named bounded evidence, which is preserved rather than discarded. Ledger remains NEEDS_LOCAL_FIX and this lane does not adjudicate semantic clause coverage or Astra acceptance.
- **176 target references / 50 distinct paths** differ from the ledger hash or are missing; exact recorded/observed hashes in `currentEvidenceGaps`. Shared references are not counted as separate defects. Drift invalidates automatic transfer of old receipts, not implementation correctness.
- Historical `finish-cli-desktop.json#/rows/18` marks **DR-006 RECLASSIFIED_EXTERNAL** although local unsigned adapter work remains. Current repair ledger correctly retains NEEDS_LOCAL_FIX. Preserve separate signing/hardware gates; do not re-close the local adapter as external-only. Rotation, texture and animation controls also refuse false external mutation.
- JSON formats differ legitimately: task `rows`, `tasks`, `taskOutcomes`, identity `taskIds`, numeric summary `rows:65`, audit advisory documents and visual arrays. `jsonDialects` records these without silently treating all documents as task arrays. Identity id-only rows carry no per-row outcome and are explicitly identified.
- Initial harness exit 1 falsely treated numeric summary rows and structured desktop-release predicates as corruption. `initial-report.json` and `initial-execution.json` retain that failure. Corrected lossless `{id,kind,description,task}` normalization and summary recognition pass against actual inputs; no product/ledger correction was required.

## Ready serial-integration packet / proposed reporting change

`report.json#/acceptancePackets` supplies **355 NOT_RUN packets**, each with exact ledger owner, JSON pointer, existing command/cwd/timeout, original predicates, current source path/symbol/line/hash, required execution receipt, and preconditions. Commands are proposals from the authoritative ledger, NOT freshly executed or certified as sufficient. Heavy commands require explicit handoff and authorized resources.

Integrator should preserve all 355 provenance rows and 35 overlapping predicates; join each DONE claim to its packet and named executed clause oracle, source/artifact hash, exit and output-log hash. Refresh stale target receipts only after execution on the reviewed candidate. Append explicit per-clause disposition rather than bulk copying lane status. Keep unmatched predicates open. Update the historical DR-006 summary only through authorized reporting ownership, splitting local adapter from signing/hardware requirements. No source patch is warranted by this reporting-only probe; native/rotation source proposals remain the existing serial-owner handoffs.

**Deferred / NOT_RUN:** every product acceptance command, full gate/build/site/native/browser/provider/DB checks, and independent current-candidate semantic acceptance. No installations, services, sockets, temporary fixtures, credentials or containers used; nothing to clean. Only this auxiliary directory was written.
