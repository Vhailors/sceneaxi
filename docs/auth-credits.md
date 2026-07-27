# Auth + credits plane

Identity, credits, and billing for SceneAxi. This document is the configuration home for
Better Auth, Neon, and Stripe test keys, and the canonical home for the credit-pack,
entitlement, and catalog-listing tables — all three kept in lockstep by
`pnpm check:contracts`.

The architecture decision behind the shape of this plane is
[ADR 0021](adr/0021-identity-credits-injected-adapters.md).

## Ownership map

| Layer | Lives in |
|---|---|
| Contracts (User, Session, RoleAssignment, credits, billing, entitlements, listings, revenue share) | `packages/schemas` |
| Single-admin resolution, role guards, identity port | `packages/auth` |
| Credit ledger, metering, entitlements, hosted-AI credit gate, Stripe test checkout, revenue share, fixture commerce | `packages/billing` |
| Neon schema | `db/migrations` |
| Login + balance view model | `apps/web-shell` (`createAccountPanel`) |
| In-app AI assistant view model | `apps/web-shell` (`createAssistantPanel`) |
| Deployable-site wiring | `sites/umbrella/src/lib/identity-plane.ts` (`docs/websites-deploy.md`) |

Release group `identity`; both packages consume only public contracts. **Outside core:** a
running Better Auth instance, a Neon connection, the Stripe API client, any HTTP surface,
and any UI. Those are injected adapters or other lanes' work — UI surfaces are coordinated
with `sceneaxi-websites-deploy-v1`, which this vertical does not block.

**What v1 does not deliver:** a live signed-in browser session. The deployable HTTP surface
has since landed on `sites/umbrella` and is wired to this plane, so what remains are the
provider handles ADR 0021 keeps outside this repository. See *Remaining wiring* at the end.

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
database instance, which SceneAxi core does not contain (ADR 0021). The boundary is typed
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

Admin elevation requires both the provider authentication and the stored SceneAxi user
record to mark `emailVerified: true`. An unverified address matching
`SCENEAXI_ADMIN_EMAIL` refuses with `AUTH_ADMIN_EMAIL_UNVERIFIED` before any session is
persisted; unverified ordinary users retain the configured ordinary-user sign-in behavior.
The same precondition holds wherever an `admin` role is produced or accepted, not only at
sign-in: `refuseUnverifiedAdmin` is the one predicate, and `planAdminBootstrap` and the role
guards apply it too, so an unverified captain can neither be persisted as admin nor satisfy
an admin guard through a principal the port did not issue.

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
and remains a captain decision (ADR 0021).

## Contracts

| Contract | Module | JSON Schema |
|---|---|---|
| `User`, `RoleAssignment`, `Session`, `Principal` | `packages/schemas/src/identity.ts` | `contracts/identity.schema.json` |
| `CreditAccount`, `CreditLedgerEntry` | `packages/schemas/src/credits.ts` | `contracts/credit-ledger.schema.json` |
| `StripeCustomerLink`, `CheckoutSessionIntent`, `CheckoutCompletedEvent` | `packages/schemas/src/billing.ts` | `contracts/billing-checkout.schema.json` |
| `CreditPack` catalog | `packages/schemas/src/billing.ts` | `contracts/credit-packs.schema.json` |
| `EntitlementDecision` | `packages/schemas/src/entitlements.ts` | `contracts/entitlement-decision.schema.json` |
| `CreatorShareRecord`, `MoneySplitRecord` | `packages/schemas/src/revenue-share.ts` | `contracts/revenue-share.schema.json` |

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
balance, and credit-pack purchase. `catalog-asset-purchase` is enforced by the bounded
fixture-commerce path below, which evaluates it in both currencies.

**Admin** has an unlimited allowance and is never debited, and because nothing is
collected, nothing downstream may be paid out of it either — see the revenue-share section.
**Kids commerce is denied** on every capability, free ones included, and the refusal is not
overridable.

