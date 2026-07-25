# Auth + credits plane

Contracts for SceneAxi identity, credits, and billing. Behavior and configuration
sections land with the rest of the vertical; this document is the canonical home for the
credit pack catalog and is enforced by `pnpm check:contracts`.

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

## Held keys are unchanged

This plane is **product** user authentication. It does not replace, weaken, or interact
with held-key captain policy ([`held-key-enforcement.md`](held-key-enforcement.md)), and
this vertical adds no CLI verb.
