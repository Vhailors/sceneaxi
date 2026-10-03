# Own-session endpoint — implemented, focused verified

New explicit scoped implementation; historical failed/exhausted reviews are NOT declared successful. Full production NOT CERTIFIED.

## Source handback

HANDOFF COMPLETE: no further source edits by bg-110. Exclusive new files:

| File | SHA-256 |
| --- | --- |
| `sites/umbrella/src/provider/own-session.ts` | `6132cefa4127131d8371858ad25388015eeb6196044957da8fee35cf33439d87` |
| `sites/umbrella/src/app/api/auth/own-session/route.ts` | `931dfdfb8208ecba18fb58b5323b29beadba0b61819155ee362a57dcfd716173` |
| `sites/umbrella/test/own-session.test.ts` | `5678030d8fd8de59094dfcc374d8d9fc81a8d5025d21bff2d2362141f3091cc5` |

`provider/own-session.ts` exports the real injectable `createOwnSessionHandler`, `OwnSessionAuthority`, `OwnSessionEnvelope`, and transport constants. Specific Next `app/api/auth/own-session/route.ts` binds the existing request-authority facade lazily; GET is real, other methods explicitly 405. Catchall/provider/identity-plane/request-authority and all shared source remain unchanged. No public root export request.

## Port contract (published to bg-111)

GET `/api/auth/own-session`; credential only `x-sceneaxi-session` (existing sessionId.token), never Cookie/Authorization/query fallback. Mandatory canonical Origin equals configured umbrella and request URL origin. Existing facade `verifyFormOrigin({origin})` receives NO requestUrl/fetchSite, so missing configuration cannot fall back to a caller URL. HTTPS normal; HTTP loopback requires explicit development policy (`NODE_ENV === "development"` in the route).

Wire: `{version:1,ok:true,value:SitePrincipal}` or `{version:1,ok:false,reason:SiteRefusalReason}`. No messages, private provider objects, token minting, second auth store, CORS grant or browser SSO. Existing `plane({sessionToken}).identity.resolvePrincipal({surface:"site",sessionToken})` is authoritative. Explicit projected fields, own-user/session binding and carried session ID checked; credential4096 chars, response16KiB, identifiers256/email320. Kids/client role claims denied before identity dispatch. No-store, pragma no-cache, Vary Origin/x-sceneaxi-session, nosniff on every path. Status200 success,400 malformed,401 absent/expired/future,403 origin/Kids/claims/disabled/surface,405 methods,503 unwired/unavailable/invalid output.

## Exact proof

- BEFORE: unchanged current-source capacity harness real provider handler returned404 `{code:"NOT_FOUND"}` for own-session, zero provider calls (`before-harness.log`). This was a handler-factory source probe, NOT actual HTTP. New permanent suite before implementation failed missing own-session module (retained RTK log referenced JSON). First accidental root filter failed `No test files found`; corrected owning-site cwd, never claimed empty pass.
- AFTER: owning-site `pnpm exec vitest run --config vitest.config.ts test/own-session.test.ts --reporter=json`: **42 passed /0 failed /0 pending/todo**, including imported real route and existing deployment-origin helper; explicit carry/role/admin/Kids, missing/hostile/unconfigured origin, alias URL, method, cookie-only, malformed/oversize, expiry, cross-user/session mismatch, private projection, unavailable and loopback controls. `test-after.json` has every assertion name.
- Owning-site strict TS5.9 `pnpm exec tsc --noEmit -p tsconfig.test.json` exit0 (`typecheck-after.log`). Initial foreign checkout test TS2379 was reported to bg-112 and fixed by that owner, never edited here.
- Owned source/route/test ESLint exit0 (`lint.log`); initial no-control-regex failure fixed with bounded char-code validation, no disable.
- `pnpm -s check:boundaries` exit0:27 packages (`boundaries.log`), no matrix widening. Owned diff check and new-file trailing whitespace assertions pass.

## Retry: confirmed unsafe HTTPS origin repair

Endpoint implementation already existed; no duplicate stack or replacement was manufactured. Added 18 permanent cases in `test/own-session.test.ts:120` and reproduced 12 unsafe-origin failures before editing the handler: **48 passed / 12 failed**, each failing `expected 200 to be 403` (`origin-test-before.json`). Then repaired `provider/own-session.ts:42` to match the catalogue adapter: production HTTPS requires canonical dotted DNS, no IP literals, trailing-dot/single-label or `.localhost`/`.local`/`.internal` domains. HTTPS loopback is denied even in development; HTTP canonical localhost/127.0.0.1/[::1] requires explicit development permission. Canonical HTTPS DNS nondefault ports remain supported.

After: **60 passed / 0 failed / 0 pending** (`origin-test-after.json`), strict owning-site `tsc --noEmit -p tsconfig.test.json` exit0 (`origin-typecheck.log`), owned ESLint exit0 (`origin-lint.log`). Dedicated project test tool could not detect the owning-site command; explicit owning-site commands were used, not an empty pass. Original 42-test proof remains historical and is not overwritten. Session-ID carry binding/private projection/facade routing remain unchanged. Source hashes above are refreshed; source handback complete again.

Shared request to parent/integrator (NOT implemented here): bg-111 reports the facade deployment-origin resolver strips path/userinfo before validation. Shared owner must reproduce and reject noncanonical **raw configured origin** before normalization (or expose raw configuration for strict validation), with permanent path/userinfo/query/hash/whitespace negatives. Request-origin hardening here cannot attest that shared raw configuration is safe. No public-export requests. This unresolved dependency prevents production certification.

## Deferred serial acceptance — NOT RUN here

Full gate/build/site build/browser/native/Docker/install; real HTTP Next specific-route precedence on fresh built artifact; real Better Auth/Neon/provider provenance; combined catalog multi-origin socket integration. Serial integrator must rebuild and prove specific GET route supersedes unchanged catchall404 with deterministic synthetic existing identity seam, preserve all security negatives, then run frozen combined checks. The historical source-only capacity harness still targets unchanged catchall factory and is not an after-network oracle. No old failed pass or production PASS claimed.

No services/ports/containers/installs/provider credentials created; no cleanup outstanding. Normal ignored tsc cache may be updated. No staging/commit/push/deploy/spend/production DB. Report JSON contains exact source hashes, symbols, wire/status, commands, failures, assertions, dependencies and source handback.
