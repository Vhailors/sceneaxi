# 05 — Auth/billing deep review: FAIL

## 1. Artifact identity and verdict

Review date: 2026-10-02. Application root: `/home/devuser/Documents/Projects/sceneaxi`.
Published PR #312 artifact: `346933c105305224d575bf9319256301c1eeabfa`; base: `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`.
Current application artifact: dirty worktree over HEAD `4e532e2fbf43e9948741578ab6208a3277870405`, independently rechecked. This is NOT the PR tree.

**Published security/commerce artifact: FAIL. Current scoped full-security/production acceptance: FAIL. NOT 100%.** Current bounded checkout and disposable database checks pass, but missing PR source, incompatible adapter types and surviving boundary defects prevent an overall PASS. PR creation alone does not establish the separate visual-in-PR goal; visual differences are outside this lane and are not certified here. No percentage denominator is invented.

Read AGENTS.md:7-43, docs/agents/layout.md:42-118, FINAL.md:1-76 and PR-EVIDENCE.md:1-48. Root EMPRYO.md is absent. Source review was selective: auth role/provenance checks, billing hosted-call/persistence boundary, checkout, provider serializers, identity checkout/history wiring and the complete 0008 migration. This is not an exhaustive audit of every auth/billing file or deployment route.

## 2. Top findings

### 05-001 — P0 FAIL: Published identity/billing dependency subtree is incomplete

- Expectation: retained production packages, manifests and imported billing implementation exist in the exact PR tree.
- Evidence: `git ls-tree -r 346933c105305224d575bf9319256301c1eeabfa -- packages/auth` returns no entries. `git show` of `packages/auth/package.json`, `packages/billing/package.json`, `packages/billing/src/entitlements.ts` and `packages/billing/src/metering.ts` each exits 128, reporting paths exist on disk but not in that commit. Current `packages/billing/src/hosted-ai.ts:69-95` imports auth, entitlements and metering. These omissions are not hypothetical local configuration problems.
- Status: reproduced exact-tree structural failure; PR application execution not attempted against an incomplete tree. Current auth is present and `git diff --name-only` against PR base is empty for packages/auth; no auth runtime rewrite regression was found in that unchanged package.
- Fix/acceptance: reconstruct the intended PR over its complete base, preserving untouched files and package manifests. Verify every import/export target and all mandatory gates on the resulting NEW PR head. A current-worktree green is not acceptance for this PR SHA.

### 05-002 — P0 FAIL: Published checkout route imports a missing handler

- Expectation: the request entry point has its executable origin-first bounded parser in the published artifact.
- Evidence: exact PR `sites/umbrella/src/app/api/checkout/route.ts:5` imports `./checkout-handler.js`; the corresponding `checkout-handler.ts` is absent (`git show` exits128), while current git status shows it untracked. The PR also includes `tests/sites/billing-final-acceptance.test.ts:4`, which imports that missing source.
- Status: reproduced exact-tree missing dependency. The checkout security implementation can be tested locally but is not included as a usable PR dependency.
- Fix/acceptance: include the actual handler in the PR, then execute its owning test and production site build against that exact updated head. Preserve origin-before-body, 8192-byte bound, duplicate-field refusals and configured-origin redirects.

### 05-003 — P1 FAIL: SQL-row narrowing breaks the existing deployment adapter contract

