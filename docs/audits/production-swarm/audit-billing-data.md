# Independent billing/data audit

Graph `sceneaxi-production-swarm` · role `code` · node `billing-data-audit` · baseline HEAD `4e532e2fbf43e9948741578ab6208a3277870405`.

**Coverage verdict: PASS_WITH_DOCUMENTED_HOLES. Product verification: FAIL (confirmed local defects). Full production: PARTIAL.** Coverage completion is not production readiness. Findings below describe the audited baseline, not subsequent builder closure; integration must retain failing-before/passing-after evidence. Application source remained read-only. Only this report and its JSON companion are owned by this auditor.

Root/cwd for every command: `/home/devuser/Documents/Projects/sceneaxi`. Read AGENTS, layout's identity/billing/site boundary sections, runnable-surfaces, production-activation, baseline, decision-log, the real JSON backlog, and September gap list. No local EMPRYO existed per baseline. Initial auditor status showed only untracked swarm reports, preserving baseline cleanliness. No production DB/provider actions, payments, credential disclosure, dependency/config changes, commits or publication occurred.

## Executed independent evidence

Linux x86_64, Node24.21.0/pnpm9.15.0. Existing Docker image `postgres:17-alpine` was used with `--pull=never`, an owned disposable container, trust authentication and loopback-only port45432. No borrowed database or unrelated container was changed. Container `sceneaxi-billing-audit-pg` was removed after evidence. Installed PostgreSQL17 directory contained clients only; the absent server binary was a routing issue, not a product failure. Real PG below is not Neon/production proof.

| Evidence | Command / boundary | Exit/result/assertions |
|---|---|---|
| E1 | `pnpm exec vitest run --reporter=json --outputFile=/tmp/sceneaxi-billing-audit-vitest.json packages/billing/test tests/db tests/sites/provider-adapters.test.ts tests/sites/identity-plane-wiring.test.ts tests/sites/credit-pack-purchase-ux.test.ts tests/sites/site-response-hardening.test.ts tests/e2e/hosted-ai-metering-golden.test.ts` | 0; **22 actual files, 593 tests, 0 failed, 0 pending**. JSON nested suite total106 is not file count. |
| E2 | `pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/umbrella test:integration` | 0; seven existing PGlite persistence tests: provisioning, replay/sequence race, atomic sale, support role/adjustments/lost response, immutability, Connect split/outcome and awaited live audit. PGlite is not a separate real server. |
| E3 | Actual `node /home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs`, `--status`, `--dry-run`, then repeated apply against disposable real PG | 0 each; all eight migrations0000–0007 stored and checksum-observed; second apply/dry-run no pending rows. Apply misleadingly prints `would apply` despite executing (BD-005). |
| E4 | Mutate only disposable tracking checksum for0007, then actual runner `--status` | Expected exit1: `checksum mismatch or unknown applied migration: 0007_stripe_live_mode_audit`. No historical migration file edited. |
| E5 | Public `createNeonCreditStore().appendOrReplayEntry` over real `pg.Pool` | Same-key concurrent append: two successes/one100-credit row. Distinct keys at sequence2: one success/one23505 refusal, final90. SQL UPDATE/DELETE both SQLSTATE23001. Corrupt negative first debit nevertheless commits (BD-001). |
| E6 | `createStripeCheckoutSessionAdapter().createCheckoutSession` with real PG intent store and injected provider recording call | Intent readable and exactly equal before provider entry; card-only; both Session/PaymentIntent carry identical metadata; stable provider key; immutable price update refused23001. Direct LIVE adapter call refuses before provider. No real Stripe request. |
| E7 | Public `applyCreditPackWebhook` with locally signed fixture bytes + real PG credit/intent adapters | Full refund before grant retry503; forged/stale signature400/no append; two concurrent completion calls one100grant/two acknowledgements; partial refund durable record and replay/no movement; created+closed disputes exact retrieved charge and separate durable records/no invented clawback; full100→0 refund/replay leaves two rows. |
| E8 | Existing umbrella `next start` on loopback45433, no configured identity/payment handles | Real malformed same-origin checkout500; cross-origin JSON checkout402 with named refusal; forged `/account?checkout=success`200 contains `Payment received`; unsigned admin403 and unwired webhook503, no state changed. Server emits formData Content-Type TypeError. Owned server stopped. |
| E9 | Two concurrent actual migration runner processes against second empty disposable DB | One exit0/all eight tracking rows, other exit1 duplicate0000 tracking key despite advisory lock. Atomic rollback prevents corruption; concurrency guarantee incomplete (BD-005). |

