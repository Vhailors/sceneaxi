# Stripe LIVE activation checklist

**Status: NOT AUTHORIZED — DO NOT EXECUTE.** This is a readiness checklist, not an
activation instruction. SceneAxi ships a Stripe **TEST-only** credit-pack path. No shipped
adapter accepts a LIVE key, and no shipped call site supplies the separate live-mode
authorization witness. Completing this list records readiness; it does not authorize a
charge, a deployment, or a configuration change.

No secret value belongs in this file, an issue, a pull request, a test fixture, a log, or
an evidence bundle. Record only provider object ids and secret *names*, redacting values.
The captain must issue a separate go-live decision after every checkbox is evidenced.

Scope: direct SceneAxi credit-pack sales only. Creator onboarding, Stripe Connect accounts,
transfers, and payouts remain SA-CON-1 and are not prerequisites that this checklist may
silently implement.

## Stripe account and LIVE products

- [ ] Activate the merchant's Stripe account with the correct legal entity, public
  business details, support contacts, statement descriptor, settlement currency, and
  payout bank account. Record the Stripe account id, never a key.
- [ ] Complete Stripe's required identity/business verification and resolve every account
  capability restriction before accepting a payment.
- [ ] Create one LIVE one-time Price for every current credit-pack revision. Record each
  public `price_…` id and its product id; never copy a TEST price into LIVE.
- [ ] Append LIVE catalog revisions through the existing credit-pack archive contract,
  pin their digests, and run `pnpm check:contracts`. Do not rewrite or delete TEST or paid
  historical revisions.
- [ ] Keep the Checkout Session restricted to `payment`, quantity `1`, and card-only until
  delayed-payment grant semantics are separately designed and tested.
- [ ] Confirm the hosted Checkout branding, support link, cancellation copy, receipt
  settings, and statement descriptor in a non-charging review.

## Webhook and settlement safety

- [ ] Create a distinct LIVE endpoint at the canonical umbrella origin:
  `POST /api/stripe/webhook`. Subscribe only to event types the code handles; today that
  is `checkout.session.completed` for credit grants.
- [ ] Store the LIVE endpoint signing secret under `STRIPE_WEBHOOK_SECRET` in the deployment
  secret store. Do not reuse the TEST endpoint secret and do not reveal either value.
- [ ] Prove raw-body signature verification, timestamp tolerance, persisted-intent lookup,
  Checkout Session id binding, paid status, amount/currency/quantity/Price equality, and
  committed archive resolution against a non-production fixture.
- [ ] Prove a duplicate Stripe event id returns a replay and appends no second ledger row;
  prove a mutated replay refuses; prove an unavailable store or evidence adapter returns a
  retryable non-2xx rather than acknowledging an uncommitted grant.
- [ ] Configure alerting for webhook 4xx/5xx, event delivery age, repeated retries, missing
  intents, settlement mismatch, catalog-revision refusal, and credit-store failure. Name
  an operator and response window.
- [ ] Confirm Stripe's endpoint health after a controlled TEST replay. A provider dashboard
  success is not grant evidence; the append-only ledger row is.

## Tax, legal, support, and refunds

- [ ] Obtain written legal/tax review identifying the seller of record, sale jurisdiction,
  credit classification, VAT/sales-tax treatment, invoice/receipt duties, and required
  registrations. Do not infer tax treatment from Stripe configuration.
- [ ] Publish and approve Terms, Privacy, pricing, credit expiry/non-expiry, cancellation,
  refund, complaint, and support policies for every country offered. The UI and Checkout
  links must match those policies before a real buyer can pay.
- [ ] Decide whether Stripe Tax is required; if it is, configure registrations, product tax
  codes, tax behavior, customer address collection, and reporting, then verify calculated
  totals in every enabled jurisdiction.
- [ ] Approve a refund policy that distinguishes returning money from returning credits.
  The current TEST webhook grants credits but intentionally performs no automatic refund
  reversal: an unhandled refund event cannot rewrite or delete its original grant.
