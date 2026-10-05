# Billing/data implementation retry — real application

Graph `sceneaxi-production-swarm`; node `fix-billing-data-retry-bg29`; role `code`; root/cwd `/home/devuser/Documents/Projects/sceneaxi`; HEAD rechecked `4e532e2fbf43e9948741578ab6208a3277870405`.

**Integration result: FAIL — local/shared acceptance remains open. Full production: PARTIAL.** This is not launch approval. The retry found substantial existing billing changes despite the prompt's zero-edit assertion. Existing work was preserved and is not attributed to this retry. No other lane, historical migration, root test, schema, config, lock or deployment was edited. Task-by-task outcomes and exact integration requests are in `fix-billing-data.json`.

## Implemented by this retry

- `packages/billing/src/ledger.ts:100 deriveBalance`: refuse duplicate entry IDs, mixed-account histories and unsafe derived balances. `appendCreditEntry`: refuse ID reuse for a different movement, after identical semantic replay handling.
- `packages/billing/test/ledger.test.ts`: three public ledger regressions. Before: **30 pass/3 fail**, each `expected true to be false`. After: **33 pass/0 fail**. The repair exposed three older adjustment/debit fixtures using the seed's ID; fixtures now carry distinct IDs, with all money/refusal assertions retained. Identical retries still replay and rejected appends leave the seeded state unchanged.
- `packages/billing/src/store.ts:537 createCreditStore.listPurchaseEntries`: remove a forbidden non-null assertion using an availability guard and receiver-preserving invocation. This fixes a real lint failure rather than disabling the rule.

## Preserved and revalidated existing work

Existing `hosted-ai.ts`, `store.ts`, `support-ledger.ts`, public `index.ts`, hosted/store tests, provider adapters, checkout route and account page changes implement server-issued fixture pricing, hosted reservation/result interfaces and recovery, first-row/in-memory ledger validation, scoped reconciliation queries, a purchase-history projection, bounded checkout parsing and unverified return copy. **A projection or optional SQL adapter is not a fully wired launch feature.** Account member history still needs the shared request/identity port and rendered pages; hosted SQL storage/functions are missing.

## Commands and actual results

All commands used the real cwd. `project` reported no command detected; this was routing recovery, not skipped checks. Billing has no own `test` script, so `pnpm --dir packages/billing test` initially failed `ERR_PNPM_NO_SCRIPT`; the exact existing runner was then used.

| Command | Outcome / asserted scope |
|---|---|
| `pnpm exec vitest run packages/billing/test` | **378 pass/0 fail** after repairs; owned pure/package assertions only |
| `pnpm --dir sites/umbrella test:integration` | **1 file/7 tests pass**; PGlite persistence/support/Connect/LIVE-audit fixtures, not real server/network evidence |
| `pnpm exec vitest run tests/db/schema-lockstep.test.ts tests/sites/provider-adapters.test.ts tests/sites/credit-pack-purchase-ux.test.ts tests/sites/site-response-hardening.test.ts tests/e2e/hosted-ai-metering-golden.test.ts` | **107 pass/5 fail**, intentionally routed to integration because root tests are read-only |
| `pnpm exec tsc -p packages/billing/tsconfig.json --noEmit --tsBuildInfoFile /tmp/sceneaxi-bg29-billing.tsbuildinfo` | Exit0; owned typecheck output isolated and removed |
| `pnpm --dir sites/umbrella typecheck` | Exit0; existing app and test TS configs checked |
| `pnpm exec eslint packages/billing/src packages/billing/test sites/umbrella/src/lib/provider-adapters.ts sites/umbrella/src/app/api/checkout/route.ts sites/umbrella/src/app/account/page.tsx --max-warnings 0` | Initially one `no-non-null-assertion`, repaired; final exit0/no issues |
| `pnpm -s check:boundaries && pnpm -s check:contracts` | Exit0; 27 unchanged package-boundary entries and pinned contract fixtures verified |

The first isolated typecheck attempt used `--incremental false` and failed TS6379 (composite project cannot disable incremental); the temp-file invocation above recovered without config edits. The JSON records failed/intermediate invocations, not just successes.

### Five shared-check failures — exact routing, no weakened source

1. `tests/e2e/hosted-ai-metering-golden.test.ts:194 hostedRequest` omits the now-required server-issued price policy/model/operation: three tests fail (`expected false to be true`, or `CREDIT_AMOUNT_INVALID` rather than `HOSTED_AI_PROVIDER_FAILED`). Integration must add `createHostedAiPricingPolicy([{model: MODEL.model, operation: 'complete', capability: 'metered-model-port', credits: 4}])`, supply request model/operation and retain existing provider/debit/replay/refusal assertions. No permissive pricing fallback.
2. `tests/sites/credit-pack-purchase-ux.test.ts:187` expects unsafe old `Payment received. Credits appear once confirmed in your ledger.` text. Assert unverified-return copy and absence of a query-derived receipt instead; do not restore the false receipt claim.
3. `tests/sites/site-response-hardening.test.ts:98` expects literal `request.formData()` after the origin proof. The bounded stream parser now parses a detached Request. Replace the obsolete lexical oracle with equivalent origin-before-body-read and malformed/truncated/oversize behavioral assertions, not a misleading comment to satisfy the old substring.