For E5–E7 the canonical pure site TS modules were transpiled into owned temporary files with the existing pinned TypeScript, existing workspace-dist-resolver registered for public core exports, and existing umbrella `pg` dependency used. Temporary files were removed; source was unchanged. These are independently asserted public-seam probes, not a substitute test runner or modified harness. Initial test invocation included two nonexistent filename filters; Vitest still ran570 tests. Correct E1 rerun uses only actual files and supplies the complete593-test oracle. No missing filename is counted as executed coverage.

## Confirmed findings and implementable tasks

### BD-001 — HIGH — persistent ledger can commit a negative/inconsistent chain

- **Source/symbol:** `sites/umbrella/src/lib/provider-adapters.ts:816 appendOrReplayEntry`; `packages/billing/src/store.ts:348 assertAppendable`; `db/migrations/0002_credits_billing.sql:23 credit_ledger_entries`.
- **Reproduction:** Provision disposable user/account, then public store append `{sequence:1,movement:'debit',delta:-500,balanceAfter:10,...valid identifiers/timestamp}`. It returns committed `replayed:false`; SQL sum(delta)=-500. `loadLedgerState` then refuses `CREDIT_LEDGER_ORDER_INVALID` because derived balance differs from10.
- **Refutation:** Normal `appendCreditEntry` computes safe nonnegative balances; existing business routes do not accept arbitrary ledger rows from clients. Schema validates a row, and DDL checks a nonnegative witness, but neither independent persistence boundary verifies its chain. Therefore **not a demonstrated HTTP credit theft**, but a public persistence invariant failure/permanent append-only account poisoning.
- **Owner/dependencies/fix:** Billing builder owns new forward migration `db/migrations/0008_credit_ledger_chain.sql` (or next free numeric id), provider adapter and tests. Validate exact next sequence, previous balance+delta, safe integer bounds and nonnegative sum under a per-account lock; preserve same-key replay before chain rejection. Never edit old checksummed SQL or delete bad production entries. Existing data preflight must refuse corruption, not repair history silently.
- **Acceptance:** Add PG/PGlite integration oracle above; invalid append rejects/no row; valid same-key simultaneous retry one row/two successful answers; distinct sequence collision remains safely retryable; overdraft, gaps, forged balance, overflow reject; UPDATE/DELETE still refuse. Run `pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/umbrella test:integration`, root schema-lockstep/store tests, then real PG runner+adapter proof.

### BD-002 — MEDIUM — malformed checkout causes500; origin refusal misclassified402

- **Source/symbol:** `sites/umbrella/src/app/api/checkout/route.ts:41 POST`, `:55 request.formData`, `:24 refusalResponse`.
- **Reproduction:** Existing started site: same-origin `POST /api/checkout`, JSON body`{}`, Accept application/json→500 empty body, TypeError. Cross-origin URL-encoded JSON-accept request→402 SITE_REQUEST_CROSS_ORIGIN rather than403.
- **Refutation/impact:** Origin guard runs before parsing; forged requests do not create sessions. Legitimate malformed transport nevertheless becomes unhandled server fault, and all JSON refusals sharing402 obscures request/authorization/configuration diagnostics.
- **Owner/fix:** Billing builder route + real HTTP regression; catch form decode, bound input, return registered malformed/request-invalid400, cross-origin403. Browser errors retain safe relative303 with named reason. Do not bypass origin/role/wiring guards.
- **Acceptance:** `pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts tests/sites/site-response-hardening.test.ts`; rebuild existing umbrella and run actual malformed JSON/truncated multipart/cross-origin/valid stable attempt requests. Failed-before500 must become named400 or safe browser303, zero provider entries.

### BD-003 — MEDIUM — account states payment received from an untrusted URL

