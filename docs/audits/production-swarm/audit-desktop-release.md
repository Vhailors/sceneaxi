# Independent desktop release audit

Graph `sceneaxi-production-swarm`; node `desktop-release-audit`; role `code`, **source read-only**. Real root `/home/devuser/Documents/Projects/sceneaxi`; baseline HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Only this report and its JSON companion are owned/changed. Read AGENTS, baseline, decision log (DEC-01/02/10/15), layout desktop sections, runnable surfaces, activation, backlog and September 26 gap list. Root EMPRYO.md is absent; baseline records no local/ancestor copy. No secret values, signing/notarization substitutes, release upload or publication were used.

**Audit coverage: PARTIAL; local acceptance: FAIL; full production: PARTIAL.** Current public refusal paths and 79 focused existing assertions pass, but a real Windows packaged-smoke oracle fails. Native clean-host macOS/Windows signing, installer, update and pixel evidence remains unavailable. An audit PASS would mean complete coverage, not production readiness; this audit does not claim that PASS.

## Executed independent evidence

All commands used real-root cwd, Linux x86_64, Node v24.21.0/pnpm 9.15.0. Front-door children bounded 20s; shell suites bounded 120s. Commands/assertions/output summaries and limitations are also recorded in JSON.

| Command (absolute install-root paths in execution) | Exit / asserted outcome | Limit |
|---|---|---|
| `pnpm --dir desktop/macos smoke` | 0; missing signing/notarization/update names and local/Actions provenance refusals proven | Static/config and negative subprocesses, no package |
| `pnpm --dir desktop/macos smoke --packaged` | 1; `desktop-macos smoke FAILED — --packaged requires macOS` | Correct platform refusal, not native evidence |
| `pnpm --dir desktop/macos dist --preflight-only` | 1; `MACOS_HOST_REQUIRED`, six `MACOS_ENV_REQUIRED` names, absent SHA and five tools | Correct refusal before build/sign |
| `pnpm --dir desktop/windows smoke` | 0; static signed/update configuration, coming-soon IA and missing-input set | No package |
| `pnpm --dir desktop/windows smoke --packaged` | **0 unexpectedly**; identical static smoke success | **DR-001 product verification defect** |
| `pnpm --dir desktop/windows dist` | 1; Windows host, signing names and SignTool absent | Correct refusal before release deletion/build |
| `pnpm --dir desktop/windows draft:upload` | 1; same plus token/tag/GitHub CLI absent | Correct refusal before network/upload |
| `pnpm exec vitest run tests/desktop/desktop-macos-packaging.test.ts tests/desktop/desktop-windows-packaging.test.ts tests/sites/desktop-offer-lockstep.test.ts tests/sites/desktop-download.test.ts tests/e2e/desktop-project-build-golden.test.ts tests/e2e/desktop-web-export-golden.test.ts` | 0; **79 pass, 0 fail** | Config/seam/refusal/contained fixture proof, not native hosts |
| `pnpm check:desktop` | 0; 3 separate matrix-listed roots, privileged imports confined, no committed secrets | Structural check |
| Exported `runWindowsUpdateCheck` with packaged=true, smoke=false, config=true, injected counting port | 0; `{ok:true,checked:true}`, calls=1 without release evidence | Actual policy executed via pinned TypeScript transpile in memory; no network, not a native updater |
| `resolveReleaseProvenance` local/fork/push contexts | 0; each `iaLinkable=false` | Pure actual helper; no fabricated release proof |
| DR-001 requirement oracle spawning real `pnpm ... smoke --packaged` | **1**; `FAIL DR-001: --packaged returned zero on Linux without signatures, installer checksum or native launch` | Failing-before evidence preserved; passing-after belongs to builder/integration |

No tool-detection failure was hidden: the project API cannot specify cwd/scripts; exact existing pnpm commands ran through Empryo shell. An initial compound `find` was rejected by the shell routing wrapper; it was a harness-discovery failure, not a product finding. No source fix was made and no passing-after is invented. Native package commands were not bypassed. macOS/Windows install-root typecheck/staging builds were not executed here because these roots lack node_modules and the read-only audit did not install; **this is locally solvable builder coverage, not an external blocker**.

## Prioritized findings and implementable tasks

Each item includes a refutation attempt. Exact builder ownership must be assigned before changes; these paths are requests, not this auditor's source claims.

### DR-001 — P1/high: Windows `--packaged` silently returns static success

