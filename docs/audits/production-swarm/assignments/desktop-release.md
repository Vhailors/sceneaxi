# Builder assignment — desktop-release

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/build.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/dist.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/release-provenance.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/src/electron/main.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/macos/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/build.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/dist.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release-preflight.d.mts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release-preflight.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/smoke.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/electron/main.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/lib/update-policy.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [52, 55, 56, 58]. Authority requirement IDs: ['REL-001', 'REL-002', 'REL-003', 'REL-004', 'REL-005', 'REL-006', 'REL-007'].

### COVERAGE-DESKTOP-RELEASE: implementation-needed / P1
Remaining current-source/front-door coverage: desktop-release
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", {"id": "LOCAL-INSTALL-STAGING", "kind": "local-achievable", "description": "macOS/Windows frozen install/typecheck/staging builds not executed by source-read-only auditor; missing node_modules is not external blocker", "task": "DR-007"}, {"id": "EXT-MAC-NATIVE", "kind": "external-evidence", "description": "Actual signed/stapled universal dmg/zip, Intel+Apple Silicon launch/pixels/Gatekeeper/install/uninstall/update validation unavailable"}, {"id": "EXT-WIN-NATIVE", "kind": "external-evidence", "description": "Actual Windows signed NSIS install/launch/uninstall/publisher/update/native pixel acceptance unavailable"}, {"id": "EXT-RELEASE-DOWNLOAD", "kind": "external-evidence", "description": "Historical workflow artifact not authenticated/downloaded; no new public release or feed authorized"}, {"id": "PERF-NATIVE", "kind": "unmeasured", "description": "Whole-file hash buffers and synchronous signing/build RSS/latency not measured on actual-sized native artifacts; no performance PASS"}]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json"]