- **Source/symbol:** `sites/umbrella/src/app/account/page.tsx:190 AccountPage`.
- **Reproduction:** Signed-out, unconfigured actual GET `/account?checkout=success`→200 HTML `Payment received, awaiting confirmation` and `Payment received`.
- **Refutation/impact:** It does not grant credits and still says ledger confirmation pending. Nevertheless payment receipt itself is not evidenced; arbitrary URLs can mislead customers/support, including no provider configured.
- **Owner/fix:** Billing builder page and UX test. Safe default: “Returned from checkout; payment and credit confirmation have not been verified.” Show paid/settled only from authenticated durable evidence, never query alone.
- **Acceptance:** E8 real GET retains access refusal, no payment-received claim and no ledger movement; cancellation/pending/confirmed states remain distinct.

### BD-004 — MEDIUM — new checkout attempts have no rate budget (backlog25 partial)

- **Source/symbol:** `sites/umbrella/src/app/api/checkout/route.ts:61 POST`; `sites/umbrella/src/lib/identity-plane.ts:1022 createCheckout`; `sites/umbrella/src/lib/provider-adapters.ts:1435 createStripeCheckoutSessionAdapter`.
- **Reproduction/refutation:** Stable16–128-character attempt now mandatory, so old random fallback is fixed. Independent adapter tests prove same-key persistence replay. Fresh valid attempt values still reach provider with fresh keys; source has no checkout throttle/reservation across these paths. No real paid flood attempted.
- **Impact/owner/fix:** New intents/provider sessions can be created without bound by a valid user. Billing builder implements a durable per-user new-attempt budget with injected clock, replay-free behavior and named429/retry-after. Cross-lane `identity-plane.ts` owner must coordinate guard adapter injection. Prefer existing PostgreSQL storage, not per-process-only counters or a paid service.
- **Acceptance:** New-attempt burst within fixed clock exceeds bounded limit with zero excess provider calls; exact old keys remain replayable; different authenticated user isolated; concurrent processes cannot exceed shared budget. Existing same-origin/TEST-only checks pass.

### BD-005 — MEDIUM — migration locking/evidence incomplete (backlog31 partial)

- **Source/symbol:** `scripts/db-migrate.mjs:70 migrate`, `:72 applied read`, `:115 psqlExecutor.transaction`, `:86 result`, `:132 main output`.
- **Reproduction/refutation:** E9 real concurrent processes: [1 duplicate tracking primary key,0 success]. Lock serializes one migration transaction but both compute pending history before acquiring it. Safety rollback works; this is an unnecessary operator failure, not lost data. E3 applied all migrations but prints eight `would apply` lines; `--status` subsequently proves applied.
- **Owner/fix:** **Shared scripts owner delivery-ops/integration**, not audit edit. Re-read and validate history under lock or serialize entire run on dedicated session; preserve atomic DDL+tracking, checksum refusals and adoption authority. Distinguish actual applied output from dry-run. Add process-level real PG tests, retain old meaningful assertions.
- **Acceptance:** Two fresh-DB processes both successful or explicitly documented safe lock refusal without deceptive applied claims; one row/id/exact checksums; genuine checksum mismatch still exit1; dry-run makes no schema change; actual apply logs `applied`.

### BD-006 — MEDIUM — member purchase history/lifecycle still absent (backlog24 partial)

- **Source/symbol:** `sites/umbrella/src/app/account/page.tsx:35 AccountPage`; provider `createNeonCheckoutIntentStore`/`:1193 listByUserId`; `packages/billing/src/support-ledger.ts:73 readSupportLedger`.
- **Refutation/impact:** Named browser303, success/cancel query states, balance/starter and **admin** intent history exist. No member purchase list, per-intent pending/granted/refunded/reconciliation status, or authenticated return correlation is rendered by the whole account component. September categorical no-UX finding is stale, done label overstates closure.
- **Owner/dependencies/fix:** Billing builder page/provider/billing query code; **shared changes requested** in `packages/site-kit` identity credit/history port, `packages/schemas` if new wire vocabulary needed, and identity lane `identity-plane.ts`/request facade wiring. Reuse persisted intents/ledger anchors, authenticated user isolation and archived pack revisions. No route/page direct auth/billing imports, no package-matrix widening, no new root dependency.
- **Acceptance:** Public request facade plus rendered account shows own pending/confirmed/refunded intents in bounded pages; another user/forged intent refused; redirect alone never settles; restart/lost response history durable; existing role/Kids guards and boundary checker unchanged.

