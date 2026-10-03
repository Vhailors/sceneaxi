# Builder assignment — billing-data

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/catalog-listings.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/checkout.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/credit-packs.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/entitlements.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/fixture-commerce.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/ledger.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/live-mode.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/metering.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/refusals.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/revenue-share.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/stripe-connect.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/stripe-webhook.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/support-ledger.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/catalog-listings.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/credit-pack-archive.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/credit-pack-grant-anchor.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/entitlements.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/fixture-commerce.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/ledger.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/live-mode.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/metering.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/revenue-share.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/store-boundary.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/stripe-checkout.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/stripe-connect.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/stripe-webhook-reconciliation.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/admin/ledger/page.tsx`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/admin/ledger/route.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/stripe/webhook/route.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/credit-webhook.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/provider-adapters.integration.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [4, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 51]. Authority requirement IDs: [].

### GATE-LIVE: genuine-external-blocker / P0
Stripe LIVE stays separately held
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Exact LIVE go-live decision and every PRE-AUTH/POST-AUTH condition; real reviewed pricing/tax/provider objects and credentials via secure store; action-specific financial authority. No invented witness, keys, price revisions or environment bypass.

### BD-001: implementation-needed / P1
New forward migration per-account serialized next-sequence/previousbalance+delta/safeinteger/nonnegative validation; preserve idempotent replay.
- Chosen solution: New forward migration per-account serialized next-sequence/previousbalance+delta/safeinteger/nonnegative validation; preserve idempotent replay.
- Acceptance: ["Invalid row rejected/no append; same-key race two successes one row; gaps/overflow/forged balance/overdraft refuse; update/delete still refuse."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 816, "symbol": "appendOrReplayEntry"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts", "line": 348, "symbol": "assertAppendable"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/db/migrations/0002_credits_billing.sql", "line": 23, "symbol": "credit_ledger_entries"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 816, "symbol": "appendOrReplayEntry", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts", "line": 348, "symbol": "assertAppendable", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/db/migrations/0002_credits_billing.sql", "line": 23, "symbol": "credit_ledger_entries", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["integration exact migration numbering", "existing malformed production-data preflight, no silent repair"]
- Evidence/reproduction: {"reproduction": "Provision own isolated account, public store append first debit delta=-500/balanceAfter10/sequence1; accepted and raw sum -500; loader refuses chain.", "refutation": "Business appendCreditEntry computes safe balance; not proven HTTP theft. Persistence row schema/DDL independently lack chain checks.", "impact": "Permanent append-only account poisoning and false independent DB nonnegative invariant.", "kind": "confirmed-defect", "status": "open-local"}
- Commands: ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/umbrella test:integration", "pnpm exec vitest run tests/db/schema-lockstep.test.ts packages/billing/test/store-boundary.test.ts", "actual db runner + public adapter real PG oracle E5"]

### BD-007: implementation-needed / P1
Local reservation/replay/result coordination and honest default-off UI; no live spend or invented economic values.
- Chosen solution: Local reservation/replay/result coordination and honest default-off UI; no live spend or invented economic values.
- Acceptance: ["Overlapping same-key one provider/one debit, different keys no funds over-reservation, failed provider releases, uncertain results recoverable, Kids calls0 and admin/BYOK free."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 501, "symbol": "runMeteredModelCall"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 698, "symbol": "runMeteredModelCall"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts", "line": 395, "symbol": "concurrent same-key debit test"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 501, "symbol": "runMeteredModelCall", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 698, "symbol": "runMeteredModelCall", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts", "line": 395, "symbol": "concurrent same-key debit test", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: ["durable operation reservation/result vocabulary/storage", "server-owned credit pricing policy", "real provider inputs/action authority remain external"]
- Evidence/reproduction: {"reproduction": "Source/test deliberately admit overlapping same-key provider calls before single debit; no enabled hosted HTTP front door or pricing transport exists.", "refutation": "Default off/Kids deny/sequential replay/nonnegative/admin/BYOK protections pass; not active production exploit.", "impact": "Cannot claim paid hosted exactly-once provider cost/result recovery or full advertised functionality.", "kind": "capability-gap-before-paid-activation", "status": "local-capability-and-external-activation"}
- Commands: ["pnpm exec vitest run packages/billing/test/hosted-ai.test.ts packages/billing/test/metering.test.ts tests/e2e/hosted-ai-metering-golden.test.ts"]

### BILLING-PRICE-POLICY: implementation-needed / P1
Server-owned hosted credit pricing policy boundary
- Chosen solution: Resolve price by vetted model/operation policy, reject caller-invented/unknown values, keep enabled false without actual commercial input. No fabricated production numeric table.
- Acceptance: ["Unknown/mismatched model/operation/credit quotes reject; caller cannot choose charge; admin/BYOK/Kids protections unchanged."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### BILLING-REALPG-REGRESSION: implementation-needed / P1
Repeatable real PostgreSQL concurrency/fault tests
- Chosen solution: Convert independent owned PG adapter/runner/webhook before evidence into repeatable existing-tool regression requests, no new test harness or dependency.
- Acceptance: ["Exact durable chain, same-key races, distinct sequence rollback, intent-before-provider, signed fixture replay/refund/dispute and migration checksums proven against disposable real PG."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/tests/db/postgres-concurrency.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/provider-adapters.integration.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### BILLING-RESTORE-LOCAL: implementation-needed / P1
Repeatable local backup/restore oracle
- Chosen solution: Use existing disposable PostgreSQL and native pg_dump/restore to exercise own fixture migrations/ledger/idempotency and checksum triggers; do not create production branch or attest Neon.
- Acceptance: ["Restored own DB counts/digests exact; append-only guards/idempotency/reconciliation preserved; production untouched."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/tests/db/restore.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### COVERAGE-BILLING-DATA: implementation-needed / P1
Remaining current-source/front-door coverage: billing-data
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Configured authenticated HTTP checkout/support success and full browser customer lifecycle", "Actual Stripe/Neon SDK network failures/timeouts/subscriptions/provider delivery", "Production/distributed load and migration/schema/privileges", "Actual Neon PITR/restore drill", "Full real-PG Better Auth support/Connect lifecycle (existing PGlite support/Connect tests remain bounded proof)"]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json"]

### GATE-COMMERCIAL: genuine-external-blocker / P1
Commercial tax/receipt/refund/dispute policy inputs absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Real legal entity/countries/tax registration obligations, invoice/receipt/customer/refund/dispute/access-resolution and economically approved credit-price values. Default TEST/USD/card-only/no automatic clawback; do not fabricate commercial values.

### GATE-CONNECT: genuine-external-blocker / P1
Connect LIVE and operational provider evidence absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Separate Connect LIVE/marketplace action authority, real approved provider/dashboard/store/secret readiness and signed onboarding/payout evidence. TEST mode and synthetic witnesses do not close this.

### GATE-RESTORE: genuine-external-blocker / P1
Production backup/PITR/restore evidence absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Name-only real Neon target/schema/checksum/privilege/PITR retention evidence, explicit isolated timestamp-restore action authority, actual restored counts/digests/triggers/comparison and unchanged-production observation. Local pg_dump restore is separate local evidence.

### GATE-STRIPE-TEST: genuine-external-blocker / P1
Genuine subscribed TEST settlement and reconciliation proof absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Authorized TEST owner verifies current endpoint/subscriptions to checkout.session.completed, charge.refunded, charge.dispute.created, charge.dispute.closed; genuine signed delivery/replay/out-of-order, exact persisted intent/session binding, one grant/refund/reconciliation and authenticated support proof. No dashboard/account/payment action here.

### BD-002: implementation-needed / P2
Catch bounded form decoding, named400/403 JSON; preserve same-site relative browser303 and fail-closed guards.
- Chosen solution: Catch bounded form decoding, named400/403 JSON; preserve same-site relative browser303 and fail-closed guards.
- Acceptance: ["Malformed JSON/truncated multipart safely refused, cross-origin403 for JSON, zero provider entries."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 55, "symbol": "POST"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 24, "symbol": "refusalResponse"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 55, "symbol": "POST", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 24, "symbol": "refusalResponse", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: ["registered site refusal vocabulary, shared schemas/site-kit owner if needed"]
- Evidence/reproduction: {"reproduction": "Same-origin JSON POST produces500 empty; cross-origin JSON-accept produces402 instead of403.", "refutation": "Origin proof precedes malformed parse; no forged provider session.", "impact": "Unhandled user input/server fault and misleading status classification.", "kind": "confirmed-defect", "status": "open-local"}
- Commands: ["pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts tests/sites/site-response-hardening.test.ts", "umbrella existing build/start and E8 real POSTs"]

### BD-003: implementation-needed / P2
Neutral returned-from-checkout notice; only authenticated persisted evidence can claim payment receipt.
- Chosen solution: Neutral returned-from-checkout notice; only authenticated persisted evidence can claim payment receipt.
- Acceptance: ["Forged query no paid/receipt claim/no mutation; pending/cancel/confirmed distinguished."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 190, "symbol": "AccountPage"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 190, "symbol": "AccountPage", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "Unconfigured signed-out GET ?checkout=success contains Payment received.", "refutation": "No credit grant claimed; confirmation remains pending, but receipt itself is unproven.", "impact": "Customer/support misinformation from arbitrary link.", "kind": "confirmed-defect", "status": "open-local"}
- Commands: ["pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts", "existing umbrella build/start E8 GET"]

### BD-004: implementation-needed / P2
Clock-injected durable per-user NEW-attempt budget; replay-free old keys;429/retry-after; no per-process-only production claim.
- Chosen solution: Clock-injected durable per-user NEW-attempt budget; replay-free old keys;429/retry-after; no per-process-only production claim.
- Acceptance: ["Burst and cross-process excess refuse before provider, user isolation, same-key retries permitted."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 61, "symbol": "POST"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts", "line": 1022, "symbol": "createCheckout"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1435, "symbol": "createStripeCheckoutSessionAdapter"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 61, "symbol": "POST", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts", "line": 1022, "symbol": "createCheckout", "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1435, "symbol": "createStripeCheckoutSessionAdapter", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: ["identity lane guard injection", "new durable migration/shared site refusal"]
- Evidence/reproduction: {"reproduction": "New valid attempts select fresh idempotency keys and call adapter with no throttle in audited paths; no actual flood attempted.", "refutation": "Stable mandatory token fixes old random fallback; existing per-key replay is correct.", "impact": "Unbounded per-member new intents/provider sessions.", "kind": "confirmed-capability-gap", "status": "open-local"}
- Commands: ["pnpm exec vitest run tests/sites/provider-adapters.test.ts tests/sites/identity-plane-wiring.test.ts", "real PG concurrent budget regression and existing umbrella TEST boundary"]

### BD-005: implementation-needed / P2
Refresh validated history inside lock or whole-run session lock; distinguish applied/dryrun statuses.
- Chosen solution: Refresh validated history inside lock or whole-run session lock; distinguish applied/dryrun statuses.
- Acceptance: ["One tracking row/id under concurrent runs; both succeed or documented safe lock refusal; actual applied output truthful; checksum mismatch remains exit1; dryrun no schema write."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 72, "symbol": "migrate"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 115, "symbol": "psqlExecutor.transaction"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 132, "symbol": "main"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 72, "symbol": "migrate", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 115, "symbol": "psqlExecutor.transaction", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 132, "symbol": "main", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["tests/db/migrate-process.test.ts owner", "no checksum/historical migration edits"]
- Evidence/reproduction: {"reproduction": "Concurrent real runner processes [1 duplicate0000 tracking key,0 applied]; real apply logs would apply.", "refutation": "Atomic transaction rollback prevents data corruption; subsequent status proves applied.", "impact": "Operator automation false failures and inaccurate execution evidence.", "kind": "confirmed-defect", "status": "open-local"}
- Commands: ["pnpm exec vitest run tests/db/migrate-process.test.ts", "actual concurrent runner E9 and checksum tamper E4 against isolated PG"]

### BD-006: implementation-needed / P2
Authenticated scoped/paginated persisted intent+ledger-anchor history/status, no direct identity/billing page imports or widened matrix.
- Chosen solution: Authenticated scoped/paginated persisted intent+ledger-anchor history/status, no direct identity/billing page imports or widened matrix.
- Acceptance: ["Own pending/granted/refunded/reconciliation visible, cross-user refused, restart durability, query alone no settlement."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 35, "symbol": "AccountPage"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1193, "symbol": "listByUserId"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 35, "symbol": "AccountPage", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1193, "symbol": "listByUserId", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/site-kit port owner", "packages/schemas status vocabulary owner if needed", "identity lane identity-plane/request facade"]
- Evidence/reproduction: {"reproduction": "Whole account source renders balance/starter and query notice only; member never receives purchase-history projection; admin alone lists intents.", "refutation": "Existing browser303/cancel/pending and admin support history refute categorical old no-UX claim.", "impact": "Customer cannot reconcile own payment lifecycle/purchases.", "kind": "confirmed-capability-gap", "status": "open-local"}
- Commands: ["pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts tests/sites/identity-plane-wiring.test.ts", "pnpm check:boundaries", "existing umbrella configured fixture HTTP lifecycle"]

### BD-008: implementation-needed / P2
Scoped bounded indexed query and pagination through existing interfaces.
- Chosen solution: Scoped bounded indexed query and pagination through existing interfaces.
- Acceptance: ["Parameterized user filter, bounded page/continuation/order, no cross-user records/no requested global load; guards/replays unchanged."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/support-ledger.ts", "line": 79, "symbol": "readSupportLedger"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 765, "symbol": "listReconciliations"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/support-ledger.ts", "line": 79, "symbol": "readSupportLedger", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 765, "symbol": "listReconciliations", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: ["existing CreditStore adapter type extension", "next forward user/time index migration", "optional shared page/port continuation types"]
- Evidence/reproduction: {"reproduction": "SQL loads/ORDER BY global reconciliation table, support filters one user afterward; account ledger/intents also unbounded.", "refutation": "Admin guard precedes reads, not unauthorized information leak or measured latency claim.", "impact": "O(global events) time/memory per one-user support lookup.", "kind": "confirmed-scale-gap", "status": "open-local"}
- Commands: ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/umbrella test:integration", "real PG many-user query-plan/scoped-page oracle"]

### LOCAL-PROOF-020: done-with-evidence / P2
Bounded implemented portion: Disputes/chargebacks unhandled
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 20, "oldStatus": "done", "current": "local-reconciliation-implemented", "remaining": "Actual event subscription/delivery and money/access-resolution policy; local fixture never production proof."}}]

### LOCAL-PROOF-021: done-with-evidence / P2
Bounded implemented portion: Refunds reconcile only when full and unspent; `STRIPE_REFUND_NOT_FULL` and spent-credit refunds are acknowledg
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 21, "oldStatus": "done", "current": "bounded-full-refund-and-durable-exceptions-implemented", "remaining": "Actual provider proof and refund/dispute monetary policy; partial/spent no silent ACK."}}]

### LOCAL-PROOF-023: done-with-evidence / P2
Bounded implemented portion: No admin/support tooling
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 23, "oldStatus": "done", "current": "local-support-implemented-scale-gap", "remaining": "BD-008 and authorized production success proof/adjustment authority."}}]

### LOCAL-PROOF-024: done-with-evidence / P2
Bounded implemented portion: Checkout UX: refusal is raw JSON `402` to an HTML form; no success/pending/cancel pages; no purchase history o
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 24, "oldStatus": "done", "current": "partial-UX-no-member-history", "remaining": "BD-002,BD-003,BD-006; preserve existing303/cancel/pending states."}}]

### LOCAL-PROOF-025: done-with-evidence / P2
Bounded implemented portion: `/api/checkout` falls back to a random attempt UUID → a new intent and Stripe session per POST; no rate limit
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 25, "oldStatus": "done", "current": "stable-key-fixed-rate-budget-absent", "remaining": "BD-004 and malformed input BD-002."}}]

### LOCAL-PROOF-031: done-with-evidence / P2
Bounded implemented portion: No migration runner and no applied-migrations tracking; `db/README.md` says to apply by hand.
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 31, "oldStatus": "done", "current": "runner-tracking-checksum-implemented-defects", "remaining": "BD-005 concurrent locking/output; real PG migrations executed locally."}}]

### LOCAL-PROOF-032: done-with-evidence / P2
Bounded implemented portion: No backup/PITR/restore policy or drill, while rollback is "forward-fix only" (`production-activation.md
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 32, "oldStatus": "done", "current": "restore-runbook-present-drill-unproven", "remaining": "Actual Neon retention/authorized isolated restore drill; docs alone not readiness."}}]

