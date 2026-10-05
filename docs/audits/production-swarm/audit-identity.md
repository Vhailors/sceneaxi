# Independent identity audit

## Outcome and authority

- Node: identity independent audit; graph: `sceneaxi-production-swarm`.
- Production outcome: **PARTIAL**. Local identity oracles pass; deployed provider, browser and account-lifecycle proof remain incomplete. Audit coverage is **PARTIAL**, not an assertion that the full acceptance criteria are proved.
- Rechecked HEAD: `4e532e2fbf43e9948741578ab6208a3277870405`. Initial `git status --short` showed only untracked `docs/audits/production-swarm/`; tracked source was clean at that observation.
- Source remained read-only. This lane writes only this report and `audit-identity.json`. No commits, publishing, spend, migration, production credential provisioning or production data changes occurred.
- Retry did not re-read the listed cached files. Focused symbol searches and executable existing tests were used to revalidate claims. These two report paths did not exist; creation uses `edit_file`, since `multi_edit` refuses creation/empty matches.

## Evidence ledger

All commands ran with cwd `/home/devuser/Documents/Projects/sceneaxi`, on the available Linux host. No secret values were printed.

| Command | Result | Actual evidence / limitation |
| --- | --- | --- |
| `git rev-parse HEAD && git status --short && pnpm --filter @sceneaxi/umbrella test -- test/better-auth-provider.test.ts` | Exit 0; **test not run** | Wrong package filter: `No projects matched the filters`. Routing failure, not product success. |
| `pnpm --dir sites/umbrella test -- test/better-auth-provider.test.ts` | Exit 1 | `ERR_PNPM_NO_SCRIPT Missing script: test`. Routing failure, not product failure. |
| `pnpm --dir sites/umbrella run test:provider` | Exit 0 | 23 tests in 2 files; 22 provider cases and 1 docs-page case. Real Better Auth runtime exercised through Request/Response handler boundary, with memory adapter/fixture users, not deployed Neon. |
| `pnpm --dir sites/umbrella run test:integration` | Exit 0 | 7 adapter integration cases. Local transport/storage doubles do not prove production connectivity. |
| `pnpm exec vitest run packages/auth/test --reporter=verbose` | Exit 0 | Runner output `PASS (85) FAIL (0)`; package authority, role, provenance, refusal and identity-store oracles. No per-test coverage report emitted. |
| `pnpm --dir sites/umbrella run typecheck` | Exit 0 | Both application and test TypeScript projects checked. |
| `pnpm exec vitest run tests/sites/umbrella-login-flow.test.ts tests/sites/identity-plane-wiring.test.ts packages/site-kit/test/site-session.test.ts tests/sites/site-response-hardening.test.ts --reporter=verbose` | Exit 0 | Runner output `PASS (153) FAIL (0)`; login/origin helpers, request authority and source-order contracts. Not a running Next/browser front door. |

Provider suite emitted named, redacted warnings for expected injected failure/rate-limit scenarios, including `umbrella.auth.provider_warning` and `umbrella.auth.provider_request_failed`; no supplied error/credential value appeared in those logs. No failing-before/passing-after patch oracle exists: this lane made no source patch and confirmed no newly reproduced security defect.

## Requirements and attempts to refute

### Provider-bound sign-in, lookup, sign-out and revocation

`packages/auth/src/better-auth-adapter.ts:83` (`createBetterAuthIdentityAdapter`) binds the provider adapter; `packages/auth/src/identity-port.ts:253` (`createIdentityPort`) is the SceneAxi issuance boundary. The actual public provider route delegates GET/POST at `sites/umbrella/src/app/api/auth/[...all]/route.ts:6`.

`sites/umbrella/test/better-auth-provider.test.ts:211` exercises stock credential sign-in and persisted cookie/bearer lookup. At `:258`, revoked credentials fail subsequent lookups while another session remains valid. At `:292`, hosted logout tests both normal operation and a first provider-delete failure, then both session layers. This **refutes backlog id 14** (claim that provider bearer always survives SceneAxi logout). Do not rebuild or weaken the existing revocation implementation. Reconcile dated backlog/gap wording to this evidence; leave deployed revocation proof open.

