# Assignment — missing-capabilities

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (59): CLI-CAP-01, CLI-CAP-02, CLI-CAP-03, CLI-CAP-04, CLI-CAP-05, CLI-CAP-06, CLI-CAP-07, CLI-PACK-01, SH-T01, SH-T02, SH-T03, SH-T04, SH-T05, SH-T06, SH-T07, SH-T08, UI-001, UI-002, IDENTITY-02, IDENTITY-03, IDENTITY-04, IDENTITY-05, BD-001, BD-002, BD-003, BD-004, BD-005, BD-006, BD-007, BD-008, DOPS-001, DOPS-002, DOPS-003, DOPS-004, DOPS-005, DOPS-006, CAT-DURABLE-INTAKE, BILLING-PRICE-POLICY, BILLING-RESTORE-LOCAL, BILLING-REALPG-REGRESSION, IDENTITY-ADMIN-HARDENING, SITE-PERSISTENCE, OPS-TUTORIAL-ORACLE, OPS-DOC-REVALIDATION, SITE-CATALOG-IDENTITY, AI-TRANSPORT-LOCAL, OPS-DELAYED-CONTRACTS, DELIVERY-PWA-LOCAL, LOCAL-070, COVERAGE-SITES-UI, COVERAGE-IDENTITY, COVERAGE-BILLING-DATA, COVERAGE-DELIVERY-OPS, AP-08, GA-001, GA-002, GA-003, GA-004, GA-005.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### site-kit-capabilities

Task IDs: SITE-PERSISTENCE, SITE-CATALOG-IDENTITY.

Exclusive exact files:

- `packages/site-kit/README.md`
- `packages/site-kit/src/access-states.ts`
- `packages/site-kit/src/admin-reauth.ts`
- `packages/site-kit/src/catalog-browse.ts`
- `packages/site-kit/src/catalog-durable.ts`
- `packages/site-kit/src/catalog-identity.ts`
- `packages/site-kit/src/catalog-pipeline.ts`
- `packages/site-kit/src/catalog.ts`
- `packages/site-kit/src/change-review.ts`
- `packages/site-kit/src/commerce-notice.ts`
- `packages/site-kit/src/deep-link.ts`
- `packages/site-kit/src/design-tokens.ts`
- `packages/site-kit/src/desktop-app-offer.ts`
- `packages/site-kit/src/editor-session.ts`
- `packages/site-kit/src/editor-shell.ts`
- `packages/site-kit/src/editor-state.ts`
- `packages/site-kit/src/engine-sdk-offer.ts`
- `packages/site-kit/src/entitlement.ts`
- `packages/site-kit/src/live-open.ts`
- `packages/site-kit/src/mountable-scene.ts`
- `packages/site-kit/src/offline-web-export.ts`
- `packages/site-kit/src/ports.ts`
- `packages/site-kit/src/profile-contracts.ts`
- `packages/site-kit/src/purchase-history.ts`
- `packages/site-kit/src/refusals.ts`
- `packages/site-kit/src/site-element.ts`
- `packages/site-kit/src/site-search-params.ts`
- `packages/site-kit/src/site-session.ts`
- `packages/site-kit/src/starter-artifact.ts`
- `packages/site-kit/src/starter-prop-intake.ts`
- `packages/site-kit/src/state-panel.ts`
- `packages/site-kit/src/web-editor.ts`
- `packages/site-kit/src/web-experience-editor.ts`
- `packages/site-kit/test/access-states.test.ts`
- `packages/site-kit/test/catalog.test.ts`
- `packages/site-kit/test/change-review.test.ts`
- `packages/site-kit/test/commerce-notice.test.ts`
- `packages/site-kit/test/design-tokens.test.ts`
- `packages/site-kit/test/desktop-app-offer.test.ts`
- `packages/site-kit/test/editor-session.test.ts`
- `packages/site-kit/test/editor-shell.test.ts`
- `packages/site-kit/test/editor-state.test.ts`
- `packages/site-kit/test/entitlement.test.ts`
- `packages/site-kit/test/final-sites-acceptance.test.ts`
- `packages/site-kit/test/live-open.test.ts`
- `packages/site-kit/test/login-plane.test.ts`
- `packages/site-kit/test/mountable-scene.test.ts`
- `packages/site-kit/test/offline-web-browser-proof.mjs`
- `packages/site-kit/test/ports.test.ts`
- `packages/site-kit/test/refuse-matrix.test.ts`
- `packages/site-kit/test/seam.test.ts`
- `packages/site-kit/test/site-config.test.ts`
- `packages/site-kit/test/site-element.test.ts`
- `packages/site-kit/test/site-session.test.ts`
- `packages/site-kit/test/state-panel.test.ts`
- `packages/site-kit/test/web-editor.test.ts`
- `packages/site-kit/test/web-experience-editor.test.ts`
- `packages/site-kit/tsconfig.json`

