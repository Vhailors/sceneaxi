# ADR 0021: The identity/credits plane ships as contracts and ports with injected Better Auth, Neon, and Stripe adapters

- **Status:** Accepted for auth + credits billing v1 — **Amended 2026-07-31** by
  [sceneaxi#185](https://github.com/Vhailors/sceneaxi/issues/185): the hosted
  sign-in HTTP surface now ships in `sites/umbrella`, so what a live signed-in
  browser session still waits on is the deployment's own provider handles, not
  missing code. See *Amendment* below. **Amended 2026-08-06** by
  [sceneaxi#199](https://github.com/Vhailors/sceneaxi/issues/199): a TEST-only
  Connect creator-payout seam ships, with one narrow durable exception to
  ledger-only money bookkeeping. LIVE Connect onboarding and payout activation
  stay held. **Amended 2026-08-07** by
  [sceneaxi#222](https://github.com/Vhailors/sceneaxi/issues/222): the provider
  implementation now ships only in the umbrella install root while core remains
  injected. See the amendments below.
- **Date recorded:** 2026-07-25
- **Source:** [sceneaxi#90](https://github.com/Vhailors/sceneaxi/issues/90) (children #91–#101).
- **Lineage:** Follows the Model Provider Port precedent
  ([sceneaxi#45](https://github.com/Vhailors/sceneaxi/issues/45)) and the Delivery
  Handoff adapter boundary; bounded by amended ADR 0004.

## Context

The captain named a concrete stack: Better Auth, Neon Postgres, roles `admin` |
`user`, credit-metered users funding credits through Stripe, with Drizzle
preferred "if the stack aligns".

SceneAxi core is a hermetic, contract-first TypeScript library monorepo. It
contains no HTTP server, no ORM, no UI framework, and no live third-party client
in any package or app. `pnpm gate` runs with no network, no `DATABASE_URL`, and no
provider credentials. Two decisions already govern this shape:

- Model Provider Port: *"Adapters and per-profile filters are injected; … There is
  no live provider adapter in core."*
- Delivery Handoff: *"Provider-specific delivery adapters, credentials, uploads,
  approvals, and releases stay outside SceneAxi core."*

Vendoring Better Auth would put an HTTP-host-and-database-dependent library in the
graph of packages that have neither, to import types from. Vendoring the Stripe SDK
would put a network client behind a boundary the gate can never exercise.

## Decision

The identity/credits plane ships as **versioned contracts plus ports with injected
adapters**, in two packages under a new `identity` release group:
`@sceneaxi/auth` (depends only on `schemas`) and `@sceneaxi/billing` (depends on
`schemas` and the `auth` seam).

1. **Better Auth is an injected adapter boundary.** `IdentityAdapter` is typed
   structurally against Better Auth's documented `{ user, session }` result, and
   `createBetterAuthIdentityAdapter` maps a real instance into SceneAxi contracts.
   Core carries no `better-auth` dependency. Wiring is documented in
   `docs/auth-credits.md`.
2. **Neon is reached through injected store ports** (`IdentityStore`,
   `CreditStore`) with in-memory reference implementations for the gate. Schema is
   hand-written forward-only SQL in `db/migrations`; `DATABASE_URL` is env-only.
3. **Stripe splits by responsibility.** The security boundary — webhook signature
   verification — is implemented **in core** with `node:crypto`, because it is a
   documented HMAC construction, fully deterministic, and testable from local
   fixtures. Checkout *intents* are provider-neutral and secret-free. The API call
   that turns an intent into a hosted checkout is the injected adapter, outside core.
4. **Drizzle is not adopted.** The stack does not align: zero-runtime-dependency
   packages, source-backed exports, strict tsc project references, hermetic gate.
   Plain versioned SQL is the aligned choice.
5. **The revenue split is integer basis-point arithmetic** (`floor(gross × 5000 /
   10000)` to the creator, remainder to the platform), asserted as a contract
   invariant so a split cannot create or destroy value. Money splits are
   **bookkeeping only**: the contract refuses any payout-shaped field.

## Consequences

- Every policy in the plane — single admin, role guards, Kids isolation,
  append-only ledger, idempotent grants, free-vs-paid enforcement, revenue share —
  is acceptance-tested in the hermetic gate, with no credentials and no network.
- v1 does **not** deliver a live signed-in browser session. That needs a hosted
  HTTP surface this repo does not contain, and belongs to the runnable-surfaces /
  websites lane. `docs/auth-credits.md` names the remaining wiring. *(Amended
  2026-07-31 — the surface has since landed in `sites/umbrella`; see below.)*
- Swapping the identity provider or payment provider is an adapter change, not a
  core change.
- Invariants are enforced twice — in the pure code and in the database DDL — so
  neither layer is the only thing protecting the ledger.

## Rejected alternatives

- **Depend on `better-auth` and `stripe` directly in core** — puts an
  HTTP-host-and-DB-dependent library and a network client in packages that have
  neither, for types and a construction we can express and test hermetically. It
  would also make the gate's Stripe coverage untestable without credentials.
- **Adopt Drizzle for the schema** — adds a driver to the dependency graph to
  describe tables no package connects to, against the captain's own "if the stack
  aligns" condition.
- **Delegate webhook verification to the Stripe SDK** — moves the one
  security-critical, deterministic, fixture-testable part of the purchase path
  behind a dependency the gate cannot exercise.
- **Store a balance column alongside the ledger** — a second source of truth that
  can drift; derived balance plus a `balanceAfter` witness removes the possibility.
- **Round the revenue split up to the creator** — lets a stream of 1-unit sales pay
  out more than came in.
- **Add a `role` field to the user record and validate it** — leaves a field a
  client can populate. Removing the field removes the attack.

## Settled here vs held elsewhere

**Settled:** the plane's package boundaries, the injected-adapter shape for Better
Auth / Neon / Stripe, in-core webhook verification, plain SQL over Drizzle, the
`identity` release group, and integer basis-point splits with ledger-only money
bookkeeping.

**Held elsewhere:**

- **Live Stripe activation** — test mode is the default and `live` refuses without
  an explicit `liveModeAuthorized`. Going live is a captain decision this ADR does
  not make or narrow.
- **Real Stripe Connect payouts to creators** — LIVE onboarding and payout
  activation remain a later captain gate. *(Amended 2026-08-06 — a TEST-only
  Connect onboarding and payout-bookkeeping seam has since landed; see below.
  LIVE stays held.)*
- **Multi-admin** — exactly one admin, from `SCENEAXI_ADMIN_EMAIL`. Any second
  admin needs a captain decision.
- **Any revenue split other than 50/50** — the captain sets it; the contract
  refuses other values today.
- **Kids commerce and Kids shared identity** — a locked hard out, not a decision
  this ADR reopens.
- **Held-key captain policy** — untouched. This plane is product user
  authentication and does not replace, weaken, or interact with
  [`docs/held-key-enforcement.md`](../held-key-enforcement.md); this vertical adds
  no CLI verb.
- **A hosted HTTP surface** — owned by the websites / runnable-surfaces lane.
  *(Amended 2026-07-31 — that lane has since delivered the umbrella sign-in
  surface; see below. The lane still owns it.)*

## Amendment — the hosted sign-in surface landed (2026-07-31)

[sceneaxi#185](https://github.com/Vhailors/sceneaxi/issues/185) delivered, in the
websites lane this ADR deferred to, the HTTP entry point that lets a browser
reach the plane: `sites/umbrella` serves `/login` beside `POST /api/login` and
`POST /api/logout`. Nothing in the decision above changes — no package gained a
`better-auth`, driver, or Stripe dependency, and the routes are thin over
`performLogin` / `performLogout`, which drive the same injected `IdentityPort`
through the one `sites/umbrella/src/lib/identity-plane.ts` plug point. What the
amendment corrects is one factual claim in *Consequences*: the repository does
now contain that surface.

What stays true:

- **The provider remains injected into core.** Sceneaxi#222 subsequently put the
  production Better Auth dependency and its two HTTP routes in the separate umbrella
  install root, never in `@sceneaxi/auth`; see the 2026-08-07 amendment below. A live
  signed-in session still requires deployment configuration, migration, and the handles
  returned by `umbrellaPlaneHandles()`. Until then every dependent surface refuses by
  name.
- **The gate stays hermetic.** The whole flow is proven with mocked providers,
  no network, and no credential; secrets remain env-only.
- **`IDENTITY_SESSION_ABSENT` still means signed out, not broken**, and the
  editor preview flag remains a labelled temporary fallback, never the product
  path.

Ownership is unchanged and this ADR copies none of it: the login contract,
refusal ordering, and session-credential rules are owned by
[`docs/auth-credits.md`](../auth-credits.md); the deployable-site mechanics and
surface status by [`docs/websites-deploy.md`](../websites-deploy.md); and the
operator authorization gate, ordered activation/rollback procedure, and evidence
checklist by [`docs/production-activation.md`](../production-activation.md).

## Amendment — the injected provider implementation landed (2026-08-07)

[sceneaxi#222](https://github.com/Vhailors/sceneaxi/issues/222) added the smallest
production Better Auth provider to the existing `sceneaxi-umbrella` deployable project.
`sites/umbrella/src/lib/better-auth-provider.ts` owns the provider SDK and PostgreSQL
pool, `/api/auth/[...all]` exposes only `POST sign-in/email` and `GET get-session`, and
`db/migrations/0005_better_auth_provider.sql` owns the provider's four tables. Cookie and
bearer lookup are both enabled. Missing configuration or storage produces a redacted
fail-closed response; public sign-up is disabled.

The original decision is unchanged: `packages/auth` has no provider dependency, the
provider creates no SceneAxi role, `SCENEAXI_ADMIN_EMAIL` remains the only admin source,
and request code still reaches the SceneAxi identity plane only through
`umbrellaRequestAuthority()`. This amendment records implementation, not deployment:
production migration, configuration, endpoint proof, and secret handling remain unchecked
operator work under `production-activation.md`.

## Clarification — deployment owns provenance issuance capabilities (2026-08-01)

The sceneaxi#126 runtime witnesses remain unchanged, including their low-level public
constructors for hermetic hosts. The umbrella does not treat caller-configured use of
those constructors as deployment authority. Its no-argument
`umbrellaRequestAuthority()` facade alone exposes the deployment-owned capability to
request code. Behind it, `identity-plane.ts` reads the server environment once, resolves
and holds the single admin identity, and closes the Stripe webhook secret, store,
evidence adapter, and clock into a `CreditWebhookCapability`. Identity, checkout, login,
and page routes may supply only a carried session credential; the webhook route may
supply only raw bytes and the signature header. The boundary checker denies routes, the
root barrel, and arbitrary library modules from importing the owner modules directly.

This narrows the hosted boundary without changing the decision above: core still owns
single-admin derivation and webhook signature verification, provider clients and secrets
stay in the umbrella deployment tier, the hermetic builder receives only typed evidence
and injected clients, and TEST-only / LIVE-refuse behaviour is unchanged.

## Amendment — a TEST-only Connect seam, and one durable money-split exception (2026-08-06)

[sceneaxi#199](https://github.com/Vhailors/sceneaxi/issues/199) delivered the typed
creator onboarding, account-status, and payout **bookkeeping** seam in
`packages/billing/src/stripe-connect.ts`. It is authenticated, Kids-refusing, and
accepts only an injected provider whose readiness is `mode: "test"` with TEST
operations, dashboard, and secret all explicitly configured. It corrects one claim
above: "v1 records balances only" is no longer the whole picture, and the
*Settled* line's "ledger-only money bookkeeping" now carries the single exception
below.

What the captain authorized, and nothing wider: `ConnectStore.commitPayoutIntent`
may atomically append one validated `MoneySplitRecord` together with the exact
creator-leg `ConnectPayoutIntent` bound to it, before a provider call. That
supersedes captain decision D4's prohibition on persisting a money split **only**
at that width. It is not a money-settlement store: it commits only a split a
payout intent is bound to field by field, it is reachable only from the
authenticated TEST-only seam, and D4 stands everywhere else — a deployment that
wants money splits durable outside this path still owns that write.

What stays true:

- **LIVE Connect is held.** A LIVE provider or a LIVE money split refuses
  `STRIPE_CONNECT_LIVE_UNAVAILABLE`. LIVE onboarding and payout activation remain
  the separate captain gate this ADR does not make or narrow, and the
  Held-elsewhere item above stands; the uncompleted checklist is owned by
  [`docs/stripe-connect-operations.md`](../stripe-connect-operations.md).
- **No provider is vendored and no secret enters the repository.** The Connect
  provider is another injected adapter; no credential crosses the seam, the gate
  stays hermetic, and nothing here deploys, configures Stripe, or creates an
  account.
- **The record contract is unchanged.** `MoneySplitRecord` still refuses every
  payout-shaped field, the split is still `floor(gross × 5000 / 10000)` to the
  creator with the remainder to the platform, and Connect records reference the
  split rather than widening it.
- **No payout is successful without provider evidence.** A success requires both
  `providerEvidenceId` and `providerPayoutId`; a thrown call leaves a pending
  intent, and a retry reads the existing outcome before dispatching again.

Ownership is unchanged and this ADR copies none of it: the supersession's exact
width, refusal ordering, and idempotency rules are owned by
[`docs/auth-credits.md`](../auth-credits.md); the operations boundary, audit
records, and LIVE checklist by
[`docs/stripe-connect-operations.md`](../stripe-connect-operations.md).