The matrix is a **closed enumeration**, not a lookup with a default: an unknown capability
refuses. There is no path where forgetting to register something makes it free, and none
where forgetting makes it silently chargeable.

## Starter credits

Every new user receives exactly **100** credits, once, under idempotency key
`starter:<userId>`. A second attempt grants nothing. The amount is captain-frozen and the
contract check refuses a change to it.

## Metering

`meterCredits` namespaces the caller's idempotency key by account before it reaches the
ledger: `usage:<accountId>:<callerKey>`. Replay is a *per-account* question in the pure
ledger, but `idempotency_key` uniqueness is **global** in both the database and the
in-memory store, so a bare caller key such as `usage:turn_01` would make one account's
committed debit collide with a different account's legitimately distinct usage — refusing
as a store failure rather than metering it. Every other producer in this plane already
namespaces by identity (`starter:<userId>`, `sale:<saleId>:buyer`, `stripe-event:<id>`);
metering is scoped the same way so the pure check and the persisted constraint agree.

## Hosted AI (sceneaxi#139)

`runMeteredModelCall` in `packages/billing/src/hosted-ai.ts` is the only path a hosted
model call may take to a debit. It adds no ledger, no second entitlement table, and no
provider abstraction — it fixes the order the two existing pieces run in:

1. **Kids** — denied by name before identity, provider, or ledger, on both routes
2. **Route** — `hosted` or `byo`, a closed enumeration with no default
3. **Hosted opt-in** — off unless a caller explicitly passes `{ enabled: true }`
4. **Replay** — the *persisted* ledger is loaded and the account-scoped key looked up in
   it, before the balance and the provider
5. **Entitlement** — capability, account, and the **persisted balance**, all before the
   provider
6. **Metering readiness** — store, reason, and key, still before the provider
7. **Provider** — the injected call, and only now
8. **Debit** — exactly the credits the decision named, through `meterCredits`

Steps 5 and 7 in that order are why a zero or insufficient balance costs nothing and
appends nothing: the refusal is `CREDIT_BALANCE_INSUFFICIENT`, produced before the provider
runs. A provider throw is `HOSTED_AI_PROVIDER_FAILED` with no debit; a ledger or store
failure keeps its own reason, and the debit is all-or-nothing either way.

**A retry is answered from the debit it already made.** The ledger's own idempotency check
lives at the bottom of the stack, *below* both the balance gate and the provider, so
relying on it alone would break the retry it is supposed to protect: a caller that timed
out and re-sent `turn_01` would be refused `CREDIT_BALANCE_INSUFFICIENT` out of the balance
its own first attempt had already spent, and would have paid the upstream provider a second
time for an answer no ledger row could cover. Step 4 looks `usage:<accountId>:<callerKey>`
up first. On a hit the call returns `replayed: true` carrying the prior debit, the ledger,
and the balance — **no provider execution and no second charge** — and entitlement is
re-evaluated against the ledger as it stood immediately before that debit, so capability,
identity, ownership, and the guard's own refusals still apply to a retry while the
already-answered balance question is not asked again. A key re-sent with a different price
or reason is still a `CREDIT_IDEMPOTENCY_KEY_CONFLICT`. The replayed outcome deliberately
carries **no `response`**: the ledger persists debits, not model answers, so the original
response is gone and the gate will not fabricate one — the `MeteredModelCallReplayed` shape
has no field to read it from. The BYO route is excluded from step 4: it never appends a
debit, and a free call is safe to simply run again.

**The retry lookup reads persistence, not the caller's `state`.** The guarantee has to hold
for the caller that never received the post-debit ledger — the timed-out turn is precisely
that caller — so step 4 takes only the account id from the supplied state and loads the
history back through the injected `CreditStore`. A lookup against a pre-debit copy would
find no prior entry, run the provider a second time for real upstream money, and only then
collide at the bottom of the stack with an opaque `CREDIT_LEDGER_STATE_INVALID`. Because the
store is read here, a store that cannot be read refuses `CREDIT_STORE_FAILED` **before** the
provider: not knowing whether a key was already charged is not a licence to charge upstream
again. The replayed outcome hands back the *persisted* ledger and balance, so a caller
holding a stale view is corrected rather than confirmed in it.