### LOCAL-PROOF-033: done-with-evidence / P2
Bounded implemented portion: Neon adapters have only been tested against a mock
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 33, "oldStatus": "done", "current": "PGlite-and-independent-real-PG-local-proof", "remaining": "BD-001; repeatable PG regression; actual Neon/network/load/restore evidence absent."}}]

### LOCAL-PROOF-035: done-with-evidence / P2
Bounded implemented portion: No startup env validation; misconfiguration silently becomes "not wired".
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 35, "oldStatus": "done", "current": "name-only-configuration-diagnostics-implemented", "remaining": "Production configured readiness proof; missing/malformed remain named refusals."}}]

### LOCAL-PROOF-036: done-with-evidence / P2
Bounded implemented portion: `ConnectStore` is in-memory only
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 36, "oldStatus": "done", "current": "durable-Neon-Connect-store-local", "remaining": "Actual provider/readiness proof and separate Connect LIVE authority; no in-memory-only claim."}}]

### LOCAL-PROOF-037: done-with-evidence / P2
Bounded implemented portion: No live-mode audit-sink implementation
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 37, "oldStatus": "done", "current": "durable-awaited-live-audit-sink-local", "remaining": "Actual authorization evidence; fixture core witness not operational authority; site remains closed."}}]

### SCOPE-CUSTOMER-LINKING: intentional-nonlaunch-capability / P2
Unused customer-link schema retained
- Chosen solution: Do not destructively drop stripe_customer_links. Implement linking only with genuine receipt/customer lifecycle requirements; unused table is not claimed customer support.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

