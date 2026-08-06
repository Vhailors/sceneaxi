# Stripe Connect creator operations

Scope: SA-CON-1 provides the typed creator onboarding, account-status, and payout
bookkeeping mechanism. It does not configure Stripe, deploy an adapter, create an
account, or authorize LIVE activity.

## Shipped boundary

`packages/billing/src/stripe-connect.ts` is the application seam. Every operation:

1. refuses Kids and authenticates a runtime-issued principal;
2. requires the creator id to equal the authenticated user's id;
3. accepts only an injected provider whose readiness says `mode: "test"`, TEST
   operations enabled, dashboard configured, and secret configured;
4. reads or appends through the injected `ConnectStore`; and
5. catches provider and persistence failures as named refusals.

No provider credential crosses the seam. The provider receives only account ids,
minor-unit amounts, currency, sale ids, and idempotency keys.

| missing or unsafe state | refusal |
|---|---|
| provider absent | `STRIPE_CONNECT_PROVIDER_MISSING` |
| LIVE provider or LIVE money split | `STRIPE_CONNECT_LIVE_UNAVAILABLE` |
| TEST operations not explicitly enabled | `STRIPE_CONNECT_TEST_OPERATIONS_DISABLED` |
| dashboard configuration absent | `STRIPE_CONNECT_DASHBOARD_MISSING` |
| provider secret absent | `STRIPE_CONNECT_SECRET_MISSING` |
| provider refuses or throws | `STRIPE_CONNECT_PROVIDER_REFUSED` |
| malformed provider success | `STRIPE_CONNECT_PROVIDER_RESPONSE_INVALID` |
| Connect account/status/payout capability absent | the corresponding named `STRIPE_CONNECT_*` refusal |

## Audit and idempotency

The versioned record contract is
`packages/schemas/contracts/stripe-connect.schema.json`; forward-only DDL is
`db/migrations/0004_stripe_connect_audit.sql`.

- Account, onboarding intent, status observation, payout intent, and payout outcome
  are separate immutable records.
- The single-use onboarding URL is returned to the authenticated caller but is not
  persisted. Its intent, expiry, provider request id, account id, and idempotency key
  are persisted.
- Onboarding retries call the provider with the same idempotency key and replay the
  same stored intent. Status observations key on provider request evidence.
- `commitPayoutIntent` atomically stores the validated `MoneySplitRecord` and the
  exact creator-leg payout intent. A different split under the sale or idempotency
  key conflicts, and so does a second payout intent for a sale that already has one
  — the store holds one intent per `saleId`, mirroring `sale_id ... UNIQUE`, so a
  fresh idempotency key cannot buy a second provider payout for the same sale.
- A conflicting write is a typed signal, never message text: an adapter throws
  `ConnectStoreConflictError` (or any error carrying
  `code: CONNECT_STORE_CONFLICT_CODE`), which the seam refuses as
  `STRIPE_CONNECT_IDEMPOTENCY_CONFLICT`. Every other throw is a store failure. A
  durable adapter maps its unique-constraint violations onto that signal.
- A payout retry first reads the outcome for its committed intent. Once an outcome
  exists, the provider is not called again.
- A successful outcome requires both `providerEvidenceId` and `providerPayoutId` in
  the TypeScript validator and SQL constraint. A thrown call leaves only a pending
  intent. An evidenced provider refusal may append only a `failed` outcome, whose
  provider payout id must be null.

The money rule has not changed: creator share is
`floor(grossMinor × 5000 / 10000)` and the platform receives the remainder.
`MoneySplitRecord` remains bookkeeping evidence and still refuses payout-shaped
fields; Connect records reference it instead of widening it.

## LIVE activation checklist — not completed

Nothing in SA-CON-1 completes or authorizes these steps. Keep LIVE refused until a
separately authorized operator has verified every item with real credentials and
recorded the evidence outside source control:

- [ ] Captain/operator authority for LIVE onboarding, transfers/payouts, account
  creation, and spend is recorded.
- [ ] The real Stripe platform account and Connect dashboard configuration are
  verified, including country, capabilities, payout schedule, and responsible owner.
- [ ] LIVE restricted keys and webhook secrets exist in the deployment secret store;
  no value is copied into this repository, a log, fixture, or issue.
- [ ] The deployment adapter proves it is using LIVE endpoints and a real Connect
  account; TEST ids are rejected in that verification.
- [ ] Webhook authenticity and the provider evidence mapped into payout outcomes are
  verified against a real signed LIVE event.
- [ ] Idempotent retry and interrupted-call recovery are exercised without a second
  transfer or payout.
- [ ] Reconciliation, negative-balance, refund/dispute, tax, KYC, incident-response,
  and manual-stop procedures are owned and rehearsed.
- [ ] A separately reviewed code change introduces the explicit LIVE authorization
  witness. Changing provider readiness to `mode: "live"` alone must remain a refusal.

Until all items are independently verified, no product surface may claim LIVE creator
onboarding or a real successful payout.
