-- Forward-only hardening. Refuse existing corrupt history; never repair balances.
-- Only apply under separately scoped database authority. Local fixtures are not LIVE proof.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT sequence, delta, balance_after,
        row_number() OVER (PARTITION BY account_id ORDER BY sequence) AS expected_sequence,
        sum(delta::numeric) OVER (PARTITION BY account_id ORDER BY sequence) AS expected_balance
      FROM credit_ledger_entries
    ) chain WHERE sequence <> expected_sequence OR balance_after <> expected_balance
      OR expected_balance NOT BETWEEN 0 AND 9007199254740991
      OR abs(delta::numeric) > 9007199254740991
  ) THEN
    RAISE EXCEPTION 'CREDIT_LEDGER_HISTORY_INVALID';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS hosted_model_operations (
  account_id text NOT NULL REFERENCES credit_accounts(account_id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  amount bigint NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  model text NOT NULL CHECK (btrim(model) <> ''),
  operation text NOT NULL CHECK (btrim(operation) <> ''),
  status text NOT NULL CHECK (status IN ('pending', 'response-ready', 'completed')),
  response jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (account_id, idempotency_key),
  CHECK ((status = 'pending' AND response IS NULL) OR (status <> 'pending' AND response IS NOT NULL)),
  CHECK (response IS NULL OR octet_length(response::text) <= 262144)
);

CREATE FUNCTION sceneaxi_validate_credit_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_sequence integer := 0;
  previous_balance bigint := 0;
  held hosted_model_operations%ROWTYPE;
  reserved numeric := 0;
BEGIN
  PERFORM 1 FROM credit_accounts WHERE account_id = NEW.account_id FOR UPDATE;
  -- Replay must reach ON CONFLICT before stale sequence checks; callers compare semantics.
  IF EXISTS (SELECT 1 FROM credit_ledger_entries WHERE idempotency_key = NEW.idempotency_key) THEN RETURN NEW; END IF;
  SELECT sequence, balance_after INTO previous_sequence, previous_balance
    FROM credit_ledger_entries WHERE account_id = NEW.account_id ORDER BY sequence DESC LIMIT 1;
  previous_sequence := COALESCE(previous_sequence, 0);
  previous_balance := COALESCE(previous_balance, 0);
  IF NEW.sequence::bigint <> previous_sequence::bigint + 1
    OR abs(NEW.delta::numeric) > 9007199254740991
    OR NEW.balance_after::numeric <> previous_balance::numeric + NEW.delta::numeric
    OR NEW.balance_after NOT BETWEEN 0 AND 9007199254740991 THEN
    RAISE EXCEPTION 'CREDIT_LEDGER_CHAIN_INVALID';
  END IF;
  SELECT * INTO held FROM hosted_model_operations WHERE idempotency_key = NEW.idempotency_key;
  IF FOUND AND (held.account_id <> NEW.account_id OR held.status <> 'response-ready'
    OR NEW.movement <> 'debit' OR NEW.delta <> -held.amount OR NEW.reason <> held.reason) THEN
    RAISE EXCEPTION 'HOSTED_DEBIT_CONFLICT';
  END IF;
  SELECT COALESCE(sum(h.amount::numeric), 0) INTO reserved FROM hosted_model_operations h
    WHERE h.account_id = NEW.account_id AND h.status IN ('pending', 'response-ready')
      AND h.idempotency_key <> NEW.idempotency_key
      AND NOT EXISTS (SELECT 1 FROM credit_ledger_entries l WHERE l.idempotency_key = h.idempotency_key);
  IF NEW.balance_after::numeric < reserved THEN RAISE EXCEPTION 'CREDIT_BALANCE_RESERVED'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sceneaxi_credit_chain BEFORE INSERT ON credit_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION sceneaxi_validate_credit_chain();

CREATE FUNCTION sceneaxi_reserve_hosted_call(
  p_account text, p_key text, p_amount bigint, p_reason text, p_model text, p_operation text, p_now timestamptz
) RETURNS TABLE(status text, response jsonb) LANGUAGE plpgsql AS $$
DECLARE held hosted_model_operations%ROWTYPE; balance numeric; reserved numeric;
BEGIN
  IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 9007199254740991 OR p_now IS NULL
    OR p_key IS NULL OR btrim(p_key) = '' OR p_reason IS NULL OR btrim(p_reason) = ''
    OR p_model IS NULL OR btrim(p_model) = '' OR p_operation IS NULL OR btrim(p_operation) = '' THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::jsonb; RETURN;
  END IF;
  PERFORM 1 FROM credit_accounts WHERE account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'conflict'::text, NULL::jsonb; RETURN; END IF;
  SELECT * INTO held FROM hosted_model_operations WHERE idempotency_key = p_key;
  IF FOUND THEN
    IF held.account_id <> p_account OR held.amount <> p_amount OR held.reason <> p_reason
      OR held.model <> p_model OR held.operation <> p_operation THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::jsonb;
    ELSE RETURN QUERY SELECT held.status, held.response; END IF;
    RETURN;
  END IF;
  SELECT COALESCE(sum(delta::numeric), 0) INTO balance FROM credit_ledger_entries WHERE account_id = p_account;
  SELECT COALESCE(sum(h.amount::numeric), 0) INTO reserved FROM hosted_model_operations h
    WHERE h.account_id = p_account AND h.status IN ('pending', 'response-ready')
      AND NOT EXISTS (SELECT 1 FROM credit_ledger_entries l WHERE l.idempotency_key = h.idempotency_key);
  IF balance - reserved < p_amount THEN RETURN QUERY SELECT 'insufficient'::text, NULL::jsonb; RETURN; END IF;
  INSERT INTO hosted_model_operations(account_id, idempotency_key, amount, reason, model, operation, status, created_at)
    VALUES (p_account, p_key, p_amount, p_reason, p_model, p_operation, 'pending', p_now);
  RETURN QUERY SELECT 'acquired'::text, NULL::jsonb;
END;
$$;

CREATE FUNCTION sceneaxi_hosted_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM credit_accounts WHERE account_id = OLD.account_id FOR UPDATE;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'pending' OR EXISTS (SELECT 1 FROM credit_ledger_entries WHERE idempotency_key = OLD.idempotency_key)
      THEN RAISE EXCEPTION 'HOSTED_OPERATION_IMMUTABLE'; END IF;
    RETURN OLD;
  END IF;
  IF (NEW.account_id, NEW.idempotency_key, NEW.amount, NEW.reason, NEW.model, NEW.operation, NEW.created_at)
    IS DISTINCT FROM (OLD.account_id, OLD.idempotency_key, OLD.amount, OLD.reason, OLD.model, OLD.operation, OLD.created_at)
    OR NOT ((OLD.status = 'pending' AND NEW.status = 'response-ready')
      OR (OLD.status IN ('response-ready', 'completed') AND NEW.status = 'completed' AND NEW.response = OLD.response)) THEN
    RAISE EXCEPTION 'HOSTED_OPERATION_IMMUTABLE';
  END IF;
  IF NEW.status = 'completed' AND NOT EXISTS (SELECT 1 FROM credit_ledger_entries
    WHERE account_id = NEW.account_id AND idempotency_key = NEW.idempotency_key
      AND movement = 'debit' AND delta = -NEW.amount AND reason = NEW.reason) THEN
    RAISE EXCEPTION 'HOSTED_DEBIT_UNCONFIRMED';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sceneaxi_hosted_operation_guard BEFORE UPDATE OR DELETE ON hosted_model_operations
  FOR EACH ROW EXECUTE FUNCTION sceneaxi_hosted_operation_guard();

-- Five new attempts in a rolling 300-second window. Stable-key replay is quota free.
CREATE FUNCTION sceneaxi_checkout_attempt_budget() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM users WHERE user_id = NEW.user_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM checkout_session_intents WHERE idempotency_key = NEW.idempotency_key) THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM checkout_session_intents WHERE user_id = NEW.user_id
      AND created_at > NEW.created_at - interval '300 seconds') >= 5 THEN
    RAISE EXCEPTION 'BILLING_CHECKOUT_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sceneaxi_checkout_attempt_budget BEFORE INSERT ON checkout_session_intents
  FOR EACH ROW EXECUTE FUNCTION sceneaxi_checkout_attempt_budget();
-- Tokenized persisted intent anchors allow a bounded member history lookup to use
-- an inverted index instead of scanning every reason in the account's lifetime.
CREATE FUNCTION sceneaxi_credit_entry_anchors(value text) RETURNS text[]
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT COALESCE(array_agg(btrim(anchor)), ARRAY[]::text[])
    FROM unnest(string_to_array(value, ';')) AS anchor;
$$;
CREATE INDEX IF NOT EXISTS sceneaxi_credit_purchase_anchors ON credit_ledger_entries
  USING gin (sceneaxi_credit_entry_anchors(reason));
CREATE INDEX IF NOT EXISTS sceneaxi_hosted_pending ON hosted_model_operations(account_id)
  WHERE status IN ('pending', 'response-ready');
CREATE INDEX IF NOT EXISTS sceneaxi_checkout_history ON checkout_session_intents(user_id, created_at DESC, intent_id DESC);
CREATE INDEX IF NOT EXISTS sceneaxi_reconciliation_history ON credit_reconciliation_records(user_id, occurred_at, mode, event_id);