- [ ] Before LIVE, implement and validate an authorized refund reconciliation that binds
  provider evidence to the original paid intent and appends a new idempotent append-only adjustment.
  It must never edit/delete the grant, invent a balance, permit a negative ledger, or treat
  a money refund as a hosted-AI credit debit. Partial refunds and already-spent credits need
  explicit product/legal decisions and named refusals.
- [ ] Document chargeback/dispute handling separately from voluntary refunds, including
  evidence retention, account access policy, ledger reconciliation, and support escalation.

## Deployment and data prerequisites

- [ ] Apply every forward-only migration in `db/migrations` to the target Neon database;
  verify the append-only trigger, unique ledger idempotency key, checkout-intent price
  immutability, and provisioned credit accounts. Never invent an account from a webhook.
- [ ] Deploy current green `main` to an isolated pre-production environment and prove
  `/login`, `/pricing`, `/account`, `POST /api/checkout`, and
  `POST /api/stripe/webhook` through the no-argument request-authority facade.
- [ ] Set the canonical HTTPS `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN`; prove checkout success
  and cancel redirects use it rather than a request `Host` or preview alias.
- [ ] Verify the deployment secret store contains the correct scoped names:
  `DATABASE_URL`, `BETTER_AUTH_ORIGIN`, `SCENEAXI_ADMIN_EMAIL`,
  `SCENEAXI_ADMIN_BOOTSTRAP_SECRET`, `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET`. Inspect presence and scope only; never print values.
- [ ] Keep `SCENEAXI_BILLING_MODE` set to `test` throughout readiness work. A later LIVE
  deployment would set it to `live`, but mode selection is not authorization.
- [ ] Leave `SCENEAXI_STRIPE_LIVE_AUTHORIZED` unset until the captain's separate recorded
  decision. If authorized later, its exact contract remains
  `live-mode-authorized:<email>:<YYYY-MM-DD>` with the required audit sink described in
  `docs/auth-credits.md`; setting it alone still enables nothing.
- [ ] Make the deliberate reviewed code change that injects the runtime-witnessed live
  authorization at both intent creation and grant settlement. This repository currently
  has no such call site and must continue to refuse LIVE until that change lands green.
- [ ] Replace the TEST-only provider adapter guard with an exact LIVE-aware key-scope check
  only in that authorized change. Never accept an arbitrary `sk_` prefix or log the key.

## Preflight evidence and rollback

- [ ] Run `pnpm gate` with no provider credentials. The hermetic gate must stay green and
  must not require network, Stripe, Neon, or Better Auth.
- [ ] Run the complete TEST purchase proof: signed-in buyer, exact committed pack display,
  persisted intent before redirect, TEST Checkout, signed webhook, one committed grant,
  duplicate-event replay, insufficient/invalid ledger refusal, missing-provider refusal,
  and refund-event non-mutation.
- [ ] Obtain security, finance/tax/legal, support, and operations sign-off with named owners
  and dated evidence. Then obtain the separate captain LIVE authorization; checklist
  completion is not a substitute.
- [ ] Define stop conditions before activation: webhook backlog, grant/store mismatch,
  unexpected tax result, refund reconciliation failure, elevated disputes, or any secret
  exposure. Assign an incident commander and communication channel.
- [ ] Define rollback as disabling new Checkout creation and returning the billing plane to
  named refusal while preserving intents and the append-only ledger. Never roll back by
  deleting or editing a paid grant, and never disable webhook receipt before all already-paid
  sessions are reconciled.
- [ ] After the authorized deployment, make one separately approved low-value LIVE canary,
  verify the receipt, webhook, intent, ledger grant, support path, tax result, and refund
  reconciliation end to end, then require a human go/no-go before wider availability.

Authoritative mechanics remain in `docs/auth-credits.md`; deployment wiring and current
TEST readiness remain in `docs/websites-deploy.md`. If either disagrees with this checklist,
the narrower authoritative contract wins and activation stops until the documents agree.