**The balance gate judges that same persisted ledger, and so does the debit.** The supplied
`state` names the account; it does not establish the balance. Trusting it would leave the
load-bearing ordering above holding only for a caller whose copy happens to be current: a
stale or fabricated state with a *fresh* key would clear the balance gate, pay the upstream
provider, and only then collide with `meterCredits`' own state check as an opaque
`CREDIT_LEDGER_STATE_INVALID` — precisely the "completed model call that is impossible to
charge for" this ordering exists to make unreachable. So step 5 reads the ledger step 4
loaded, and `meterCredits` is handed the same one: a stale caller with a real balance that
covers the charge is corrected and charged the real amount, and one whose real balance does
not cover it refuses `CREDIT_BALANCE_INSUFFICIENT` with no provider execution. The narrow
race left is a debit landing between the two store reads, which `meterCredits` still refuses
outright rather than half-applying.

**Identity is settled before persistence is read.** The account id arrives inside a
caller-supplied state, so step 4 authenticates the principal and checks account ownership
before it asks the store anything: an expired, disabled, or wrong-user principal cannot drive
a lookup against an account it merely named. Those refusals are still spoken by
`evaluateEntitlement` immediately below, which owns the identity vocabulary — step 4 only
declines to read, so one defect keeps one refusal. The supplied ownership claim only earns
the *first* read, though, since the caller wrote it: the account the store returns is itself
re-checked against the guarded user and refuses `CREDIT_ACCOUNT_NOT_OWNED` before its
history is loaded or any metering key is compared, so naming a stranger's account id cannot
make persistence answer questions about that account's entries.

**Only a throw is a provider failure.** The thunk is provider-neutral, so billing charges
for any value it returns — it cannot tell a refusal envelope from a legitimate answer that
happens to contain `ok: false`. Provider layers that report refusals as data, the Model
Provider Port's `{ ok: false, reason }` among them, must be translated in the caller's own
provider integration:

```ts
const call = async () => {
  const result = await port.complete(request);
  if (!result.ok) throw new Error(result.reason);
  return result;
};
```

That converts a port refusal into `HOSTED_AI_PROVIDER_FAILED` with no debit, and it is the
integration's obligation rather than the gate's precisely because billing must not learn
the shape of a model refusal to charge for a model call.
`tests/e2e/hosted-ai-metering-golden.test.ts` wires it that way and asserts the refused
call is not billed.

**Default-off is a switch, not an inference.** `HOSTED_AI_DEFAULT_CONFIG` is
`{ enabled: false }`. A configured OpenRouter adapter or a present API key does not enable
hosted AI — possessing a key is not a decision to spend a user's credits. The
`HOSTED_AI_NOT_ENABLED` refusal is reachable with no account and no ledger, so it can never
be confused with a balance problem.

**Which capability bills.** The `hosted` route bills `hosted-ai-assistant` or
`metered-model-port`; the `byo` route bills `byo-model-keys`. The caller names it and a
capability outside its route's list refuses — nothing is inferred from the route.

**BYO stays free**, including for a signed-in caller with a balance: `byo-model-keys` is
free-without-account in the matrix, so it resolves before identity and never reaches
metering.

The provider is an **injected thunk**, deliberately not a Model Provider Port type: billing
must not learn what a model is to charge for one, and the port sits above this package in
the dependency matrix. Callers wire the two.
`tests/e2e/hosted-ai-metering-golden.test.ts` does exactly that with the real port, the
real `@sceneaxi/provider-openrouter` adapter, and that package's recorded fixture transport
(`createFixtureTransport`) — so the whole proof runs with no network, no credential, and no
production spend.

