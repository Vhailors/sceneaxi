# privacy-lifecycle — PASS scoped fixture / production acceptance NOT RUN

Task: IDENTITY-01 / GATE-RETENTION / GATE-MAIL / REQ-PROOF-IDENT-001..007. Only this auxiliary directory was written. Read AGENTS.md, layout identity ownership, repair integration/ledger header, fix-identity-provider and deep-review 08-FINAL. This is not a duplicate full review, publication proof or a landed product fix.

## Fresh executed proof

`python3 docs/audits/production-swarm/capacity-work-2026-10-02/privacy-lifecycle/check.py` exited **0**: **20 actual lifecycle Request/Response fixture cases**, plus provenance and admin reauthentication assertions. Current source is transpiled in memory with TypeScript 5.9.3; actual installed Better Auth password hash/verify is used. SQL is an explicit recording fixture, **not PostgreSQL semantics or transaction proof**. No app dist is used.

`evidence.json` records exact fixture inputs, response status/body/headers, SQL calls, source SHA-256 and dependency entry-point SHA-256. `account-lifecycle.ts` SHA-256: `2e85dc263ec7ca76787d567c9e3308bee4045ab1ee9b37f8f7f4c1255e9e556e`. Cases include unknown member/action, injected cross-user/admin fields, missing/hostile origin with body getter trap, wrong method/password, stale session, reauth budget/Retry-After, duplicate form fields, 4097 bytes, valid reauth/export/disable and fixture-state revoked-token replay. Recovery endpoints explicitly return 503 unconfigured; no successful reset or single-use-token proof is claimed.

Negative control: remove the actual unknown-field guard **in memory only**; unchanged cross-user-field oracle expects 400 and catches observed 200. Issued admin passes provenance; spread/Proxy impostors and structural principal fail; missing/throwing admin verifier fails closed. Export projects only fixture-own records with no password hash; recording verifies all category query arguments derive from authenticated user and no credit/checkout mutations occur.

## Source facts and handoff

- `sites/umbrella/src/provider/account-lifecycle.ts:130,223`: exported dispatch and own-user execute; policy `:9-20` explicitly denies full privacy export/erasure claims.
- `sites/umbrella/src/provider/better-auth-provider.ts:633,652,676-682` + `src/app/api/auth/[...all]/route.ts:6-7`: lifecycle front doors already exist.
- `sites/umbrella/src/app/login/page.tsx:89-101`: export/disable forms already exist; `src/app/account/page.tsx:71-74,153-161`: own-user purchase history already reads/renders. Missing UI/endpoint allegation **refuted**, not a reason to add duplicates.
- `packages/auth/src/admin.ts:73,95`, `principal-provenance.ts:18`; `packages/site-kit/src/admin-reauth.ts:6`: source-backed provenance/reauth consumers.

`handoff.md` names exact serial/provider/site/shared owners, acceptance requirements and policy-dependent pseudonymization/recovery integration. **No product defect requiring a blind source patch was reproduced.** Approved retention category inventory and mail delivery remain genuine unresolved decisions; disable is not legal erasure. Do not alter append-only ledger records.

## Deferred / resources

`deferred.sh` contains the real existing lifecycle suite command and an explicit authorization guard: **NOT_RUN** under zero-heavy budget. DB revocation durability, rollback, concurrent locks, browser forms, complete export, pseudonymization, live mail and full gate/build remain unverified here. No sockets, containers, temp files, installs, credentials, providers, Git changes or product-tree writes were made. Auxiliary artifacts persist by design.
