CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);