### BD-007 — HIGH capability gap before paid hosted AI (backlogs28–30)

- **Source/symbol:** `packages/billing/src/hosted-ai.ts:501 runMeteredModelCall`, `:698 provider call`, `:726 meterCredits`; test `packages/billing/test/hosted-ai.test.ts:395` explicitly documents concurrent same-key provider executions; account`:66` advertises hosted AI.
- **Refutation:** Default-off, Kids-denied, BYOK/admin free, sequential replay safe and public ledger/nonnegative debit protections all pass E1. There is no current enabled paid HTTP front door and no live provider exercised, so this is **not an active charge exploit**. Existing order deliberately charges only after successful provider execution; it cannot guarantee exactly-once provider cost or recover results after uncertain debit.
- **Owner/fix/dependencies:** Billing builder can locally implement/test durable operation reservation, scoped replay/result state and safe unconfigured UI without spending. Provider transport is cross-lane provider owner; existing server-owned configuration/ports only. Keep default-off while real provider credentials, action authority and actual credit price/tax policy absent. Do not invent production price table or enable paid provider calls.
- **Acceptance:** Two overlapping same-key fixture calls one provider execution/one debit/result or truthful pending; two different keys cannot use same reserved funds; failed provider releases reservation; lost commit/response recoverable; Kids provider-call count0; admin/BYOK never debited. Root billing hosted tests + actual future authorized TEST front door.

### BD-008 — MEDIUM scale gap: support loads every reconciliation before filtering

- **Source/symbol:** `packages/billing/src/support-ledger.ts:79 readSupportLedger`; `sites/umbrella/src/lib/provider-adapters.ts:765 listReconciliations`.
- **Refutation/impact:** Admin guard precedes reads; data is not leaked to unauthorized callers. SQL nevertheless selects/ordering all users' records and application filters one user, O(global events) for one support lookup, plus unbounded ledger/intents rendering. This is confirmed code/data-flow complexity, not a fabricated benchmark.
- **Owner/fix/dependencies:** Billing builder extends existing CreditStore/adapter with scoped bounded reconciliation read and index (`user_id, occurred_at, event_id`) in next forward migration; paginate account/admin projections. Coordinate any site-kit/schema vocabulary change; do not edit old checksums.
- **Acceptance:** Seed many users locally, observe parameterized user predicate+bounded page/index plan, no global scan requested for user lookup, correct continuation/order and no cross-user rows; existing support role/idempotency/lost-response tests pass.

## All assigned backlog revalidation (historical JSON unchanged)

