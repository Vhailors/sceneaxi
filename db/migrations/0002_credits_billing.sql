-- SceneAxi credits and billing (sceneaxi#95)
--
-- Forward-only. Apply after 0001_identity.sql.
--
-- The two invariants that matter most are enforced here independently of the
-- application:
--
--   * credit_accounts has NO balance column — the ledger is the only source of
--     truth, so there is nothing for a balance to drift from;
--   * credit_ledger_entries is append-only, enforced by a trigger that raises on
--     UPDATE and DELETE, plus unique indexes on (account_id, sequence) and on
--     idempotency_key so a replay cannot become a second row.

CREATE TABLE IF NOT EXISTS credit_accounts (
  account_id text        PRIMARY KEY,
  -- One account per user.
  user_id    text        NOT NULL UNIQUE REFERENCES users (user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL
);

-- Deliberately NO balance column. Balance is derived from credit_ledger_entries.

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  entry_id        text        PRIMARY KEY,
  account_id      text        NOT NULL REFERENCES credit_accounts (account_id) ON DELETE RESTRICT,
  -- 1-based, strictly monotonic per account.
  sequence        integer     NOT NULL,
  movement        text        NOT NULL,
  -- Signed, non-zero. Sign is fixed by movement.
  delta           bigint      NOT NULL,
  -- Derived witness of previous balance + delta. Never negative.
  balance_after   bigint      NOT NULL,
  reason          text        NOT NULL,
  -- Namespaced replay key, e.g. 'stripe-event:evt_1' or 'starter:usr_1'.
  idempotency_key text        NOT NULL,
  occurred_at     timestamptz NOT NULL,
  CONSTRAINT credit_ledger_entries_sequence_positive CHECK (sequence >= 1),
  CONSTRAINT credit_ledger_entries_movement_known CHECK (
    movement IN ('grant', 'debit', 'adjustment')
  ),
  CONSTRAINT credit_ledger_entries_delta_nonzero CHECK (delta <> 0),
  CONSTRAINT credit_ledger_entries_delta_sign CHECK (
    (movement = 'grant' AND delta > 0)
    OR (movement = 'debit' AND delta < 0)
    OR movement = 'adjustment'
  ),
  CONSTRAINT credit_ledger_entries_balance_nonnegative CHECK (balance_after >= 0),
  CONSTRAINT credit_ledger_entries_reason_present CHECK (btrim(reason) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_account_sequence
  ON credit_ledger_entries (account_id, sequence);

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_idempotency_key
  ON credit_ledger_entries (idempotency_key);

-- Append-only, enforced by the database. A privileged UPDATE or DELETE raises
-- rather than silently rewriting financial history.
CREATE OR REPLACE FUNCTION credit_ledger_entries_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'credit_ledger_entries is append-only; % is refused',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS credit_ledger_entries_append_only_trigger
  ON credit_ledger_entries;

CREATE TRIGGER credit_ledger_entries_append_only_trigger
  BEFORE UPDATE OR DELETE ON credit_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION credit_ledger_entries_append_only();

CREATE TABLE IF NOT EXISTS stripe_customer_links (
  user_id            text        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  stripe_customer_id text        NOT NULL,
  -- Test and live links are distinct records; a test customer must never be
  -- mistaken for a live one.
  mode               text        NOT NULL,
  linked_at          timestamptz NOT NULL,
  PRIMARY KEY (user_id, mode),
  CONSTRAINT stripe_customer_links_mode_known CHECK (mode IN ('test', 'live'))
);

CREATE TABLE IF NOT EXISTS checkout_session_intents (
  intent_id       text        PRIMARY KEY,
  user_id         text        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  purpose         text        NOT NULL,
  item_id         text        NOT NULL,
  -- Present exactly when purpose = 'credit-pack'; a listing sale grants none.
  credits         bigint,
  unit_amount     bigint      NOT NULL,
  currency        char(3)     NOT NULL,
  -- A public identifier, not a secret. API keys live only in the environment.
  stripe_price_id text        NOT NULL,
  mode            text        NOT NULL,
  success_url     text        NOT NULL,
  cancel_url      text        NOT NULL,
  idempotency_key text        NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL,
  CONSTRAINT checkout_session_intents_purpose_known CHECK (
    purpose IN ('credit-pack', 'catalog-listing')
  ),
  CONSTRAINT checkout_session_intents_mode_known CHECK (mode IN ('test', 'live')),
  CONSTRAINT checkout_session_intents_credits_match_purpose CHECK (
    (purpose = 'credit-pack' AND credits IS NOT NULL AND credits >= 1)
    OR (purpose <> 'credit-pack' AND credits IS NULL)
  ),
  CONSTRAINT checkout_session_intents_amount_positive CHECK (unit_amount >= 1),
  -- A post-payment state transition is never carried over plaintext http.
  CONSTRAINT checkout_session_intents_https CHECK (
    success_url LIKE 'https://%' AND cancel_url LIKE 'https://%'
  )
);

CREATE TABLE IF NOT EXISTS catalog_listings (
  listing_id             text        PRIMARY KEY,
  catalog                text        NOT NULL,
  seller_user_id         text        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  title                  text        NOT NULL,
  price_mode             text        NOT NULL,
  -- Present exactly when price_mode includes credits.
  credit_price           bigint,
  -- Present exactly when price_mode includes money, all three together.
  money_unit_amount      bigint,
  money_currency         char(3),
  money_stripe_price_id  text,
  published_at           timestamptz NOT NULL,
  CONSTRAINT catalog_listings_catalog_known CHECK (catalog IN ('game', 'web')),
  CONSTRAINT catalog_listings_price_mode_known CHECK (
    price_mode IN ('credits', 'money', 'credits-and-money')
  ),
  -- The cross-field rule: a price is present exactly when the mode admits it. A
  -- dormant price is how a credits-only listing quietly acquires a money one.
  CONSTRAINT catalog_listings_credit_price_matches_mode CHECK (
    (price_mode IN ('credits', 'credits-and-money') AND credit_price IS NOT NULL AND credit_price >= 1)
    OR (price_mode = 'money' AND credit_price IS NULL)
  ),
  CONSTRAINT catalog_listings_money_price_matches_mode CHECK (
    (
      price_mode IN ('money', 'credits-and-money')
      AND money_unit_amount IS NOT NULL AND money_unit_amount >= 1
      AND money_currency IS NOT NULL
      AND money_stripe_price_id IS NOT NULL
    )
    OR (
      price_mode = 'credits'
      AND money_unit_amount IS NULL
      AND money_currency IS NULL
      AND money_stripe_price_id IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS catalog_listings_seller_idx
  ON catalog_listings (seller_user_id);

CREATE TABLE IF NOT EXISTS creator_share_records (
  sale_id          text        PRIMARY KEY,
  listing_id       text        NOT NULL REFERENCES catalog_listings (listing_id) ON DELETE RESTRICT,
  buyer_user_id    text        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  creator_user_id  text        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  gross_credits    bigint      NOT NULL,
  creator_credits  bigint      NOT NULL,
  platform_credits bigint      NOT NULL,
  basis_points     integer     NOT NULL,
  occurred_at      timestamptz NOT NULL,
  CONSTRAINT creator_share_records_parties_differ CHECK (
    buyer_user_id <> creator_user_id
  ),
  CONSTRAINT creator_share_records_amounts_nonnegative CHECK (
    gross_credits >= 1 AND creator_credits >= 0 AND platform_credits >= 0
  ),
  -- A split may never create or destroy credits.
  CONSTRAINT creator_share_records_balances CHECK (
    creator_credits + platform_credits = gross_credits
  ),
  CONSTRAINT creator_share_records_ratio CHECK (
    creator_credits = floor((gross_credits::numeric * 5000) / 10000)
    AND platform_credits = gross_credits - creator_credits
  ),
  CONSTRAINT creator_share_records_basis_points CHECK (basis_points = 5000)
);

-- Money splits are BOOKKEEPING ONLY. There is deliberately no payout, transfer,
-- destination, or Connect-account column: real cash payouts to creators are a
-- later captain gate, and a column shaped like a payout invites one.
CREATE TABLE IF NOT EXISTS money_split_records (
  sale_id         text        PRIMARY KEY,
  listing_id      text        NOT NULL REFERENCES catalog_listings (listing_id) ON DELETE RESTRICT,
  buyer_user_id   text        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  creator_user_id text        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  gross_minor     bigint      NOT NULL,
  creator_minor   bigint      NOT NULL,
  platform_minor  bigint      NOT NULL,
  currency        char(3)     NOT NULL,
  basis_points    integer     NOT NULL,
  mode            text        NOT NULL,
  occurred_at     timestamptz NOT NULL,
  CONSTRAINT money_split_records_parties_differ CHECK (
    buyer_user_id <> creator_user_id
  ),
  CONSTRAINT money_split_records_amounts_nonnegative CHECK (
    gross_minor >= 1 AND creator_minor >= 0 AND platform_minor >= 0
  ),
  -- A split may never create or destroy money.
  CONSTRAINT money_split_records_balances CHECK (
    creator_minor + platform_minor = gross_minor
  ),
  CONSTRAINT money_split_records_ratio CHECK (
    creator_minor = floor((gross_minor::numeric * 5000) / 10000)
    AND platform_minor = gross_minor - creator_minor
  ),
  CONSTRAINT money_split_records_basis_points CHECK (basis_points = 5000),
  CONSTRAINT money_split_records_mode_known CHECK (mode IN ('test', 'live'))
);
