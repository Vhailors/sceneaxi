# Stripe LIVE activation checklist

**Status: NOT AUTHORIZED — DO NOT EXECUTE.** This is a readiness checklist, not an
activation instruction. SceneAxi ships a Stripe **TEST-only** credit-pack path. No shipped
adapter accepts a LIVE key, and no shipped call site supplies the separate live-mode
authorization witness. Completing this list records readiness; it does not authorize a
charge, a deployment, or a configuration change.

No secret value belongs in this file, an issue, a pull request, a test fixture, a log, or
an evidence bundle. Record only provider object ids and secret *names*, redacting values.

Scope: direct SceneAxi credit-pack sales only. Creator onboarding, Stripe Connect accounts,
transfers, and payouts remain SA-CON-1 and are not prerequisites that this checklist may
silently implement.

## Authorization phase boundary

This list has two strictly ordered phases. **PRE-AUTH** items are evidence-only readiness
work that cannot create a LIVE Stripe object, accept a charge, or change production.
After every PRE-AUTH item is evidenced, finance/tax/legal, security, support, and operations
sign off and the captain may issue the separate recorded go-live decision. Only then may an
operator execute an item marked **POST-AUTH**. No POST-AUTH item is a prerequisite for that
decision, and no checklist item substitutes for it. If authorization is withheld, every
POST-AUTH box stays unchecked indefinitely.

## Stripe account and LIVE products

- [ ] **POST-AUTH** — Activate the merchant's Stripe account with the correct legal entity, public
  business details, support contacts, statement descriptor, settlement currency, and
  payout bank account. Record the Stripe account id, never a key.
- [ ] **POST-AUTH** — Complete Stripe's required identity/business verification and resolve every account
  capability restriction before accepting a payment.
- [ ] **POST-AUTH** — Create one LIVE one-time Price for every current credit-pack revision. Record each
  public `price_…` id and its product id; never copy a TEST price into LIVE.
- [ ] **POST-AUTH** — Append LIVE catalog revisions through the existing credit-pack archive contract,
  pin their digests, and run `pnpm check:contracts`. Do not rewrite or delete TEST or paid
  historical revisions.
- [ ] **PRE-AUTH** — Confirm the Checkout Session design remains restricted to `payment`, quantity `1`, and card-only until
  delayed-payment grant semantics are separately designed and tested.
- [ ] **PRE-AUTH** — Confirm the planned hosted Checkout branding, support link, cancellation copy, receipt
  settings, and statement descriptor in a non-charging review.

## Webhook and settlement safety

- [ ] **POST-AUTH** — Create a distinct LIVE endpoint at the canonical umbrella origin:
  `POST /api/stripe/webhook`. Subscribe only to event types the code handles, and to **all**
  of them; today that is `checkout.session.completed` for credit grants and
  `charge.refunded` for full-refund reconciliation. An unsubscribed handled type is not a
  fail-closed state: the event is never delivered, so nothing refuses and the reconciliation
  it owns silently never runs.
- [ ] **POST-AUTH** — Store the LIVE endpoint signing secret under `STRIPE_WEBHOOK_SECRET` in the deployment
  secret store. Do not reuse the TEST endpoint secret and do not reveal either value.
- [ ] **PRE-AUTH** — Prove raw-body signature verification, timestamp tolerance, persisted-intent lookup,
  Checkout Session id binding, paid status, amount/currency/quantity/Price equality, and
  committed archive resolution against a non-production fixture.
- [ ] **PRE-AUTH** — Prove a duplicate Stripe event id returns a replay and appends no second ledger row;
  prove a mutated replay refuses; prove an unavailable store or evidence adapter returns a
  retryable non-2xx rather than acknowledging an uncommitted grant.
- [ ] **PRE-AUTH** — Define alerting for webhook 4xx/5xx, event delivery age, repeated retries, missing
  intents, settlement mismatch, catalog-revision refusal, and credit-store failure. Name
  an operator and response window.
- [ ] **PRE-AUTH** — Confirm the TEST endpoint's health after a controlled TEST replay. A provider dashboard
  success is not grant evidence; the append-only ledger row is.

## Tax, legal, support, and refunds

- [ ] **PRE-AUTH** — Obtain written legal/tax review identifying the seller of record, sale jurisdiction,
  credit classification, VAT/sales-tax treatment, invoice/receipt duties, and required
  registrations. Do not infer tax treatment from Stripe configuration.
- [ ] **PRE-AUTH** — Approve publication-ready Terms, Privacy, pricing, credit expiry/non-expiry, cancellation,
  refund, complaint, and support policies for every country offered. The UI and Checkout
  links must match those policies before a real buyer can pay.
