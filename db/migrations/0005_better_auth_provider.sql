-- SA-AUTH-1: provider-owned Better Auth persistence.
--
-- Forward-only. Apply after 0004_stripe_connect_audit.sql. These tables belong
-- to the Better Auth HTTP provider hosted by the umbrella deployment; they do
-- not replace the SceneAxi `users`, `role_assignments`, or digest-only
-- `sessions` tables from 0001_identity.sql.
--
-- The schema matches Better Auth 1.6's four core models with the explicit
-- model names configured in sites/umbrella/src/lib/better-auth-provider.ts.

CREATE TABLE IF NOT EXISTS better_auth_users (
  "id"            text        PRIMARY KEY,
  "name"          text        NOT NULL,
  "email"         text        NOT NULL UNIQUE,
  "emailVerified" boolean     NOT NULL DEFAULT false,
  "image"         text,
  "createdAt"     timestamptz NOT NULL,
  "updatedAt"     timestamptz NOT NULL,
  CONSTRAINT better_auth_users_email_normalized CHECK (
    "email" = lower(btrim("email"))
  )
);

CREATE TABLE IF NOT EXISTS better_auth_sessions (
  "id"        text        PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token"     text        NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId"    text        NOT NULL REFERENCES better_auth_users ("id") ON DELETE CASCADE,
  CONSTRAINT better_auth_sessions_expiry_after_creation CHECK (
    "expiresAt" > "createdAt"
  )
);

CREATE INDEX IF NOT EXISTS better_auth_sessions_user_id_idx
  ON better_auth_sessions ("userId");
CREATE INDEX IF NOT EXISTS better_auth_sessions_expires_at_idx
  ON better_auth_sessions ("expiresAt");

CREATE TABLE IF NOT EXISTS better_auth_accounts (
  "id"                    text        PRIMARY KEY,
  "accountId"             text        NOT NULL,
  "providerId"            text        NOT NULL,
  "userId"                text        NOT NULL REFERENCES better_auth_users ("id") ON DELETE CASCADE,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  "password"              text,
  "createdAt"             timestamptz NOT NULL,
  "updatedAt"             timestamptz NOT NULL,
  CONSTRAINT better_auth_accounts_provider_account_unique UNIQUE ("providerId", "accountId"),
  CONSTRAINT better_auth_accounts_user_provider_unique UNIQUE ("userId", "providerId"),
  CONSTRAINT better_auth_accounts_credential_has_password CHECK (
    "providerId" <> 'credential' OR "password" IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS better_auth_accounts_user_id_idx
  ON better_auth_accounts ("userId");

CREATE TABLE IF NOT EXISTS better_auth_verifications (
  "id"         text        PRIMARY KEY,
  "identifier" text        NOT NULL,
  "value"      text        NOT NULL,
  "expiresAt"  timestamptz NOT NULL,
  "createdAt"  timestamptz NOT NULL,
  "updatedAt"  timestamptz NOT NULL,
  CONSTRAINT better_auth_verifications_expiry_after_creation CHECK (
    "expiresAt" > "createdAt"
  )
);

CREATE INDEX IF NOT EXISTS better_auth_verifications_identifier_idx
  ON better_auth_verifications ("identifier");
CREATE INDEX IF NOT EXISTS better_auth_verifications_expires_at_idx
  ON better_auth_verifications ("expiresAt");

-- Durable rate-limit counters for the public credential endpoint. The provider
-- configures `rateLimit.storage = "database"` because a per-instance in-memory
-- counter resets on every serverless cold start and throttles nothing an
-- attacker can simply outlast. `"key"` is the provider's `<ip>|<path>` bucket
-- and its uniqueness is load-bearing: the atomic consume path depends on a
-- concurrent insert for the same bucket losing.
CREATE TABLE IF NOT EXISTS better_auth_rate_limits (
  "id"          text    PRIMARY KEY,
  "key"         text    NOT NULL UNIQUE,
  "count"       integer NOT NULL,
  "lastRequest" bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS better_auth_rate_limits_last_request_idx
  ON better_auth_rate_limits ("lastRequest");