## In-app AI assistant (sceneaxi#121)

`createAssistantPanel` in `apps/web-shell/src/assistant-panel.ts` is the assistant
surface, and it is a **view model** like `createAccountPanel` beside it — no markup, no
provider, no transport, no credential, no ledger, and no entitlement rule of its own. It
lives in `web-shell` because that is the one node in the dependency matrix that may name
both the Model Provider Port (`@sceneaxi/authoring-core`) and this plane; the port and the
credit gate stay unaware of each other, exactly as ADR 0021 and the hosted-AI section above
require.

| Mode | Transport | Billing route | Metering | Default |
|---|---|---|---|---|
| `fixture` | recorded in-repo fixture | `byo` | none | **the default** |
| `byo` | the user's own credential, direct to their provider | `byo` | none | opt-in |
| `hosted` | SceneAxi-operated | `hosted` | `hosted-ai-assistant` credits | opt-in **and off** |

All three reach a model through the *same* injected `ModelProviderPort` — the panel builds
no adapter and cannot tell a recorded transport from a live one, so "live OpenRouter is
opt-in" is structural: a live transport exists only if a caller wired one into `ports` for a
mode it then selected, and the default mode is `fixture`. A mode whose port is missing — or
present but unable to answer `complete` — refuses `ASSISTANT_TRANSPORT_MISSING` at the point
it is wired or selected, rather than borrowing another mode's transport or surfacing a
wiring defect as a per-turn `HOSTED_AI_PROVIDER_FAILED`.

**The mode table is a projection, never a second credit policy.** `ASSISTANT_MODE_BILLING`
maps each mode onto a route and capability that already exist in
`HOSTED_AI_ROUTE_CAPABILITIES`, and both the seam test and the golden assert exactly that.
`fixture` bills on the free `byo` route on purpose: the credit plane's only question is
whether a call costs credits, a recorded fixture costs nothing, and keeping the test mode on
the one gate is what makes the Kids ordering below hold in *every* mode rather than in every
mode a charge happens to reach. Teaching billing a third route would be the alternative, and
it would move test-mode knowledge inside the credit plane.

**Kids is denied three times, and always before metering and before dispatch.** The panel
refuses to *exist* for a `kids` surface (`KIDS_ASSISTANT_SURFACE_DENIED`) or a
`@sceneaxi/profile-kids` profile (`KIDS_ASSISTANT_PROFILE_DENIED`) — checked before any
other option is even validated, so a defect elsewhere cannot demote it. That is the deny
that satisfies "before metering": the port's own Kids guard runs inside the provider thunk,
which the credit gate enters *after* the balance is judged. Below it, `runMeteredModelCall`
still denies `KIDS_COMMERCE_DENIED` and the port still denies a Kids profile
non-overridably. Three independent denies, per the invariant in *Kids isolation*.

**A hosted balance is read, never remembered.** Each hosted turn re-reads the ledger through
the injected credits view and hands it to the credit gate, which judges the *persisted*
ledger regardless — so a stale copy is corrected rather than believed, and refuses
`CREDIT_BALANCE_INSUFFICIENT` before the transport is entered. A ledger the panel cannot
read, or one that is invalid or owned by another user, is a named refusal
(`ASSISTANT_CREDITS_UNAVAILABLE`, `CREDIT_LEDGER_STATE_INVALID`,
`ASSISTANT_LEDGER_OWNER_MISMATCH`) and never `0`. Identity, entitlement, and metering
refusals are left to the layer that owns their vocabulary: an anonymous hosted turn is
`ENTITLEMENT_ACCOUNT_REQUIRED`, an expired session is `AUTH_SESSION_EXPIRED`, and a hosted
turn with no `turnId` is `CREDIT_REQUEST_INVALID` — the panel repeats none of them.

