# CLI / desktop finish

24 assigned rows: 21 DONE_IMPLEMENTED_VERIFIED, 3 RECLASSIFIED_EXTERNAL. Existing swarm work was preserved; verified existing implementations are distinguished from retry edits in the JSON report.

Final combined test command: `pnpm exec vitest run packages/cli/test apps/desktop-shell/test apps/web-shell/test desktop/linux/test desktop/windows/test desktop/macos/test tests/desktop` — **825 passed, 0 failed** (CLI 276, shells 395, Linux 28, release 21, desktop integration 105). `pnpm -s build`, Linux runtime build/typecheck/check:renderer (94 inputs), and Windows/macOS typechecks passed; lint was not run or disabled.

Both genuine native Linux runs passed: built runtime `xvfb-run -a pnpm smoke`, and separately staged unpacked application `SCENEAXI_SMOKE_PACKAGED_ROOT=dist-build/retry-package/linux-unpacked xvfb-run -a pnpm smoke --packaged`. Packaging used `electron-builder --linux dir --publish never --config.directories.output=dist-build/retry-package`, preserving the old candidate. Receipts: `desktop/linux/dist-build/smoke-{runtime,packaged}-proof.json` and corresponding PNGs.

id | final status | files touched / verified | proof (names + counts)
--- | --- | --- | ---
CLI-001 | DONE_IMPLEMENTED_VERIFIED | dispatcher.ts verified unchanged | refusal.test.ts, held-keys.refusal-table.test.ts, bin-smoke.test.ts: 47 focused passes; CLI suite 276 passes; inherited child names refused
CLI-002 | DONE_IMPLEMENTED_VERIFIED | dispatcher.ts verified unchanged | same 47 focused / 276 owning passes; bare-version tokens and malformed globals refuse
CLI-003 | DONE_IMPLEMENTED_VERIFIED | held-keys/gate.ts verified unchanged | held-keys.refusal-table.test.ts in 47 focused passes; finite clock/budget/timestamp/age and currency ordering
CLI-004 | DONE_IMPLEMENTED_VERIFIED | run.ts, bin/sceneaxi.mjs verified unchanged | bin-smoke.test.ts in 47 focused / 276 CLI passes; introspection does not register watchers
CLI-005 | DONE_IMPLEMENTED_VERIFIED | packages/cli/README.md | executable streaming/SIGINT versus synchronous API reconciled; CLI suite 276 passes
DL-SEC-01 | DONE_IMPLEMENTED_VERIFIED | live-transport.ts, production-hardening.test.ts verified unchanged | production-hardening transport URL/redirect/stream bounds/stalled-body tests; Linux suite 28 passes
DL-BYOK-02 | DONE_IMPLEMENTED_VERIFIED | provider-runtime.ts, byo-configuration.ts verified unchanged | production-hardening readiness/storage/remove/Kids oracle; Linux suite 28 passes; no live-provider claim
DL-COV-03 | DONE_IMPLEMENTED_VERIFIED | Linux main.ts, smoke.mjs | 2 native receipts: typed New/Open/Recent/Save/Undo/Redo/hierarchy/transform/import/reload/Local Ask/Build/approve/apply/cancel/real timeout/late retirement/Play/Export
DL-COV-04 | DONE_IMPLEMENTED_VERIFIED | Linux main.ts, viewport.ts | 2 native receipts: exact browser revisions, bounded diagnostics, actual playbackFrame; missing-frame plateau failed before and passed after
DL-HARD-05 | DONE_IMPLEMENTED_VERIFIED | Linux main.ts, smoke.mjs; chrome-document.ts verified | production-hardening deterministic inline hashes in 28 passes; 2 native CSP/permission receipts, 6 foreign-sender channels denied each
DL-PRIV-06 | DONE_IMPLEMENTED_VERIFIED | Linux main.ts, smoke.mjs | production-hardening opt-out synthetic-dump oracle in 28 passes; both native receipts rawDumpConsent=false; no automatic sharing
DL-DOC-07 | DONE_IMPLEMENTED_VERIFIED | desktop/linux/README.md | fresh limited runtime/package receipts and fixture/live distinction reconciled; Linux suite 28 passes
DL-PERF-08 | DONE_IMPLEMENTED_VERIFIED | Linux main.ts, viewport.ts, smoke.mjs | 2 native receipts: 8 MiB staging/rejection golden, maximum+1 oversize refusal, 12 import/reload/Play/Export cycles under unchanged 4000ms bound, resource plateau, actual GPU/canvas pagehide teardown; teardown failed before and passed after
DR-001 | RECLASSIFIED_EXTERNAL | Windows smoke.mjs verified | release front-door refusals / seam tests in 21 owning + 105 integration passes; genuine Windows signature/launch/pixels not run
DR-002 | DONE_IMPLEMENTED_VERIFIED | Windows package-release.mjs; build/release guards verified | release front-door implicit-publish refusal and exact integrity oracles; 21 owning + 105 integration passes; no uploader executed
DR-003 | DONE_IMPLEMENTED_VERIFIED | Windows package-release.mjs; release-preflight.mjs verified | output-preservation/provenance/integrity oracles: 21 owning + 105 integration passes
DR-004 | DONE_IMPLEMENTED_VERIFIED | Windows update-policy.ts verified unchanged | disabled-by-default feed, redaction/signature guard tests: 21 owning + 105 integration passes
DR-005 | DONE_IMPLEMENTED_VERIFIED | macOS artifact-validation.mjs, Windows package-release.mjs | existing exact symlink assertions failed on both adapters before; seam.test.ts now 7 passes; release owning suite 21 passes without weaker assertions
DR-006 | RECLASSIFIED_EXTERNAL | Linux smoke.mjs, README.md | genuine contained Editor package plus 1 fresh packaged smoke receipt and separate static Web export; not user-project native packaging certification
DR-007 | DONE_IMPLEMENTED_VERIFIED | peer bg-43: .github/workflows/desktop-windows.yml | scripts/delivery-local-oracle.test.mjs 5 passes including 2 Windows branch assertions; check:desktop 3 roots pass; default-off native job not run
COVERAGE-CLI | DONE_IMPLEMENTED_VERIFIED | CLI README.md; current source verified | packages/cli/test 276 passes; root build passes
COVERAGE-SHELLS | DONE_IMPLEMENTED_VERIFIED | current desktop-shell/web-shell source verified | apps/{desktop-shell,web-shell}/test 395 passes; shared chrome exercised by 2 native Linux receipts
COVERAGE-DESKTOP-LINUX | DONE_IMPLEMENTED_VERIFIED | Linux main.ts, viewport.ts, smoke.mjs, README.md | desktop/linux/test 28 passes; runtime build/typecheck/browser graph pass; 2 genuine native receipts
COVERAGE-DESKTOP-RELEASE | RECLASSIFIED_EXTERNAL | both release validators, macOS/Windows manifests and locks | 21 owning + 105 integration passes, audits 0 each, genuine Linux packaged smoke; Windows/macOS native certification unavailable