- Source: `desktop/windows/scripts/smoke.mjs:1-79` top-level entry; there is no argument parsing/native branch. `desktop/windows/package.json:21` routes the real command here.
- Reproduction: real command above returns 0 on Linux without any installer/certificate/native host. Requirement oracle returns 1 with the recorded FAIL output.
- Refutation: its header intentionally says static smoke, so default success is valid. Passing an explicit native-proof option without refusal is not valid. macOS explicitly rejects the same request. No actual signature/pixels were claimed by the default text; defect is the accepted option/false-positive verification channel.
- Impact: an operator can mistake `smoke --packaged` for native acceptance; no Windows clean-host smoke contract currently exists.
- Owner/files: desktop-release builder, `desktop/windows/scripts/smoke.mjs`; shared test owner `tests/desktop/desktop-windows-packaging.test.ts`, doc owner `docs/desktop-windows.md`.
- Fix/acceptance: explicitly parse/reject unknown flags; implement `--packaged` with Windows host refusal, exact manifest/checksums/signature/installed-runtime checks and real JSON/pixels proof. Linux command must exit 1 with a named host refusal; existing default smoke remains green. Genuine authorized Windows `pnpm --dir desktop/windows smoke --packaged` must launch actual recorded bytes, not just config.

### DR-002 — P1/high: draft bytes upload before independent verification

- Source: `desktop/windows/scripts/release.mjs:62-65` calls `packageWindowsRelease` with `publish: "onTagOrDraft"`; `desktop/windows/scripts/package-release.mjs:19-30` runs publishing electron-builder before output-set validation `:32-50`, SignTool `:53-56` and hashes `:57-61`.
- Reproduction: read-only control-flow assertion confirmed publish invocation precedes independent verification; credentialed upload deliberately not executed.
- Refutation: `forceCodeSigning: true`, draft-only config and a real draft check exist; these protect signing and public visibility. They do not prevent uploading candidate bytes before post-build verification, nor preserve verify-first phase separation.
- Impact: a failed candidate can leave external draft assets without the final checksum/provenance/launch verification; retry becomes ambiguous. Not a demonstrated public-release bypass.
- Owner/files: desktop-release builder `desktop/windows/scripts/{release,package-release}.mjs`; shared packaging tests/docs.
- Fix/acceptance: always build with publish never; verify signature, artifact set, manifest, checksums and native acceptance before a separate explicit draft uploader. Test command ordering with a denied upload port after verification failure, no credentialed action. Keep token/tag/draft checks and later publication separation. `pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts`; no upload in this swarm.

### DR-003 — P1/high: Windows candidate provenance and preservation missing

- Source: `desktop/windows/scripts/release-preflight.mjs:16-37` checks host/tools/nonempty names only; `desktop/windows/scripts/dist.mjs:13` and `scripts/release.mjs:61` recursively erase `release`; `scripts/package-release.mjs:57-62` emits only installer SHA256SUMS.
- Reproduction: public missing-input refusals verified; source shows no clean-HEAD binding/manifest and unconditional erasure after preflight. Destructive/native branch not run.
- Refutation: macOS already guards nonempty output and verifies SHA against clean checkout (`desktop/macos/scripts/dist.mjs:75-128`). Windows force-signing authenticates a publisher, not the source commit or candidate lifecycle.
- Impact: prior local artifacts/evidence can be lost; signed Windows bytes cannot be independently tied to exact clean source/run/size/update metadata.
- Owner/files: desktop-release builder Windows preflight/dist/release/package-release and a reusable lane-local candidate validator; shared tests/docs. Reuse macOS provenance semantics without importing privileged/product internals.
- Fix/acceptance: refuse nonempty/invalid/unreadable output; require real SHA matching clean HEAD, optional canonical-run shape; emit non-linkable local manifest with exact sizes/hashes/update metadata and genuine verification facts. Containment/symlink/duplicate file regressions and no-output-change assertions must run without signing. `pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts`; actual Windows signed `dist` remains external evidence.

### DR-004 — P1/high: generated config alone enables Windows updates

- Source: `desktop/windows/src/lib/update-policy.ts:27-45` exported `runWindowsUpdateCheck`; `src/electron/main.ts:30-35` passes file existence and invokes `checkForUpdatesAndNotify`; `electron-builder.yml:25-30` has bundled GitHub feed config.
- Reproduction: exported policy actually executes injected port once with only generated configuration, no recorded verified release or opt-in.
- Refutation: not-packaged, smoke, absent config and thrown transport failure refuse correctly; Authenticode verification is configured. These are real protections, but generated builder configuration is not a release-readiness/activation record. Unlike macOS preflight gating, Windows local signed packaging can carry the provider configuration.
- Impact: default packaged launch can reach network/update-download behavior before a verified release policy is configured. No unsigned installation or real network request was demonstrated.
- Owner/files: desktop-release builder `desktop/windows/src/lib/update-policy.ts`, `src/electron/main.ts`, `scripts/build.mjs`, `electron-builder.yml`; root-owned test/doc updates.
- Fix/acceptance: follow DEC-10: build with disabled policy unless an independently validated authorized verified release/feed is supplied; explicit downloaded-verified/apply lifecycle; retain signature checks and error redaction. Test packaged/config-only inputs cause **zero** update port calls; smoke always zero; verified explicit configuration allows one. Existing test command plus native feed failure/recovery checks later; no live update service here.

