# Assignment — identity-provider

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (13): IDENTITY-01, GATE-RETENTION, GATE-MAIL, SCOPE-CLOSED-SIGNUP, SCOPE-OAUTH, LOCAL-PROOF-014, REQ-PROOF-IDENT-001, REQ-PROOF-IDENT-002, REQ-PROOF-IDENT-003, REQ-PROOF-IDENT-004, REQ-PROOF-IDENT-005, REQ-PROOF-IDENT-006, REQ-PROOF-IDENT-007.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### auth-core

Task IDs: REQ-PROOF-IDENT-002.

Exclusive exact files:

- `packages/auth/README.md`
- `packages/auth/src/admin.ts`
- `packages/auth/src/better-auth-adapter.ts`
- `packages/auth/src/bootstrap.ts`
- `packages/auth/src/identity-port.ts`
- `packages/auth/src/index.ts`
- `packages/auth/src/principal-provenance.ts`
- `packages/auth/src/refusals.ts`
- `packages/auth/src/roles.ts`
- `packages/auth/src/session-token.ts`
- `packages/auth/src/store.ts`
- `packages/auth/src/testing/principal-issuance.ts`
- `packages/auth/test/admin.test.ts`
- `packages/auth/test/identity-port.test.ts`
- `packages/auth/test/principal-provenance.test.ts`
- `packages/auth/test/role-guard.test.ts`
- `packages/auth/test/seam.test.ts`
- `packages/auth/tsconfig.json`

### provider-wiring

Task IDs: GATE-RETENTION, GATE-MAIL, SCOPE-CLOSED-SIGNUP, SCOPE-OAUTH, REQ-PROOF-IDENT-001, REQ-PROOF-IDENT-003.

Exclusive exact files:

- `sites/umbrella/src/app/api/auth/[...all]/route.ts`
- `sites/umbrella/src/app/api/login/route.ts`
- `sites/umbrella/src/app/api/logout/route.ts`
- `sites/umbrella/src/app/login/page.tsx`
- `sites/umbrella/src/lib/identity-plane.ts`
- `sites/umbrella/src/lib/login-flow.ts`
- `sites/umbrella/src/lib/request-authority.ts`
- `sites/umbrella/src/provider/LIFECYCLE-CONTRACT.md`
- `sites/umbrella/src/provider/account-lifecycle.ts`
- `sites/umbrella/src/provider/better-auth-provider-refusals.ts`
- `sites/umbrella/src/provider/better-auth-provider.ts`
- `sites/umbrella/src/provider/recovery-contract.ts`

## Lead-only cross-file task coordination

IDENTITY-01, LOCAL-PROOF-014, REQ-PROOF-IDENT-004, REQ-PROOF-IDENT-005, REQ-PROOF-IDENT-006, REQ-PROOF-IDENT-007

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-identity-provider.md` and `../fix-identity-provider.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.