### SCOPE-HOSTED-OFF: intentional-nonlaunch-capability / P2
Paid hosted AI intentionally default-off
- Chosen solution: Implement safe durable reservation/pricing-policy boundary/server transport locally, but never enable paid calls or fabricate provider/economic evidence.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

### SCOPE-MULTICURRENCY: intentional-nonlaunch-capability / P2
Multicurrency intentionally excluded
- Chosen solution: Keep honest USD TEST/minor units; unsupported currencies refuse. Broader capability remains a full-product gap.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

## Shared requests and acceptance obligations

[{"lane": "billing-data", "sourceKey": "sharedChangesRequested", "requests": [{"owner": "delivery-ops/integration", "files": ["scripts/db-migrate.mjs", "tests/db/migrate-process.test.ts", "docs/production-activation.md", "db/README.md"], "reason": "BD-005 runner/evidence plus activation/migration/recovery docs"}, {"owner": "identity", "files": ["sites/umbrella/src/lib/identity-plane.ts", "sites/umbrella/src/lib/request-authority.ts"], "reason": "History/status and durable new-attempt rate adapter wiring; preserve no-arg deployment authority"}, {"owner": "integration-selected shared package owner", "files": ["packages/site-kit/src identity/credits/history port and tests", "packages/schemas/src and contracts if new wire status needed"], "reason": "BD-004/006 authenticated narrow public projection, no forbidden direct page imports"}, {"owner": "provider transport lane", "files": ["packages/provider-openrouter transport surface and tests"], "reason": "BD-007 transport proof coordination, default-off and no actual spend"}, {"owner": "root manifests owner", "files": ["package.json", "docs/dependency-matrix.json"], "reason": "NO new dependency or widened boundary needed; existing pinned TypeScript/pg/Docker image sufficient"}]}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
