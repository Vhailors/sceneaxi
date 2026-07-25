# Auth + credits plane

Identity, credits, and billing for SceneAxi. This document is the configuration home for
Better Auth, Neon, and Stripe test keys, and the canonical home for the credit-pack,
entitlement, and catalog-listing tables — all three kept in lockstep by
`pnpm check:contracts`.

The architecture decision behind the shape of this plane is
[ADR 0016](adr/0016-identity-credits-injected-adapters.md).

## Ownership map

| Layer | Lives in |
|---|---|
| Contracts (User, Session, RoleAssignment, credits, billing, entitlements, listings, revenue share) | `packages/schemas` |
| Single-admin resolution, role guards, identity port | `packages/auth` |
| Credit ledger, metering, entitlements, Stripe test checkout, revenue share | `packages/billing` |
| Neon schema | `db/migrations` |
| Login + balance view model | `apps/web-shell` (`createAccountPanel`) |

Release group `identity`; both packages consume only public contracts. **Outside core:** a
running Better Auth instance, a Neon connection, the Stripe API client, any HTTP surface,
and any UI. Those are injected adapters or other lanes' work — UI surfaces are coordinated
with `sceneaxi-websites-deploy-v1`, which this vertical does not block.

**What v1 does not deliver:** a live signed-in browser session. That needs a hosted HTTP
surface this repo does not contain. See *Remaining wiring* at the end.

## Environment

Names only; values never appear in the repository.

| Variable | Purpose |
|---|---|
| `SCENEAXI_ADMIN_EMAIL` | The **one** captain email that resolves to the `admin` role |
| `DATABASE_URL` | Neon Postgres connection string |
| `STRIPE_SECRET_KEY` | Stripe **test** secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe **test** webhook signing secret |

`pnpm gate` passes with none of these set. If it ever needs one, that is a defect.

## Single-admin bootstrap

`resolveAdminIdentity(process.env)` returns the one admin identity, or a named refusal.
The email is normalized (trimmed, lowercased) and that same form is used for the
comparison and stored in the database, so the two can never disagree.

It refuses, each with its own reason: the variable absent; empty or whitespace-only; not a
plausible address; **more than one address** (comma, semicolon, or space separated); and a
*plural* variable (`SCENEAXI_ADMIN_EMAILS`, `SCENEAXI_ADMINS`) present **at all** — even
holding a single valid address. Honoring a plural name would quietly normalize multi-admin
into the codebase, and multi-admin needs a captain decision.

Admin comes from an environment variable, so there is no API, migration, or admin panel
that can mint a second one. `planAdminBootstrap` produces the single `RoleAssignment` a
deployment persists; the database allows at most one admin row regardless.

```ts
import { planAdminBootstrap, resolveAdminIdentity } from "@sceneaxi/auth";

const admin = resolveAdminIdentity(process.env);
if (!admin.ok) throw new Error(`${admin.reason}: ${admin.message}`);
```

## Better Auth

Better Auth is **injected**, not depended on: it needs a running HTTP host and a live
database instance, which SceneAxi core does not contain (ADR 0016). The boundary is typed
structurally against Better Auth's documented result, so a real instance drops in:

```ts
import { betterAuth } from "better-auth";              // in your HTTP app, not in core
import {
  createBetterAuthIdentityAdapter,
  createIdentityPort,
  createInMemoryIdentityStore,
  resolveAdminIdentity,
} from "@sceneaxi/auth";

const auth = betterAuth({
  database: /* your Neon pool */,
  emailAndPassword: { enabled: true },
});

const admin = resolveAdminIdentity(process.env);
if (!admin.ok) throw new Error(admin.message);

const identityPort = createIdentityPort({
  adapter: createBetterAuthIdentityAdapter(auth),
  store: yourNeonIdentityStore,        // or createInMemoryIdentityStore() in tests
  admin: admin.value,
  clock: () => Date.now(),
});
```

The adapter must satisfy `IdentityAdapter`: `authenticate({ surface, email, password })`
resolving `{ user: { id, email, emailVerified }, session: { id, token, userId, expiresAt } }`,
or `undefined` when the credentials simply do not authenticate. Resolving `undefined` and
throwing mean different things — the port reports `AUTH_CREDENTIALS_REJECTED` for the first
and `AUTH_ADAPTER_FAILED` for the second, so a wrong password is never confused with a
broken provider.