### Principal/admin origin and Kids boundary

`identity-port.ts:256` uses object issuance provenance, and `:281` refuses an admin identity not issued by `resolveAdminIdentity`. `packages/auth/src/roles.ts:57` (`resolveRole`) is deliberately arithmetic, not authority; guards rederive the role and check provenance (`:142`). `createRoleGuards`, `requireAuthenticated` and `requireRole` are covered by the passing package suite; exact role matching does not imply an admin hierarchy. Fabricated/JSON-round-tripped principals are not production evidence. Kids refusal is exercised before provider/storage/network work at provider test `:786` and by role guards.

Admin provider bootstrap inserts a verified flag at `sites/umbrella/src/provider/better-auth-provider.ts:338` (`ensureBetterAuthAdminBootstrap`), tied to the configured sole-admin identity. This is an **operator/environment attestation**, not verified email delivery. Attempted refutation: disagreement/idempotency/rollback tests at provider test `:405`, `:423`, `:435` pass. No privilege-escalation defect established. Do not describe this as a public email-verification flow.

### Origin, cookies, malformed and absent configuration

`sites/umbrella/src/lib/request-authority.ts:72` (`verifyFormOrigin`) refuses when deployment proof is unavailable. Login/logout POST front doors use existing origin and cookie-security helpers (`sites/umbrella/src/app/api/login/route.ts:28`, `:63`; logout `:28`, `:46`). Same-origin tests reject foreign origins, alias hosts and insufficient proof (`tests/sites/umbrella-login-flow.test.ts:138`, `packages/site-kit/test/site-session.test.ts:124`). Provider trusts only its configured origin (`better-auth-provider.ts:248`) and enables secure cookies for HTTPS (`:260`); origin resolution rejects non-loopback HTTP (`:65`). Malformed/absent provider configuration and redacted storage faults pass provider tests `:703` and `:735`.

These are local helper/handler assertions. **No deployed browser CSRF/cookie test or real reverse-proxy header proof was run**; direct handler tests do not prove Next routing, cookie transport, forwarded headers or browser behavior.

### Lifecycle, retention, error handling and performance

Signup is intentionally disabled (`better-auth-provider.ts:245`). `requiredEndpoint` at `:583` exposes only POST sign-in, GET lookup and POST sign-out. Provider test `:764` proves endpoint/method refusal. Reset/change password/email, account disable/export/deletion and MFA are not supplied by that public provider front door. Absence is a capability gap, not evidence that Better Auth itself lacks these features.

Durable throttling is present (`:249`), with five sign-in attempts per 300 seconds (`:202`), bounded pool size three (`:396`), bootstrap recovery and idle-client containment tests. Rate-limit retention is explicitly implemented (`:216`, `:431`, `:448`) and tested (`provider test :609`, `:659`). Refutation succeeded against a blanket claim of no retention/throttling. **Throttle-counter retention is not a user/account/ledger retention policy.** Live multi-instance throughput, deployed IP trust and database exhaustion were not load-tested.

## Prioritized implementable tasks and gates