| Id | Current outcome | Remaining requirement / decision |
|---|---|---|
|4,18|Intentional fail-closed, external-held|TEST-only provider keys, no live witness at site, no LIVE revisions. Exact separate LIVE decision+all prerequisites/code review, never environment alone.|
|19|External commercial blocker|Adapter still omits tax/address/invoice/customer email settings. Reviewed entity/tax/refund/receipt requirements and provider configuration needed; safe default TEST card-only. No fabricated legal/tax settings.|
|20|Local reconciliation implemented, production unproven|Dispute created/closed now durably record exact Charge evidence. Subscription/live delivery and human money/access-resolution policy remain.|
|21|Local bounded refund implemented, production unproven|Full unspent reverses once; partial/spent becomes durable reconciliation rather than silent ACK. Actual refund/dispute policy remains; do not choose unauthorized money clawback.|
|22|External delivery blocker|Runbook still records dated completion-only subscription. Need name-only reobservation plus authorized addition/delivery of refund/created/closed events. No dashboard mutation here.|
|23|Local implemented with scale gap|Witnessed admin-only support UI/API lookup+attributed idempotent nonnegative adjustment, guard/lost-response tested; BD-008. Production adjustments require exact target/amount/reason/key authority.|
|24|Partially implemented|Browser redirects/cancel/pending states exist; BD-003 false receipt and BD-006 missing member history remain.|
|25|Partially implemented|Mandatory stable attempt removes random fallback; BD-004 rate budget absent.|
|26|Recommended local default, external commercial validation|Keep USD-only current TEST fixture, minor-unit formatting honest; no speculative currency expansion. Real country/tax/pricing policy required before LIVE.|
|27|Unused schema retained deliberately|No runtime consumer of stripe_customer_links. Recommended preserve forward compatibility, no destructive drop solely to eliminate unused table. Model real customer linking only with receipt/customer lifecycle requirements.|
|28|Local capability/claim gap|No site paid metered hosted call; BD-007. Correct claims locally; actual paid provider remains off.|
|29|Cross-lane provider gap|Fixture transport is not live hosted evidence; provider owner must implement vetted server-side transport/default-off without actual spend.|
|30|Missing server-owned pricing contract|Caller creditAmount remains trusted core injection, not public user pricing. Implement local policy boundary/negative tests; real economic values not invented.|
|31|Implemented runner with defects|Eight migrations/tracking/checksum exist, real PG revalidated; BD-005 concurrency/evidence.|
|32|Runbook present, external recovery evidence missing|PITR/restore docs232–250 exist, no actual retention/restore drill proof supplied. Could test local pg_dump/restore only, not attest Neon.|
|33|Mock-only stale, durable local proof strengthened|Existing seven PGlite tests plus this real PG adapter/webhook proof; no production Neon latency/fault/restore/session/SDK-network proof. BD-001 invariant remains.|
|35|Implemented diagnostics|inspectUmbrellaConfiguration/classifyUmbrellaPlane and facade health now name absent/malformed/wired without values. Lazy handle creation is intentional, missing config remains refusal.|
|36|Durable local implementation|createNeonConnectStore persists audit/account/status/onboarding/payout transaction; PGlite tested; no configured Connect external provider or LIVE authority.|
|37|Durable local implementation|createNeonLiveModeAuditSink awaited persistence, append-only DDL; issuing synthetic core witness is fixture proof, never operational authority. Site never supplies it to LIVE.|
|51|Intentional TEST-only/held|Connect LIVE remains refused; separate Connect authority+provider/readiness/operations and marketplace authority needed, not mode switch.|

## Production gates and explicit coverage holes

1. **Identity/session/DB inputs:** authorized deployment owner supplies name-only evidence for DATABASE_URL/target, BETTER_AUTH_ORIGIN/SECRET, sole verified admin and real sessions. No process credential names were present at baseline; report never prints secret values.
2. **Real Stripe TEST:** action-specific authorization for exact endpoint/account/mode/window/operator/evidence/rollback, signed actual provider completion+replay+refund+both dispute delivery; observed subscriptions, actual persisted intent before redirect and real SDK settlement/session binding. Local signatures/providers are clearly fixtures, not external proof.
3. **Commercial/legal:** real entity, countries/tax policy, receipts/customer/invoice/refund/dispute/access/retention decisions. Human governance remains distinct from safe local code choices. LIVE and Connect activation each need exact separate authority and reviewed fail-closed changes.
4. **Database/recovery:** named production schema/migration/checksum observations, privileges, forward migration preflight and actual Neon retention/isolated restore drill. Real local PG is available and should become repeatable integration coverage; production migration/branch creation forbidden without action-specific authority.
5. **Coverage holes:** configured authenticated HTTP purchase/support success and browser full lifecycle; actual Stripe/Neon network SDK fault/timeouts/webhook subscription proof; distributed/production load; full real-PG Better Auth support/Connect lifecycle. Existing PGlite support/Connect and hermetic security tests are not mislabeled as these. No new stack/API was adopted; existing helpers/dependencies reused.
6. **Shared ownership requests:** delivery-ops owns db runner/process tests and docs activation/backup updates; identity owns identity-plane/request facade changes; site-kit/schemas need one integration-selected owner for public history/throttle/status vocabulary and fixtures; provider transport owner coordinates hosted proof. Root manifests need **no new dependency or matrix edge**. Auditors edit none of these.

No confirmed local finding is parked as an external-only blocker. Builder findings were sent upstream as discovered (BD-001 through008). Integration owns closing local tasks, independent reruns, maximum three-pass FAIL routing, all per-task/per-node outcomes and final production status. These reports are audit evidence, not self-issued launch authority.