## Lead-only cross-file task coordination

CLI-CAP-01, CLI-CAP-02, CLI-CAP-03, CLI-CAP-04, CLI-CAP-05, CLI-CAP-06, CLI-CAP-07, CLI-PACK-01, SH-T01, SH-T02, SH-T03, SH-T04, SH-T05, SH-T06, SH-T07, SH-T08, UI-001, UI-002, IDENTITY-02, IDENTITY-03, IDENTITY-04, IDENTITY-05, BD-001, BD-002, BD-003, BD-004, BD-005, BD-006, BD-007, BD-008, DOPS-001, DOPS-002, DOPS-003, DOPS-004, DOPS-005, DOPS-006, CAT-DURABLE-INTAKE, BILLING-PRICE-POLICY, BILLING-RESTORE-LOCAL, BILLING-REALPG-REGRESSION, IDENTITY-ADMIN-HARDENING, OPS-TUTORIAL-ORACLE, OPS-DOC-REVALIDATION, AI-TRANSPORT-LOCAL, OPS-DELAYED-CONTRACTS, DELIVERY-PWA-LOCAL, LOCAL-070, COVERAGE-SITES-UI, COVERAGE-IDENTITY, COVERAGE-BILLING-DATA, COVERAGE-DELIVERY-OPS, AP-08, GA-001, GA-002, GA-003, GA-004, GA-005

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-missing-capabilities.md` and `../fix-missing-capabilities.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.

## Uncovered original tasks — exclusive primary task responsibility

The following 53 IDs had no finish row; they are exclusively assigned here. Other lanes remain source owners when their exact paths are required. Do not hide local work under external-only labels; split genuine credentials/signing/hardware from missing local adapters.

AI-TRANSPORT-LOCAL, BD-001, BD-002, BD-003, BD-004, BD-005, BD-006, BD-007, BD-008, BILLING-PRICE-POLICY, BILLING-REALPG-REGRESSION, BILLING-RESTORE-LOCAL, CAT-DURABLE-INTAKE, CLI-CAP-01, CLI-CAP-02, CLI-CAP-03, CLI-CAP-04, CLI-CAP-05, CLI-CAP-06, CLI-CAP-07, CLI-PACK-01, COVERAGE-BILLING-DATA, COVERAGE-DELIVERY-OPS, COVERAGE-IDENTITY, COVERAGE-SITES-UI, DELIVERY-PWA-LOCAL, DOPS-001, DOPS-002, DOPS-003, DOPS-004, DOPS-005, DOPS-006, IDENTITY-02, IDENTITY-03, IDENTITY-04, IDENTITY-05, IDENTITY-ADMIN-HARDENING, LOCAL-070, OPS-DELAYED-CONTRACTS, OPS-DOC-REVALIDATION, OPS-TUTORIAL-ORACLE, SH-T01, SH-T02, SH-T03, SH-T04, SH-T05, SH-T06, SH-T07, SH-T08, SITE-CATALOG-IDENTITY, SITE-PERSISTENCE, UI-001, UI-002.

Detailed acceptance may be expanded by this designated worker, preserving all canonical assertions and the nonblank executable command already provided. Implement unclaimed site-kit helper/test work concurrently; request exact shared schema/root-test/manifest and other-lane patches. DR-006 native user-project adapter is a local dependency, separate from external signing/native certification.