| ID / severity | Evidence and impact | Owner / exact changes requested | Dependencies and acceptance |
| --- | --- | --- | --- |
| IDENTITY-01 / high / coverage gap | Real provider handler tests use `better-auth/adapters/memory` (`provider test :2`, `:72`). No deployed Neon/HTTPS/session proof. | Integration/provider owner: existing `sites/umbrella/src/provider/better-auth-provider.ts:createBetterAuthProviderHandler`, route exports, `docs/production-activation.md`; integration evidence under production-swarm FINAL. | Authorized test deployment/origin, configured database and credential secret via secure provisioning, permission for disposable non-production test data. Run stock sign-in -> cookie/bearer lookup -> hosted logout -> both lookups reject. Capture command/status, redacted headers and persistence evidence; never invent a session. |
| IDENTITY-02 / high / capability gap | Allowlist `provider:583` excludes reset/change credential and lifecycle endpoints. Backlog 11/12/13/16 remain capability questions; admin-only launch still needs safe recovery. | Identity builder: `sites/umbrella/src/provider/better-auth-provider.ts:requiredEndpoint` and runtime options; new authenticated lifecycle/reset/change route/page tests. Shared ownership needed: `packages/schemas` lifecycle contracts; `packages/auth/src/identity-port.ts`, `store.ts` lifecycle interface; persistence/ledger owner for export/disable/pseudonymization. | Default keep signup closed and Kids denied. Implement local authenticated export/disable and recovery contracts with no-send named refusal when transport absent; never enable raw stock reset/delete endpoints without origin/provenance/re-auth tests. Preserve append-only ledger. External mail delivery/regulated retention requires real transport/legal inputs. Acceptance: real existing provider suite plus new public-boundary reauth, token expiry/replay, disable-and-revoke, export and immutable-ledger tests. No endpoint claimed complete before those new tests exist. |
| IDENTITY-03 / high / policy gap | Bootstrap verified flag is operator attestation (`provider:338`); throttle cleanup is not account retention (`:431`). Missing explicit account/ledger lifecycle evidence. | Policy/docs coordinator and persistence owner: `docs/production-activation.md`, dated backlog/gap list, privacy/retention docs and schema migration plan, not source edits by this lane. | Recommend minimize identity data, revoke access immediately on authorized disable, export authenticated account-owned data, pseudonymize identifiers only through a reviewed ledger-preserving procedure; do not choose arbitrary legal retention periods or execute production deletion. Acceptance: documented record-category retention/legal basis, backup handling, export boundaries and local tests proving immutable finance records survive lifecycle operations. |
| IDENTITY-04 / medium / stale claim | Backlog id 14 and dated sign-out claim refuted by provider tests `:258`, `:292`. Leaving it open misdirects builders. | Docs/backlog owner: `docs/audits/go-live-backlog.json` id 14; `docs/audits/go-live-gaps-2026-09-26.md` sign-out section. | Mark local remediation evidenced, retain external deployment verification dependency. Acceptance: provider/adapter suites above and accurate production status, not an unconditional PASS. |
| IDENTITY-05 / medium / coverage gap | Origin/cookie assertions are helpers/source-order tests, not live browser route proof. | Site/integration owner: `sites/umbrella/src/app/api/login/route.ts:POST`, logout `POST`, provider route GET/POST; browser integration tests. | Existing authorized local build/server and browser environment; no new harness/config. Test genuine same-origin login, hostile Origin, omitted proof, alias origin, HTTPS Secure/HttpOnly/SameSite, logout replay, cache-control and rejected credentials without leakage. Run existing `pnpm --dir sites/umbrella run test:visual` with meaningful assertions; no screenshot-only claim of auth coverage. |

No root manifest change is required for current verification. If lifecycle contracts require new exports/dependencies, root manifest/package-boundary changes belong to the integration owner; this lane does not widen the matrix.

## Recommended delegated decision

Keep the locally implemented sole-admin, closed-signup launch posture; do not park that product choice for AFK approval. Public account onboarding, verified email delivery, password recovery and MFA must not be advertised as shipped. Backlog id 3 is an explicit closed-launch scope choice, not permission to open signup. Backlog id 15 is still relevant to future public users: provider attestation does not establish verification delivery for them. Backlog id 16 is not evidence of an existing auth bypass; MFA merits an admin hardening work item, OAuth is not automatically launch-required.

Recommendation was sent to the coordinator through the finding bus. Code implementation is delegated to the owning builder; this read-only audit has no source-edit authority. Account lifecycle, live browser proof and external provider proof remain in the remaining list. No full-production PASS is warranted.