*No* ledger — no credits view wired, or the deployment's own `CreditStore` holding none for
this user — is deliberately **not** a panel refusal either. Whether a hosted turn needs a
ledger at all is an entitlement question, and the gate answers it above its own balance
check: the captain's unlimited allowance is granted before a balance is ever consulted, so a
panel-owned "no credit ledger exists for this user" would deny the one caller that rule
exists to allow. Such a turn is handed over with no `state`, and the gate refuses everyone
else in its own words.

That fall-through is why the panel reads a ledger only where the gate would reach one. The
hosted route being off, Kids, and every identity refusal are all ordered *above*
`resolveHostedLedger` inside `runMeteredModelCall`, so the panel asks `requireAuthenticated`
— the same guard, on the same `{ now, surface, admin }` — purely to decide whether to read,
never to refuse. Where it declines, no credits view is consulted and the turn is handed over
with no `state`, so the controlling refusal is spoken by its owner instead of being buried
under a panel-owned one, and persistence is never made to answer for a caller no guard has
admitted.

The balance a snapshot *reports* comes only from an outcome the gate derived from
persistence, never from the view the panel was handed — otherwise a stale copy would be
published next to the very refusal that proves it wrong, telling a buyer they hold credits
the ledger says they already spent. Before a turn has been priced there is no authoritative
balance and the panel reports none.

**A retried turn is refused, not re-answered.** The gate replays the debit
(`assistant-turn:<turnId>`, then account-scoped by `meterCredits`) with no provider
execution and no second charge, and it carries no `response` because the ledger records
debits, not model answers. The panel reports `ASSISTANT_TURN_ALREADY_CHARGED` and corrects
the balance rather than fabricating the lost reply.

**A port refusal is never billed as an answer.** The panel performs the documented
integration translation — a `{ ok: false, reason }` from the port becomes a throw — so
billing reports `HOSTED_AI_PROVIDER_FAILED` with no debit, and the panel carries the port's
own reason alongside it in `refusal.providerReason` so a reader can tell "the model failed"
from "the port refused the route".

Proof: `apps/web-shell/test/assistant-panel.test.ts` (seam, including a reachability check
over every `ASSISTANT_PANEL_REASONS` entry) and `tests/e2e/assistant-panel-golden.test.ts`
in `pnpm test:golden`, which wires the real `@sceneaxi/provider-openrouter` adapter over
that package's recorded `createFixtureTransport` — no network, no credential, no production
spend.

## Credit packs

Canonical list: `packages/schemas/contracts/credit-packs.fixtures.json`. The table below is
kept in exact lockstep with it by `pnpm check:contracts` — edit the JSON, then the table.

`loadCreditPackCatalog()` reads the fixture's bundled twin,
`packages/schemas/src/credit-packs.data.ts` (`CREDIT_PACK_CATALOG_DATA`), rather than the
JSON file: the same catalog is loaded inside a bundled serverless site, where a
package-relative file read is not guaranteed to be traced into the deployment. That module
is held byte-for-byte against the fixture by the same `pnpm check:contracts` run, so it is
a third lockstep artifact, never a second source of truth — edit the JSON, then the table,
then the module.

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

`loadCatalogListings()` reads the fixture's bundled twin,
`packages/schemas/src/catalog-listings.data.ts` (`CATALOG_LISTINGS_DATA`), for the same
reason `loadCreditPackCatalog()` does — and one more: this module is reachable from a
deployed site through the `@sceneaxi/billing` package root, and a bundler cannot even
statically resolve a package-relative read, so it rewrites the specifier into a stub that
breaks the module before any refusal could run. That module is the third lockstep
artifact here too — edit the JSON, then the table, then the module.

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
stay dormant. A listing being *in* this set does not make it purchasable: what may actually
be transacted is the separate, narrower enumeration in *Fixture commerce* below.

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

