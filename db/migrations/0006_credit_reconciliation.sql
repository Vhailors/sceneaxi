-- Provider evidence awaiting an operator decision. This table moves no credits.
BEGIN;

CREATE TABLE IF NOT EXISTS credit_reconciliation_records (
  event_id text NOT NULL CHECK (length(event_id) > 0),
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  intent_id text NOT NULL REFERENCES checkout_session_intents(intent_id),
  user_id text NOT NULL REFERENCES users(user_id),
  charge_id text NOT NULL CHECK (length(charge_id) > 0),
  event_type text NOT NULL,
  reason text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),
  currency text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  dispute_id text,
  dispute_status text,
  occurred_at timestamptz NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (mode, event_id),
  CONSTRAINT credit_reconciliation_event_known CHECK (
    (event_type = 'charge.refunded'
      AND reason IN ('STRIPE_REFUND_NOT_FULL', 'CREDIT_BALANCE_INSUFFICIENT')
      AND dispute_id IS NULL AND dispute_status IS NULL)
    OR
    (event_type IN ('charge.dispute.created', 'charge.dispute.closed')
      AND reason = 'STRIPE_DISPUTE_RECONCILIATION_REQUIRED'
      AND dispute_id IS NOT NULL AND length(dispute_id) > 0
      AND dispute_status IS NOT NULL AND length(dispute_status) > 0)
  )
);

CREATE INDEX IF NOT EXISTS credit_reconciliation_intent
  ON credit_reconciliation_records (intent_id, occurred_at);

DROP TRIGGER IF EXISTS credit_reconciliation_records_append_only_trigger ON credit_reconciliation_records;
CREATE TRIGGER credit_reconciliation_records_append_only_trigger
  BEFORE UPDATE OR DELETE ON credit_reconciliation_records
  FOR EACH ROW EXECUTE FUNCTION credit_ledger_entries_append_only();

COMMIT;
