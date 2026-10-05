# Identity/provider repair — in progress

Actual source root: `/home/devuser/Documents/Projects/sceneaxi`. Local worktree and published PR #312 are distinct artifacts. No publication, deployment, production database, account, secret disclosure or spending action is authorized for this lane.

## Scope and acceptance

Owned identity/provider/auth sources and the two explicitly assigned root provider/checkout tests only; all manifests, shared schemas/exports and other test directories require their serial owner. Preserve inherited dirty and untracked work, including `sites/umbrella/src/app/api/checkout/checkout-handler.ts`.

Primary ledger task IDs: IDENTITY-01, GATE-RETENTION, GATE-MAIL, SCOPE-CLOSED-SIGNUP, SCOPE-OAUTH, LOCAL-PROOF-014, REQ-PROOF-IDENT-001 through REQ-PROOF-IDENT-007. Supplemental Repair05-003 requires old unknown-row SDK consumer compile compatibility and invalid-column runtime refusal without a cast. Checkout acceptance retains origin-before-body/authority, 8192-byte limit, duplicate fields, 429 and configured redirects; session/history must remain authenticated.

Current status: NEEDS_LOCAL_FIX — pass 1 source fixes verified locally; independent Astra review, current-artifact lifecycle rerun and cross-lane catalog adapter completion remain pending. Exact source SHA-256 and 499 executed named assertions are in the JSON companion. No historical suite green is transferred. Independent Astra PASS requires current artifact-bound positive and negative oracles; repair bound is three passes.

## Inputs that cannot be fabricated

GATE-MAIL requires an approved real mail/recovery delivery target and redacted delivery evidence under action-specific authorization. GATE-RETENTION requires approved retention/erasure policy, not a guessed legal policy. Provider/production proof and PR/CI publication belong to their serial owners. Missing local implementations are not classified as credential/signing blockers.

## Pass 1 implementation and executable proof

- `sites/umbrella/src/lib/provider-adapters.ts`: restore raw `SqlRow = Readonly<Record<string, unknown>>`; `SqlValue` remains a separate recursive SQL vocabulary. Column decoders accept unknown and narrow individual values before constructing domain records. Better Auth fetch output is likewise unknown rather than prematurely asserting a JSON representation. No SDK-output casts were added.
- Same file: reuse the billing owner's `snapshotHostedResponse` canonical bounded accessor-free codec for both raw Neon save and response-ready recovery. Unsupported values refuse before a persistence query; restart returns an owned frozen JSON snapshot, not a mutable SDK object.
- `tests/sites/provider-adapters.test.ts`: permanent actual TypeScript old query/transaction consumer, invalid identity columns, real SQL bigint/timestamp decoding and unsafe integer refusal; Map/Date/BigInt, accessor/toJSON, persisted-answer restart and invalid recovered-output tests. Existing sale tests now seed a genuine buyer grant before sequence-2 debit; atomic/replay/negative assertions remain intact and derived balance is checked.
- `tests/sites/billing-final-acceptance.test.ts`: retain all ten existing boundary cases; add actual Request.body getter trap proving origin-before-body/authority, authenticated user/configured-origin positive redirect, signed-out refusal and forged userId-field refusal. Preserve the actual untracked checkout handler unchanged.

### Exact commands and outcomes

All root commands use cwd `/home/devuser/Documents/Projects/sceneaxi`.

1. Initial focused auth/wiring/provenance/provider/checkout command: exit 0, 262 assertions. Baseline evidence only.
2. Permanent raw-provider oracles: `pnpm exec vitest run tests/sites/provider-adapters.test.ts --reporter=dot`, exit 1, 7 failed / 42 passed before source fix. Compiler reports unknown not assignable to SqlValue; Map/Date/hooks incorrectly persisted, BigInt emitted an unrelated exception, restart snapshot was mutable, and malformed recovery was accepted. An earlier wrong test import caused six `createNeonHostedCallStore is not a function` setup failures; corrected direct owned-module import before counting semantic reproduction. One atomic edit attempt had an exact-whitespace mismatch and applied no source changes.
3. Same source-fixed provider command plus `tests/sites/billing-final-acceptance.test.ts`: exit 0, 63 assertions (49 provider + 14 checkout).
4. `pnpm exec eslint tests/sites/provider-adapters.test.ts tests/sites/billing-final-acceptance.test.ts sites/umbrella/src/lib/provider-adapters.ts`: exit 0.
5. Unchanged `pnpm --dir sites/umbrella typecheck`: exit 0 (application and installed provider-test projects).
6. `pnpm check:boundaries`: exit 0, 27 packages; no matrix or manifests changed.
7. Targeted strict TypeScript API semantic check of both owned root test files: first exit 1 (new checkout fixture omitted required mode; bare root site-kit resolution absent). Added real TEST mode and used source-backed site-kit resolution, no compiler suppression; final exit 0, zero owned-source diagnostics. This is not a whole-root typecheck.
8. Focused 13-target auth/wiring/provenance/login/provider/checkout/store/metering/Stripe/live/hosted/refusal command recorded verbatim in JSON: exit 0, 499 passed, zero failed/pending. JSON lists every file and assertion; temporary reporter output was removed.

Installed umbrella `pnpm exec vitest run --config vitest.config.ts test/better-auth-provider.test.ts test/account-lifecycle.test.ts --reporter=verbose` previously returned exit 0, 35 assertions. The lifecycle suite uses an owned disposable cached PostgreSQL container, loopback HTTP/HTTPS and real Chromium cookies; no production/provider credentials or real mail. Because this execution preceded the provider-source fix, current-artifact lifecycle rerun remains pending resource coordination; it is not borrowed as current final acceptance. Source cleanup uses browser/socket close, pool.end and owned docker removal.

## Shared requests and remaining gates

- Serial publication must include the existing untracked `sites/umbrella/src/app/api/checkout/checkout-handler.ts`, all source-backed dependencies and executable modes; only the serial publication owner may commit/push PR #312. Published SHA and mandatory CI remain NOT_VERIFIED by this lane.
- The catalog identity gap is a local cross-lane implementation requirement, not an external-only signing/credential gate. Proposal sent original coordinator and missing-capabilities owner: read-only authoritative umbrella `/api/auth/catalog-session` endpoint plus one configured-origin bounded server fetch adapter shared by both catalogs. Use versioned `SitePrincipal | null` or registered fixed refusal, no second issuer/store/role, Host trust, browser-JS credential, cookie scope widening or fabricated SSO. Explicit carried server credentials only. New cross-lane endpoint/adapter approval and owner reconciliation are pending.
- GATE-RETENTION: reviewed category inventory, retention/erasure purposes and periods, backup/tombstone operator procedure. Access disable is not legal erasure; current bounded export excludes some categories and cannot be called a full privacy export.
- GATE-MAIL: approved real sender/domain/template, authenticated delivery transport, anti-enumeration/rate-limit policy, authorized non-production target and independently verified redacted delivery evidence.
- Closed public signup and social OAuth remain intentional full-production gaps; named refusal/workflow coverage never means launched onboarding/OAuth.
- Independent Astra pass-1 review and serial stable-candidate root/site build/gate/production HTTP acceptance remain requested. No guarantees, completion percentage, real-provider certification, deployment or production money action are claimed.
