-- SceneAxi checkout intent price immutability (captain decision D3)
--
-- Forward-only. Apply after 0002_credits_billing.sql.
--
-- The checkout intent is the price snapshot later consumed by settlement. Its
-- price-bearing columns may not change after insertion, while operational
-- columns remain writable.

CREATE OR REPLACE FUNCTION checkout_session_intents_price_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.credits IS DISTINCT FROM OLD.credits
    OR NEW.unit_amount IS DISTINCT FROM OLD.unit_amount
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.stripe_price_id IS DISTINCT FROM OLD.stripe_price_id
  THEN
    RAISE EXCEPTION
      'checkout_session_intents price columns are immutable; UPDATE is refused'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkout_session_intents_price_immutable_trigger
  ON checkout_session_intents;

CREATE TRIGGER checkout_session_intents_price_immutable_trigger
  BEFORE UPDATE ON checkout_session_intents
  FOR EACH ROW
  EXECUTE FUNCTION checkout_session_intents_price_immutable();