### DR-001: implementation-needed / P1
Parse flags; add real Windows packaged integrity/signature/runtime/pixels branch; named non-Windows refusal
- Chosen solution: Parse flags; add real Windows packaged integrity/signature/runtime/pixels branch; named non-Windows refusal
- Acceptance: ["E12 exits 0 after real command refuses Linux", "default Windows smoke unchanged", "genuine native smoke --packaged requires recorded signed bytes and real pixels"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/smoke.mjs", "line": 1, "symbol": "top-level smoke entry"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/package.json", "line": 21, "symbol": "scripts.smoke"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
- Dependencies: ["shared-root-test-owner", "docs-owner", "EXT-RELEASE for native pass"]
- Evidence/reproduction: {"reproduction": "E04/E12 real pnpm smoke --packaged on Linux", "refutation": "Default static smoke is intentional; silently accepting explicit --packaged rather than refusing or validating is not native acceptance.", "impact": "False-positive packaged verification channel; no Windows native smoke contract", "category": "verification", "status": "confirmed-reproduced"}

### DR-002: implementation-needed / P1
Always build --publish never; independent validation/native acceptance before separate explicit draft uploader
- Chosen solution: Always build --publish never; independent validation/native acceptance before separate explicit draft uploader
- Acceptance: ["verification failure invokes zero uploader calls", "token/tag/real draft checks preserved", "pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": 62, "symbol": "packageWindowsRelease publish:onTagOrDraft"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": 19, "symbol": "packageWindowsRelease"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": 53, "symbol": "SignTool verify after publisher"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
- Dependencies: ["DR-001", "DR-003", "later separate upload authority"]
- Evidence/reproduction: {"reproduction": "Read-only control-flow assertion: publisher command precedes output validation, signtool and SHA256SUMS", "refutation": "Force signing, existing draft check and draft-only provider protect visibility but do not enforce independent verify-before-upload.", "impact": "Failed candidate can mutate external draft assets before final acceptance; not a demonstrated public-release bypass", "category": "release-phase-ordering", "status": "source-confirmed-external-path-unexecuted"}

### DR-003: implementation-needed / P1
Refuse nonempty output; verify clean HEAD; write exact non-linkable local candidate manifest and independently verified artifact/update facts
- Chosen solution: Refuse nonempty output; verify clean HEAD; write exact non-linkable local candidate manifest and independently verified artifact/update facts
- Acceptance: ["prior output unchanged on refusal", "commit mismatch/dirty checkout/duplicates/traversal rejected", "pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release-preflight.mjs", "line": 16, "symbol": "windowsReleasePreflight"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/dist.mjs", "line": 13, "symbol": "rmSync release"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": 61, "symbol": "rmSync release"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": 57, "symbol": "installer checksum output"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release-preflight.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/dist.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
- Dependencies: ["shared tests/docs", "EXT-RELEASE actual signing"]
- Evidence/reproduction: {"reproduction": "Source shows unconditional erase after preflight and no clean HEAD/candidate provenance checks; refused public paths E06/E07", "refutation": "Signing proves publisher, not clean source; macOS has clean SHA/nonempty-output guards that Windows lacks.", "impact": "Loss of prior candidates; unbound source/run/size/update metadata", "category": "provenance-lifecycle", "status": "source-confirmed-destructive-path-unexecuted"}

### DR-004: implementation-needed / P1
Explicit disabled-by-default verified release/feed policy; redacted failure status; retain signature guards
- Chosen solution: Explicit disabled-by-default verified release/feed policy; redacted failure status; retain signature guards
- Acceptance: ["packaged+config-only calls zero ports", "smoke calls zero", "explicit validated configured release calls one", "pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/lib/update-policy.ts", "line": 27, "symbol": "runWindowsUpdateCheck"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/electron/main.ts", "line": 30, "symbol": "bootstrap update check"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/electron-builder.yml", "line": 25, "symbol": "win.publish"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/lib/update-policy.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/build.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/electron-builder.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["DEC-10", "DR-003"]
- Evidence/reproduction: {"reproduction": "E10 configuration-only packaged input calls updater port once", "refutation": "Smoke/absence/error guards and signature verification exist; generated config is not verified release evidence. No actual network or unsigned install alleged.", "impact": "Packaged launches can reach update/download network before verified release policy", "category": "update-policy", "status": "confirmed-exported-port-reproduction"}

### DR-006: implementation-needed / P1
Prepare real contained local package job/evidence adapter without authorizing publication; assess offline Web-export portability separately
- Chosen solution: Prepare real contained local package job/evidence adapter without authorizing publication; assess offline Web-export portability separately
- Acceptance: ["public package job contained output, no overwrite, deterministic evidence, rollback/refusal", "existing project-build/Web-export goldens remain strict", "no fabricated readiness/authority success"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 53, "symbol": "evaluateProjectBuild"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 92, "symbol": "unconditional final Failure"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": 1834, "symbol": "ship non-Linux export refusal"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 53, "symbol": "evaluateProjectBuild", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 92, "symbol": "unconditional final Failure", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": 1834, "symbol": "ship non-Linux export refusal", "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: ["held/Kids/release authority unchanged", "actual packaging job contract", "EXT-RELEASE native proof"]
- Evidence/reproduction: {"reproduction": "E08 host command golden executes refusal parity; source return type is Failure only even all readiness flags true", "refutation": "Refusal is deliberate and must stay until real gated packager exists; signing inputs alone cannot implement success.", "impact": "Native project output absent and offline Web export Linux-only", "category": "missing-capability", "status": "intentional-refusal-plus-local-implementation-gap"}

### GATE-MACOS: genuine-external-blocker / P1
Real signed/notarized macOS acceptance absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Real Apple Silicon and Intel hosts, Xcode codesign/xcrun/stapler, genuine Developer ID certificate via CSC_LINK/CSC_KEY_PASSWORD, APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID, approved HTTPS SCENEAXI_MACOS_RELEASE_BASE_URL, clean source SHA, platform/candidate signing authority and real signature/Gatekeeper/install/uninstall/update/pixel evidence. Names only.

### GATE-PUBLICATION: genuine-external-blocker / P1
Artifact/publication/update activation authority absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Later separate authority naming exact independently verified source/candidate/hash/release record/target/feed/operator/window/evidence/rollback; genuine durable downloaded release hashes and update evidence. A local archive/workflow artifact is not public release.

### GATE-WINDOWS: genuine-external-blocker / P1
Real signed Windows acceptance absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Real Windows x64 host/SDK SignTool, genuine WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD, clean source SHA and exact platform/candidate signing authority; real NSIS per-user installer/hash/publisher/install/uninstall/native-launch/update evidence. Token/tag/gh only for later separately authorized upload.

### DR-005: implementation-needed / P2
Reusable platform-neutral contained exact-set/version/size/hash/update validation, separate from genuine signature/native stage
- Chosen solution: Reusable platform-neutral contained exact-set/version/size/hash/update validation, separate from genuine signature/native stage
- Acceptance: ["omitted/duplicate/traversal/size/hash/update mismatch fixtures fail without signing simulation", "pnpm exec vitest run tests/desktop/desktop-macos-packaging.test.ts", "native pnpm smoke --packaged later"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": 131, "symbol": "manifest validation"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": 167, "symbol": "SHA256SUMS loop"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": 127, "symbol": "update metadata existence"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/artifact-validation.mjs", "line": null, "symbol": "(proposed helper)", "existsAtSynthesis": false, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
- Dependencies: ["shared packaging tests/docs", "native Mac for final package proof"]
- Evidence/reproduction: {"reproduction": "Source: checksum set not compared to exact manifest/expected set; manifest size/digest and update SHA512/size not checked", "refutation": "Empty checksum text DOES fail; dist emits exact signed/stapled/hash-bound artifacts. Missing later cross-binding remains; no empty-checksum bypass claimed.", "impact": "Omitted artifact or stale manifest/feed metadata escapes independent integrity stage", "category": "artifact-integrity", "status": "source-confirmed-native-front-door-unreachable-here"}

### DR-007: implementation-needed / P2
Bounded non-signing install/typecheck/staging/default-smoke CI; explicit default-off native candidate branch, no triggered signing/publish
- Chosen solution: Bounded non-signing install/typecheck/staging/default-smoke CI; explicit default-off native candidate branch, no triggered signing/publish
- Acceptance: ["pnpm --dir desktop/macos install --frozen-lockfile", "pnpm --dir desktop/windows install --frozen-lockfile", "pnpm --dir desktop/macos typecheck && pnpm --dir desktop/macos build && pnpm --dir desktop/macos smoke", "pnpm --dir desktop/windows typecheck && pnpm --dir desktop/windows build && pnpm --dir desktop/windows smoke", "pnpm check:desktop && pnpm check:boundaries"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-windows.yml", "line": 1, "symbol": "absent workflow"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-macos.yml", "line": 19, "symbol": "unbounded job"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/desktop-windows.md", "line": 121, "symbol": "Gate coverage"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/build.mjs", "line": null, "symbol": "only if real staging failure", "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/build.mjs", "line": null, "symbol": "only if real staging failure", "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
- Dependencies: ["frozen separate install roots", "no dispatch/new spend", "DR-001 native smoke"]
- Evidence/reproduction: {"reproduction": "Windows workflow missing; neither install root has node_modules here; focused gate covers structure/static tests, not installed staging", "refutation": "Mac default false release_candidate/Ubuntu staging and root tests exist; native signing external but local installs/typecheck/build/config smoke achievable.", "impact": "Staging/platform regressions not independently caught in actual packaging builds", "category": "local-build-CI-coverage", "status": "confirmed-missing-local-evidence"}

### REQ-PROOF-REL-001: done-with-evidence / P2
Bounded requirement declaration: The root quality gate fails when build, test, lint, sites, desktop, contracts, boundaries, or publish-readiness checks fail; passing while required stages are unwired is itself a regression.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "bounded-tests-pass-with-coverage-defect"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-*.mjs", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "tests/syntax"}, {"reference": "tests/contracts"}, {"reference": "tests/boundary"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-001", "status": "bounded-tests-pass-with-coverage-defect", "evidence": ["baseline exact gate", "E08", "E09", "E12"], "remaining": "DR-001 and installed staging/native coverage"}, "expectedEvidenceLayer": ["tests/syntax/check-syntax.test.ts", "tests/contracts/injected-open-path-drift.test.ts", "tests/boundary/injected-violations.test.ts"]}]

### REQ-PROOF-REL-002: done-with-evidence / P2
Bounded requirement declaration: Stage 1 proof remains separate from product presentation and requires both tier-3 captain decisions and explicit run authorization; no product implementation counts as proof evidence.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "held-not-executed"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/program/spec-41.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "docs/proof/"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-002", "status": "held-not-executed", "evidence": "No proof stages run; release prep is not Stage1 evidence", "remaining": "separate program/held authority"}, "expectedEvidenceLayer": ["docs/proof/README.md", "docs/three-presentation-core.md"]}]

### REQ-PROOF-REL-003: done-with-evidence / P2
Bounded requirement declaration: Review, apply, install, commit, push, merge, proof execution, spend/accounts, and publication are separate non-transitive authorities.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "authority-preserved"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/bootstrap.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-003", "status": "authority-preserved", "evidence": "No commit/push/sign/upload/publish/spend; E05-E07 actual refusals", "remaining": "future action-specific operator authorization"}, "expectedEvidenceLayer": ["tests/", "docs/production-activation.md"]}]

### REQ-PROOF-REL-004: done-with-evidence / P2
Bounded requirement declaration: Production activation is a runbook only; external changes require a current authorization naming the exact action, target, scope, inputs, and rollback, and unchecked actions remain held.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "runbook-only"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/bootstrap.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-004", "status": "runbook-only", "evidence": "production-activation requires platform/source/candidate/window/operator/rollback; no action taken", "remaining": "real exact action authorization, credentials are not authority"}, "expectedEvidenceLayer": ["docs/production-activation.md"]}]

### REQ-PROOF-REL-005: done-with-evidence / P2
Bounded requirement declaration: Runnable claims use R2 startable, R1 driveable, and R0 refuse-only levels, each backed by a real entrypoint or named refusal and its highest available proof.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "truthful-IA-with-native-coverage-hole"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/*/bin"}, {"reference": "apps/*/bin"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-005", "status": "truthful-IA-with-native-coverage-hole", "evidence": "E08 download/offer assertions; Mac/Windows no R2; iaLinkable context is intentionally noncryptographic", "remaining": "actual clean-host/native acceptance"}, "expectedEvidenceLayer": ["packages/cli/test/bin-smoke.test.ts", "tests/e2e/", "tests/sites/"]}]

### REQ-PROOF-REL-006: done-with-evidence / P2
Bounded requirement declaration: The CLI, catalog activation, Kids launch, package publication, license selection, Stripe LIVE, marketplace, and unsigned platform releases remain deferred or held until their separate authorities and evidence exist.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "holds-preserved"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/program/SPEC.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-006", "status": "holds-preserved", "evidence": "No Kids/LIVE/marketplace/legal/package-publication/held-key relaxation", "remaining": "separate full-production gates"}, "expectedEvidenceLayer": ["docs/audits/initiation/Initiation-Audit.md", "docs/runnable-surfaces.md"]}]

### REQ-PROOF-REL-007: done-with-evidence / P2
Bounded requirement declaration: The current Electron GPU-process crash on the local host is recorded as a host limitation; CI Xvfb/SwiftShader evidence owns packaged-runtime claims.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "dated-host-failure-claim-superseded-in-owner-doc"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/module-coverage.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/desktop-linux.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-007", "status": "dated-host-failure-claim-superseded-in-owner-doc", "evidence": "docs/desktop-linux.md:435-440 records September26 successful Xvfb packaged pixels", "remaining": "desktop-linux/integration fresh independent native Linux evidence; cannot infer Mac/Windows"}, "expectedEvidenceLayer": ["docs/full-editor-v1-capability-matrix.md", "docs/desktop-linux.md"]}]

## Shared requests and acceptance obligations

[]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
