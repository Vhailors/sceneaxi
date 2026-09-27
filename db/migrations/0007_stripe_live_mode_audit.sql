-- Append-only evidence for an explicitly supplied Stripe LIVE authorization.
-- No shipped call site consumes the authorization witness.

CREATE TABLE IF NOT EXISTS stripe_live_mode_authorization_audit (
  audit_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_version integer     NOT NULL CHECK (schema_version = 1),
  kind           text        NOT NULL CHECK (kind = 'sceneaxi.stripe-live-mode-authorization-audit'),
  source         text        NOT NULL CHECK (source = 'SCENEAXI_STRIPE_LIVE_AUTHORIZED'),
  authorized_by  text        NOT NULL,
  authorized_on  date        NOT NULL,
  fingerprint    char(64)    NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  record         text        NOT NULL CHECK (length(record) > 0)
);

CREATE OR REPLACE FUNCTION stripe_live_mode_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS stripe_live_mode_authorization_audit_append_only_trigger
  ON stripe_live_mode_authorization_audit;
CREATE TRIGGER stripe_live_mode_authorization_audit_append_only_trigger
  BEFORE UPDATE OR DELETE ON stripe_live_mode_authorization_audit
  FOR EACH ROW
  EXECUTE FUNCTION stripe_live_mode_audit_append_only();