- Expectation: replacing unknown input types during lint rewriting does not silently require trusted SQL values before validation or break existing adapters.
- Evidence: base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc:sites/umbrella/src/lib/provider-adapters.ts:59` exports `SqlRow = Readonly<Record<string, unknown>>`. PR and current `provider-adapters.ts:65-67,111-115` instead require recursive `SqlValue` rows. A read-only virtual TypeScript consumer assigning a formerly valid `query(): Promise<ReadonlyArray<Record<string, unknown>>>` adapter to `NeonDatabase` reproduces TS2322: unknown is not assignable to SqlValue.
- Status: reproduced source/API incompatibility. This is not evidence that arbitrary database values become safe at runtime. Primitive predicate wrappers preserve their direct typeof checks; no auth elevation bypass was demonstrated.
- Fix/acceptance: retain unknown at the untrusted provider output boundary and validate individual columns before constructing trusted rows, or explicitly version/document a compatible validated adapter API. Preserve a compile-time consumer oracle accepting the old supported adapter and runtime negative column cases. Do not cast SDK output merely to silence checks.

### 05-004 — P2 FAIL: Generic hosted response recovery is lossy and invokes untrusted serialization

- Expectation: a persisted response recovered as the advertised generic response type has a lossless, bounded, validated representation; hooks cannot redefine the charged answer.
- Evidence: `provider-adapters.ts:1072-1080` calls JSON.stringify and checks size only. Independent current-source injected-database probe saves `new Map([['answer','charged answer']])` successfully and records `{}`. `packages/billing/src/store.ts:963-965` repeats the JSON stringify policy. `hosted-ai.ts:818-820` casts restored JSON back to generic Response without validating it; the provider contract at :179-204 permits arbitrary successful values. JSON.stringify can also invoke toJSON/accessors before any byte bound is checked.
- Status: reproduced serializer acceptance and loss. A paid end-to-end Map recovery was NOT executed; no claim of observed ledger corruption or actual provider money loss is made. The provider serializer is byte-identical on PR and current, but the runtime probe belongs only to current source because PR cannot load its dependencies.
- Fix/acceptance: explicitly constrain durable responses to a strictly validated, accessor-free bounded JSON value, or require an owned encode/decode codec proving round-trip semantics. Keep replay from invoking the provider twice. Add Map/Date/BigInt/accessor/toJSON and response-ready restart oracles, including original-answer preservation or a precise pre-provider unsupported-response contract.

### 05-005 — P2 FAIL: Invalid hosted capability can throw instead of returning a named refusal

- Expectation: the public unknown capability boundary returns BillingOutcome refusal without invoking hostile conversion functions or the provider.
- Evidence: current `packages/billing/src/hosted-ai.ts:616-620` interpolates String(capability) on its refusal path. Current source probe with route byo and capability whose toString throws rejects with `HOSTILE STRINGIFICATION`, rather than producing the named capability refusal. Provider was not reached.
- Status: reproduced current runtime failure. The same diagnostic conversion exists in the PR source; this is a surviving boundary defect, NOT attributed as a new runtime regression caused by the predicate rewrite. PR execution is not certified.
- Fix/acceptance: use a fixed or bounded primitive-only diagnostic without calling user conversion hooks. Add an existing owning-suite negative oracle for throwing toString, Symbol.toPrimitive, accessors and proxies, asserting a named refusal and zero provider/store calls.

## 3. Independent checks and refutations

1. `pnpm exec vitest run tests/sites/billing-final-acceptance.test.ts --reporter=verbose`: exit0, **10 pass / 0 fail**. Read its owning source :14-84 first. It covers malformed JSON/multipart, duplicate attempt, 8193-byte body, missing/hostile/alias origin, 429 Retry-After, same-site browser refusal and configured BetterAuth POST origin. It uses injected hermetic authority, not real authentication or Stripe.
2. Independent current-source Request.body getter trap: hostile Origin returned403, bodyReads0, authority0. This directly verifies origin-before-body/authority, rather than trusting a lexical source assertion. Current handler :67-76 screens origin before :89 gets the reader; :102-105 caps retained body chunks at8192. The code does not add an application read deadline; transport-level timeout/slow-body acceptance was not tested.
3. `docker image inspect postgres:17-alpine` confirmed a cached image, then `node --test db/local-postgres-oracle.mjs`: exit0, **15 pass / 0 fail / 0 skip**, about9.3s. Existing test :25-130 uses a disposable loopback PG17 container and fixture rows only; no real credentials, provider endpoints or production database. It checks whole-run migration-lock refresh, competing ledger sequence, witness/range refusal, replay, reservation affordability/response-ready completion, durable per-user rolling quota and competing sixth attempt, corrupt-history migration refusal, indexes, populated24-table dump/restore and restored guards. Container cleanup is owned by the existing test. No image install/pull was needed.
4. Migration `0008_credit_chain_hosted_budget.sql:42-64,81-98,130-140` serializes ledger/reservations by credit-account lock and checkout attempts by user lock. Current execution refutes the old assertion that these local races remain completely unverified. Same migration bytes exist on the PR, but this does NOT make the incomplete PR application runnable or CI green. Different-account deadlock stress, crashed pending-operation reconciliation, prolonged capacity and actual provider acceptance remain uncovered.
5. Current hosted-AI default-off at `hosted-ai.ts:173-175,633-640`, issued-price-policy WeakSet/quote at :146-163,764-774, and Kids-before-store/provider at :596-604 remain in source. No live economic-policy adequacy, real provider cost or safety approval was measured: risky-change assumptions cannot be established by fixture tests alone.
6. Current auth runtime provenance at `packages/auth/src/roles.ts:142-169` and rederived role :179-185 remains unchanged against the PR base. Current identity checkout checks verified buyer against submitted user at `identity-plane.ts:1138-1147`, maps only exact DB budget error at :1168-1174 and binds purchase-history reads to verified carried session at :1419-1438. These are inspected protections, not exhaustive end-to-end certification.
7. Read-only TypeScript API source check rooted only in current hosted-ai.ts with actual source dependencies and no emit: **0 diagnostics**. Refutes attributing an unknown-response/StoreBoundaryValue compile error specifically to hosted-ai.ts:833: current StoreBoundaryValue aliases validateCreditLedgerEntry's still-unknown input. Two preliminary checker setups were invalid (relative-config setup, then TS2209 root ambiguity); only corrected absolute config/source-root result counts. This does NOT establish root build success. No whole-repo build/gate was run by this reviewer; build reviewer owns it.

## 4. Claim accounting / full-goal gaps

- PR-EVIDENCE.md:19 historical4513/544, FINAL.md:14,53 historical4297 and previous provider greens do not certify either present artifact. They were not treated as current evidence.
- FINAL.md:61 historical missing local migration/race acceptance is partially refuted by today's15 fresh disposable-PG checks; current typed row API, serializer and refusal defects still remain. A complete local or production PASS is not substituted for bounded race coverage.
- Genuine externally approved auth/email/Stripe/model configuration, redacted real session/webhook/refund/metering paths and justified commercial pricing inputs remain distinct acceptance requirements (FINAL.md:65-70). Forbidden real-endpoint/money actions were not attempted. Lack of these checks fails the full-production criterion, not the already tested hermetic predicates.
- Published PR missing source and signatures independently fail this lane's narrow merge-safe artifact criterion, irrespective of visual improvements elsewhere. Coverage does not include all auth methods, all webhook/Connect/refund reconciliation paths, full browser/native contexts or exhaustive hostile proxies.

## 5. Evidence fingerprints and mutation constraints

Current SHA256:
- checkout-handler.ts: `a4c3a2a93dfd3bfa94daefe5fd8e4f655da4330b17aa67d50449056ade6a3ab3` (absent from PR).
- provider-adapters.ts: `050fd5f1d7d71b61218e549895e8c352c8cd532a34f20c890cb05a8b94ace6b8` (byte-identical to PR).
- identity-plane.ts: `e3091b9fc0817439c43364333698097809df7f251a4ad8e9f9fefbc9b33bcd34` (byte-identical to PR).
- migration0008: `607e13b126d842e0bcadd99f969b4ce4eaa661d29dae25cf14eb3d084baa0a15` (byte-identical to PR).
- hosted-ai.ts: `961c0c114685ac30b76152b157e8b8c6bc14b852769193ac37f7e8ac29834cbc` (different from PR).
- store.ts: `6cb08f65a83490ff6cc12ddd72ce2f062c3a84d49f668b5799e074c3d76a2424` (different from PR).
- owning checkout test: `0dc4c60ae16f4aab89250c4423ffb6a6143220ac6ff2eb3a9101bd591ef5b37d` (byte-identical to PR, but handler dependency missing there).
- disposable PG test: `dc45d85cdb9b0bc624f4ff42452502ce2deaba0f5b7a0e10d9c51ff6a66114d7` (byte-identical to PR).

Only this numbered Markdown/JSON report pair was written by the reviewer. No product/config/source edits, dependency install, commit/push/PR mutation, production endpoint, spend or deployment. Twelve bounded shell commands including report validation; each timeout120s or less. Virtual compiler probes and runtime source transpilation were memory-only; no new application/test files were written.