The **store**, not the provider, owns the SceneAxi `User` record and therefore owns
`disabled`. That split is deliberate: disabling a user must take effect even if the upstream
provider would still happily authenticate them. The port also cross-checks that the
provider's user id matches the stored user, so a session can never be bound to a user the
store never authorized.

## Neon

`DATABASE_URL` from the environment only. Apply `db/migrations` in numeric order; see
[`db/README.md`](../db/README.md) for the full invariant table.

Implement `IdentityStore` (`@sceneaxi/auth`) and `CreditStore` (`@sceneaxi/billing`) over
your Neon client. The in-memory reference implementations mirror the database's constraints
— unique `(account_id, sequence)`, unique `idempotency_key`, no update or delete — so a bug
the real trigger would catch cannot pass the test suite.

## Stripe (test mode)

Responsibility splits by what can be verified hermetically:

- **In core:** webhook signature verification (`t=…,v1=…`, HMAC-SHA256 over the *raw* body,
  constant-time compare, 300s tolerance both directions) and provider-neutral
  `CheckoutSessionIntent` construction.
- **Your adapter:** the API call that turns an intent into a hosted checkout URL, using
  `STRIPE_SECRET_KEY`.

Set the checkout session's metadata to the keys in `CHECKOUT_METADATA_KEYS`
(`sceneaxiUserId`, `sceneaxiPurpose`, `sceneaxiItemId`, `sceneaxiIntentId`). Credits are
resolved from the **persisted intent**, never from event metadata, so influencing the
webhook body cannot name a credit amount. Persist the `CheckoutSessionIntent` before
creating the hosted session. Stripe webhook objects are minimal, so the completion parser
takes settlement (paid status, amount, currency, quantity, Stripe price) that your adapter
**retrieves separately** for that exact Checkout Session, and refuses unless it and the
session's mode and metadata all match the persisted intent — the immutable price snapshot.

Your webhook endpoint must pass the **raw request body**, not a re-serialised object —
re-encoding the JSON changes the bytes and verification will (correctly) fail:

```ts
import {
  CHECKOUT_METADATA_KEYS,
  applyCheckoutCompletedGrant,
  parseCheckoutCompletedEvent,
  verifyStripeWebhookSignature,
  type CheckoutSettlementPort,
} from "@sceneaxi/billing";

const verified = verifyStripeWebhookSignature({
  payload: rawBodyBuffer,                                  // raw bytes
  header: request.headers["stripe-signature"],
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  now: Date.now(),
});
if (!verified.ok) return respond(400, verified.reason);

const event = JSON.parse(verified.value.payload) as {
  data: { object: { id: string; metadata: Record<string, string> } };
};
const sessionId = event.data.object.id;
const intentId = event.data.object.metadata[CHECKOUT_METADATA_KEYS.intentId];

// The persisted intent is the immutable price snapshot; look it up by the id carried
// in the session metadata. Your store owns this lookup.
const intent = await checkoutIntentStore.findByIntentId(intentId);
if (!intent) return respond(400, "unknown checkout intent");

// Stripe webhook objects do not carry line items — retrieve settlement for this exact
// Checkout Session through the injected adapter boundary.
const settlement = await (settlementPort as CheckoutSettlementPort).retrieveSettlement(
  sessionId,
);
if (!settlement) return respond(400, "unpaid or unverified session");

const completed = parseCheckoutCompletedEvent({ verified, intent, settlement });
if (!completed.ok) return respond(400, completed.reason);

const granted = applyCheckoutCompletedGrant({
  state: await creditStore.loadState(completed.value.userId),
  completion: completed.value,
  now: Date.now(),
});
if (!granted.ok) return respond(400, granted.reason);
```

**Live mode is unreachable by default.** `mode: "live"` refuses unless
`liveModeAuthorized: true` is passed explicitly at the call site, enforced both when
creating an intent and when honoring an event. **Live activation is not authorized today**
and remains a captain decision (ADR 0016).

## Contracts

| Contract | Module | JSON Schema |
|---|---|---|
| `User`, `RoleAssignment`, `Session`, `Principal` | `packages/schemas/src/identity.ts` | `contracts/identity.schema.json` |
| `CreditAccount`, `CreditLedgerEntry` | `packages/schemas/src/credits.ts` | `contracts/credit-ledger.schema.json` |
| `StripeCustomerLink`, `CheckoutSessionIntent`, `CheckoutCompletedEvent` | `packages/schemas/src/billing.ts` | `contracts/billing-checkout.schema.json` |
| `CreditPack` catalog | `packages/schemas/src/billing.ts` | `contracts/credit-packs.schema.json` |