**An uncharged sale pays nobody.** Admin's unlimited allowance debits no ledger, so there
is no gross to split: `applyCreditsSale` returns `charged: false` with **no** creator grant
and **no** `CreatorShareRecord`, and `persistCreditsSale` writes nothing. Granting the
creator half of an uncollected gross would mint credits into the plane out of nothing and
book a collection that never happened. `CreditStore.settleCreditsSale` enforces the same
rule independently: a settlement whose non-zero `grossCredits` carries no buyer debit is
refused, exactly as a non-zero `creatorCredits` with no creator grant already was.

**Money sales are bookkeeping only.** No payout, no Stripe Connect, no transfer. The
`MoneySplitRecord` contract *refuses* any field that could describe a payout
(`payout`, `transfer`, `destination`, `connectAccountId`, …) — a record shaped like a
payout instruction would invite one to be attempted. **Real cash payouts to creators are a
later captain gate.**

Both paths are idempotent on the sale id (`sale:<saleId>:buyer` / `:creator`), so a replay
moves nothing.

## Fixture commerce (sceneaxi#138)

The primitives above take a `CatalogListing` **value**, which is right for a mechanism and
wrong for an offer: a caller holding a hand-built listing object could transact against a
SKU nobody published, and `recordMoneySale` would book a split for it. What was missing was
a statement of what is actually for sale. `packages/billing/src/fixture-commerce.ts` is that
statement, and it is a closed enumeration of exactly **one** dual-priced fixture SKU.

| | |
|---|---|
| Enabled SKU | `market-stall-kit` — the only member of `FIXTURE_COMMERCE_LISTING_IDS` |
| Credits | 75 gross → **37** creator, **38** platform |
| Money (test) | 2500 USD minor → **1250** creator, **1250** platform, bookkeeping only |
| Mode | `test`, structurally — see below |

Four properties are what the module adds over calling the primitives in order:

1. **A listing is resolved by id from the committed set, never supplied.** No exported
   function accepts a `CatalogListing`, so the purchasable assets are exactly the enumerated
   ones. An unknown id, a fabricated listing, and every *other* committed fixture listing all
   refuse `LISTING_FIXTURE_COMMERCE_NOT_ENABLED` — a reason distinct from `LISTING_UNKNOWN`,
   because "exists in the catalog and is not for sale" is a different fact from "does not
   exist". Adding a second id is a product decision, not a refactor: it is what turns one
   proven fixture purchase into an open catalog.
2. **The documented entitlement is actually evaluated.** `catalog-asset-purchase` was a row
   in the matrix above that no purchase path read. Both entry points now evaluate it with the
   currency the buyer chose, so an insufficient balance refuses before any ledger is appended
   to, and the matrix governs a purchase instead of describing one.
3. **A retry is answered from the debit it already made.** That balance gate sits *above* the
   ledger's own idempotency check, so a naive version of it would break the retry it exists to
   protect — a caller re-sending `sale_01` after a timeout holds a ledger that already paid,
   and would be refused `CREDIT_BALANCE_INSUFFICIENT` out of its own proceeds. When the
   supplied ledger already carries `sale:<saleId>:buyer`, the balance is judged against the
   state that *preceded* that debit, so the question is asked exactly once while capability,
   Kids, identity, ownership, and self-purchase are still re-checked. A *different* sale out
   of the same depleted balance is still refused. Recognition reads the supplied ledger
   because that is the same ledger `applyCreditsSale`'s own idempotency reads — the gate must
   not be able to refuse a retry the layer beneath it would replay.
4. **Money bookkeeping is bound to a settlement.** `settleFixtureListingMoneySale` takes only
   the branded output of `parseCheckoutCompletedEvent` plus the persisted intent it was bound
   to, and recovers the sale id from that intent's `sale:<saleId>` idempotency key rather than
   accepting one. That key is itself bound to the settlement: `intentId` is the intent field
   the completion pins, and every real intent derives it from its own idempotency key, so the
   key is re-derived and compared before the sale id is read out of it — renaming the key onto
   another sale refuses. A `MoneySplitRecord` on this path can therefore only describe money a
   signature-verified Stripe **test** settlement actually took, for an enabled SKU, at the
   price the seller listed. A settled amount that differs from the listing refuses.

