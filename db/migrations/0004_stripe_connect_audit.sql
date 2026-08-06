-- SA-CON-1: append-only Stripe Connect creator audit records.
--
-- This migration carries no credential and activates no provider. Application
-- code currently permits TEST operations only; LIVE remains an operator
-- checklist. A successful payout row requires both provider evidence and a
-- provider payout id, while its amount is pinned to the exact 50/50 money split.

CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
  creator_user_id    text        PRIMARY KEY REFERENCES users (user_id) ON DELETE RESTRICT,
  stripe_account_id  text        NOT NULL UNIQUE,
  mode               text        NOT NULL,
  provider_request_id text       NOT NULL UNIQUE,
  created_at         timestamptz NOT NULL,
  CONSTRAINT stripe_connect_accounts_mode_known CHECK (mode IN ('test', 'live'))
);

CREATE TABLE IF NOT EXISTS stripe_connect_onboarding_intents (
  onboarding_intent_id text        PRIMARY KEY,
  creator_user_id      text        NOT NULL REFERENCES stripe_connect_accounts (creator_user_id) ON DELETE RESTRICT,
  stripe_account_id    text        NOT NULL REFERENCES stripe_connect_accounts (stripe_account_id) ON DELETE RESTRICT,
  expires_at           timestamptz NOT NULL,
  mode                 text        NOT NULL,
  idempotency_key      text        NOT NULL UNIQUE,
  provider_request_id  text        NOT NULL,
  created_at           timestamptz NOT NULL,
  CONSTRAINT stripe_connect_onboarding_mode_known CHECK (mode IN ('test', 'live')),
  CONSTRAINT stripe_connect_onboarding_expiry_order CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS stripe_connect_status_records (
  status_id            text        PRIMARY KEY,
  creator_user_id      text        NOT NULL REFERENCES stripe_connect_accounts (creator_user_id) ON DELETE RESTRICT,
  stripe_account_id    text        NOT NULL REFERENCES stripe_connect_accounts (stripe_account_id) ON DELETE RESTRICT,
  onboarding_complete  boolean     NOT NULL,
  payouts_enabled      boolean     NOT NULL,
  requirements_due     text[]      NOT NULL,
  provider_request_id  text        NOT NULL UNIQUE,
  observed_at          timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_connect_payout_intents (
  payout_intent_id   text        PRIMARY KEY,
  sale_id            text        NOT NULL UNIQUE REFERENCES money_split_records (sale_id) ON DELETE RESTRICT,
  creator_user_id    text        NOT NULL REFERENCES stripe_connect_accounts (creator_user_id) ON DELETE RESTRICT,
  stripe_account_id  text        NOT NULL REFERENCES stripe_connect_accounts (stripe_account_id) ON DELETE RESTRICT,
  gross_minor        bigint      NOT NULL,
  creator_minor      bigint      NOT NULL,
  platform_minor     bigint      NOT NULL,
  currency           char(3)     NOT NULL,
  basis_points       integer     NOT NULL,
  mode               text        NOT NULL,
  idempotency_key    text        NOT NULL UNIQUE,
  requested_at       timestamptz NOT NULL,
  CONSTRAINT stripe_connect_payout_amounts_nonnegative CHECK (
    gross_minor >= 1 AND creator_minor >= 0 AND platform_minor >= 0
  ),
  CONSTRAINT stripe_connect_payout_balances CHECK (
    creator_minor + platform_minor = gross_minor
  ),
  CONSTRAINT stripe_connect_payout_ratio CHECK (
    creator_minor = floor((gross_minor::numeric * 5000) / 10000)
    AND platform_minor = gross_minor - creator_minor
  ),
  CONSTRAINT stripe_connect_payout_basis_points CHECK (basis_points = 5000),
  CONSTRAINT stripe_connect_payout_mode_known CHECK (mode IN ('test', 'live'))
);

CREATE TABLE IF NOT EXISTS stripe_connect_payout_outcomes (
  payout_outcome_id    text        PRIMARY KEY,
  payout_intent_id     text        NOT NULL UNIQUE REFERENCES stripe_connect_payout_intents (payout_intent_id) ON DELETE RESTRICT,
  status               text        NOT NULL,
  provider_payout_id   text        UNIQUE,
  provider_evidence_id text        NOT NULL UNIQUE,
  provider_message     text        NOT NULL,
  observed_at          timestamptz NOT NULL,
  CONSTRAINT stripe_connect_payout_outcome_status_known CHECK (
    status IN ('succeeded', 'failed')
  ),
  CONSTRAINT stripe_connect_payout_success_has_evidence CHECK (
    (status = 'succeeded' AND provider_payout_id IS NOT NULL)
    OR (status = 'failed' AND provider_payout_id IS NULL)
  )
);

-- Money splits become durable only as the atomic precondition of a payout
-- intent. Every involved row is immutable evidence; corrections append a new
-- provider observation rather than rewriting history.
CREATE OR REPLACE FUNCTION stripe_connect_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS money_split_records_append_only_trigger
  ON money_split_records;
CREATE TRIGGER money_split_records_append_only_trigger
  BEFORE UPDATE OR DELETE ON money_split_records
  FOR EACH ROW
  EXECUTE FUNCTION stripe_connect_audit_append_only();

DROP TRIGGER IF EXISTS stripe_connect_accounts_append_only_trigger
  ON stripe_connect_accounts;
CREATE TRIGGER stripe_connect_accounts_append_only_trigger
  BEFORE UPDATE OR DELETE ON stripe_connect_accounts
  FOR EACH ROW
  EXECUTE FUNCTION stripe_connect_audit_append_only();

DROP TRIGGER IF EXISTS stripe_connect_onboarding_intents_append_only_trigger
  ON stripe_connect_onboarding_intents;
CREATE TRIGGER stripe_connect_onboarding_intents_append_only_trigger
  BEFORE UPDATE OR DELETE ON stripe_connect_onboarding_intents
  FOR EACH ROW
  EXECUTE FUNCTION stripe_connect_audit_append_only();

DROP TRIGGER IF EXISTS stripe_connect_status_records_append_only_trigger
  ON stripe_connect_status_records;
CREATE TRIGGER stripe_connect_status_records_append_only_trigger
  BEFORE UPDATE OR DELETE ON stripe_connect_status_records
  FOR EACH ROW
  EXECUTE FUNCTION stripe_connect_audit_append_only();

DROP TRIGGER IF EXISTS stripe_connect_payout_intents_append_only_trigger
  ON stripe_connect_payout_intents;
CREATE TRIGGER stripe_connect_payout_intents_append_only_trigger
  BEFORE UPDATE OR DELETE ON stripe_connect_payout_intents
  FOR EACH ROW
  EXECUTE FUNCTION stripe_connect_audit_append_only();

DROP TRIGGER IF EXISTS stripe_connect_payout_outcomes_append_only_trigger
  ON stripe_connect_payout_outcomes;
CREATE TRIGGER stripe_connect_payout_outcomes_append_only_trigger
  BEFORE UPDATE OR DELETE ON stripe_connect_payout_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION stripe_connect_audit_append_only();