Three shapes are load-bearing and should not be "fixed" later without reading why:

- **`User` carries no role.** A role on a client-writable record is a role a client can
  try to claim. Roles live only on `RoleAssignment`, which the server derives, and a user
  payload containing `role`, `roles`, `isAdmin`, or `admin` is **refused** rather than
  sanitized — silently dropping the field would make an escalation attempt look like success.
- **`CreditAccount` has no balance.** A stored balance is a second source of truth that can
  drift from the ledger. The ledger is the only record; `balanceAfter` on each entry is a
  checkable witness of the derivation, not an independent store.
- **`Session` stores a token digest**, never a raw token, so a leaked session row cannot be
  replayed as a credential.

## Free vs paid enforcement matrix

Captain commercial model (2026-07-25). Canonical data:
`packages/schemas/contracts/entitlement-matrix.fixtures.json`, mirrored by
`ENTITLEMENT_MATRIX` in `packages/schemas/src/entitlements.ts`. `pnpm check:contracts`
keeps the JSON and this table in lockstep, a seam test binds the JSON to the TypeScript
table, and the checker independently refuses any change that would put an account or a
price on the three free-path capabilities.

<!-- entitlement-matrix:list -->
| capability | account | price |
|---|---|---|
| `engine-sdk-download` | not required | free |
| `cli-authoring` | not required | free |
| `byo-model-keys` | not required | free |
| `hosted-ai-assistant` | required | credits |
| `metered-model-port` | required | credits |
| `catalog-asset-purchase` | required | credits-or-money |
| `creator-publish` | required | free |
| `credit-pack-purchase` | required | money |
<!-- /entitlement-matrix:list -->

**Free forever, and reachable with no account at all:** the public engine SDK download,
CLI and local agent authoring, and bring-your-own AI keys. Bring-your-own keys never burn
SceneAxi credits — the user is already paying their own provider, so charging twice would
be indefensible. A test asserts that path appends no ledger entry even when a balance
exists.

**Account required:** SceneAxi-hosted AI, catalog purchases, creator publish, credit
balance, and credit-pack purchase.

**Admin** has an unlimited allowance and is never debited. **Kids commerce is denied** on
every capability, free ones included, and the refusal is not overridable.

The matrix is a **closed enumeration**, not a lookup with a default: an unknown capability
refuses. There is no path where forgetting to register something makes it free, and none
where forgetting makes it silently chargeable.

## Starter credits

Every new user receives exactly **100** credits, once, under idempotency key
`starter:<userId>`. A second attempt grants nothing. The amount is captain-frozen and the
contract check refuses a change to it.

## Credit packs

Canonical list: `packages/schemas/contracts/credit-packs.fixtures.json`. The table below is
kept in exact lockstep with it by `pnpm check:contracts` — edit the JSON, then the table.

Only **test-mode** price ids are committed. Live price ids belong to a later captain
go-live decision.

<!-- credit-packs:list -->
| pack | credits | price | stripe test price id |
|---|---|---|---|
| `starter` | 100 | 500 USD minor units | `price_test_starter_100` |
| `maker` | 500 | 2000 USD minor units | `price_test_maker_500` |
| `studio` | 2000 | 7000 USD minor units | `price_test_studio_2000` |
<!-- /credit-packs:list -->

Price ids are public identifiers, not secrets. API keys are a different thing entirely and
live only in the environment — see the configuration section.

## Catalog listings (dual pricing)

A seller decides what an asset costs and in which currency: **credits, money, or both**.
`creditPrice` is required exactly when `priceMode` includes credits and `moneyPrice`
exactly when it includes money; a price the mode *excludes* must be absent, because a
dormant field is how a credits-only listing quietly acquires a money price later. A buyer
cannot pay in a currency the seller did not list — that refuses rather than converting at
a rate nobody agreed to.

Canonical listings: `packages/schemas/contracts/catalog-listings.fixtures.json`, in
lockstep with the table below. All three price modes must stay covered, so a regression
cannot pass by dropping the shape it breaks. Test mode only.

