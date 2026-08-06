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
| Contracts (User, Session, RoleAssignment, credits, billing, entitlements, listings, revenue share, Connect audit) | `packages/schemas` |
| Single-admin resolution, role guards, identity port | `packages/auth` |
| Credit ledger, metering, entitlements, hosted-AI credit gate, Stripe test checkout, revenue share, TEST-only Connect seam, fixture commerce | `packages/billing` |
| Credit persistence boundary (`createCreditStore`) every adapter is built through | `packages/billing/src/store.ts` |
| Neon schema | `db/migrations` |
| Login + balance view model | `apps/web-shell` (`createAccountPanel`) |
| In-app AI assistant view model | `apps/web-shell` (`createAssistantPanel`) |
| Deployable-site wiring | `sites/umbrella/src/lib/identity-plane.ts` + `provider-adapters.ts`, reached by request code only through the `request-authority.ts` facade (`docs/websites-deploy.md`) |

Release group `identity`; both packages consume only public contracts. **Outside core:** a
running Better Auth instance, a Neon connection, the Stripe API client, any HTTP surface,
and any UI. The umbrella owns only the deployment adapters that connect those providers;
provider credentials and the database remain outside the repository.

The TEST deployment path now has the provider-backed handles and idempotent account
provisioning. Missing provider configuration remains a named refusal, and activation
still requires the wiring mechanics at `docs/websites-deploy.md`, taken in the order
`docs/production-activation.md` owns. The sign-in HTTP
entry point that reaches `identityPort.signIn` **ships** (sceneaxi#185): the umbrella's
`/login` page and `POST /api/login|logout` routes drive the plane's login port and set the
HttpOnly `sceneaxi.session` cookie — see *Better Auth* below. **What v1 still does
not deliver is a running provider:** a live signed-in browser session additionally needs
the deployment to serve Better Auth's own handler and configure the handles held behind
`umbrellaRequestAuthority()`, which is operational work outside this repository. See
*Deployment activation* at the end.

## Environment

Names only; values never appear in the repository.

| Variable | Purpose |
|---|---|
| `SCENEAXI_ADMIN_EMAIL` | The **one** captain email that resolves to the `admin` role |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | Provider-owned first-admin credential material. It is not a role source and never enters core |
| `BETTER_AUTH_ORIGIN` | Better Auth provider origin used by the umbrella sign-in adapter. The provider must serve `sign-in/email` and `get-session`, and must resolve that lookup from either the issued session cookie or the issued bearer token; `docs/websites-deploy.md` owns that prerequisite |
| `DATABASE_URL` | Neon Postgres connection string |
| `STRIPE_SECRET_KEY` | Stripe **test** secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe **test** webhook signing secret |
| `SCENEAXI_STRIPE_LIVE_AUTHORIZED` | The **one** source of live-mode authorization; see *Live-mode authorization* below. Unset — as it is everywhere — means `live` refuses |

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

On the umbrella, a route does not call this resolver and cannot supply its own `env`.
The no-argument `umbrellaRequestAuthority()` facade obtains the deployment registry once
and exposes only a request-plane method accepting the carried session credential and a
webhook method accepting raw request evidence. The registry holds the exact issued
`AdminIdentity` with the provider handles. The pure `createUmbrellaIdentityPlane()`
builder receives already-issued evidence for deterministic tests; it no longer turns a
caller-shaped environment into admin authority, and the returned site plane does not
expose the admin witness. `pnpm check:boundaries` denies production code from reaching
that builder, the provider adapters, or the root barrel around the facade.

```ts
import { planAdminBootstrap, resolveAdminIdentity } from "@sceneaxi/auth";

const admin = resolveAdminIdentity(process.env);
if (!admin.ok) throw new Error(`${admin.reason}: ${admin.message}`);
```

## Runtime provenance (sceneaxi#126)

Five values in this plane mean "a trusted step produced me", and their shapes are public:
the resolved `AdminIdentity`, the `Principal` an identity port issues, the `VerifiedWebhook`
a signature check produces, and the `VerifiedCheckoutCompletion` and
`VerifiedCreditPackRefund` parsed out of it. Structural validation confirms only the
public shape, while a TypeScript brand constrains only ordinary typed callers; neither
proves trusted origin against JavaScript or an `as` cast. These values can reach exported
functions inside the server process. So all five carry **runtime** provenance, built on
the one shared helper `createProvenanceWitness` in `@sceneaxi/schemas`.

A witness remembers the *object identity* of every value its module issued, in a `WeakSet`
no importer can reach. Nothing is written onto the value, so every structural check stays
as it was — and because identity is what is remembered, a plain literal, a spread, an
`Object.assign`, a `structuredClone`, a JSON round-trip, and a `Proxy` wrapper are all
different objects and all refuse. A symbol-keyed brand would not do this: spread and
`Object.assign` copy own enumerable symbol keys. The guarantee is in-process and
non-transferable, which is exactly what "this process verified it" should mean; evidence
that must cross a process boundary needs a signature instead.

Who issues, who checks, and what refuses:

| Value | Issued by | Checked at | Refusal |
| --- | --- | --- | --- |
| `AdminIdentity` | `resolveAdminIdentity(env)` | `requireRole`, `requireAuthenticated`, identity-port sign-in/session verification | `AUTH_ADMIN_IDENTITY_UNPROVEN` |
| `Principal` | `createIdentityPort().signIn` / `.verifySession` | `requireRole`, `requireAuthenticated` and every billing path built on them | `AUTH_PRINCIPAL_UNPROVEN` |
| `VerifiedWebhook` | `verifyStripeWebhookSignature` | `parseCheckoutCompletedEvent` | `STRIPE_WEBHOOK_NOT_VERIFIED` |
| `VerifiedCheckoutCompletion` | `parseCheckoutCompletedEvent` | `applyCheckoutCompletedGrant`, `recordMoneySale`, `settleFixtureListingMoneySale` | `STRIPE_COMPLETION_NOT_VERIFIED` |
| `VerifiedCreditPackRefund` | `parseCreditPackRefundEvent` | `applyCreditPackRefund`, and `persistCreditPackRefund` through it | `STRIPE_WEBHOOK_NOT_VERIFIED` |

`hasAdminIdentityProvenance`, `hasPrincipalProvenance`,
`hasVerifiedWebhookProvenance`, `hasVerifiedCompletionProvenance`, and
`hasVerifiedRefundProvenance` are exported so a caller sequencing its own route can
assert the same thing. Checking provenance grants nothing; each module's issuing witness
stays private.

Tests need genuinely issued principals without standing up a port, so `@sceneaxi/auth`
declares one visibly test-only subpath, `@sceneaxi/auth/testing/principal-issuance`, which
validates a structural fixture and records it with the same witness the port uses. It is a
declared package entry point rather than a relative reach into another package's test
directory, it is never re-exported from the root barrel, and it is unreachable from
shipped code — the general `testing/` subpath rule `pnpm check:boundaries` enforces is
owned by [`DEPENDENCY-MATRIX.md`](DEPENDENCY-MATRIX.md#test-only-testing-subpaths).

A guard is never an issuance authority, so it returns the **exact** witnessed object it was
handed rather than the validator's copy: `requireAuthenticated`/`requireRole` results still
satisfy `hasPrincipalProvenance` and still pass a subsequent guard. Structural validation
runs first and keeps its own named refusal, so a malformed value is still
`AUTH_PRINCIPAL_INVALID` rather than unproven.

Principal provenance deliberately does not survive serialization. A deployment must
re-verify its carried session per request instead of caching and rehydrating a principal.
The umbrella does this in `verifyCarriedSession()`: each checkout calls
`IdentityPort.verifySession()` and threads that exact returned object into the billing
guard.

**Prefer bound guards.** `createRoleGuards(resolveAdminIdentity(env))` fixes "who is admin"
at the point the guards are made, so no later call site supplies it as an argument at all:

```ts
import { createRoleGuards, resolveAdminIdentity } from "@sceneaxi/auth";

const guards = createRoleGuards(resolveAdminIdentity(process.env));
const guarded = guards.requireRole(principal, "admin", { now: Date.now() });
```

A refused resolution yields guards that return that same named refusal — the deployment
has no admin, so nothing is admin. `requireRole`/`requireAuthenticated` stay exported for
callers that already hold the resolved identity; they check its provenance, so keeping
them costs nothing at the boundary.

The whole boundary is proven in `tests/e2e/runtime-provenance-refusal.test.ts`, which
builds every impostor listed above for each value and asserts the refusal by name, then
asserts a genuine completion still grants exactly once and a genuine refund still reverses
exactly once, while a redelivery of either settles to the entry already committed. The
refund impostors are pushed at both `applyCreditPackRefund` and the
`persistCreditPackRefund` commit boundary, against a ledger holding the real anchored
grant, so provenance is the only thing that can be refusing them.

### Issuance authority begins outside core

The trust boundary is **the process**, and SceneAxi core issues no authority of its own:
issuance authority begins at the environment and at the deployment's own persistence, and
core's work is to derive the witnesses above from it and to verify provider evidence and
persisted state handed in from outside. Those witnesses are therefore defence-in-depth
*inside* that boundary rather than a second one — they establish that this process ran the
expected step on this exact object, and never make the process an independent issuer of the
environment value, persisted row, or provider fact the object was derived from.

The public low-level functions landed for sceneaxi#126 remain compatible building blocks,
but they are not the umbrella's deployment authority. `resolveAdminIdentity(env)` and
`verifyStripeWebhookSignature({ secret, ... })` necessarily accept caller-supplied inputs
for hermetic core tests and other hosts. The umbrella narrows those inputs at its server
boundary instead: the owner module alone reads deployment configuration and holds the
admin evidence plus a `CreditWebhookCapability` that closes over the webhook signing
secret, store, evidence adapter, and clock. Routes reach that registry only through
`umbrellaRequestAuthority()`, receiving neither issuer input nor secret. The webhook
route can supply only raw request bytes and the Stripe signature header to that
capability. Core still owns the same signature verification, completion provenance,
grant decision, and commit boundary; the deployment adds no second verifier or issuer.

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

A successful `signIn` returns a `SignInGrant`, not a bare principal:
`{ principal, sessionToken }`. The store keeps only the token's digest, so the grant's
raw `sessionToken` is the **one redeemable copy in existence** — without it no browser
credential could ever be constructed and a sign-in would be unredeemable. The caller's
obligation is symmetric to the store's: hand the token to the authenticated client (the
umbrella writes it into the HttpOnly `sceneaxi.session` cookie as
`<sessionId>.<token>`, the same credential `verifySession` later checks against the
stored digest) and hold it nowhere else — never logged, never persisted, never
re-derivable. The first consumer is the umbrella's hosted login route
(sceneaxi#185): `createAuthLoginAdapter` in `sites/umbrella/src/lib/identity-plane.ts`
drives `signIn` and composes the cookie credential; a consumer that holds the issued
`Principal` object itself, like web-shell's account panel, drops the token on the floor
deliberately.

Issuance has one precondition ahead of everything above: the submission must prove it
came from the deployment's own pages. `verifySiteFormOrigin` decides it from the
browser-set `Origin` (or `Sec-Fetch-Site: same-origin` where a browser omits `Origin`)
against the configured umbrella origin, and `performLogin` / `performLogout` take that
proof as a **required argument**, refusing `SITE_REQUEST_CROSS_ORIGIN` before a field is
read or a port is reached. The cookie's `SameSite=Lax` is not that check and cannot be:
a sign-in POST carries no cookie yet, so nothing is withheld from it and the browser
stores the `Set-Cookie` it answers with — a cross-site page would otherwise be able to
sign a visitor into an account it chose, and the mirror submission to sign-out would
force a visitor's session away. Sign-out is refused there too, which is the one bound on
"the cookie is cleared unconditionally": that promise is to this browser's own request.

That credential format carries one obligation back onto the provider's session id: it is
read back by splitting on the **first** `.`, so a session id that itself contains a dot —
which the adapter's identifier rules otherwise permit — cannot round-trip. The umbrella
adapter re-reads the credential it just composed and refuses `LOGIN_SESSION_NOT_ISSUED`
when the halves do not come back unchanged, so an unrepresentable session id is a named
refusal at issuance rather than a cookie the next request silently reads as "signed out".

`LOGIN_SESSION_NOT_ISSUED` is the issuance counterpart of the verify path's
`IDENTITY_ADAPTER_OUTPUT_INVALID`, and site-kit's login plane uses it for a grant it
cannot read — a non-record answer, an off-registry refusal, a principal whose shape the
verify path would have called `IDENTITY_ADAPTER_OUTPUT_INVALID`, or a credential no
cookie can carry. A grant it reads but will not trust is a different answer: the plane
re-validates the principal exactly as it does a resolved one, so an expired,
not-yet-valid, or surface-mismatched session, an unknown role, and a disabled user each
keep their own named reason rather than being folded into the issuance one. The
distinction is not cosmetic: at issuance the browser presented nothing, so nothing was discarded and
signing in again cannot change the outcome. `describeSiteAccessState` therefore projects
it onto its own `sign-in-not-issued` state — a deployment fault with **no** action —
instead of the "sign in again to get a fresh session" copy that belongs to a credential
the plane refused to trust.

That distinction is held at the boundary rather than at each page, because a page can no
longer tell an issued session from a presented one. `siteReasonForLoginAuthReason` is
the issuance mapping the umbrella's login adapter applies to the reasons the **auth
port** raises, upstream of the plane's own re-validation above: it is
`siteReasonForAuthReason` with one substitution, so a reason
added to the verify mapping is carried onto the login path by construction. Rejected
credentials become `LOGIN_CREDENTIALS_REJECTED` rather than the "signed out" the verify
path folds them into; every reason whose named state would describe a credential *this
browser presented* — `IDENTITY_SESSION_ABSENT`, `IDENTITY_ADAPTER_OUTPUT_INVALID`,
`IDENTITY_ROLE_UNKNOWN`, `IDENTITY_SESSION_EXPIRED`,
`IDENTITY_SESSION_NOT_YET_VALID`, `IDENTITY_SESSION_SURFACE_MISMATCH` — becomes
`LOGIN_SESSION_NOT_ISSUED`, since at issuance nothing was carried, nothing was
discarded, and retrying reaches the same fault. Everything equally true on both paths —
`KIDS_SURFACE_DENIED`, `ROLE_CLAIM_FROM_CLIENT_DENIED`, `IDENTITY_USER_DISABLED`,
`IDENTITY_PLANE_NOT_WIRED`, `IDENTITY_PLANE_UNAVAILABLE` — keeps its own name, so the
issuance path gains no second vocabulary to drift from the registry.

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

The umbrella deployment implements `IdentityStore` (`@sceneaxi/auth`) over its Neon
client, and a `CreditStoreAdapter` (`@sceneaxi/billing`) handed to `createCreditStore` —
never a `CreditStore` implemented directly, for the reasons in *The credit persistence
boundary* below. Its authentication adapter provisions the SceneAxi user and exactly one
credit account with an idempotent insert; payment webhooks never create accounts. That
insert reconciles `email` and `email_verified` from the provider on every authentication,
because the provider — not this deployment — owns both: freezing them at the first sign-in
would leave an admin who verified afterwards permanently refused `adminEmailUnverified`
against a stale row, and a member who changed their address permanently `userNotFound`.
`disabled` and `created_at` stay deployment-owned and are never overwritten, and the
credit account is still created at most once. The
in-memory reference implementations mirror the database's constraints — unique
`(account_id, sequence)`, unique `idempotency_key`, no update or delete — so a bug the real
trigger would catch cannot pass the test suite.

## The credit persistence boundary (sceneaxi#128)

The pure layer guarantees the *arithmetic and the refusals*; it cannot guarantee the
*commit*, because it owns none. `createCreditStore` is that commit boundary. **Build every
adapter through it** — `createCreditStore(yourNeonAdapter)` — because it is where the
invariants that must not be re-implemented per adapter live. The in-memory reference store
is constructed the same way, so it is held to exactly the rules a Neon adapter will be.

| operation | what the boundary guarantees |
|---|---|
| `appendEntry` | refuses a `sale:`-namespaced key before the adapter is reached |
| `appendOrReplayEntry` | the committed entry answers for the key that was requested, at the ledger position it was requested for |
| `settleCreditsSale` | each leg carries that sale's own reserved key, no gross or creator share is booked without the entry that moved it, each present leg moves exactly the credits the share record claims, and the adapter's outcome says whether it replayed |

`CreditStore` is a structural type, so a deployment *can* implement the port directly and
reach a commit path having never been through `createCreditStore`. The two commit call
sites — `persistCheckoutCompletedGrant` and `meterCredits` — therefore read every
append-or-replay answer through `readCommittedEntry`, which applies the boundary's own
comparison to the entry that call requested. An answer that is merely schema-valid, or is a
row belonging to some other request, is a commit that could not be confirmed:
`CREDIT_STORE_FAILED`, no entry, retry — never a foreign row reported as this grant or this
debit, and never an `ignored: false` for credits the ledger does not hold.

**`sale:` keys are reserved to atomic settlement.** A sale has two ledger legs in two
different accounts. Any path that can append one on its own can leave a buyer charged for a
creator who was never paid, so `appendEntry` refuses the namespace outright and
`settleCreditsSale` is the only way in — committing both legs and the `CreatorShareRecord`
together, or nothing. `saleEntryKeys(saleId)` names the two keys; `isSaleEntryKey` asks the
question. The reservation lives at the shared boundary rather than in one adapter, so a new
adapter inherits it by construction.

**`appendOrReplayEntry` is what a lost response needs.** Given an idempotency key and a
semantic payload it either appends or hands back the entry already committed under that
key, atomically — one row per key, mirroring the DDL's unique `idempotency_key`. A caller
whose append committed but whose answer never arrived is told `replayed: true` instead of
colliding with its own row. A key carrying different money is a conflict, never a second
append. The boundary then checks the answer: a replay must match the requested payload on
the fields the ledger's own idempotency rule compares, and a fresh append must be exactly
the entry handed over — an adapter that renumbered a sequence or balance witness would
break the next reader's derivation.

`meterCredits` goes further, because a lost response also makes the caller's state look
stale: before refusing `CREDIT_LEDGER_STATE_INVALID` it asks whether persistence holds
exactly the caller's own history **plus this very debit**. That shape, and only that shape,
is a replay. A different account record, a different history, more than one extra entry, or
an extra entry that is somebody else's movement stays a refusal — as does a retry that asks
for different money under the same key.

None of this needs a database to prove. The gate builds adapters in-process and asserts the
contract against them; there is no live-database suite in this repository, and any future
one must stay opt-in and outside the default run, which is hermetic by rule (ADR 0021).

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
takes settlement (session id, paid status, amount, currency, quantity, Stripe price) that
your adapter **retrieves separately** for that exact Checkout Session, and refuses unless it
and the session's mode and metadata all match the persisted intent — the immutable price
snapshot.

The persisted checkout intent is an **input to issuance**, not its authority for
`credits`. Both figures a grant depends on arrive through the same deployment-owned
`CheckoutEvidencePort`, so the money figure is corroborated across two reads:
`parseCheckoutCompletedEvent` compares the retrieved settlement's amount, currency, and
Stripe price against the persisted intent — and requires its quantity to be exactly `1`,
which the intent does not carry a field for. At grant time,
`applyCheckoutCompletedGrant` resolves the persisted intent's exact
`(itemId, stripePriceId, unitAmount)` tuple through the committed historical archive and
requires the completion's `currency` and `credits` to equal that retained revision. The
ledger entry uses the revision's credits, never a caller- or intent-controlled amount.
Unknown tuples — and a resolved revision the completion does not settle the currency of,
since a matching amount in another currency is another price — refuse
`BILLING_CATALOG_REVISION_UNRESOLVABLE`; a known tuple with a different credit amount
refuses `BILLING_CATALOG_REVISION_CREDITS_MISMATCH`, both before any append or commit.
That is what makes a deployment's adapter obligation exact: write the row exactly as
`createCheckoutSessionIntent` produced it, and treat its four price-bearing fields —
`credits`, `unit_amount`, `currency`, `stripe_price_id` — as immutable once written. The
obligation is field-scoped on purpose, not whole-row: the columns a deployment adds for its
own operations stay writable, so it may stamp the hosted Stripe session id onto the row
after creating the session, and this rule must not be re-tightened into whole-row
immutability later. The `CheckoutEvidencePort` obligations themselves, retrieving the
settlement separately for that exact Checkout Session included, stay owned by
[`websites-deploy.md`](websites-deploy.md#activation-mechanics).
[`packages/billing/src/stripe-webhook.ts`](../packages/billing/src/stripe-webhook.ts),
[`packages/billing/test/stripe-checkout.test.ts`](../packages/billing/test/stripe-checkout.test.ts),
and the credit-pack grant-anchor tests prove the settlement comparison, grant-time anchor,
and persisted-credit commit behavior.

Captain decision D2 (`intent-credit-anchor`) is implemented here over the archived/versioned
catalog landed in [PR #173](https://github.com/Vhailors/sceneaxi/pull/173). D3
(`intent-ddl-immutability`) stays a separate decision
and this change implements no part of it, but its migration already landed in
[PR #172](https://github.com/Vhailors/sceneaxi/pull/172):
`db/migrations/0003_checkout_session_intent_price_immutability.sql` is a forward-only
`BEFORE UPDATE` trigger that refuses a change to exactly those four price-bearing columns
while operational columns stay writable, and
[`tests/db/schema-lockstep.test.ts`](../tests/db/schema-lockstep.test.ts) asserts that
field scope. What D3 still owes is outside this repository: the deployment's own writes
have not been audited — this repository cannot see them — and applying the migration needs
the separate deploy authority that [`websites-deploy.md`](websites-deploy.md#activation-mechanics)
owns. So the obligation above is enforced in the database of any deployment that has run
`db/migrations` in order, and rests on the adapter alone until it has. Stripe LIVE is still
unactivated under ADR 0021.

**Settlement must name the session it settles** (sceneaxi#127). `CheckoutSettlement.sessionId`
is required and must equal the Checkout Session id in the verified body (`data.object.id`),
which the parser reads itself and carries onto the completion as `checkoutSessionId`. Amount,
currency, and price are identical between any two genuinely paid sessions for the same item,
so without this a settlement retrieved for one paid session would validate another one's
event. The comparison happens *inside* the parser, before anything else about the settlement
is read, so a caller that retrieved for the wrong session cannot skip it.

The session id is **provider-generated and opaque**, so it is held to presence only —
not to the url-safe 1-128-char rule SceneAxi applies to the ids it mints itself
(`intentId`, `userId`). Stripe guarantees nothing about the length or charset of an
object id, and a format rule here would refuse a genuinely paid webhook permanently.
What binds the evidence is that an id is *there* to compare, and that the comparison is
exact string equality.

| condition | refusal |
|---|---|
| the event's session object names no `id`, or an empty or blank one | `STRIPE_CHECKOUT_SESSION_ID_MISSING` |
| a retrieved settlement carries no `sessionId`, or a different one | `STRIPE_SETTLEMENT_SESSION_MISMATCH` |
| no settlement was retrieved at all | `STRIPE_WEBHOOK_PAYLOAD_INVALID` |
| settlement is unpaid, or its amount/currency/quantity/price ≠ the intent | `STRIPE_WEBHOOK_PAYLOAD_INVALID` |

Your adapter must echo back the id it was asked about. The grant's completion fingerprint
includes the session id too, so two sessions can never be mistaken for a redelivery of each
other.

`STRIPE_SETTLEMENT_SESSION_MISMATCH` is a **deployment-side** fault, so a deployment must
classify it as one: both sides of that comparison come from a single signature-verified
body, which leaves only the deployment's own `retrieveSettlement` adapter able to disagree.
The umbrella does this in `SERVER_SIDE_REASONS`
(`sites/umbrella/src/lib/credit-webhook.ts`), and `docs/websites-deploy.md` owns the full
status table. `STRIPE_CHECKOUT_SESSION_ID_MISSING` is deliberately *not* server-side: it
reads the id out of the verified body itself, so an absent id means the inbound body
lacked one.

Your webhook endpoint must pass the **raw request body**, not a re-serialised object —
re-encoding the JSON changes the bytes and verification will (correctly) fail. On the
umbrella, the route receives the deployment-owned capability from the one plug point; it
never accepts or reads a webhook secret itself:

```ts
const outcome = await umbrellaRequestAuthority().applyCreditWebhook({
  payload: await request.text(),
  signatureHeader: request.headers.get("stripe-signature"),
});
```

`CreditWebhookCapability` closes over the environment secret and the deployment's typed
`CreditStore` / `CheckoutEvidencePort`; `applyCreditPackWebhook` still performs the
signature check, parsing, archive anchor, and persisted grant exactly as documented below.

The commit is `CreditStore.appendOrReplayEntry` on the event's own key
(`stripe-event:<eventId>`), so at-least-once delivery is safe from both sides: the pure
path answers a redelivery the ledger already shows, and the store answers one that landed
after this caller read the ledger. Exactly one grant exists either way.

**A webhook grant commits through exactly one boundary, and every endpoint uses it**
(captain decision D4). `sites/umbrella/src/lib/credit-webhook.ts` used to hand the decided
entry to `appendEntry` itself and reconcile a throw by re-reading the ledger; it now calls
`persistCheckoutCompletedGrant` like the sketch above, so no second commit path exists for
the same paid event. The re-read is not missing, it is *unnecessary*: it existed because
`appendEntry` reports an ordinary redelivery race and a genuine store failure identically,
and only the ledger could tell them apart. `appendOrReplayEntry` answers the race itself —
handing back the row already committed under that key, checked against the entry that was
requested and the ledger position it was requested for — so a throw is what it says it is.
The endpoint's three-way outcome split is unchanged, and so is what its success means:

| Outcome | HTTP | Meaning |
|---|---|---|
| `ok: true, ignored: true` | `200` | an event this endpoint owes no work, decided from the verified body alone before any port or store is read; permanent, because Stripe stops redelivering |
| `ok: true, ignored: false` | `200` | **this event's movement is in the ledger** — nothing else is reported as success. `movement` names which one it was and `credits` carries the committed entry's signed delta, so a reconciled full refund reports `"refund"` and a negative delta rather than reading as a second purchase |
| `CREDITS_PLANE_NOT_WIRED` from the request facade | `503` | no deployment webhook capability is wired, so nothing was verified and nothing was granted; it is `CREDIT_WEBHOOK_REASONS.planeNotWired` and sits in `SERVER_SIDE_REASONS` like every other deployment fault, so `creditWebhookHttpStatus` — never the route — answers it |
| refusal in `SERVER_SIDE_REASONS` | `503` | this deployment's own fault, retried |
| every other refusal | `400` | decided against the inbound bytes, retried |

A commit the boundary could not confirm refuses `CREDIT_STORE_FAILED` (`503`) with no
grant claimed — including when the row did in fact land, since this call cannot prove it —
and the redelivery reads the ledger and answers the replay. **An issuance-authority
refusal is never `ignored`**: a fault answered as a permanent acknowledgement is money
silently lost. A new issuance-authority refusal belongs in `SERVER_SIDE_REASONS` (`503`)
unless it is decided purely from the inbound bytes without consulting a port, in which
case it is a `400`. Nothing new is ever added to `UNHANDLED_EVENT_REASONS`, whose three
members remain only the verified-body cases documented in
[`docs/websites-deploy.md`](websites-deploy.md#how-the-seam-holds): an unhandled event
type, a completion purpose that settles elsewhere, and an event carrying no SceneAxi
metadata. The refund path adds the endpoint's only other acknowledgements, from its own
second closed set and scoped to that path alone — a partial refund and a balance the buyer
already spent, both settled facts about money no redelivery changes, and neither one moves
the ledger. That doc owns the transport rule for all of them. The closed-set assertions in
[`tests/sites/identity-plane-wiring.test.ts`](../tests/sites/identity-plane-wiring.test.ts)
make a new member of either set — or a new acknowledgement path added beside them — a gate
failure.
`CREDIT_REQUEST_INVALID` joins the server-side set for
the same reason: the boundary refuses it for a request the endpoint built, never for
anything the inbound bytes decided.

**Full TEST refunds reconcile by append, never rewrite.** Checkout creation copies the
four SceneAxi metadata keys onto both the Checkout Session and its PaymentIntent, so a
signature-verified `charge.refunded` event carries the immutable intent id on the Charge.
`parseCreditPackRefundEvent` requires a full refund, exact TEST mode, currency, amount,
user, purpose, item, and intent match, then resolves the same committed pack revision the
grant used. `applyCreditPackRefund` requires the ledger's original intent-anchored grant
and appends one negative `adjustment` under `stripe-refund:<intentId>`; it never edits or
deletes the grant. The anchor is written as its own `;`-delimited segment of the grant's
reason and read back as a whole segment, never as a substring: a buyer influences the
idempotency key an intent id is derived from, so one id can literally begin with another,
and a substring match would let an ungranted intent reverse a different intent's credits.
The decision is not the commit here either: `persistCreditPackRefund` is the refund's
counterpart to `persistCheckoutCompletedGrant`, reporting success only after the
adjustment is in the ledger and going through the same `appendOrReplayEntry` seam and the
same answer-for-what-was-asked check, so the reversal has no second commit path any more
than the grant does. The intent-scoped key makes duplicate and replacement refund events a
replay rather than a second reversal. A partial refund, a missing original grant, an
already-spent balance that cannot absorb the adjustment, missing evidence, or an
unavailable store refuses by name and never reports a reconciled refund. LIVE remains
unreachable exactly as it is for grants.

A partial refund carries its own reason, `STRIPE_REFUND_NOT_FULL`, rather than the
payload refusal: it is bound to the intent and well-formed, and only the money is
partial. That distinction is what lets a transport tell the two conditions apart — a
payload it could not read may be worth retrying, while a partial refund and a spent
balance are settled facts no redelivery changes. The umbrella endpoint therefore
acknowledges exactly those two on the refund path with their own names and no ledger
movement (`docs/websites-deploy.md` owns that transport rule); the refusal itself is
unchanged here, and neither one ever appends, rewrites, or partially reverses anything.
Reconciling the money side of either is an operator decision taken outside this
repository — never a hand-edited ledger row, which the append-only trigger refuses
anyway.

**Grants committed before the intent anchor shipped cannot be reconciled.** The anchor is
part of a grant's `reason`, the ledger is append-only, and a committed row is immutable,
so no grant written before this contract landed carries one. A refund naming such a
purchase finds no anchored grant and refuses `CREDIT_LEDGER_STATE_INVALID`, which the
umbrella endpoint answers `503` and Stripe retries until it stops on its own. That is
fail-closed and deliberate: the alternative — matching a grant some other way — is
exactly the ambiguity the anchor exists to remove. There is no migration, and inventing
one would mean rewriting immutable rows. An operator meeting this case reconciles the
money in Stripe and records the credit decision out of band; the ledger keeps the
original grant, and the refund is visible in the endpoint's refusals rather than silently
absorbed. Deployments whose ledgers hold only grants written on or after this contract
are unaffected.

**Live mode is unreachable by default.** `mode: "live"` refuses unless
`liveModeAuthorized: true` is passed explicitly at the call site, enforced both when
creating an intent and when honoring an event. **Live activation is not authorized today**
and remains a captain decision (ADR 0021).

## Live-mode authorization (captain decision D5)

`assertModeAuthorized` takes a bare boolean, and this repository used to say nothing about
where a deployment could get one — which reads as "any expression you like" to anyone
wiring an adapter. The captain closed that silence by allowing **one named configuration
variable**, against the recommendation that it stay a code-only literal, and attached the
mitigations below as the price. `resolveLiveModeAuthorization` in
`packages/billing/src/live-mode.ts` is the only implementation of them.

```
SCENEAXI_STRIPE_LIVE_AUTHORIZED=live-mode-authorized:<email>:<YYYY-MM-DD>
```

| Requirement | How it holds |
|---|---|
| **One name, never a second spelling** | `STRIPE_LIVE_MODE_ENV_VAR` is the only key read. Every alias in `STRIPE_LIVE_MODE_ALIAS_ENV_VARS` refuses **by its presence alone**, even alongside a correct affirmative — the same rule `SCENEAXI_ADMIN_EMAILS` gets, for the same reason |
| **Absent means refused** | Unset, empty, `true`, `1`, `yes`, a value naming no address, or a date that is not a real `YYYY-MM-DD` all refuse `STRIPE_LIVE_MODE_NOT_AUTHORIZED`, so `assertModeAuthorized` refuses at both ends unchanged |
| **Audit evidence** | The affirmative *names its author and the day*, so live mode cannot be switched on anonymously; and the caller must inject a `recordAudit` sink, which is handed a `LiveModeAuthorizationAudit` (`authorizedBy`, `authorizedOn`, a `sha256` fingerprint, and one ready-to-log line) **before** the authorization is issued. A missing sink, a non-function, one that throws, and one that answers with a promise all refuse — the resolver is synchronous, so a record it would have to await is a record it cannot witness — and no deployment can hold an authorization it never wrote down |
| **The gate stays a gate** | Nothing else is an input. `NODE_ENV`, `VERCEL_ENV`, an `sk_live_` key, `SCENEAXI_BILLING_MODE`, the price, and the adapter's identity are not read and must not become inputs. The resolved value is runtime-witnessed (sceneaxi#126), so `liveModeAuthorizedFlag` answers `true` for the exact object the resolver issued and `undefined` for every copy or look-alike |
| **The hermetic gate is unaffected** | The resolver takes an injected `env`; nothing reads a global. `pnpm gate` runs with the variable absent, and a test asserts that |

**This is a mechanism, not an activation.** No shipped call site passes
`liveModeAuthorizedFlag`'s result to a checkout or a grant — a gate test asserts that — so
today `live` refuses everywhere regardless of the variable. Reaching live mode still needs
the separate captain go-live decision ADR 0021 holds, *and* a deliberate wiring change on
top of it. `SCENEAXI_BILLING_MODE=live` selects a mode; it authorizes nothing.

The complete non-executable Stripe account, webhook, tax/legal, refund, deployment,
preflight, and rollback gate is [`docs/stripe-live-activation.md`](stripe-live-activation.md).
Every item remains unchecked; the checklist neither supplies secrets nor authorizes LIVE.

Regressions: `packages/billing/test/live-mode.test.ts` (the resolver's contract) and the
`live-mode authorization sourced from configuration (D5)` block in
`packages/billing/test/stripe-checkout.test.ts` (both ends, against the real paths).

## Contracts

| Contract | Module | JSON Schema |
|---|---|---|
| `User`, `RoleAssignment`, `Session`, `Principal` | `packages/schemas/src/identity.ts` | `contracts/identity.schema.json` |
| `CreditAccount`, `CreditLedgerEntry` | `packages/schemas/src/credits.ts` | `contracts/credit-ledger.schema.json` |
| `StripeCustomerLink`, `CheckoutSessionIntent`, `CheckoutCompletedEvent` | `packages/schemas/src/billing.ts` | `contracts/billing-checkout.schema.json` |
| `CreditPack`, `CreditPackRevision`, `CreditPackCatalogArchive` | `packages/schemas/src/billing.ts` | `contracts/credit-packs.schema.json` |
| `EntitlementDecision` | `packages/schemas/src/entitlements.ts` | `contracts/entitlement-decision.schema.json` |
| `CreatorShareRecord`, `MoneySplitRecord` | `packages/schemas/src/revenue-share.ts` | `contracts/revenue-share.schema.json` |
| `ConnectAccountRecord`, `ConnectOnboardingIntent`, `ConnectStatusRecord`, `ConnectPayoutIntent`, `ConnectPayoutOutcome` | `packages/schemas/src/stripe-connect.ts` | `contracts/stripe-connect.schema.json` |

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

The umbrella's own starter grant (`createBillingCreditsAdapter` in
`sites/umbrella/src/lib/identity-plane.ts`) still commits it with `appendEntry` plus a
re-read of the ledger, the idiom the webhook path left behind. That is a **recorded gap,
not a second sanctioned pattern**: captain decision D4 scopes its invariant to webhook
grants, and this path is not one. Moving it onto `appendOrReplayEntry` needs no new
authority and would delete the re-read the same way.

## Metering

`meterCredits` namespaces the caller's idempotency key by account before it reaches the
ledger: `usage:<accountId>:<callerKey>`. Replay is a *per-account* question in the pure
ledger, but `idempotency_key` uniqueness is **global** in both the database and the
in-memory store, so a bare caller key such as `usage:turn_01` would make one account's
committed debit collide with a different account's legitimately distinct usage — refusing
as a store failure rather than metering it. Every other producer in this plane already
namespaces by identity (`starter:<userId>`, `sale:<saleId>:buyer`, `stripe-event:<id>`);
metering is scoped the same way so the pure check and the persisted constraint agree.

The debit itself is committed through `appendOrReplayEntry`, and a stale supplied state is
reconciled against persistence before it is refused — see *The credit persistence boundary*
above for what counts as a replay and what stays a refusal.

## Hosted AI (sceneaxi#139)

`runMeteredModelCall` in `packages/billing/src/hosted-ai.ts` is the only path a hosted
model call may take to a debit. It adds no ledger, no second entitlement table, and no
provider abstraction — it fixes the order the two existing pieces run in:

1. **Kids** — denied by name before identity, provider, or ledger, on both routes
2. **Route** — `hosted` or `byo`, a closed enumeration with no default
3. **Hosted opt-in** — off unless a caller explicitly passes `{ enabled: true }`
4. **Current ledger** — the supplied ledger is loaded from persistence; absent or stale
   state refuses for every principal
5. **Replay** — the account-scoped key is looked up before the balance and the provider
6. **Entitlement** — capability, account, and the **current persisted balance**, all
   before the provider
7. **Metering readiness** — store, reason, and key, still before the provider
8. **Provider** — the injected call, and only now
9. **Debit** — exactly the credits the decision named, through `meterCredits`

Steps 6 and 8 in that order are why a zero or insufficient balance costs nothing and
appends nothing: the refusal is `CREDIT_BALANCE_INSUFFICIENT`, produced before the provider
runs. A provider throw is `HOSTED_AI_PROVIDER_FAILED` with no debit; a ledger or store
failure keeps its own reason, and the debit is all-or-nothing either way.

**A retry is answered from the debit it already made after refreshing the ledger.** The
ledger's own idempotency check lives at the bottom of the stack, *below* both the balance
gate and the provider, so
relying on it alone would break the retry it is supposed to protect: a caller that timed
out and re-sent `turn_01` would be refused `CREDIT_BALANCE_INSUFFICIENT` out of the balance
its own first attempt had already spent, and would have paid the upstream provider a second
time for an answer no ledger row could cover. Step 5 looks `usage:<accountId>:<callerKey>`
up first. On a hit the call returns `replayed: true` carrying the prior debit, the ledger,
and the balance — **no provider execution and no second charge** — and entitlement is
re-evaluated against the ledger as it stood immediately before that debit, so capability,
identity, ownership, and the guard's own refusals still apply to a retry while the
already-answered balance question is not asked again. A key re-sent with a different price
or reason is still a `CREDIT_IDEMPOTENCY_KEY_CONFLICT`. The replayed outcome deliberately
carries **no `response`**: the ledger persists debits, not model answers, so the original
response is gone and the gate will not fabricate one — the `MeteredModelCallReplayed` shape
has no field to read it from. The BYO route is excluded from steps 4 and 5: it never appends a
debit, and a free call is safe to simply run again.

**The retry lookup requires the caller's current persisted state.** Step 4 loads the
supplied account through the injected `CreditStore` and compares the complete ledger before
any key lookup. A timed-out caller still holding the pre-debit view must refresh before it
retries; re-sending that stale view refuses `CREDIT_LEDGER_STATE_INVALID` before the
provider.
A store that cannot be read refuses `CREDIT_STORE_FAILED` at the same boundary. Once the
state is current, step 5 can return the prior debit without dispatch or another charge.

**The balance gate and debit judge the same current ledger.** A stale or fabricated state
refuses before either is reached, even when persistence still holds enough credits and even
for the captain's unlimited allowance. `meterCredits` receives the state step 4 already
matched to persistence. The race left is this same key committing between step 4's read and
step 9's append — two concurrent requests sharing one scoped key, each seeing no debit at
step 5 and each entering the provider. Exactly one debit exists afterwards, because step 9
commits through `appendOrReplayEntry` and reconciles a state that persistence has already
moved past; the loser of that race is answered from the committed row rather than refused.
Its outcome is still a `MeteredModelCallCompleted` — the provider *was* entered, so
`replayed` stays `false` and the `response` is real — and the debit's own answer is reported
separately as **`debitReplayed: true`**, so a caller can tell "this call appended the charge"
from "this call's charge was already in the ledger". Nothing else about that shape changes:
the `entry`, `state`, and `balance` reported are the ledger's own.

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
which the credit gate enters *after* the ledger is judged. Below it, `runMeteredModelCall`
still denies `KIDS_COMMERCE_DENIED` and the port still denies a Kids profile
non-overridably. Three independent denies, per the invariant in *Kids isolation*.

**A hosted balance is read, never remembered.** Each hosted turn re-reads the ledger through
the injected credits view and hands it to the credit gate, which requires an exact match to
persistence. An absent or stale ledger refuses `CREDIT_LEDGER_STATE_INVALID` before the
transport for every principal, including the captain. A ledger the panel cannot
read, or one that is invalid or owned by another user, is a named refusal
(`ASSISTANT_CREDITS_UNAVAILABLE`, `CREDIT_LEDGER_STATE_INVALID`,
`ASSISTANT_LEDGER_OWNER_MISMATCH`) and never `0`. Identity, entitlement, and metering
refusals are left to the layer that owns their vocabulary: an anonymous hosted turn is
`ENTITLEMENT_ACCOUNT_REQUIRED`, an expired session is `AUTH_SESSION_EXPIRED`, and a hosted
turn with no `turnId` is `CREDIT_REQUEST_INVALID` — the panel repeats none of them.

*No* ledger — no credits view wired, or the deployment's own `CreditStore` holding none for
this user — is handed over with no `state` rather than restated as panel policy. The billing
boundary refuses it in its own vocabulary for every hosted principal.

That fall-through is why the panel reads a ledger only where the gate would reach one. The
hosted route being off, Kids, and every identity refusal are all ordered *above*
`resolveHostedLedger` inside `runMeteredModelCall`, so the panel asks `requireAuthenticated`
— the same guard, on the same `{ now, surface, admin }` — purely to decide whether to read,
never to refuse. Where it declines, no credits view is consulted and the turn is handed over
with no `state`, so the controlling identity refusal is spoken by its owner instead of being
buried under a panel-owned one. Every authenticated hosted principal proceeds to the shared
current-ledger requirement.

The balance a snapshot *reports* comes only from an outcome the gate derived from
persistence, never from the view the panel was handed — otherwise a stale copy would be
published next to the very refusal that proves it wrong, telling a buyer they hold credits
the ledger says they already spent. Before a turn has been priced there is no authoritative
balance and the panel reports none.

**A retried turn is refused, not re-answered.** After the credits view refreshes, the gate
replays the debit
(`assistant-turn:<turnId>`, then account-scoped by `meterCredits`) with no provider
execution and no second charge, and it carries no `response` because the ledger records
debits, not model answers. The panel reports `ASSISTANT_TURN_ALREADY_CHARGED` and reports
the current balance rather than fabricating the lost reply.

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

Canonical archive: `packages/schemas/contracts/credit-packs.fixtures.json`. Each immutable
row in `packRevisions` has a stable `revisionId`; `currentRevisionIds` is the only current
catalog index. Repricing appends a row and moves that pack's current pointer. An appended
row must carry a Stripe price id no revision has ever used — uniqueness is enforced across
the whole archive, not just the current pointers — so even a credits-only change needs a new
Stripe price object rather than the already-paid one, which is what keeps the anchor tuple
resolving to exactly one row. Retirement
removes the pointer but retains the row. The table below shows only the current pointers
and is kept in exact lockstep by `pnpm check:contracts` — edit the JSON, then the table.

That immutability is **enforced**, not merely documented: `CREDIT_PACK_REVISION_DIGESTS` in
`scripts/check-contracts.mjs` pins one SHA-256 per revision over its economic tuple
(`revisionId`, `packId`, `credits`, `unitAmount`, `currency`, `stripePriceId`), and
`pnpm check:contracts` fails in three directions — an altered pinned row, a revision that
carries no pin, and a pinned row that was deleted. The table check alone cannot cover this,
because it is built from `currentRevisionIds` and a superseded or retired revision has left
that index; the fixture/module comparison alone cannot either, since it only proves the two
copies agree. So appending a revision is a deliberate contract change that adds its digest,
while editing an archived one fails the gate even when fixture and bundled module are
changed together (`tests/contracts/injected-credit-pack-drift.test.ts`).

`resolveCreditPackRevision(itemId, stripePriceId, unitAmount)` resolves only against that
bundled committed archive. It accepts lookup keys, never a caller-supplied pack or archive,
and refuses `BILLING_CATALOG_REVISION_UNRESOLVABLE` when the tuple has no retained row.
`applyCheckoutCompletedGrant` performs the D2 grant-time check before it calls the ledger:
a resolved revision priced in a currency the completion does not settle refuses that same
`BILLING_CATALOG_REVISION_UNRESOLVABLE`, a known revision whose credits differ from the
completion refuses `BILLING_CATALOG_REVISION_CREDITS_MISMATCH`, while a valid current or
retained revision uses the archive row's credits for the grant. `persistCheckoutCompletedGrant` inherits the
same refusal before its commit boundary, so unknown or inflated intent values cannot mutate
the ledger.

The archive shape was chosen over a `createdAt` grace window because persisted intents
already carry the exact `(itemId, stripePriceId, unitAmount)` anchor. Time alone cannot
prove which values were current, and a bounded window would make correctness depend on
webhook and deployment timing instead of retaining the paid revision.

`loadCreditPackCatalog()` reads the fixture's bundled twin,
`packages/schemas/src/credit-packs.data.ts` (`CREDIT_PACK_CATALOG_DATA`), rather than the
JSON file: the same catalog is loaded inside a bundled serverless site, where a
package-relative file read is not guaranteed to be traced into the deployment. That module
is held byte-for-byte against the fixture by the same `pnpm check:contracts` run, so it is
a third lockstep artifact, never a second source of truth. With the digest pin above there
are four edits for a new revision, in order: the JSON, the table, the module, then the
revision's digest in `CREDIT_PACK_REVISION_DIGESTS`.

Only **test-mode** price ids are committed. Live price ids belong to a later captain
go-live decision.

<!-- credit-packs:list -->
| pack | revision | credits | price | stripe test price id |
|---|---|---|---|---|
| `starter` | `starter-v1` | 100 | 500 USD minor units | `price_test_starter_100` |
| `maker` | `maker-v1` | 500 | 2000 USD minor units | `price_test_maker_500` |
| `studio` | `studio-v1` | 2000 | 7000 USD minor units | `price_test_studio_2000` |
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

**Money splits are bookkeeping only.** The
`MoneySplitRecord` contract *refuses* any field that could describe a payout
(`payout`, `transfer`, `destination`, `connectAccountId`, …) — a record shaped like a
payout instruction would invite one to be attempted. Stripe Connect is a separate,
append-only audit path over a validated split; it never widens this record.

**A money split is built from verified evidence, never from arguments** (sceneaxi#127).
`recordMoneySale` takes exactly two pieces of evidence — a runtime-witnessed
`VerifiedCheckoutCompletion` and the persisted `CheckoutSessionIntent` that completion was
bound to — beside the captain `liveModeAuthorized` gate, which authorizes nothing else.
There is no parameter for a gross, a currency, a buyer, a mode, a listing, or a sale id, so
a caller cannot book a split for a sale nobody paid — the older shape, which accepted an
arbitrary listing plus a caller-asserted buyer and mode, could. Where each figure comes from:

| field | source | if it disagrees |
|---|---|---|
| `grossMinor`, `currency` | the persisted intent — the immutable price snapshot | — |
| `buyerUserId`, `mode`, `occurredAt` | the verified completion | — |
| `saleId` | read out of the intent's `sale:<saleId>` idempotency key | `STRIPE_CHECKOUT_INTENT_INVALID` |
| `listingId`, `creatorUserId` | the committed catalog, resolved by the completion's item id | `LISTING_UNKNOWN` |
| the completion's provenance | `parseCheckoutCompletedEvent` | `STRIPE_COMPLETION_NOT_VERIFIED` |
| the intent↔completion binding | all eight price-bearing fields compared | `STRIPE_CHECKOUT_INTENT_INVALID` |

The key is itself bound to the settlement: `intentId` is the intent field the completion
pins, and every real intent derives it from its own idempotency key, so the key is
re-derived and compared before the sale id is read out of it — renaming the key onto
another sale refuses. A listing the seller never priced in money refuses
`LISTING_CURRENCY_NOT_LISTED`, and a `credit-pack` completion refuses
`STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED` rather than booking a split for a purchase that
settles on the ledger. `mode` comes from the completion and still passes
`assertModeAuthorized`, so a live settlement refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED`
without an explicit captain `liveModeAuthorized`. `occurredAt` is the settlement's own
time rather than the recorder's clock, so re-recording the same completion produces an
identical row.

Both credits paths are idempotent on the sale id (`sale:<saleId>:buyer` / `:creator`), so a
replay moves nothing, and neither key can reach persistence except through
`settleCreditsSale` — see *The credit persistence boundary* above. `recordMoneySale`
still constructs a pure `MoneySplitRecord`, and no credits or checkout path persists one.

Captain decision D4 recorded that atomic persistence for `MoneySplitRecord` was not
selected and remained an unauthorized gap before any Connect work. For the accepted
SA-CON-1 creator-payout package (sceneaxi#199) the captain **superseded** that
prohibition, and only to the width described here; the disposition row in
[`NEXT-STEP.md`](program/NEXT-STEP.md) restates the same supersession. What is
authorized is the narrower durable boundary `commitPayoutIntent`: it atomically appends
one validated split together with its exact creator-leg payout intent before a provider
call, and nothing else. It is not a general money-settlement store — it commits only a
split a `ConnectPayoutIntent` is bound to field by field, it is reachable only from the
authenticated TEST-only Connect seam, and D4's general statement stands everywhere else:
a deployment that wants money splits durable outside this path still owns that write. A success can be appended only
from strict provider evidence, and retry reads the existing outcome before dispatch.
All Connect operations are TEST-only and require explicit provider, dashboard, secret,
and operations readiness. LIVE remains refused and is only the uncompleted checklist in
[`docs/stripe-connect-operations.md`](stripe-connect-operations.md).

## Fixture commerce (sceneaxi#138)

The credits primitives above take a `CatalogListing` **value**, which is right for a
mechanism and wrong for an offer: a caller holding a hand-built listing object could
transact against a SKU nobody published. What was missing was a statement of what is
actually for sale. `packages/billing/src/fixture-commerce.ts` is that statement, and it is a
closed enumeration of exactly **one** dual-priced fixture SKU.

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
4. **Only an enumerated SKU, at the price it carries, may be settled.**
   `settleFixtureListingMoneySale` takes the same two arguments `recordMoneySale` does — a
   runtime-witnessed completion and the persisted intent it was bound to — and every check
   that makes the record evidence-bound belongs to that primitive, not to a second copy here.
   What this path adds is the offer: the settled item must be one of
   `FIXTURE_COMMERCE_LISTING_IDS`, and the settled amount must be the price that listing
   actually carries, so a real payment for an inert SKU still books nothing. A
   `MoneySplitRecord` on this path can therefore only describe money a signature-verified
   Stripe **test** settlement actually took, for an enabled SKU, at the price the seller
   listed.

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
- The umbrella's Neon session mapping (`provider-adapters.ts`) carries that constraint's
  deny in code, on both halves: it refuses to write a `kids` session and refuses to build
  one out of a row, rather than handing a Kids surface up to `@sceneaxi/auth` to reject.

Additionally, nothing depends on or imports `@sceneaxi/profile-kids`, enforced independently
of allow lists by `pnpm check:boundaries`.

## Held keys are unchanged

This plane is **product** user authentication. It does not replace, weaken, or interact
with held-key captain policy ([`held-key-enforcement.md`](held-key-enforcement.md)), and
this vertical adds no CLI verb. Machine/agent CLI behavior is untouched.

## Deployment activation

The deployable HTTP surface is `sites/umbrella`, wired to this plane through one plug
point. Its `provider-adapters.ts` provides the Neon `IdentityStore` and
`CreditStoreAdapter` (wrapped by `createCreditStore`), provisions one credit account per
user at authentication, and provides the TEST Stripe checkout/evidence adapters. The
existing webhook route passes the **raw** body to `verifyStripeWebhookSignature` and
commits through `persistCheckoutCompletedGrant`.

Two distinct things remain, and only the first is deployment authority: apply the forward
migrations, set the named Better Auth/Neon/Stripe TEST variables, and register the
card-only webhook. Missing providers continue to refuse by name.

One further deployment obligation is specific to `settleCreditsSale`: `creator_share_records.listing_id`
is `NOT NULL REFERENCES catalog_listings (listing_id)`, and this repository seeds no
`catalog_listings` row — the shipped listing set is the bundled `catalog-listings.data.ts`
module, not a table. So a Neon settlement additionally requires the deployment to seed that
table from the committed listing set, or the transaction fails the foreign key. No umbrella
route reaches that path today — none of `/login`, `/api/login`, `/api/logout`,
`/api/checkout`, `/api/stripe/webhook`, or the TEST-only
`/api/editor/catalog-intake` ([`catalog-intake.md`](catalog-intake.md), which records
metadata and moves no money)
does — so the store method is wired ahead of the catalog-sale surface that
would call it, and its gate tests run against an in-memory fake that enforces no constraint.

The second is no longer code in this repository: the sign-in surface
[sceneaxi#185](https://github.com/Vhailors/sceneaxi/issues/185) called for has landed. The
umbrella serves `/login` beside `POST /api/login`, `POST /api/logout`, `/api/checkout`, and
`/api/stripe/webhook`, and `performLogin` reaches `identityPort.signIn` — and therefore
`putSession` — through `createAuthLoginAdapter`, the login-port counterpart to the
verify-only `createAuthIdentityAdapter`. What remains is the deployment's own: serve Better
Auth's own handler and configure the handles behind `umbrellaRequestAuthority()`. Until
it does, `signIn` has no adapter to reach, so no user is provisioned, no starter grant
runs, and every surface refuses by name. Dropping the editor preview flag comes after
that provider configuration, never before it.
The deployable-site mechanics and surface status are owned by
[`websites-deploy.md`](websites-deploy.md#activation-mechanics). The operator
authorization gate, ordered activation/rollback procedure, and evidence checklist are
owned by [`production-activation.md`](production-activation.md).
