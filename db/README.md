# Neon Postgres migrations

Schema for the SceneAxi identity + credits plane. Configuration and the wider ownership
map live in [`docs/auth-credits.md`](../docs/auth-credits.md).

## Apply order

Forward-only, in numeric order:

1. `migrations/0001_identity.sql` — `users`, `role_assignments`, `sessions`
2. `migrations/0002_credits_billing.sql` — `credit_accounts`,
   `credit_ledger_entries`, `stripe_customer_links`, `checkout_session_intents`,
   `catalog_listings`, `creator_share_records`, `money_split_records`
3. `migrations/0003_checkout_session_intent_price_immutability.sql` — checkout intent price immutability trigger
4. `migrations/0004_stripe_connect_audit.sql` — `stripe_connect_accounts`,
   `stripe_connect_onboarding_intents`, `stripe_connect_status_records`,
   `stripe_connect_payout_intents`, `stripe_connect_payout_outcomes`, and the
   append-only triggers those tables share with `money_split_records`
5. `migrations/0005_better_auth_provider.sql` — provider-owned Better Auth
   `better_auth_users`, `better_auth_sessions`, `better_auth_accounts`, and
   `better_auth_verifications`; these are distinct from SceneAxi identity rows

There are no down-migrations. Reverting a financial schema by dropping tables loses the
ledger, so a correction ships as a new forward migration.

## Why this lives at the repo root

One Neon database serves both `@sceneaxi/auth` and `@sceneaxi/billing`. Splitting the
migration sequence across two package directories would make apply order ambiguous, and
apply order is the one thing a migration set cannot get wrong.

## Why plain SQL and not an ORM

SceneAxi packages carry no runtime database dependency, exports are source-backed, and
`pnpm gate` is hermetic — it runs with no `DATABASE_URL` and no network. Versioned SQL fits
that; an ORM schema would put a driver in the dependency graph to describe tables no
package connects to. Recorded in ADR 0021.

## Invariants the database enforces itself

The application enforces these too. Neither layer is the only thing standing between the
plane and a bad row.

| Invariant | How |
|---|---|
| A user row has no role at all | `users` has no `role` column — there is nothing for a write path to set |
| At most one admin, ever | partial unique index `role_assignments_single_admin` |
| `admin` only from the environment | check constraint `role <> 'admin' OR source = 'admin-env'` |
| No Kids session can be stored | `'kids'` is absent from the `sessions` surface check |
| No raw token can be stored | only `token_digest char(64)` exists, shape-checked as hex |
| Balance cannot drift | `credit_accounts` has no balance column |
| Ledger is append-only | `BEFORE UPDATE OR DELETE` trigger raises `restrict_violation` |
| A replay cannot become a second row | unique index on `idempotency_key` |
| Sequences cannot fork | unique index on `(account_id, sequence)` |
| A listing price matches its mode | cross-field check constraints per price mode |
| A split cannot create or destroy value | `creator + platform = gross` check constraints |
| Only a 50/50 creator split | `basis_points = 5000` check constraint |
| Money bookkeeping cannot masquerade as payout | `money_split_records` has no payout/transfer/destination column |
| Connect audit history is immutable | all five Connect tables and `money_split_records` have append-only triggers |
| No payout success without provider evidence | outcome constraint requires both provider evidence and a provider payout id |
| At most one payout per sale | `stripe_connect_payout_intents.sale_id` is `UNIQUE`, so a fresh idempotency key cannot buy a second payout |
| A checkout redirect is never plaintext | `success_url LIKE 'https://%'` check |
| Provider credentials cannot become a second SceneAxi role source | Better Auth tables contain no role column and remain separate from `role_assignments` |
| One provider account per authentication method | unique `(userId, providerId)` and `(providerId, accountId)` constraints |

## Connecting

`DATABASE_URL` comes from the environment only — never a committed file, never a default.
`.env.example` lists the name and nothing else. Applying these migrations against a live
Neon branch needs credentials and is separate authority; `pnpm gate` never touches a
database.

The contract ↔ DDL lockstep is verified without a database by
`tests/db/schema-lockstep.test.ts`, so a contract field added without a column (or the
reverse) fails the gate.