<!-- catalog-listings:list -->
| listing | catalog | price mode | credits | money |
|---|---|---|---|---|
| `lantern-prop` | game | credits | 40 | — |
| `harbour-diorama` | web | money | — | 1200 USD minor units |
| `market-stall-kit` | game | credits-and-money | 75 | 2500 USD minor units |
| `odd-price-charm` | game | credits-and-money | 7 | 333 USD minor units |
<!-- /catalog-listings:list -->

`odd-price-charm` exists so the odd-amount cases are always exercised: 7 credits splits
3 to the creator and 4 to the platform, and 333 minor units splits 166/167. The remainder
always lands with the platform, and no value is created or lost.

Catalog **browse and purchase UI** is coordinated with `sceneaxi-websites-deploy-v1`; this
vertical owns the ledger and the enforcement. The `catalog-game` and `catalog-web` apps
stay dormant.

## Creator publish and revenue share

Publishing is **free but account-gated** (`creator-publish` in the matrix above). On a
sale, the creator earns **50%**.

The split is **integer arithmetic on basis points** — `floor(gross × 5000 / 10000)` to the
creator, remainder to the platform — so it is exactly reproducible in any language and can
never mint a fractional credit or lose a minor unit. Both record contracts assert
`creator + platform === gross`, so a split that created or destroyed value cannot be
persisted at all.

The remainder always lands with the **platform**. Rounding in the platform's favour by at
most one unit is defensible and auditable; rounding up to the creator would let a stream
of 1-credit sales pay out more than came in.

| sale | who pays | creator gets | platform keeps | recorded as |
|---|---|---|---|---|
| credits | buyer's ledger debit | grant into the creator's own ledger | remainder | `CreatorShareRecord` |
| money | Stripe (test) | bookkeeping balance only | remainder | `MoneySplitRecord` |

A credits sale is **atomic in effect**: `applyCreditsSale` computes both ledger appends and
returns them only if both succeed, so a failure anywhere leaves the buyer's balance
untouched. That falls out of the ledger being pure — there is no half-applied intermediate
state to roll back. Creator earnings land in the creator's own append-only ledger, not a
separate mutable balance store.

**Money sales are bookkeeping only.** No payout, no Stripe Connect, no transfer. The
`MoneySplitRecord` contract *refuses* any field that could describe a payout
(`payout`, `transfer`, `destination`, `connectAccountId`, …) — a record shaped like a
payout instruction would invite one to be attempted. **Real cash payouts to creators are a
later captain gate.**

Both paths are idempotent on the sale id (`sale:<saleId>:buyer` / `:creator`), so a replay
moves nothing.

## Kids isolation

Kids never shares identity or commerce with another SceneAxi surface. The refusal is
enforced at four independent points, none of them overridable:

1. `signIn` refuses a `kids` surface **before** the adapter is called, so no adapter can
   influence the outcome and no session or digest is produced.
2. `verifySession` and the role guards refuse a **stored** `kids` session, so one written by
   any other path cannot be redeemed.
3. `evaluateEntitlement` refuses `KIDS_COMMERCE_DENIED` for **every** capability on the Kids
   surface, the free ones included.
4. The `sessions` table's surface check constraint omits `'kids'` entirely, so the row
   cannot exist.

Additionally, nothing depends on or imports `@sceneaxi/profile-kids`, enforced independently
of allow lists by `pnpm check:boundaries`.

## Held keys are unchanged

This plane is **product** user authentication. It does not replace, weaken, or interact
with held-key captain policy ([`held-key-enforcement.md`](held-key-enforcement.md)), and
this vertical adds no CLI verb. Machine/agent CLI behavior is untouched.

## Remaining wiring for a live signed-in session

Everything below is outside this vertical and needs a hosted HTTP surface, coordinated with
`sceneaxi-websites-deploy-v1`:

1. An HTTP app that mounts Better Auth's handler and holds the session cookie.
2. `IdentityStore` and `CreditStore` implementations over a Neon client, and the migrations
   applied to a Neon branch (needs credentials — separate authority).
3. A Stripe adapter that turns a `CheckoutSessionIntent` into a hosted checkout URL, and a
   webhook route that passes the **raw** body to `verifyStripeWebhookSignature`.
4. A renderer over `createAccountPanel`'s snapshots.

None of it changes a contract or a policy in this plane; all four are adapters and glue.