### DR-005 — P2/medium: macOS packaged integrity check incompletely binds release bytes

- Source: `desktop/macos/scripts/smoke.mjs:131-165` only tests that artifacts is an array/provenance shape; `:167-172` hashes filenames listed in SHA256SUMS; `:127-130` only checks update file existence.
- Reproduction: source/control-flow coverage, not native execution. Metadata mismatch negative front door cannot be reached on Linux because host refusal correctly precedes it.
- Refutation: empty SHA256SUMS actually fails its regex, so **no empty-checksum bypass is alleged**. `dist` generates exact two artifact names, real hashes, SHA512/size update metadata and validates signature/stapling. But a later smoke accepts a checksum list with an omitted artifact or altered manifest artifact fields/update YAML; it does not compare list to required artifacts, per-artifact size/digest or feed hash/size. Native signature validation of app bundle does not bind those omitted outer release files.
- Impact: transport corruption/stale metadata may escape the purported independent release-set validation.
- Owner/files: desktop-release builder `desktop/macos/scripts/smoke.mjs` and reusable lane-local validation helper; `tests/desktop/desktop-macos-packaging.test.ts`, `docs/desktop-macos.md` shared owners.
- Fix/acceptance: parse/validate exact artifact allowlist, unique contained basenames, manifest version/source/platform/signed/notarized facts, exact bytes/digest equality and zip SHA512/update URL/size binding. Expose read-only artifact validation runnable on Linux without pretending to verify signatures. Truncated/duplicate/path-traversal/size/hash/update mismatch each fail; genuine complete candidate required on Mac. `pnpm exec vitest run tests/desktop/desktop-macos-packaging.test.ts`; later native `pnpm smoke --packaged`.

### DR-006 — P1/high capability gap: native user-project build is an unconditional refusal, not just credentials

- Source/shared owner: `packages/schemas/src/desktop-project-build.ts:53-95` `evaluateProjectBuild` returns **only Failure**, final branch always returns releaseAuthorityMissing even all host readiness/authority flags are true. `desktop/linux/src/lib/bridge.ts:1834-1836` `ship` deliberately refuses offline Web export outside Linux.
- Reproduction: executed `desktop-project-build-golden` through real `createDesktopBridge().handle()` for desktop-control/CLI/local-agent verifies host/signing/Kids refusal parity; source disproves the credentials-only explanation. Web-export golden passes locally; non-Linux gate confirmed in source.
- Refutation: current refusal is intentional and must remain until actual packager/evidence exist; it is not an authorization bypass. Supplying certificates alone cannot implement the absent success path. Old backlog58 is incomplete when parked only as signing credentials.
- Impact: macOS/Windows users lack both native project output and the Linux offline Web-export target; full production capability remains missing.
- Tasks/shared ownership: schemas owner `packages/schemas/src/desktop-project-build.ts` and contracts; desktop-linux owner `desktop/linux/src/lib/bridge.ts`, `web-export.ts`, project build host adapter; shells owner target/control UX; release builder platform adapters; root golden tests/manifests/docs by integration. Prepare a real contained local packaging/job/evidence adapter under existing registry, retain independent Kids/held/release refusal. Assess lifting only the offline Web-export OS restriction with contained/no-replace parity, not native-signing gates. Exact cross-lane design/implementation required; do not invent authorization booleans as production proof.
- Acceptance: existing project-build/Web-export goldens plus public local package job, contained output/no overwrite/replay/failure rollback; actual native signed/notarized candidate acceptance remains external. Do not weaken current refusal assertions to manufacture success.

### DR-007 — P2/medium: locally achievable Windows CI/staging evidence absent

- Source: no `.github/workflows/desktop-windows.yml`; `docs/desktop-windows.md:121-128` covers static/hermetic proof only. macOS workflow `release_candidate` (`.github/workflows/desktop-macos.yml:9-16,24,64-84`) correctly defaults false, stages on Ubuntu and only selected dispatch reaches signing/native smoke. Its jobs currently lack a wall-clock bound.
- Refutation: root gate covers both install-root structure and packaging suites; it does not execute installed Windows/macOS staging or Windows clean-host launch. Signing inputs are genuinely external; preparing unsigned/default-disabled staging checks is not.
- Owner/files: delivery-ops workflow owner `.github/workflows/desktop-{windows,macos}.yml`; desktop-release builder own scripts; root-owned tests/traceability docs. No workflow was triggered here.
- Fix/acceptance: existing pinned frozen install/typecheck/build/default smoke in separate roots, bounded non-signing validation job; explicit default-off manual native candidate branch and artifact-retention/checksum provenance only after genuine verification. No widened matrix or automatic spend/dispatch. Run local `pnpm --dir desktop/{macos,windows} install --frozen-lockfile`, then each root's existing `typecheck`, `build`, `smoke`; install/staging is remaining local work, while native signed CI results are unresolved external evidence.