Failure output: `/home/devuser/.local/share/empryo/tee/2026-10-01T13-19-28-011Z_shell-full.txt`. Shared fixes were sent upstream. Whole-tree build/gate is deferred to serial integration; no concurrent build/dist race is attributed to source. No rebuilt actual HTTP proof is claimed from old `.next` outputs.

## Actual isolated PostgreSQL17 and local restore

Used only the existing cached `postgres:17-alpine` image (`--pull=never`), owned container `sceneaxi-billing-builder-bg29-pg`, trust authentication inside that disposable container, loopback port45439. Databases: `sceneaxi_bg29`, `sceneaxi_bg29_restored`, `sceneaxi_bg29_reconciliation_restored`. No production URL, account or dataset was used.

1. Actual unchanged `scripts/db-migrate.mjs` applied migrations0000–0007; `--status` observed all8 applied checksum rows. Apply still prints **would apply**, confirming unresolved BD-005 output accuracy rather than using that text as proof.
2. Actual SQL reconfirmed the independent DB defect: first debit `delta=-500,balance_after=10` commits and sum(delta)=-500. This corruption fixture was wholly inside a transaction and **rolled back**. There is still no durable `hosted_model_operations` table or `sceneaxi_reserve_hosted_call` function after current migrations. These are local/shared blockers, not external provider blockers.
3. Seeded only explicit synthetic `.invalid`/`fixture_*` user/account/100-credit ledger, TEST intent and a500-minor-unit partial-refund reconciliation fixture. They are **not genuine provider/legal/financial evidence**.
4. Executed `pg_dump --format=custom` then `pg_restore --exit-on-error` into a freshly created owned DB. Used the already installed umbrella `pg` dependency and Node `assert.deepEqual` to compare **all23 public table row counts and SHA256 digests**, including all8 migration rows. Table names were read from `pg_tables`, validated as identifiers; each table used `row_to_json(t)::text` lexical ordering then `SHA256(JSON.stringify(rows))`. Exact populated digests are persisted in JSON; the17 empty tables were also compared, not omitted.
5. On restored data, SQL blocks explicitly required `restrict_violation` for ledger UPDATE/DELETE, reconciliation UPDATE/DELETE and intent price rewrite, and `unique_violation` for a duplicate ledger idempotency key. Unexpected success raised an exception. Final derived ledger100 and reconciliation500 were asserted unchanged.

**BILLING-RESTORE-LOCAL: done for this bounded local criterion.** Not Neon PITR/retention, distributed load, network SDK failure, production privileges, or a complete actual public-adapter/webhook regression. Full BILLING-REALPG-REGRESSION remains open; prior auditor races/intent/webhook evidence is not mislabeled as a newly rerun oracle.

## Remaining local integration work

Exact migration/script/shared requests are in JSON; assignments reserve SQL/schema/root tests/scripts to integration. Do not overwrite historic checksums or silently repair malformed production rows.

- **BD-001:** new forward chain preflight+account locking+sequence/derived balance/safe-bound guards. Preserve append-only triggers and same-key replay; test direct SQL and adapter same-key/different-key races.
- **BD-007:** durable reservation/result table and exact `sceneaxi_reserve_hosted_call(text,text,bigint,text,text,text,timestamptz)` contract. Use the same account lock for reservations and debits; prevent spending other pending/response-ready holds. No automatic expiry/re-execution for uncertain calls.
- **BD-004:** durable per-user new-attempt budget, stable-key retry-free semantics, clock injection,429/retry-after, concurrent-process cap before provider; coordinate identity-plane. No process-local-only or paid-service workaround.
- **BD-005:** whole-run locked migration history and honest applied/dryrun output, checksum and two-process regression; reserved delivery-ops/integration scripts.
- **BD-006:** wire exported `readPurchaseHistory` through site-kit/identity/request facade and real account pages with own-user bounded cursors and durable pending/granted/refunded/reconciliation evidence. Do not ship inert UI.
- **BD-008:** forward scoped reconciliation cursor index, continuation/order/cross-user tests and bounded admin/member rendering.
- **BD-002/003/COVERAGE:** actual changed-handler malformed/cross-origin/forged-return tests and independent current HTTP/browser purchase/support lifecycle, in addition to repairing the five shared tests. A requested additional exact test path `sites/umbrella/test/billing-production-regression.test.ts` was not edited without acknowledgement.

## Exact true external gates

- **GATE-STRIPE-TEST:** exact account/endpoint/mode/window/operator/rollback authority and actual signed completion/replay/refund/dispute deliveries plus subscription observations. No real charge or dashboard mutation occurred.
- **GATE-LIVE/GATE-CONNECT:** separately scoped financial/marketplace activation authority, reviewed provider/legal/readiness and durable audit evidence. Environment switches or fixture witnesses do not supply authority; LIVE/Connect remain held.
- **GATE-COMMERCIAL:** reviewed entity/countries/tax/receipt/refund/dispute/access/retention inputs and real economic values. Do not fabricate a price/tax policy.
- **GATE-RESTORE:** genuine named production retention/PITR/privilege/schema/checksum evidence and specifically authorized isolated production restore. Local PG proof is not a substitute.

**Cleanup complete:** owned container removed (three DBs and in-container dumps removed with it), temp build-info file removed; no named Docker volume created. No commit/push/deploy/publish/new spend/provider account/production migration/data change, secret disclosure, assertion weakening or guard/matrix widening. Integration owns FINAL.md/FINAL.json and independent three-pass FAIL routing; this report does not claim those tasks complete.
