# Production activation runbook

**Status: RUNBOOK ONLY — NO PRODUCTION ACTION IS AUTHORIZED BY THIS FILE OR
[sceneaxi#201](https://github.com/Vhailors/sceneaxi/issues/201).** The captain has
authorized preparing this checklist and considering activation now. That is not
authority to deploy, move an alias, create or change an account, set a secret, accept a
charge, enable Stripe LIVE, sign a desktop build, or publish an artifact. Each external
action still needs its own explicit captain authorization naming the action, and it may
be executed only with real configured credentials and a recorded verification result.

This is the operator control plane for activation, and the **sole owner of the ordered
activation and rollback procedure**. No other document sequences these actions; the
narrower owners below hold the mechanics, contracts, and verification commands each step
needs, and this runbook does not replace them:

- [`websites-deploy.md`](websites-deploy.md) owns the Vercel topology, environment
  names, provider wiring, and web verification commands. Its
  [activation mechanics](websites-deploy.md#activation-mechanics) are grouped by topic
  and deliberately unnumbered — read them for what a step entails, and take the steps in
  the order below;
- [`auth-credits.md`](auth-credits.md) owns identity, ledger, checkout, and LIVE-mode
  invariants;
- [`stripe-live-activation.md`](stripe-live-activation.md) and
  [`stripe-connect-operations.md`](stripe-connect-operations.md) own the two
  deliberately uncompleted Stripe LIVE checklists;
- [`desktop-linux.md`](desktop-linux.md), [`desktop-macos.md`](desktop-macos.md), and
  [`desktop-windows.md`](desktop-windows.md) own artifact evidence and platform release
  mechanics; and
- [`bootstrap.md`](bootstrap.md) keeps review, push, spend/accounts, and publication as
  separate authorities. A green gate grants none of them.

If this runbook and a narrower owner disagree, stop. The narrower owner wins and the
documents must be reconciled before activation continues.

## Authorization gate

Before an operator changes external state, the captain's recorded authorization must
name all of the following for that one action:

- the action itself, such as deploying a named commit to a named Vercel project,
  reassigning one production alias, applying named migrations to the recorded Neon
  database, configuring the TEST webhook, signing one desktop candidate, or publishing
  one already verified artifact;
- the exact target, billing mode, source commit or artifact record, operator, and
  execution window; and
- the evidence location and rollback owner.

An authorization for one row does not authorize another. In particular:

| Action | Additional authority that must be explicit |
|---|---|
| Production site deployment or alias reassignment | publication/public-visibility authority 11 from `docs/bootstrap.md` |
| Provider account creation, paid service, or real charge | spend/accounts authority 10 |
| Stripe LIVE credit-pack activation | separate captain go-live decision plus every POST-AUTH condition in `docs/stripe-live-activation.md` |
| Stripe Connect LIVE onboarding or payout | separate Connect LIVE decision plus `docs/stripe-connect-operations.md`; changing readiness to `mode: "live"` is insufficient |
| macOS or Windows signed build | an authorization naming that platform, source commit, and candidate |
| Publishing a desktop artifact or update feed | a later, separate publication authorization naming the verified record |

The present #201 authorization satisfies none of those rows. If the authorization record
does not name the proposed action exactly, record `REFUSED — AUTHORITY ABSENT` and stop.

## Exact production inputs and owners

No value from a secret store belongs in this repository, a pull request, an issue, a
terminal transcript, or a committed evidence file. Inspect secret **name, target, and
scope** without printing the value. Provider object ids, deployment ids, source commits,
and hashes may be recorded; credentials may not.

### Web identity, Neon, and Stripe TEST

Two kinds of fact share the **Current recorded state** column below, and they are not
interchangeable. The `BETTER_AUTH_ORIGIN`, Neon project identity, Stripe TEST endpoint, and
encrypted Vercel variable-name cells restate the dated external observation owned by
[`websites-deploy.md#verified-test-readiness`](websites-deploy.md#verified-test-readiness),
last re-observed 2026-08-01. Re-observe there first: that record is the owner, those cells are
the operator's at-a-glance copy of it, the two must move in the same change, and
`tests/docs/production-activation.test.ts` fails if they drift.

The remaining cells are not part of that dated observation. `SCENEAXI_ADMIN_EMAIL` records
captain-held configuration policy, `BETTER_AUTH_SECRET` names newly required provider
configuration, while the cells for Neon-backed provider handles and TEST
checkout/evidence adapters state what this repository's own source and tests establish
together with what production has not evidenced. None of the four is an external
observation, none is held in lockstep by that test, and none may be read as a deployment
claim; the deployment owner still proves each of them through the close-out column.

| Input or evidence | Exact target | Current recorded state | Owner and required close-out |
|---|---|---|---|
| `BETTER_AUTH_ORIGIN` | Vercel Production scope, `sceneaxi-umbrella` | **Missing** from the latest name-only Vercel observation. The deployed umbrella also predates `/login`. | Better Auth/deployment owner supplies a real HTTPS provider origin and proves `POST /api/auth/sign-in/email` plus `GET /api/auth/get-session`. Credentials and provider tables remain provider-owned. A malformed or absent origin leaves the identity handle absent. |
| `BETTER_AUTH_SECRET` | Vercel Production scope, `sceneaxi-umbrella` | Required by the in-repo provider implementation; absent from the latest name-only observation, and no value is recorded. | Captain/provider owner supplies signing material of the provider's required strength. Missing or malformed material returns `BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT` or `BETTER_AUTH_PROVIDER_CONFIGURATION_INVALID`; it is never printed or passed to core. |
| `DATABASE_URL` | Vercel Production scope, all three web projects | The deployment doc records one encrypted value shared by all three; the latest external observation confirmed the name only on the umbrella, not its value or use. | Captain (Neon) owns the connection secret. The deployment owner confirms the same target database on all three projects without printing the URL. |
| Neon project identifiers | project `sceneaxi-prod`, id `misty-king-68383952`, region `aws-us-east-2`, database `neondb` | Project identity is recorded; no connection or migration proof was performed in the latest readiness observation. | Neon/deployment owner verifies the identifiers, applies `db/migrations/0001_identity.sql` through `0005_better_auth_provider.sql` in order, and captures schema/trigger/index evidence. There is no down-migration rollback. |
| Neon-backed provider handles | umbrella deployment owner behind `umbrellaRequestAuthority()` | Adapter code exists; production handle construction and authenticated read/write behavior are not yet evidenced. | Deployment owner supplies the real `IdentityStore`, `CreditStoreAdapter`, checkout-intent store, settlement evidence port, and any separately authorized Connect store. Missing or unreadable storage remains a refusal, never an empty account or zero balance. |
| `SCENEAXI_ADMIN_EMAIL` | Vercel Production scope, `sceneaxi-umbrella` | Value is captain-held and intentionally undocumented. | Captain supplies the sole admin address. The deployment owner verifies a real provider-authenticated session for that address; the environment value alone grants no role. |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | Vercel Production scope, `sceneaxi-umbrella` | Encrypted variable name was observed; its value was not and must not be attested here. | Captain/provider owner supplies first-run credential material and proves it through the provider. It is never a role source or core input. |
| `STRIPE_SECRET_KEY` | Vercel Production scope, `sceneaxi-umbrella` | Encrypted variable name was observed; the shipped adapter accepts **TEST** scope only. | Captain/Stripe TEST owner verifies TEST scope without exposing the key. A LIVE key is not a substitute. |
| `STRIPE_WEBHOOK_SECRET` | Vercel Production scope, `sceneaxi-umbrella` | Encrypted variable name was observed for the TEST endpoint. | Captain/Stripe TEST owner keeps the endpoint-specific signing secret in the deployment store. Missing means `STRIPE_WEBHOOK_SECRET_MISSING` and HTTP 503, never acceptance. |
| Stripe TEST endpoint | `https://sceneaxi-umbrella.vercel.app/api/stripe/webhook` | Recorded with `livemode: false`, but subscribed only to `checkout.session.completed`. | Stripe TEST/deployment owner adds `charge.refunded`, keeps Checkout card-only, and proves a signed TEST completion, replay, and full-refund reconciliation. An event never subscribed is not fail-closed; it is never delivered. |
| `SCENEAXI_BILLING_MODE` | Vercel Production scope, `sceneaxi-umbrella` | `test` when unset; the name was observed. | Deployment owner pins `test` for this activation and records the scope. Mode selection never authorizes LIVE. |
| TEST checkout/evidence adapters | umbrella deployment owner | In-repo behavior exists; a real persisted intent, returned TEST Checkout Session, exact settlement read, and ledger grant are not production-evidenced. | Deployment owner proves intent-before-redirect, required metadata on both Checkout Session and PaymentIntent, exact session binding, archived pack resolution, and one append-only grant before enabling Buy. |

`BETTER_AUTH_ORIGIN` is an origin, not an application secret. Its provider credentials
still remain secret. The accepted origin is HTTPS except for exact loopback development;
production must never use loopback or a look-alike host. A provider that honors neither
the issued cookie nor bearer token for `get-session` is a deployment fault, not a reason
to report valid credentials as rejected.

### Vercel projects, aliases, and build-time origins

The only web production topology in this activation is:

| Project | Root directory | Required stable production alias |
|---|---|---|
| `sceneaxi-umbrella` | `sites/umbrella` | `https://sceneaxi-umbrella.vercel.app` |
| `sceneaxi-catalog-game` | `sites/catalog-game` | `https://sceneaxi-catalog-game.vercel.app` |
| `sceneaxi-catalog-web` | `sites/catalog-web` | `https://sceneaxi-catalog-web.vercel.app` |

The Vercel deployment owner operates those projects on the one recorded team
(`vhailpers-projects` preferred). The captain owns publication/public visibility and
must authorize each deployment or alias move. There is no custom-domain action in this
runbook, and a per-build preview hostname is never a canonical checkout origin.

Before the authorized production build, set `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` to
`https://sceneaxi-umbrella.vercel.app` on all three projects. If the authorized release
includes complete family links, set `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN` to
`https://sceneaxi-catalog-game.vercel.app` and
`NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` to
`https://sceneaxi-catalog-web.vercel.app` on all three as well. These values are public
build inputs, not secrets, and changing one requires a redeploy. Do not derive checkout
redirects from `Host`, attach the umbrella alias to a preview build, or substitute a
preview URL in the canonical-origin variable.

The last observation confirms that all three aliases answered, but not that they point
to current green `main`. The deployment owner must record the alias-to-deployment-id and
deployment-to-source-commit mapping after the authorized release.

### Stripe TEST and LIVE stay separate

This runbook may activate only the existing TEST path, and only after its own named
authorization. For that action:

- `SCENEAXI_BILLING_MODE` is `test` (or absent with the documented TEST default);
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` belong to TEST objects;
- the endpoint reports `livemode: false`; and
- `SCENEAXI_STRIPE_LIVE_AUTHORIZED` remains unset.

LIVE is not a missing value to fill during TEST activation. The sole accepted LIVE
authorization variable is `SCENEAXI_STRIPE_LIVE_AUTHORIZED`, with the exact audited form
owned by `docs/auth-credits.md`. It is currently unset by design, no shipped call site
passes its runtime witness, and the provider adapter rejects LIVE keys. Setting it,
setting `SCENEAXI_BILLING_MODE=live`, using an `sk_live_` key, or setting any alias such
as `STRIPE_LIVE_MODE_AUTHORIZED` still does not activate LIVE. All must continue to
refuse `STRIPE_LIVE_MODE_NOT_AUTHORIZED` until a separately authorized reviewed code and
operations change lands green.

The SA-CON-1 seam is likewise TEST-only. Its provider, dashboard, secret, TEST-operations,
and operations readiness are injected values with no repository-owned credential names;
do not invent environment variables for them. Missing readiness refuses
`STRIPE_CONNECT_PROVIDER_MISSING`, `STRIPE_CONNECT_TEST_OPERATIONS_DISABLED`,
`STRIPE_CONNECT_DASHBOARD_MISSING`, or `STRIPE_CONNECT_SECRET_MISSING`. A LIVE provider
or LIVE split refuses `STRIPE_CONNECT_LIVE_UNAVAILABLE`.

### Desktop signing and notarization inputs

Desktop release is independent of web activation. No public macOS or Windows artifact
exists, and the recorded Linux artifact makes no code-signing or update claim. Do not
replace either coming-soon row without a real verified release record and its own
publication authorization.

| Platform | Exact missing operator inputs | Owner and closed behavior |
|---|---|---|
| macOS | `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `SCENEAXI_MACOS_RELEASE_BASE_URL`; verified `GITHUB_SHA`; canonical Actions evidence also requires `GITHUB_REPOSITORY` and `GITHUB_RUN_ID` | Apple/release operator owns the Developer ID Application certificate, its password, Apple account, team, notarization credential, HTTPS update location, and clean source checkout. Missing input refuses `MACOS_ENV_REQUIRED:<name>` or `MACOS_PROVENANCE_REQUIRED:<name>`. Missing host/tools refuse `MACOS_HOST_REQUIRED`, `MACOS_TOOL_REQUIRED:<tool>`, or `MACOS_XCRUN_TOOL_REQUIRED:<tool>`. `dist` uses `--publish never`. |
| Windows | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`; publication additionally requires `GITHUB_RELEASE_TOKEN` and `SCENEAXI_WINDOWS_RELEASE_TAG` equal to `v<package.json version>` | Windows/release operator owns the Authenticode certificate, password, token, existing draft, and SignTool host. Missing inputs refuse `WINDOWS_RELEASE_ENV_MISSING:<name>`; missing host/tool refuses `WINDOWS_RELEASE_HOST_REQUIRED` or `WINDOWS_RELEASE_TOOL_MISSING:<tool>`. `dist` does not publish, and `draft:upload` cannot create or publish the release. |

For macOS, the operator also needs `codesign`, `hdiutil`, `security`, `spctl`, `xcrun`,
`notarytool`, `stapler`, and `git` on the required macOS host. For Windows, the operator
needs the documented Windows x64 toolchain, `signtool.exe`, and—only for draft upload—
`gh.exe`. Values, certificates, app-specific passwords, and tokens stay in the operator
secret store. A locally produced macOS record remains `iaLinkable: false`; only the exact
canonical `workflow_dispatch` provenance may produce the linkable record.

### GitHub required-check registration recovery

This is **operator-only CI recovery mechanics, not an activation step**. If GitHub fails
to register a required check, or cancels it before its job executes, a repository
operator may use the Actions **Run workflow** control against the exact preserved PR
branch and head commit for each required workflow:

- `.github/workflows/gate.yml`
- `.github/workflows/engine-sdk.yml`
- `.github/workflows/desktop-linux.yml`
- `.github/workflows/desktop-macos.yml`

Record each dispatched run URL and verify that all four runs name the intended full head
commit before treating the required-check set as recovered. A dispatch does not deploy a
site, publish an artifact, prove a provider credential, enable Stripe LIVE, or supply
captain authorization.

Recovery never produces a release. `desktop-macos.yml` takes a `release_candidate`
input that defaults to `false`, and every recovery dispatch leaves it at that default:
the run then executes exactly the pull-request verification job — the same Linux
type-check, staging build, and configuration smoke — so it needs no Apple credential and
no macOS runner to report the same required check. Dispatching `release_candidate=true`
is a separate credentialed release operation outside this recovery: only that explicit
input selects a macOS runner and reaches signing, notarization, packaged smoke, and
artifact upload, and it still fails closed by name when its real Apple inputs are absent
or empty. Never substitute, copy, print, or invent credentials merely to obtain a green
check, and never request a release candidate to recover one. Only authoritative GitHub
results for the intended head count as CI evidence.

## Preflight checklist

Do not start activation until every applicable item is checked with real evidence.

- [ ] Record the explicit captain authorization for the exact action being attempted,
  including target, mode, source commit/artifact, operator, window, evidence location,
  and rollback owner. The #201 runbook authorization is not this record.
- [ ] Confirm the source is current green `main`, record its full commit, and run
  `pnpm gate` without provider credentials. A green hermetic gate is necessary and is
  not deployment authority or provider evidence.
- [ ] Build each in-scope site using its Vercel project settings. Record all three Next
  build results; the root gate does not run those production framework builds.
- [ ] In Vercel, inspect only presence and Production scope for every exact variable
  assigned above. Confirm the three project roots, Node 24, install command, build
  command, and team. Do not print secret values.
- [ ] Prove `BETTER_AUTH_ORIGIN` is a real HTTPS provider origin serving both required
  endpoints, using an authorized test member. Capture status and provider request ids,
  not credentials, cookies, bearer tokens, or response bodies containing them.
- [ ] Confirm `BETTER_AUTH_SECRET` is present only as encrypted Production configuration
  on `sceneaxi-umbrella`; inspect name and scope only, never its value.
- [ ] Confirm all three `DATABASE_URL` entries target Neon project `sceneaxi-prod`
  (`misty-king-68383952`), `aws-us-east-2`, database `neondb`, without recording the
  connection string.
- [ ] Apply and verify every migration in `db/migrations`, in order, under a separately authorized
  database action. Prove append-only ledger and Connect triggers, uniqueness, and the
  checkout-intent price immutability rule. Do not create a credit account by hand.
- [ ] In Stripe TEST, prove the endpoint is `livemode: false` and subscribed to both
  `checkout.session.completed` and `charge.refunded`; confirm card-only Checkout.
- [ ] Confirm `SCENEAXI_STRIPE_LIVE_AUTHORIZED` and every forbidden alias are absent,
  the adapter remains TEST-key-only, and Connect LIVE still refuses.
- [ ] Define stop conditions and incident ownership: authentication mismatch, unknown
  database state, alias/source mismatch, webhook backlog, missing intent, settlement
  mismatch, ledger/store failure, refund-reconciliation failure, unexpected LIVE object,
  secret exposure, or an unverifiable desktop signature/notarization result.
- [ ] Rehearse rollback against the last verified deployment ids and evidence records.
  Database rollback is forward-fix only; no ledger or audit row may be deleted or edited.

## Activation checklist

Execute only the rows named by the current authorization; unchecked rows remain held.

### Web identity and Stripe TEST

- [ ] Configure the shipped Better Auth handler at `BETTER_AUTH_ORIGIN`, including
  `BETTER_AUTH_SECRET` and migration `0005_better_auth_provider.sql`, and configure the
  real provider/store handles behind `umbrellaRequestAuthority()`.
- [ ] Set the exact Vercel Production variables and build-time origins on only their
  assigned projects. Keep `SCENEAXI_BILLING_MODE=test` and LIVE authorization absent.
- [ ] Configure the existing Stripe TEST webhook endpoint for both handled event types
  and store its TEST signing secret under `STRIPE_WEBHOOK_SECRET`.
- [ ] Deploy the authorized commit to the three named Vercel projects using their
  recorded root/install/build configuration. Record each immutable deployment id before
  any alias move.
- [ ] Verify the candidate deployments, then attach each of the three exact aliases to
  its matching project deployment. Never attach an alias across projects.
- [ ] Prove hosted sign-in and sign-out, one provisioned account, the starter grant,
  session verification on `/account`, and real entitlement on `/editor` through the one
  identity plane.
- [ ] Prove one separately approved Stripe TEST purchase end to end: persisted intent
  before redirect, card-only Checkout, signed completion, matching settlement and archive
  revision, one append-only grant, idempotent replay, and no second grant.
- [ ] Prove one controlled full TEST refund appends one idempotent negative adjustment;
  prove partial refund and spent-credit cases stay named terminal refusals.
- [ ] Only after hosted sign-in and entitlement are verified, remove
  `SCENEAXI_SITE_EDITOR_PREVIEW` if it is present and redeploy the umbrella. Never use the
  preview flag to conceal broken provider wiring.

### Desktop candidates — separate authorization only

- [ ] On the authorized platform host, run the owning document's release preflight
  without exposing values. Stop on every named missing-input, provenance, host, or tool
  refusal.
- [ ] Build from the named clean commit. For macOS run `pnpm --dir desktop/macos dist`
  then `pnpm --dir desktop/macos smoke --packaged`; for Windows run the documented
  `dist` and signature/hash verification. Neither command authorizes publication.
- [ ] Capture the exact candidate record, artifact sizes and hashes, signing identity,
  signature verification, notarization/stapling evidence where applicable, packaged
  smoke, and canonical workflow provenance.
- [ ] Under a later publication authorization, publish only those verified bytes and
  metadata. Download them back, re-verify, and only then update the umbrella offer. Never
  infer a download from a local record, draft, or expiring unverified artifact.

## Verification checklist

- [ ] Run and capture the complete web command set in
  [`websites-deploy.md#verification`](websites-deploy.md#verification), substituting the
  three exact aliases above. Record timestamps and immutable Vercel deployment ids.
- [ ] In a real browser, verify the umbrella `/`, `/open`, and entitled `/editor`
  viewports report `surface webgl-canvas` and `pixelsDrawn true`. Curl and the root gate
  cannot prove pixels.
- [ ] Verify `/login` serves the hosted form, a signed-out visitor is
  `IDENTITY_SESSION_ABSENT`, valid sign-in sets only the HttpOnly `sceneaxi.session`
  cookie, and same-origin enforcement refuses a cross-origin login or logout as
  `SITE_REQUEST_CROSS_ORIGIN`.
- [ ] Verify `/account` shows the authenticated user and an actual ledger-derived
  balance. A failed read must be `CREDITS_PLANE_UNAVAILABLE`, never zero.
- [ ] Verify checkout uses `https://sceneaxi-umbrella.vercel.app` for success/cancel
  redirects and refuses an alias/Host mismatch as `BILLING_CHECKOUT_ORIGIN_UNTRUSTED`.
- [ ] Verify Stripe TEST mode, both webhook subscriptions, signature enforcement,
  intent/settlement binding, one grant, duplicate replay, and full-refund adjustment
  against Stripe object ids and ledger rows. Dashboard success alone is not evidence.
- [ ] Verify the catalogs remain browse-only and return `CATALOG_COMMERCE_INERT` for
  marketplace purchase/publish. Web TEST activation does not open tier 6b.
- [ ] Verify the Kids origin remains undeployed and disconnected. SA-KIDS-1 landing a
  local isolated surface did not authorize its deployment.
- [ ] If a desktop candidate was separately authorized, verify the downloaded bytes
  against the recorded checksum and platform signature/notarization record, then run the
  packaged smoke. Until publication is real, macOS and Windows stay coming soon.

## Rollback and refusal checklist

Rollback favors a safe named refusal over partial availability.

- [ ] On any failed verification, stop alias movement. If an alias moved, reassign only
  that alias to its last recorded verified deployment and capture both deployment ids.
- [ ] Withdraw new TEST Checkout creation by restoring the umbrella's last recorded
  verified deployment and its configuration under an explicitly authorized rollback —
  never by removing the deployment's Stripe provider handle. The shipped wiring builds the
  checkout entry point and the webhook's settlement evidence from that one handle, so
  removing it also blinds the webhook to the persisted intent and the exact settlement:
  every already-created paid session then refuses instead of granting, which is the
  paid-but-ungranted outcome this checklist exists to prevent.
- [ ] Throughout that rollback, keep `POST /api/stripe/webhook` reachable with its signing
  secret and Stripe subscriptions unchanged, and confirm the restored deployment still
  reads persisted intents and settlements, so every already-created paid session and refund
  still reconciles. Rollback is complete only once that reconciliation is evidenced.
- [ ] If no verified known-good deployment, configuration, or provider handle is available
  to restore, stop and hold the incident open under its rollback owner. Do not deploy an
  unverified build, clear configuration, or disable the endpoint to end an alert. An
  unreconciled paid session stays a named refusal and a Stripe retry, never an acknowledged
  no-op and never an invented grant.
- [ ] Do not delete or edit a checkout intent, session, credit account, ledger entry,
  Connect record, or paid grant. Apply forward fixes only. A missing account remains
  `CREDITS_PLANE_UNAVAILABLE`; a webhook never invents one.
- [ ] Do not loosen authentication to recover availability. Missing or unusable Better
  Auth/Neon handles must return `IDENTITY_PLANE_NOT_WIRED`,
  `IDENTITY_PLANE_UNAVAILABLE`, or the narrower auth/store refusal.
- [ ] Do not derive redirect origins from `Host` or fall back from a supplied malformed
  canonical origin. Preserve `BILLING_CHECKOUT_ORIGIN_UNCONFIGURED`,
  `BILLING_CHECKOUT_ORIGIN_UNTRUSTED`, and `SITE_REQUEST_CROSS_ORIGIN`.
- [ ] Do not switch modes or keys during rollback. Any LIVE observation is an incident:
  stop new Checkout, preserve provider and ledger evidence, and invoke the separately
  owned Stripe rollback plan. Never delete webhook evidence or a paid grant.
- [ ] For a bad desktop candidate, leave or restore the platform's coming-soon state,
  withdraw the exact published asset/update metadata only under publication authority,
  and retain its hashes and incident record. Never replace it silently with unsigned or
  unnotarized bytes.

### Required refusal evidence

Capture at least one safe proof for each applicable closed state before go/no-go:

| Missing or unsafe state | Required result |
|---|---|
| Better Auth provider configuration or provider tables unavailable | `BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT`, `BETTER_AUTH_PROVIDER_CONFIGURATION_INVALID`, or `BETTER_AUTH_PROVIDER_STORAGE_UNAVAILABLE`; redacted HTTP 503 and no provider dispatch after a failed readiness check |
| Persisted provider credential disagrees with `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | `BETTER_AUTH_PROVIDER_BOOTSTRAP_DISAGREEMENT`, never the storage refusal; `POST /api/auth/sign-in/email` refuses and issues no session, while `GET /api/auth/get-session` keeps answering for already-issued sessions. The provider never rotates or overwrites the persisted account to resolve it — a rotation is applied to the database by its owner, after which each running instance re-reads the credential within a minute and recovers without a redeploy |
| Better Auth or identity store absent | `IDENTITY_PLANE_NOT_WIRED`; no form/session/account invention |
| Signed-out visitor | `IDENTITY_SESSION_ABSENT`; treated as signed out, not a provider failure |
| Credit store unreadable | `CREDITS_PLANE_UNAVAILABLE`; no zero-balance substitution |
| Checkout origin absent or mismatched | `BILLING_CHECKOUT_ORIGIN_UNCONFIGURED` or `BILLING_CHECKOUT_ORIGIN_UNTRUSTED`; no Checkout session |
| Webhook secret absent | `STRIPE_WEBHOOK_SECRET_MISSING` and HTTP 503; no grant |
| Stripe LIVE not separately authorized | `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at intent creation and grant |
| Connect provider/readiness absent or LIVE | corresponding `STRIPE_CONNECT_*` refusal; no account or payout success |
| Marketplace activation held | `CATALOG_COMMERCE_INERT`; no payment collection |
| Desktop signing/notarization input absent | corresponding `MACOS_*` or `WINDOWS_*` preflight refusal; no release claim |

## Evidence-capture checklist

Store operational evidence in the authorized external evidence system, not in this
repository. Create no placeholder record and check no box until the action actually ran.

- [ ] Captain authorization record, including exact action/target/mode, source commit or
  artifact, operator, window, evidence location, and rollback owner.
- [ ] `pnpm gate` result and all three production Next build results, each tied to the
  full source commit.
- [ ] Name-and-scope-only Vercel configuration inventory; project ids, deployment ids,
  alias mappings, source commits, timestamps, and rollback deployment ids.
- [ ] Neon project id/region/database, applied migration identifiers and checksums,
  trigger/index verification, and redacted read/write result. Never capture
  `DATABASE_URL`.
- [ ] Better Auth origin, endpoint/status evidence, redacted provider request ids, and
  sign-in/session result. Never capture passwords, cookies, bearer tokens, or bootstrap
  material.
- [ ] Stripe account mode, TEST endpoint id, event subscriptions, Price/Session/Event
  ids, intent id, ledger idempotency key, grant/refund row ids, and replay result. Never
  capture API keys or webhook secrets.
- [ ] Browser and command verification results for each route, SDK checksum, WebGL frame
  reports, account/entitlement state, and storefront refusal state.
- [ ] Every stop, refusal, rollback, and residual risk, including the exact named reason
  and whether external state changed.
- [ ] For an independently authorized desktop candidate: source commit, workflow/run,
  artifact names/sizes/hashes, signature verification, signing identity (not the
  certificate), notarization/stapling ticket evidence, packaged smoke, publication URL,
  and downloaded-byte re-verification.
- [ ] Final human go/no-go, named approver, timestamp, and the exact set of actions that
  remain held.

## Actions that remain parked

This runbook does not reopen custom domains, Kids deployment, tier-6b marketplace
activation, Stripe LIVE credit-pack charging, Stripe Connect LIVE onboarding or payout,
package publication, editor persistence, Linux signing/update, or any macOS/Windows
publication without its own authorization and real evidence. If an activation proposal
includes one of those actions, split it into its owning checklist and obtain a separate
captain decision.