**Test mode is structural, not a default.** No function here accepts or forwards
`liveModeAuthorized`, so the captain go-live gate cannot be passed through this path at all:
the checkout entry point can only emit a `test` intent, and a live settlement handed to the
settlement function refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED`. The money path also grants no
credits — `applyCheckoutCompletedGrant` refuses a `catalog-listing` completion — so the two
currencies cannot cross.

This adds no ledger, no second entitlement table, no publishing surface, and no catalog
activation; it only narrows what the existing seams may be pointed at. The `catalog-game` and
`catalog-web` apps and the `sites/` storefronts stay as they were. The whole path is proven
in `tests/e2e/catalog-fixture-commerce-golden.test.ts` (in `pnpm test:golden`) with the exact
figures above, and unit-tested in `packages/billing/test/fixture-commerce.test.ts`; both run
with no Stripe key, no database, and no network.

## Kids isolation

Kids never shares identity or commerce with another SceneAxi surface. The rule is an
invariant rather than a fixed number of checkpoints: **every** path that can reach identity
or a charge carries its own non-overridable deny — `AUTH_REFUSE_REASONS.kidsSurfaceDenied`
or `BILLING_REFUSE_REASONS.kidsCommerceDenied` — instead of relying on an upstream one, so
adding a path means adding its deny. Counting the current call sites here would go stale on
the next path; `tests/e2e/auth-credits-refuse-matrix.test.ts` is what proves both reasons
stay reachable.

The structural points that hold whatever else is added:

- `signIn` refuses a `kids` surface **before** the adapter is called, so no adapter can
  influence the outcome and no session or digest is produced.
- `verifySession` and the role guards refuse a **stored** `kids` session, so one written by
  any other path cannot be redeemed.
- `evaluateEntitlement` refuses `KIDS_COMMERCE_DENIED` for **every** capability on the Kids
  surface, the free ones included — and each commerce entry point above it (credit-pack
  checkout, catalog listings, fixture commerce, the hosted-AI gate) refuses on its own
  before it gets there.
- The in-app AI assistant refuses to *exist* on the Kids surface or for the Kids profile, so
  no assistant turn — in any mode, metered or not — can be attempted there at all.
- The `sessions` table's surface check constraint omits `'kids'` entirely, so the row
  cannot exist.

Additionally, nothing depends on or imports `@sceneaxi/profile-kids`, enforced independently
of allow lists by `pnpm check:boundaries`.

## Held keys are unchanged

This plane is **product** user authentication. It does not replace, weaken, or interact
with held-key captain policy ([`held-key-enforcement.md`](held-key-enforcement.md)), and
this vertical adds no CLI verb. Machine/agent CLI behavior is untouched.

## Remaining wiring for a live signed-in session

Everything below is outside this vertical. The hosted HTTP surface it needed is now
`sites/umbrella`, wired to this plane through one plug point:

1. Better Auth's own handler, mounted behind that surface to issue the session cookie the
   umbrella already reads.
2. `IdentityStore` and `CreditStore` implementations over a Neon client, and the migrations
   applied to a Neon branch (needs credentials — separate authority). The `CreditStore` also
   owns provisioning a `CreditAccount` per user; nothing in this repository can create one.
3. A Stripe adapter that turns a `CheckoutSessionIntent` into a hosted checkout URL. The
   webhook route that passes the **raw** body to `verifyStripeWebhookSignature` has landed
   on the umbrella (`sites/umbrella/src/app/api/stripe/webhook/route.ts`, sceneaxi#131).
4. A renderer over `createAccountPanel`'s snapshots.

None of it changes a contract or a policy in this plane; all of it is adapters and glue.
The deployable-site half of that glue — and which surfaces are already live versus still
refusing — is owned by [`websites-deploy.md`](websites-deploy.md).
