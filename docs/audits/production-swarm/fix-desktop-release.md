# Desktop release implementation — PARTIAL

Graph `sceneaxi-production-swarm`; role `code`; repository/cwd `/home/devuser/Documents/Projects/sceneaxi`; baseline `4e532e2fbf43e9948741578ab6208a3277870405`. **No production PASS.** No signing, notarization, upload, publication, deploy, new spend, commit, push or production data change occurred. No secret values or fake native/legal/provider proof were produced.

## Implemented locally

- **DR-001:** `desktop/windows/scripts/smoke.mjs:22` now rejects unknown flags and refuses real `--packaged` on Linux. Windows native branch independently validates exact candidate hashes, SignTool on installer/runtime, real native smoke and WebGL pixels; it explicitly does not claim installed-clean-host acceptance.
- **DR-002:** `desktop/windows/scripts/package-release.mjs:93` accepts only `--publish never`. `uploadVerifiedWindowsDraft` and `scripts/release.mjs:24` require already-existing verified bytes, real native acceptance before remote lookup, exact draft tag/SHA, unchanged revalidated hashes, and explicit no-clobber upload. Integrity/native failures prove zero upload/lookup calls.
- **DR-003:** `desktop/windows/scripts/dist.mjs:11` no longer deletes candidates. `requireEmptyWindowsOutput` rejects nonempty/symlink outputs. `windowsCheckoutProvenance` requires declared clean exact HEAD. Only real SignTool success precedes a strictly non-linkable local manifest; SHA256SUMS covers installer/blockmap/update metadata with bound hashes/sizes/version/feed.
- **DR-004:** Both current packaging roots write disabled update policy even for signing candidates. `desktop/windows/src/lib/update-policy.ts:27` rejects configuration-only calls; explicit embedded policy validates version/commit/hash/canonical feed before a port. Both wrapper mains enforce packaged/smoke guards, disable auto-download/install and emit redacted named errors. There is no enabled-policy writer and no public-feed evidence. Shape validation is not cryptographic attestation.
- **DR-005:** `desktop/macos/scripts/artifact-validation.mjs:18` verifies exact manifest/checksum sets, safe contained regular files, version, bytes, SHA256 and closed update SHA512/size grammar. Mac smoke retains source/linkability/native signature/Gatekeeper/stapler/pixel gates. Large release-file hashes stream in 64KiB chunks. Windows uses the same tested algorithm in its existing package script rather than adding a cross-root import.

All exact changed files/symbols, before/after commands, outputs, severities and acceptance states are in `fix-desktop-release.json`.

## Executed acceptance

| Evidence | Actual result / limits |
|---|---|
| Real before Windows packaged process | Child exit0/static output; requirement oracle **FAIL**, proving DR-001. |
| Before exported Windows updater | Config-only calls1, ok:true; zero-network-port oracle **FAIL**, proving DR-004. |
| Frozen installs | Both roots exit0, all277/278 packages reused, zero downloaded; locks/manifests unchanged. |
| Typechecks | Both actual package typechecks exit0. |
| Owned seam regression | **7 tests pass**: both byte validators, omission/duplicate/traversal/size/hash/checksum/update/symlink negatives, preserve prior output, implicit publisher refusal, failed integrity/native verifier zero uploads, real flag/host processes, default-off/updater port behavior. Unsigned fixtures are byte-only and never claim signatures. |
| Mac packaging + owned seam | Final **17 tests pass**. Intermediate absent-refusal compatibility failure fixed without changing existing assertions. |
| Offer/download/project-build/Web-export goldens | **60 tests pass**, existing refusals and bytes remain strict. |
| Package default smokes | Both exit0, mandatory absence/provenance refusal assertions. Not native package PASS. |
| Actual packaged/Windows dist/draft fronts | Both packaged commands exit1 on Linux; Windows dist/draft exit1 on absent host/signing/tool/authority; asserting driver exit0. No signing/upload path reached. |
| Wrapper compile | Actual installed esbuild write:false emits Mac601173 bytes / Windows3648 bytes; exact hashes in JSON. This avoids shared Linux dist races, **not full staging build evidence**. |
| Desktop/boundaries/contracts | All exact unchanged checks exit0; 3 roots/27 packages, held/Kids/LIVE/matrix intact. |
| Focused lint/diff | Final no issues/whitespace errors; one intermediate unused import fixed by actual policy wiring. |

