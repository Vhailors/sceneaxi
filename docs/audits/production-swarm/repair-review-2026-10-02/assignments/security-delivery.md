# Assignment — security-delivery

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (73): GATE-LICENCE, GATE-TRADEMARK, GATE-ACTIVATION, GATE-AI-PROVIDER, GATE-OBSERVABILITY, GATE-CANONICAL-INPUT, SCOPE-EXTRA-TARGETS, SCOPE-DELAYED-MODULES, LOCAL-PROOF-034, LOCAL-PROOF-041, LOCAL-PROOF-080, LOCAL-PROOF-081, LOCAL-082, LOCAL-PROOF-083, LOCAL-PROOF-084, LOCAL-PROOF-085, LOCAL-PROOF-086, LOCAL-088, REQ-PROOF-TOPO-001, REQ-PROOF-TOPO-002, REQ-PROOF-TOPO-003, REQ-PROOF-TOPO-004, REQ-PROOF-TOPO-005, REQ-PROOF-TOPO-006, REQ-PROOF-TOPO-007, REQ-PROOF-BOUNDARY-001, REQ-PROOF-BOUNDARY-002, REQ-PROOF-BOUNDARY-003, REQ-PROOF-BOUNDARY-004, REQ-PROOF-BOUNDARY-005, REQ-PROOF-BOUNDARY-006, REQ-PROOF-BOUNDARY-007, REQ-PROOF-BOUNDARY-008, REQ-PROOF-BOUNDARY-009, REQ-PROOF-BOUNDARY-010, REQ-PROOF-BOUNDARY-011, REQ-PROOF-BOUNDARY-012, REQ-PROOF-BOUNDARY-013, REQ-PROOF-BOUNDARY-014, REQ-PROOF-BOUNDARY-015, REQ-PROOF-BOUNDARY-016, REQ-PROOF-BOUNDARY-017, REQ-PROOF-BOUNDARY-018, REQ-PROOF-BOUNDARY-019, REQ-PROOF-BOUNDARY-020, REQ-PROOF-BOUNDARY-021, REQ-PROOF-BOUNDARY-022, REQ-PROOF-BOUNDARY-023, REQ-PROOF-BOUNDARY-024, REQ-PROOF-BOUNDARY-025, REQ-PROOF-BOUNDARY-026, REQ-PROOF-SURFACE-005, REQ-PROOF-SURFACE-006, REQ-PROOF-SURFACE-007, REQ-PROOF-SURFACE-010, REQ-PROOF-SURFACE-013, REQ-PROOF-SURFACE-014, PR-001, PR-002, PR-003, PR-004, PR-005, 02-001, 02-002, 02-003, 02-004, 02-005, 06-05, 08-01, 08-02, 08-03, 08-04, 08-05.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### manifests-workflows

Task IDs: GATE-LICENCE, GATE-TRADEMARK, GATE-ACTIVATION, GATE-AI-PROVIDER, GATE-OBSERVABILITY, GATE-CANONICAL-INPUT, SCOPE-EXTRA-TARGETS, SCOPE-DELAYED-MODULES, PR-001, 02-004, 06-05, 08-01, 08-03.

Exclusive exact files:

- `.github/workflows/desktop-artifact-expiry.yml`
- `.github/workflows/desktop-linux.yml`
- `.github/workflows/desktop-macos.yml`
- `.github/workflows/desktop-windows.yml`
- `.github/workflows/engine-sdk.yml`
- `.github/workflows/gate.yml`
- `apps/catalog-game/package.json`
- `apps/catalog-web/package.json`
- `apps/desktop-shell/package.json`
- `apps/web-shell/package.json`
- `desktop/linux/package.json`
- `desktop/linux/pnpm-lock.yaml`
- `desktop/linux/pnpm-workspace.yaml`
- `desktop/macos/package.json`
- `desktop/macos/pnpm-lock.yaml`
- `desktop/macos/pnpm-workspace.yaml`
- `desktop/windows/package.json`
- `desktop/windows/pnpm-lock.yaml`
- `desktop/windows/pnpm-workspace.yaml`
- `package.json`
- `packages/auth/package.json`
- `packages/authoring-core/package.json`
- `packages/billing/package.json`
- `packages/cli/package.json`
- `packages/engine-kernel/package.json`
- `packages/engine-orchestrator/package.json`
- `packages/engine-presentation/package.json`
- `packages/importers/package.json`
- `packages/physics-rapier/package.json`
- `packages/plugin-host/package.json`
- `packages/profile-game/package.json`
- `packages/profile-kids/package.json`
- `packages/profile-web/package.json`
- `packages/provider-openrouter/package.json`
- `packages/schemas/package.json`
- `packages/site-kit/package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `sites/catalog-game/package.json`
- `sites/catalog-game/pnpm-lock.yaml`
- `sites/catalog-game/pnpm-workspace.yaml`
- `sites/catalog-web/package.json`
- `sites/catalog-web/pnpm-lock.yaml`
- `sites/catalog-web/pnpm-workspace.yaml`
- `sites/kids/package.json`
- `sites/kids/pnpm-lock.yaml`
- `sites/kids/pnpm-workspace.yaml`
- `sites/umbrella/package.json`
- `sites/umbrella/pnpm-lock.yaml`
- `sites/umbrella/pnpm-workspace.yaml`
- `tests/e2e/fixtures/plugin-host/illegal-claim/package.json`
- `tests/e2e/fixtures/plugin-host/sample-capability/package.json`
- `tests/e2e/fixtures/plugin-host/sample-inert/package.json`
- `tests/e2e/fixtures/plugin-host/sculpt-intake-source-broken/package.json`
- `tests/e2e/fixtures/plugin-host/sculpt-intake-source/package.json`

### scripts-checkers

Task IDs: REQ-PROOF-TOPO-002, REQ-PROOF-BOUNDARY-001, REQ-PROOF-BOUNDARY-002, REQ-PROOF-BOUNDARY-003, REQ-PROOF-BOUNDARY-004, REQ-PROOF-BOUNDARY-005, REQ-PROOF-BOUNDARY-006, REQ-PROOF-BOUNDARY-007, REQ-PROOF-BOUNDARY-008, REQ-PROOF-BOUNDARY-009, REQ-PROOF-BOUNDARY-010, REQ-PROOF-BOUNDARY-011, REQ-PROOF-BOUNDARY-012, REQ-PROOF-BOUNDARY-013, REQ-PROOF-BOUNDARY-014, REQ-PROOF-BOUNDARY-015, REQ-PROOF-BOUNDARY-016, REQ-PROOF-BOUNDARY-017, REQ-PROOF-BOUNDARY-018, REQ-PROOF-BOUNDARY-019, REQ-PROOF-BOUNDARY-020, REQ-PROOF-BOUNDARY-021, REQ-PROOF-BOUNDARY-022, REQ-PROOF-BOUNDARY-023, REQ-PROOF-BOUNDARY-024, REQ-PROOF-BOUNDARY-025, REQ-PROOF-BOUNDARY-026.

Exclusive exact files:

- `scripts/build-engine-sdk.d.mts`
- `scripts/build-engine-sdk.mjs`
- `scripts/check-boundaries.mjs`
- `scripts/check-contracts.mjs`
- `scripts/check-contracts.test.mjs`
- `scripts/check-desktop-artifact-expiry.d.mts`
- `scripts/check-desktop-artifact-expiry.mjs`
- `scripts/check-desktop.mjs`
- `scripts/check-publish-ready.d.mts`
- `scripts/check-publish-ready.mjs`
- `scripts/check-sites.mjs`
- `scripts/check-syntax.mjs`
- `scripts/check-traceability.d.mts`
- `scripts/check-traceability.mjs`
- `scripts/check-vercel-package.d.mts`
- `scripts/check-vercel-package.mjs`
- `scripts/db-migrate.mjs`
- `scripts/delivery-local-oracle.test.mjs`
- `scripts/docs-api.mjs`
- `scripts/engine-sdk-files.json`
- `scripts/finish-catalog-browser-proof.mjs`
- `scripts/lib/package-exports.mjs`
- `scripts/lib/zip.d.mts`
- `scripts/lib/zip.mjs`
- `scripts/local-sbom.mjs`
- `scripts/probe-surfaces.mjs`
- `scripts/surface-map.mjs`
- `scripts/tutorial-local-oracle.test.mjs`
- `scripts/workspace-dist-resolver.mjs`

## Lead-only cross-file task coordination

LOCAL-PROOF-034, LOCAL-PROOF-041, LOCAL-PROOF-080, LOCAL-PROOF-081, LOCAL-082, LOCAL-PROOF-083, LOCAL-PROOF-084, LOCAL-PROOF-085, LOCAL-PROOF-086, LOCAL-088, REQ-PROOF-TOPO-001, REQ-PROOF-TOPO-003, REQ-PROOF-TOPO-004, REQ-PROOF-TOPO-005, REQ-PROOF-TOPO-006, REQ-PROOF-TOPO-007, REQ-PROOF-SURFACE-005, REQ-PROOF-SURFACE-006, REQ-PROOF-SURFACE-007, REQ-PROOF-SURFACE-010, REQ-PROOF-SURFACE-013, REQ-PROOF-SURFACE-014, PR-002, PR-003, PR-004, PR-005, 02-001, 02-002, 02-003, 02-005, 08-02, 08-04, 08-05

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-security-delivery.md` and `../fix-security-delivery.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.
