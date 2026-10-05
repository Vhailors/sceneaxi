# Builder assignment — identity

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/admin.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/better-auth-adapter.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/bootstrap.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/identity-port.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/principal-provenance.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/refusals.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/roles.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/session-token.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/store.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/testing/principal-issuance.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/test/admin.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/test/identity-port.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/test/principal-provenance.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/test/role-guard.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/auth/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/auth/[...all]/route.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/login/route.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/logout/route.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/login/page.tsx`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/account-lifecycle.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/login-flow.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/request-authority.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider-refusals.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/account-lifecycle.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [3, 11, 12, 13, 14, 15, 16]. Authority requirement IDs: ['IDENT-001', 'IDENT-002', 'IDENT-003', 'IDENT-004', 'IDENT-005', 'IDENT-006', 'IDENT-007'].

### COVERAGE-IDENTITY: implementation-needed / P1
Remaining current-source/front-door coverage: identity
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "live Next/browser auth front doors", "deployed Neon provider flows", "real mail delivery", "live multi-instance load tests", "account lifecycle/export/deletion proof"]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json"]

### GATE-MAIL: genuine-external-blocker / P1
Verified email/recovery delivery absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Approved real email transport/sender/domain configuration via secure provisioning, authority for test delivery and genuine confirmation/recovery/expiry/replay/revocation evidence. Missing transport must refuse by name.

### GATE-RETENTION: genuine-external-blocker / P1
Account/ledger privacy retention inputs absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Reviewed record-category retention/legal basis, legal entity/contact, jurisdictional privacy/export/deletion/backup/pseudonymization policy that preserves append-only finance records; no arbitrary legal time periods or production deletion.

### IDENTITY-01: finding-mapped-to-root-tasks / P1
Run stock sign-in, cookie/bearer lookup, hosted logout and failed replay through actual HTTP routes with redacted persistence evidence
- Chosen solution: Run stock sign-in, cookie/bearer lookup, hosted logout and failed replay through actual HTTP routes with redacted persistence evidence
- Acceptance: ["Both provider and SceneAxi credentials invalid after logout; unrelated session preserved; no forged session or secret logs"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": "2", "symbol": "providerFixture"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": "2", "symbol": "providerFixture", "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}]
- Dependencies: ["authorized non-production deployment and disposable test data", "securely provisioned provider/database credentials"]
- Evidence/reproduction: {"reproduction": "Run test:provider; runtime uses memoryAdapter and fixture records, not deployed database", "refutation": "Real Better Auth runtime is exercised locally; absence of production evidence is not a product failure", "impact": "No proof of live provider persistence, HTTPS deployment or actual Next front doors", "kind": "coverage-gap", "status": "OPEN_EXTERNAL_EVIDENCE"}
- Exact missing input (no local implementation parked): ['authorized non-production deployment and disposable test data', 'securely provisioned provider/database credentials']; Run stock sign-in, cookie/bearer lookup, hosted logout and failed replay through actual HTTP routes with redacted persistence evidence

### IDENTITY-02: implementation-needed / P1
Keep signup closed; implement authenticated export/disable and recovery contracts with explicit unconfigured refusal; add token replay/expiry and reauth tests before enabling endpoints
- Chosen solution: Keep signup closed; implement authenticated export/disable and recovery contracts with explicit unconfigured refusal; add token replay/expiry and reauth tests before enabling endpoints
- Acceptance: ["New public-boundary tests must prove lifecycle/recovery semantics; existing commands alone do not prove new features"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": "583", "symbol": "requiredEndpoint"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/identity-port.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/store.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"reference": "packages/schemas lifecycle contracts (shared owner)"}, {"reference": "new lifecycle route/page tests (builder assigns exact paths)"}]
- Dependencies: ["existing origin/provenance helpers", "ledger-preserving lifecycle contract", "email transport credentials for actual delivery"]
- Evidence/reproduction: {"reproduction": "Endpoint allowlist permits only sign-in, get-session and sign-out; existing endpoint-refusal test at provider test:764 passes", "refutation": "Closed signup is intentional; Better Auth feature availability is not SceneAxi endpoint availability; OAuth not automatically launch-required", "impact": "No public recovery/change-credential/account export-disable-delete/MFA flow demonstrated", "kind": "capability-gap", "status": "OPEN_LOCAL_AND_EXTERNAL"}
- Commands: ["pnpm --dir sites/umbrella run test:provider", "pnpm --dir sites/umbrella run test:integration", "pnpm exec vitest run packages/auth/test --reporter=verbose"]

### IDENTITY-03: implementation-needed / P1
Document operator attestation accurately; specify category-level retention/export/disable and ledger-preserving pseudonymization; no arbitrary legal periods or production deletion
- Chosen solution: Document operator attestation accurately; specify category-level retention/export/disable and ledger-preserving pseudonymization; no arbitrary legal periods or production deletion
- Acceptance: ["Reviewed explicit policy plus local immutable-ledger lifecycle tests; external evidence remains named"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": "338", "symbol": "ensureBetterAuthAdminBootstrap"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-backlog.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-gaps-2026-09-26.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "privacy/retention policy and schema migration plan (shared owners)"}]
- Dependencies: ["legal retention basis and backup policy", "real mail verification evidence for public-account claims"]
- Evidence/reproduction: {"reproduction": "Bootstrap stores verified flag via environment-owned provisioning; rate-limit retention SQL affects counters only", "refutation": "Bootstrap idempotence/conflict/rollback tests pass; no privilege escalation established; throttle retention exists", "impact": "Delivered-email verification and user/ledger retention claims cannot be made", "kind": "policy-gap", "status": "OPEN_POLICY_AND_LOCAL_DOCS"}

### IDENTITY-ADMIN-HARDENING: implementation-needed / P1
Admin reauthentication and lifecycle capability hardening
- Chosen solution: Use current verified-password provider and provenance guards for sensitive export/disable/credential operations; prepare MFA policy/negative boundary only where existing stack admits it, never advertise unimplemented MFA.
- Acceptance: ["Recent genuine session/reauth required; disable revokes both session layers; immutable ledger survives; no client-supplied role; missing MFA/transport named refusal."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/identity-port.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### IDENTITY-04: implementation-needed / P2
Reconcile id 14 and gap wording to current source/test evidence, without claiming deployed proof
- Chosen solution: Reconcile id 14 and gap wording to current source/test evidence, without claiming deployed proof
- Acceptance: ["Independent current public-front-door assertion and unchanged integration gate; preserve protected refusals."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": "292", "symbol": "hosted-logout-flow"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-backlog.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-gaps-2026-09-26.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["retain live deployment evidence gate"]
- Evidence/reproduction: {"reproduction": "Run test:provider; provider bearer/cookie invalid after logout, including injected first-delete failure", "refutation": "Specific stale defect successfully refuted through provider Request/Response and hosted flow boundaries", "impact": "Dated claim incorrectly directs builders to already remediated local revocation", "kind": "stale-backlog", "status": "REFUTED_SOURCE_CLAIM_DOC_UPDATE_NEEDED"}
- Commands: ["pnpm --dir sites/umbrella run test:provider", "pnpm --dir sites/umbrella run test:integration"]

### IDENTITY-05: implementation-needed / P2
Add real browser/HTTP tests for same-origin sign-in, hostile/missing/alias Origin, HTTPS cookie attributes, logout replay and cache controls
- Chosen solution: Add real browser/HTTP tests for same-origin sign-in, hostile/missing/alias Origin, HTTPS cookie attributes, logout replay and cache controls
- Acceptance: ["Auth-specific assertions required; screenshots or script exit alone insufficient"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/login/route.ts", "line": "28", "symbol": "POST"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/login/route.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/logout/route.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/auth/[...all]/route.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"reference": "browser auth integration tests (site owner assigns exact paths)"}]
- Dependencies: ["existing authorized local build/server/browser environment"]
- Evidence/reproduction: {"reproduction": "Current successful oracles call helpers/handler and inspect route source, not browser HTTP routes", "refutation": "Configured-origin and cookie-security helper/source-order tests pass; live-browser coverage still absent", "impact": "Cookie transport, proxy headers, deployed origin and Next routing could differ from tested helpers", "kind": "coverage-gap", "status": "OPEN_LOCAL_INTEGRATION"}
- Commands: ["pnpm --dir sites/umbrella run test:visual"]

### LOCAL-PROOF-014: done-with-evidence / P2
Bounded implemented portion: Sign-out deletes only the SceneAxi `sessions` row; the Better Auth session/bearer stays valid until expiry
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "backlogDisposition": {"id": 14, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

### REQ-PROOF-IDENT-001: done-with-evidence / P2
Bounded requirement declaration: Identity, credits, and billing use injected Better Auth, Neon, and Stripe adapters; provider clients stay out of hermetic core.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_INJECTED_PROVIDER_BOUNDARY"]
- Source: []
- Targets/owners: [{"reference": "packages/auth"}, {"reference": "packages/billing"}, {"reference": "sites/umbrella/src/provider"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-001", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_INJECTED_PROVIDER_BOUNDARY", "evidence": "audit-identity verification + audit-billing-data E1/E2/E5/E6/E7; no real provider/deployment proof", "remaining": ["GATE-ACTIVATION", "IDENTITY-05"]}, "expectedEvidenceLayer": ["tests/sites/identity-plane-wiring.test.ts", "tests/boundary/injected-site-violations.test.ts"]}]

### REQ-PROOF-IDENT-002: done-with-evidence / P2
Bounded requirement declaration: Admin identity is derived only from normalized SCENEAXI_ADMIN_EMAIL; User has no role field that can be claimed by input.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_PRINCIPAL_PROVENANCE_ROLE_GUARDS"]
- Source: []
- Targets/owners: [{"reference": "packages/auth/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-002", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_PRINCIPAL_PROVENANCE_ROLE_GUARDS", "evidence": "audit-identity principal/admin origin requirement; auth suite85 assertions", "remaining": ["GATE-ACTIVATION"]}, "expectedEvidenceLayer": ["packages/auth/test/identity-port.test.ts", "tests/e2e/auth-credits-refuse-matrix.test.ts"]}]

### REQ-PROOF-IDENT-003: done-with-evidence / P2
Bounded requirement declaration: Hosted login and logout require same-origin proof before fields or identity ports are reached, store the raw grant only in the HttpOnly session cookie, and keep redirects same-site.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_HELPER_HANDLER_ORIGIN_COOKIE_REDIRECT"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/login-flow.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"reference": "sites/umbrella/src/app/api/login"}, {"reference": "sites/umbrella/src/app/api/logout"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-003", "crossLaneSemanticRevalidation": true, "outcome": "PASS_HELPER_HANDLER_ORIGIN_COOKIE_REDIRECT", "evidence": "audit-identity CSRF/cookie/origin requirement +153 site assertions", "remaining": ["IDENTITY-05", "GATE-ACTIVATION"]}, "expectedEvidenceLayer": ["tests/sites/umbrella-login-flow.test.ts", "sites/umbrella/test/better-auth-provider.test.ts"]}]

### REQ-PROOF-IDENT-004: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Credit balance is derived from an append-only ledger; every store is created through the commit boundary and sale settlement commits both legs and the creator record atomically.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CONFIRMED_PERSISTENCE_INVARIANT_DEFECT"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "db/migrations"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-004", "crossLaneSemanticRevalidation": true, "outcome": "CONFIRMED_PERSISTENCE_INVARIANT_DEFECT", "normativeSatisfied": false, "evidence": "audit-billing-data E5 real PostgreSQL poisoned first debit accepted; normal business paths remain bounded", "remaining": ["BD-001", "BD-008"]}, "expectedEvidenceLayer": ["packages/billing/test/store-boundary.test.ts", "packages/billing/test/metering.test.ts", "tests/db/schema-lockstep.test.ts"]}]

### REQ-PROOF-IDENT-005: done-with-evidence / P2
Bounded requirement declaration: Hosted AI is default-off, follows the documented Kids → route → opt-in → ledger → replay → entitlement → metering → provider → debit order, and BYO remains free.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_DEFAULT_OFF_KIDS_BYOK_METERING_ORDER"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-005", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_DEFAULT_OFF_KIDS_BYOK_METERING_ORDER", "evidence": "audit-billing-data E1 hosted-ai cases + audit-identity lifecycle/performance bounded requirement", "remaining": ["BD-007", "BILLING-PRICE-POLICY", "GATE-AI-PROVIDER"]}, "expectedEvidenceLayer": ["tests/e2e/hosted-ai-metering-golden.test.ts", "packages/billing/test/metering.test.ts"]}]

### REQ-PROOF-IDENT-006: done-with-evidence / P2
Bounded requirement declaration: Checkout grant persistence acknowledges only after the ledger commit succeeds, and signed webhook evidence is bound to the exact Checkout Session and persisted intent.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_SIGNED_FIXTURE_EXACT_INTENT_SESSION_DURABILITY"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/checkout.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "sites/umbrella/src/provider"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-006", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_SIGNED_FIXTURE_EXACT_INTENT_SESSION_DURABILITY", "evidence": "audit-billing-data E6/E7 actual disposable PostgreSQL, fixture provider signatures explicitly not real Stripe", "remaining": ["GATE-STRIPE-TEST"]}, "expectedEvidenceLayer": ["packages/billing/test/stripe-checkout.test.ts", "tests/sites/identity-plane-wiring.test.ts"]}]

### REQ-PROOF-IDENT-007: done-with-evidence / P2
Bounded requirement declaration: Live Stripe mode has one environment authorization source and remains unavailable without its explicit audited authority; mode, environment, and key prefixes cannot authorize it.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_LIVE_DEFAULT_REFUSAL_SOURCE"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/live-mode.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "packages/billing/src"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/db/migrations/0007_stripe_live_mode_audit.sql", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-007", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_LIVE_DEFAULT_REFUSAL_SOURCE", "evidence": "audit-billing-data E1/E6 and LIVE/Connect fail-closed acceptanceCoverage", "remaining": ["GATE-LIVE"]}, "expectedEvidenceLayer": ["packages/billing/test/", "tests/e2e/auth-credits-refuse-matrix.test.ts", "sites/umbrella/test/provider-adapters.integration.test.ts"]}]

### SCOPE-CLOSED-SIGNUP: intentional-nonlaunch-capability / P2
Public onboarding intentionally not launched
- Chosen solution: Keep sole-admin verified-password closed signup; locally build safe recovery/export/disable. Public signup requires genuine policy/transport/governance authority, not toggling disableSignUp.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

### SCOPE-OAUTH: intentional-nonlaunch-capability / P2
Social OAuth not part of safe local candidate
- Chosen solution: Prioritize verified-password recovery and admin hardening; OAuth remains unsupported/visible, do not invent provider accounts.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

## Shared requests and acceptance obligations

[{"lane": "identity", "sourceKey": "sharedChanges", "requests": ["packages/schemas lifecycle contracts and persistence/ledger interfaces belong to shared owners", "root manifest edits not needed for present verification; future dependency/export edits require integration ownership", "backlog/gap/activation-policy documentation belongs to docs coordinator"]}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