`project(test, absolute path)` reported no command detected; recovered with exact `pnpm exec vitest run` and real cwd. No harness/config/check weakening.

Upstream API checks: official GitHub CLI manuals returned HTTP200 and documented `targetCommitish/isDraft/tagName` and explicit-only `--clobber`; official electron-builder source returned200 and verified updater members/default behavior. Old documentation URLs and guessed pinned tag returned404; an overstrict direct-initializer spelling assertion failed and was corrected by inspecting the real compatibility accessor. Exact attempts are preserved in JSON. Installed6.8.9 API compatibility was independently typechecked; no dependency change made.

## Remaining local integration — do not classify external

1. **Shared Windows contract tests currently fail (2):** `tests/desktop/desktop-windows-packaging.test.ts:86` still expects unsafe `publish: "onTagOrDraft"`; replace with no implicit builder and ordered explicit uploader assertions. At `:120–130`, give the transport-error assertion an explicitly labeled valid embedded-policy fixture + version; add config-only/disabled/malformed/smoke zero-call assertions. Existing source-owned regressions already prove both. Initial focused run18pass/2FAIL; integration must rerun this shared suite, not skip it.
2. **DR-007 staging/CI:** Run actual Mac then Windows `pnpm build` serially after Linux dist owner is idle. Both wrapper scripts intentionally rebuild shared Linux dist; these were deferred by explicit concurrent-dist instruction, not blamed on source. Install/typecheck/default smoke/in-memory wrapper compile are complete. Add bounded Windows default-false `release_candidate` workflow and Mac timeout; workflows/docs are reserved integration, no dispatch authorized.
3. **DR-006 native user-project job/portability remains local implementation absent:** All specified targets belong to schemas/Linux/shells. `packages/schemas/src/desktop-project-build.ts:53` still returns only Failure; no fake successful release was added. Integration needs an actual injected contained no-overwrite job with deterministic file/size/hash/provenance/recovery evidence and bridge/registry progress wiring, reusing contained-file/Web-export helpers. Native acceptance stays distinct. Offline Web-export non-Linux restriction needs platform path semantics proof before removal. This is **not certificates-only closure**.
4. Update owning Windows/Mac release docs to reflect separate local dist → independent native smoke → later existing-draft upload; local record nonlinkable, exact checksum set, default-off public feeds, and unpacked-vs-installed proof limits. JSON provides exact reserved paths/contracts.
5. Integration owns final unchanged full gate and three-pass FAIL routing. No concurrent whole-tree gate/build was run by this lane.

## Exact external gates

- **GATE-MACOS:** Authentic Intel and Apple Silicon hosts/tools; `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, approved HTTPS `SCENEAXI_MACOS_RELEASE_BASE_URL`, clean source SHA and exact signing authorization. Real universal DMG/zip signatures/staples/Gatekeeper, install/uninstall/native pixels/update/download evidence.
- **GATE-WINDOWS:** Windows x64 + SDK SignTool, genuine `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`, clean source SHA and exact signing authority. Real NSIS installed-clean-host publisher/install/uninstall/native pixels/update and downloaded hashes. Unpacked runtime smoke does not close install acceptance.
- **GATE-PUBLICATION:** Later separate authorization naming verified record/hash/target/tag/feed/operator/window/evidence/rollback. Token/tag/gh only for that later existing-draft action. Actual durable downloaded release/feed evidence; local bytes/workflow artifact/env shape are not publication.

Name-only probe: all11 platform/release input names absent on this Linux x64 host; values were never printed. Native artifact RSS/latency and installed clean-host proofs remain unmeasured. Backlogs52/55/56/58 and REL001–007 remain explicitly mapped in JSON; safe defaults do not redefine full production.

## Owned resources / preservation

Owned byte-only temporary fixture directories are removed in `finally`; no pre-existing release directory or unrelated work was deleted. Only explicitly assigned source paths and these two reports were edited. Ignored package node_modules use existing cache; no shared lock/config/manifests changed. Additional test/helper path requests received no answer, so none were created: checks live in assigned `desktop/macos/test/seam.test.ts`, Windows helper in assigned existing package script. No shared dist writes occurred. Integration retains genuine local and external remaining work in FINAL.
