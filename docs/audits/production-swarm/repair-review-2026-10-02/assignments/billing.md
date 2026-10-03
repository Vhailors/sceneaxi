# Assignment — billing

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (25): GATE-LIVE, GATE-CONNECT, GATE-STRIPE-TEST, GATE-COMMERCIAL, GATE-RESTORE, SCOPE-MULTICURRENCY, SCOPE-CUSTOMER-LINKING, SCOPE-HOSTED-OFF, LOCAL-PROOF-020, LOCAL-PROOF-021, LOCAL-PROOF-023, LOCAL-PROOF-024, LOCAL-PROOF-025, LOCAL-PROOF-031, LOCAL-PROOF-032, LOCAL-PROOF-033, LOCAL-PROOF-035, LOCAL-PROOF-036, LOCAL-PROOF-037, 05-001, 05-002, 05-003, 05-004, 05-005, DEEP-08-ADDITIONAL-3.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### provider-checkout-db

Task IDs: LOCAL-PROOF-031, 05-002, 05-003.

Exclusive exact files:

- `db/README.md`
- `db/local-postgres-oracle.mjs`
- `db/migrations/0000_schema_migrations.sql`
- `db/migrations/0001_identity.sql`
- `db/migrations/0002_credits_billing.sql`
- `db/migrations/0003_checkout_session_intent_price_immutability.sql`
- `db/migrations/0004_stripe_connect_audit.sql`
- `db/migrations/0005_better_auth_provider.sql`
- `db/migrations/0006_credit_reconciliation.sql`
- `db/migrations/0007_stripe_live_mode_audit.sql`
- `db/migrations/0008_credit_chain_hosted_budget.sql`
- `sites/umbrella/src/app/account/page.tsx`
- `sites/umbrella/src/app/api/checkout/checkout-handler.ts`
- `sites/umbrella/src/app/api/checkout/route.ts`
- `sites/umbrella/src/app/api/stripe/webhook/route.ts`
- `sites/umbrella/src/lib/provider-adapters.ts`
- `sites/umbrella/test/better-auth-provider.test.ts`
- `sites/umbrella/test/provider-adapters.integration.test.ts`

### billing-core

Task IDs: GATE-LIVE, GATE-CONNECT, GATE-STRIPE-TEST, GATE-COMMERCIAL, GATE-RESTORE, SCOPE-MULTICURRENCY, SCOPE-CUSTOMER-LINKING, SCOPE-HOSTED-OFF, 05-001, 05-005, DEEP-08-ADDITIONAL-3.

Exclusive exact files:

- `packages/billing/README.md`
- `packages/billing/src/catalog-listings.ts`
- `packages/billing/src/checkout.ts`
- `packages/billing/src/credit-packs.ts`
- `packages/billing/src/entitlements.ts`
- `packages/billing/src/fixture-commerce.ts`
- `packages/billing/src/hosted-ai.ts`
- `packages/billing/src/index.ts`
- `packages/billing/src/ledger.ts`
- `packages/billing/src/live-mode.ts`
- `packages/billing/src/metering.ts`
- `packages/billing/src/refusals.ts`
- `packages/billing/src/revenue-share.ts`
- `packages/billing/src/store.ts`
- `packages/billing/src/stripe-connect.ts`
- `packages/billing/src/stripe-webhook.ts`
- `packages/billing/src/support-ledger.ts`
- `packages/billing/test/catalog-listings.test.ts`
- `packages/billing/test/credit-pack-archive.test.ts`
- `packages/billing/test/credit-pack-grant-anchor.test.ts`
- `packages/billing/test/entitlements.test.ts`
- `packages/billing/test/fixture-commerce.test.ts`
- `packages/billing/test/hosted-ai.test.ts`
- `packages/billing/test/ledger.test.ts`
- `packages/billing/test/live-mode.test.ts`
- `packages/billing/test/metering.test.ts`
- `packages/billing/test/revenue-share.test.ts`
- `packages/billing/test/seam.test.ts`
- `packages/billing/test/store-boundary.test.ts`
- `packages/billing/test/stripe-checkout.test.ts`
- `packages/billing/test/stripe-connect.test.ts`
- `packages/billing/test/stripe-webhook-reconciliation.test.ts`
- `packages/billing/tsconfig.json`

## Lead-only cross-file task coordination

LOCAL-PROOF-020, LOCAL-PROOF-021, LOCAL-PROOF-023, LOCAL-PROOF-024, LOCAL-PROOF-025, LOCAL-PROOF-032, LOCAL-PROOF-033, LOCAL-PROOF-035, LOCAL-PROOF-036, LOCAL-PROOF-037, 05-004

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-billing.md` and `../fix-billing.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.
