# Serial integration packet — privacy-lifecycle

## Ready now, not landed

Retain `check.py` and `evidence.json` as the auxiliary acceptance packet. Run from the actual root with `python3 docs/audits/production-swarm/capacity-work-2026-10-02/privacy-lifecycle/check.py`. This invokes actual exported `createAccountLifecycle().dispatch(Request, stock)` and actual password crypto, not a copied handler. SQL is only an explicit recording fixture. The test mutates the actual handler source **in memory** to remove unknown-field admission and proves the unchanged cross-user-field refusal oracle catches 200 instead of 400. No source files are changed.

Exact handoff: serial integration owns promotion into `sites/umbrella/test/account-lifecycle.test.ts` and provider-owner review of `sites/umbrella/src/provider/account-lifecycle.ts`; site UI owner retains `sites/umbrella/src/app/login/page.tsx` and `account/page.tsx`; shared identity owner retains `packages/auth/src/{admin,principal-provenance}.ts` and `packages/site-kit/src/admin-reauth.ts`. No ownership is transferred by this document; parent must explicitly release the freeze.

## Missing UI/endpoint allegation refuted

Do **not** integrate duplicate export/disable endpoints or invent a new SSO issuer. `sites/umbrella/src/app/api/auth/[...all]/route.ts:6-7` forwards to the provider handler; `better-auth-provider.ts:633,676-682` identifies and dispatches lifecycle operations. `/login` already renders password-confirmed export and disable forms (`page.tsx:89-101`); `/account` reads and renders bounded purchase history (`page.tsx:71-74,153-161`). Existing controls correctly call disable access, not erasure. A speculative source patch is not justified by this probe.

## Concrete remaining implementation acceptance

1. Identity/provider owner: retain 401 unknown-session/stale-session/wrong-password, 400 injected userId/role, 403 origin-before-body, 429 with Retry-After, and 503 unconfigured mail/retention contracts. For real database acceptance, verify another seeded member's records never appear, revocation survives fresh runtime creation, all provider and SceneAxi sessions disappear atomically, financial row counts/digests remain identical, and failed transaction leaves identity/session/ledger state unchanged. Run `deferred.sh` only after explicit heavy-resource authorization.
2. Retention owner + identity/billing/schema owners: approve a category matrix covering identity/contact, provider credentials and tokens, auth counters, sessions, credit accounts/append-only entries, checkout, reconciliation, purchases/sales, hosted request/response data, operational logs and backups. For each, record collection source, purpose, export treatment, exact approved retention disposition and authority. This is a proposed review inventory, not a claim every category applies or a legal policy.
3. Only after that decision, propose a versioned pseudonymization mapping/tombstone migration. Never update/delete ledger entries to simulate erasure; preserve stable account references and reconciliation evidence. Separately protect/remove reversible identity mapping under the approved procedure. Tests must compare ledger bytes/digests before/after, verify disabled identity cannot authenticate, exports exclude other users, and backup restore honors tombstones. No migration, duration or legal compliance claim is supplied without policy.
4. Recovery owner: keep named 503 until transport/policy approval. Then introduce an injected delivery port only in the provider install root, generic non-enumerating responses, bounded per-identity/source limits, expiring single-use tokens consumed atomically, session revocation after reset, and replay/expired/unknown-email oracles. Never print delivery tokens or use live mail in this fixture. These are acceptance requirements, not a fabricated successful recovery flow.

## Evidence boundaries

No deployed HTTP/Next rendering, database SQL execution, cross-process race, complete export, mail delivery, pseudonymization, production provider or PR validation was run. Source crypto dependency entry point is hashed in evidence; its installed dependency graph is not represented as current app source. The small admin/provenance consumers load the exact implementation files with the actual schemas provenance export, not the entire package barrel or a compile-compatibility proof.