## Dated backlog and requirement coverage

- **52 retained external release gap:** current documentation still records expiring run 31629556282, verified 2026-08-12, expiry 2026-11-10 (`docs/desktop-linux.md:494-509`); current offer/IA lockstep suite passes. This audit did not authenticate/download the historical run and does not assert current remote availability. Fresh durable public release needs genuine recorded bytes and separate publication authority. Changes shared with desktop-linux/site-kit/delivery-ops, not this read-only lane.
- **55 retained:** no recorded signed/notarized macOS or Windows release; Windows CI remains absent. Split real host/cert proof from achievable DR-001/003/007 preparation.
- **56 stale categorical claim:** update tooling exists on macOS and Windows; macOS candidate workflow exists. Signed feed activation/native update proof/public release still absent; Windows policy and verify-first defects above are local tasks. Linux signing is desktop-linux/external release lane.
- **58 retained but reclassified mixed:** intentional target refusals remain; actual user-project packaging implementation is missing as well as signing/host/publication inputs. Offline Web export is still Linux-only. No R2 for macOS/Windows is earned.
- **REL-001:** baseline exact gate green; independent focused 79 assertions and desktop checker green, but these do not cover installed staging/native evidence; DR-001 demonstrates an omitted negative oracle.
- **REL-002:** proof stages not executed; source release preparation is not Stage 1 evidence. Cross-owner authoring/program held gates remain.
- **REL-003/004:** no signing/upload/deploy/publish/spend performed; dist/draft missing-input refusals verified. Credential presence/manual flags are not action-specific operator authority; activation runbook still controls.
- **REL-005:** correct unavailable download IA tested; macOS deliberately outside R2; Windows similarly no R2. `iaLinkable` context checks are not cryptographic attestation (`docs/desktop-macos.md:101-107` explicitly admits spoofable environment); no new security defect alleged from that intentional contract.
- **REL-006:** package/CLI/Kids/LIVE/marketplace/legal/publication holds not weakened. Keep local release records non-linkable unless canonical context independently corroborated; actual publication separately held.
- **REL-007:** dated blanket GPU failure claim is stale: current `docs/desktop-linux.md:435-440` records a successful 2026-09-26 Xvfb packaged check. This audit did not repeat Linux pixels; desktop-linux/integration owns fresh host evidence. Never infer native Mac/Windows pixels from Linux proof.

## Coverage by concern / exact remaining requests

- **Security:** signing/config refusals executed; privilege/tier checker passes. Provenance, update default-off, verify-before-upload, checksum containment need tasks above. No fake certificates or signature/notary results.
- **Error/lifecycle:** Windows rejects absent host/tools before erasing bytes; nevertheless successful-preflight output erasure and update error observability remain risks. macOS unavailable feeds catch errors silently; propose local redacted diagnostic status as part of DR-004 parity, not paid telemetry.
- **Performance:** artifact hashing uses whole-file `readFileSync` on macOS and Windows (Mac dist:208-209/smoke:170, Windows package:58), O(largest artifact) extra memory and synchronous time. No native installer-size/RSS benchmark available. Builder should stream hash/size validation using Node built-ins if large candidate memory is observed; acceptance exact hashes unchanged and bounded RSS on actual-sized owned fixture, no release proof inferred.
- **Clean host/platform:** need actual Apple Silicon and Intel universal launch/signature/Gatekeeper/stapler/install/uninstall/update evidence; Windows x64 NSIS per-user install/launch/uninstall/publisher-signature/update evidence; newer shared-host feature smoke parity. Native hosts/certs unavailable, not simulated.
- **Inputs:** macOS real Developer ID Application certificate + `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, approved HTTPS `SCENEAXI_MACOS_RELEASE_BASE_URL`; Xcode tools + clean checkout SHA. Windows real certificate via `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`, Windows SDK SignTool, clean SHA; token/tag/GitHub CLI only for separately authorized future draft upload. **Names only, never values in evidence.** A named platform/source/candidate/operator/window/evidence/rollback authorization is required before signing; a later separate verified-record authorization before any upload/publication/feed activation. None granted by this report.

Complete task outcomes, dependencies, source anchors, evidence distinctions and requests are machine-readable in `audit-desktop-release.json`. All local findings routed to builder/integration; passing-after verification and remaining tasks must be merged into FINAL, not silently dropped because hermetic tests exit zero.