## External inputs (two-sentence rationale per row)

**DR-001:** The Windows packaged branch and named non-Windows refusal are present and tested, but this Linux host cannot certify genuine Authenticode, Windows runtime launch or native pixels. Missing input: an approved Windows host, genuine signed staged artifacts and their signer identity; no artifact/signature was fabricated.

**DR-006:** Locally verified Editor distribution packaging is distinct from native packaging of a user's project, whose host/signing/notarization/release-authority guards remain in force. Missing input: an approved native user-project packaging adapter and native build/signing hosts; exact shared-policy integration request is `packages/schemas/src/desktop-project-build.ts`, outside owned paths, without authorizing publication.

**COVERAGE-DESKTOP-RELEASE:** Local byte-integrity/front-door tests and genuine Linux native proof pass, but Windows/macOS signatures, launch and pixels require their actual native hosts. Missing input: approved Windows/macOS signing/notarization hosts and genuine candidates; neither native certification nor publication is claimed.

## Honest limits and failures

- Prior unpacked candidate failed the new predicates because it was stale; it was preserved and the separately rebuilt genuine candidate passed. Initial no-display Electron run exited SIGSEGV; documented Xvfb runs passed.
- Exact symlink refusal precedence, missing playbackFrame, and missing pagehide teardown each failed before the retry fixes and passed afterward. No assertion or byte/latency limit was weakened.
- A contended maximum-byte admission run exceeded 4000ms; unchanged-budget final runtime/package runs passed. The 8 MiB proof is isolated admission/rejection, **not maximum-scene rendering**: a full padded-asset GUI reload experiment stalled at the existing 120s wrapper bound. Exact upstream request: investigate `packages/importers/src/contained-gltf.ts` and schema document/asset validation for the full maximum-byte browser reload path without raising limits.
- Coordinated DOPS-001 fix: both macOS/Windows manifests now override `js-yaml@4` to `4.3.2`; regenerated locks and frozen installs with scripts disabled pass, `audit --prod` reports 0 vulnerabilities each, relevant release tests 126 pass. Compatible lock regeneration also resolved Electron 43.7.7 from its existing range; no native signing/install scripts were executed.
- No live provider credentials, CI/native signing job, upload, deployment, automatic sharing, spend, commit, push or fabricated release artifact.
