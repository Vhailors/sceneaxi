# Assignment — authoring-assets

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (58): AUTHORING-001, AUTHORING-002, AUTHORING-003, AUTHORING-004, AUTHORING-005, AP-01, AP-02, AP-03, AP-04, AP-05, AP-06, AP-07, PK-001, PK-002, PK-004, AP-PERF, COVERAGE-AUTHORING, COVERAGE-ASSETS-PLUGINS, COVERAGE-PROFILES-KIDS, PK-003, PK-005, GATE-MARKETPLACE, GATE-PROOF, GATE-CONFORMANCE, SCOPE-UNTRUSTED-PLUGINS, SCOPE-GENERAL-E2, SCOPE-KIDS-SHARED, REQ-PROOF-AUTH-001, REQ-PROOF-AUTH-002, REQ-PROOF-AUTH-003, REQ-PROOF-AUTH-004, REQ-PROOF-AUTH-005, REQ-PROOF-AUTH-006, REQ-PROOF-AUTH-007, REQ-PROOF-CORE-004, REQ-PROOF-CORE-006, REQ-PROOF-CORE-008, REQ-PROOF-CORE-009, REQ-PROOF-CORE-010, REQ-PROOF-CORE-013, REQ-PROOF-CORE-016, REQ-PROOF-PROF-001, REQ-PROOF-PROF-002, REQ-PROOF-PROF-003, REQ-PROOF-PROF-004, REQ-PROOF-PROF-005, REQ-PROOF-PROF-006, REQ-PROOF-CAT-001, REQ-PROOF-CAT-002, REQ-PROOF-CAT-003, REQ-PROOF-CAT-004, REQ-PROOF-SURFACE-008, REQ-PROOF-SURFACE-009, AUTHORING-006, AUTHORING-007, AUTHORING-REPAIR-CRASH-REGRESSION, 06-04, DEEP-08-ADDITIONAL-4.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### authoring-core

Task IDs: AUTHORING-001, AUTHORING-002, AUTHORING-003, AUTHORING-004, AUTHORING-005, GATE-MARKETPLACE, GATE-PROOF, GATE-CONFORMANCE, SCOPE-UNTRUSTED-PLUGINS, SCOPE-GENERAL-E2, SCOPE-KIDS-SHARED, REQ-PROOF-AUTH-002, REQ-PROOF-CORE-009, REQ-PROOF-CORE-010, REQ-PROOF-PROF-005, AUTHORING-006, AUTHORING-007, AUTHORING-REPAIR-CRASH-REGRESSION, DEEP-08-ADDITIONAL-4.

Exclusive exact files:

- `packages/authoring-core/README.md`
- `packages/authoring-core/internal/project-git-authority.ts`
- `packages/authoring-core/src/apply-journal.ts`
- `packages/authoring-core/src/assistant-sculpt.ts`
- `packages/authoring-core/src/atomic-write.ts`
- `packages/authoring-core/src/content-hash.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/json-invariants.ts`
- `packages/authoring-core/src/json-pointer.ts`
- `packages/authoring-core/src/minimum-e2.ts`
- `packages/authoring-core/src/model-provider-port.ts`
- `packages/authoring-core/src/project-git.ts`
- `packages/authoring-core/src/project-model.ts`
- `packages/authoring-core/src/propose-apply.ts`
- `packages/authoring-core/src/rarity-authoring.ts`
- `packages/authoring-core/src/rarity-evidence.ts`
- `packages/authoring-core/src/scene-composition.ts`
- `packages/authoring-core/src/sculpt-procedural-emit.ts`
- `packages/authoring-core/src/sculpt-reconstruction.ts`
- `packages/authoring-core/src/unified-diff.ts`
- `packages/authoring-core/test/assistant-sculpt.test.ts`
- `packages/authoring-core/test/final-acceptance.test.ts`
- `packages/authoring-core/test/journal-recovery.test.ts`
- `packages/authoring-core/test/model-provider-port.test.ts`
- `packages/authoring-core/test/project-git.test.ts`
- `packages/authoring-core/test/project-model.test.ts`
- `packages/authoring-core/test/scene-composition.test.ts`
- `packages/authoring-core/test/sculpt-reconstruction.test.ts`
- `packages/authoring-core/test/seam.test.ts`
- `packages/authoring-core/test/transaction-history.test.ts`
- `packages/authoring-core/tsconfig.json`

### importers-plugin

Task IDs: AP-01, AP-02, AP-03, AP-04, AP-05, AP-07, AP-PERF, REQ-PROOF-CORE-008, 06-04.

Exclusive exact files:

- `packages/importers/README.md`
- `packages/importers/src/contained-gltf.ts`
- `packages/importers/src/index.ts`
- `packages/importers/test/baseline-regression-proof.mjs`
- `packages/importers/test/contained-gltf.test.ts`
- `packages/importers/test/document-import.test.ts`
- `packages/importers/test/fixtures/source.sceneaxi.json`
- `packages/importers/test/fixtures/unsupported-schema.sceneaxi.json`
- `packages/importers/test/seam.test.ts`
- `packages/importers/tsconfig.json`
- `packages/plugin-host/README.md`
- `packages/plugin-host/src/host-api-range.ts`
- `packages/plugin-host/src/host.ts`
- `packages/plugin-host/src/index.ts`
- `packages/plugin-host/src/isolation.ts`
- `packages/plugin-host/src/pipeline.ts`
- `packages/plugin-host/src/types.ts`
- `packages/plugin-host/test/cache-front-door-proof.mjs`
- `packages/plugin-host/test/load-refuse.test.ts`
- `packages/plugin-host/test/refuse-matrix.test.ts`
- `packages/plugin-host/test/seam.test.ts`
- `packages/plugin-host/tsconfig.json`

### profiles-kids

Task IDs: PK-001, PK-002, PK-004, PK-003, PK-005, REQ-PROOF-PROF-003, REQ-PROOF-PROF-004, REQ-PROOF-SURFACE-009.

Exclusive exact files:

- `packages/profile-game/README.md`
- `packages/profile-game/src/index.ts`
- `packages/profile-game/test/conformance.test.ts`
- `packages/profile-game/test/open-path.test.ts`
- `packages/profile-game/test/seam.test.ts`
- `packages/profile-game/tsconfig.json`
- `packages/profile-kids/PRODUCT.md`
- `packages/profile-kids/README.md`
- `packages/profile-kids/src/index.ts`
- `packages/profile-kids/src/kids-activity.ts`
- `packages/profile-kids/test/activity.test.ts`
- `packages/profile-kids/test/policy.test.ts`
- `packages/profile-kids/test/refuse-matrix.test.ts`
- `packages/profile-kids/test/seam.test.ts`
- `packages/profile-kids/tsconfig.json`
- `packages/profile-web/README.md`
- `packages/profile-web/src/index.ts`
- `packages/profile-web/test/authoring.test.ts`
- `packages/profile-web/test/browser-experience-proof.mjs`
- `packages/profile-web/test/experience-scenarios.test.ts`
- `packages/profile-web/test/open-path.test.ts`
- `packages/profile-web/test/policy.test.ts`
- `packages/profile-web/test/seam.test.ts`
- `packages/profile-web/tsconfig.json`
- `sites/kids/.env.example`
- `sites/kids/README.md`
- `sites/kids/next.config.ts`
- `sites/kids/page-extensions.json`
- `sites/kids/security-headers.json`
- `sites/kids/src/app/_components/kids-studio.tsx`
- `sites/kids/src/app/globals.css`
- `sites/kids/src/app/layout.tsx`
- `sites/kids/src/app/page.tsx`
- `sites/kids/src/index.ts`
- `sites/kids/src/lib/kids-activity.ts`
- `sites/kids/src/lib/security-policy.ts`
- `sites/kids/test/production-activity.spec.ts`
- `sites/kids/test/visual-evidence/after-activity-desktop.png`
- `sites/kids/test/visual-evidence/after-activity-mobile.png`
- `sites/kids/test/visual-evidence/after-playing-desktop.png`
- `sites/kids/test/visual-evidence/after-playing-mobile.png`
- `sites/kids/test/visual-evidence/before-activity-desktop.png`
- `sites/kids/test/visual-evidence/before-activity-mobile.png`
- `sites/kids/test/visual-evidence/before-playing-desktop.png`
- `sites/kids/test/visual-evidence/before-playing-mobile.png`
- `sites/kids/tsconfig.json`

## Lead-only cross-file task coordination

AP-06, COVERAGE-AUTHORING, COVERAGE-ASSETS-PLUGINS, COVERAGE-PROFILES-KIDS, REQ-PROOF-AUTH-001, REQ-PROOF-AUTH-003, REQ-PROOF-AUTH-004, REQ-PROOF-AUTH-005, REQ-PROOF-AUTH-006, REQ-PROOF-AUTH-007, REQ-PROOF-CORE-004, REQ-PROOF-CORE-006, REQ-PROOF-CORE-013, REQ-PROOF-CORE-016, REQ-PROOF-PROF-001, REQ-PROOF-PROF-002, REQ-PROOF-PROF-006, REQ-PROOF-CAT-001, REQ-PROOF-CAT-002, REQ-PROOF-CAT-003, REQ-PROOF-CAT-004, REQ-PROOF-SURFACE-008

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-authoring-assets.md` and `../fix-authoring-assets.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.
