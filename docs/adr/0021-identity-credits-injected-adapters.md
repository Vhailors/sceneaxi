# ADR 0021: The identity/credits plane ships as contracts and ports with injected Better Auth, Neon, and Stripe adapters

- **Status:** Accepted for auth + credits billing v1.
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
  websites lane. `docs/auth-credits.md` names the remaining wiring.
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
- **Real Stripe Connect payouts to creators** — a later captain gate; v1 records
  balances only.
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