- [ ] **PRE-AUTH** — Decide whether Stripe Tax is required; if it is, define registrations, product tax
  codes, tax behavior, customer address collection, and reporting, then verify calculated
  totals in every enabled jurisdiction.
- [ ] **PRE-AUTH** — Approve a refund policy that distinguishes returning money from returning credits.
  The current TEST webhook reconciles a signature-verified full refund through the
  persisted intent and a new append-only adjustment; it cannot rewrite or delete the grant.
- [ ] **PRE-AUTH** — Before LIVE, validate that refund reconciliation binds provider
  evidence to the original paid intent and appends a new idempotent append-only adjustment.
  It must never edit/delete the grant, invent a balance, permit a negative ledger, or treat
  a money refund as a hosted-AI credit debit. Partial refunds and already-spent credits need
  explicit product/legal decisions and named refusals.
- [ ] **PRE-AUTH** — Document chargeback/dispute handling separately from voluntary refunds, including
  evidence retention, account access policy, ledger reconciliation, and support escalation.

## Deployment and data prerequisites

- [ ] **POST-AUTH** — Apply every forward-only migration in `db/migrations` to the target Neon database;
  verify the append-only trigger, unique ledger idempotency key, checkout-intent price
  immutability, and provisioned credit accounts. Never invent an account from a webhook.
- [ ] **PRE-AUTH** — Deploy current green `main` to an isolated pre-production environment and prove
  `/login`, `/pricing`, `/account`, `POST /api/checkout`, and
  `POST /api/stripe/webhook` through the no-argument request-authority facade.
- [ ] **PRE-AUTH** — Prove the planned canonical HTTPS `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN`; checkout success
  and cancel redirects use it rather than a request `Host` or preview alias.
- [ ] **PRE-AUTH** — Verify the deployment secret store contains the correct TEST-scoped names:
  `DATABASE_URL`, `BETTER_AUTH_ORIGIN`, `SCENEAXI_ADMIN_EMAIL`,
  `SCENEAXI_ADMIN_BOOTSTRAP_SECRET`, `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET`. Inspect presence and scope only; never print values.
- [ ] **PRE-AUTH** — Keep `SCENEAXI_BILLING_MODE` set to `test` throughout readiness work. A later LIVE
  deployment would set it to `live`, but mode selection is not authorization.
- [ ] **PRE-AUTH** — Leave `SCENEAXI_STRIPE_LIVE_AUTHORIZED` unset until the captain's separate recorded
  decision. If authorized later, its exact contract remains
  `live-mode-authorized:<email>:<YYYY-MM-DD>` with the required audit sink described in
  `docs/auth-credits.md`; setting it alone still enables nothing.
- [ ] **POST-AUTH** — Make the deliberate reviewed code change that injects the runtime-witnessed live
  authorization at both intent creation and grant settlement. This repository currently
  has no such call site and must continue to refuse LIVE until that change lands green.
- [ ] **POST-AUTH** — Replace the TEST-only provider adapter guard with an exact LIVE-aware key-scope check
  only in that authorized change. Never accept an arbitrary `sk_` prefix or log the key.

## Preflight evidence and rollback

- [ ] **PRE-AUTH** — Run `pnpm gate` with no provider credentials. The hermetic gate must stay green and
  must not require network, Stripe, Neon, or Better Auth.
- [ ] **PRE-AUTH** — Run the complete TEST purchase proof: signed-in buyer, exact committed pack display,
  persisted intent before redirect, TEST Checkout, signed webhook, one committed grant,
  duplicate-event replay, insufficient/invalid ledger refusal, missing-provider refusal,
  and refund-event non-mutation.
- [ ] **PRE-AUTH** — Obtain security, finance/tax/legal, support, and operations sign-off
  with named owners and dated evidence. Present only the PRE-AUTH evidence for the separate
  captain LIVE decision; checklist completion is not a substitute.
- [ ] **PRE-AUTH** — Define stop conditions before activation: webhook backlog, grant/store mismatch,
  unexpected tax result, refund reconciliation failure, elevated disputes, or any secret
  exposure. Assign an incident commander and communication channel.
- [ ] **PRE-AUTH** — Define rollback as disabling new Checkout creation and returning the billing plane to
  named refusal while preserving intents and the append-only ledger. Never roll back by
  deleting or editing a paid grant, and never disable webhook receipt before all already-paid
  sessions are reconciled.
- [ ] **POST-AUTH** — After the authorized deployment, make one separately approved low-value LIVE canary,
  verify the receipt, webhook, intent, ledger grant, support path, tax result, and refund
  reconciliation end to end, then require a human go/no-go before wider availability.

Authoritative mechanics remain in `docs/auth-credits.md`; deployment wiring and current
TEST readiness remain in `docs/websites-deploy.md`. If either disagrees with this checklist,
the narrower authoritative contract wins and activation stops until the documents agree.
