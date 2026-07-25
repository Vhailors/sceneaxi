-- SceneAxi identity plane (sceneaxi#95)
--
-- Forward-only. Apply in numeric order; see db/README.md.
--
-- The invariants the application enforces are re-stated here, so neither layer
-- is the only thing standing between the identity plane and a bad row:
--
--   * a user row carries no role column at all, so there is no column for a
--     client-writable path to set;
--   * at most one admin can exist, enforced by a partial unique index rather
--     than by trusting every future write path;
--   * the sessions table cannot hold a Kids session, because 'kids' is absent
--     from the surface check constraint;
--   * only a token digest is stored — there is no column a raw token fits in.

CREATE TABLE IF NOT EXISTS users (
  user_id        text        PRIMARY KEY,
  -- Stored normalized (trimmed, lowercased) so the admin comparison and the
  -- uniqueness constraint agree on one form.
  email          text        NOT NULL UNIQUE,
  email_verified boolean     NOT NULL DEFAULT false,
  disabled       boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL,
  CONSTRAINT users_user_id_shape CHECK (user_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)))
);

-- Deliberately NO role column on users. Roles live on role_assignments, which
-- the server derives from SCENEAXI_ADMIN_EMAIL; see docs/auth-credits.md.

CREATE TABLE IF NOT EXISTS role_assignments (
  user_id     text        PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
  -- No DEFAULT: a role is always written deliberately, never acquired by
  -- omitting the column on an INSERT.
  role        text        NOT NULL,
  source      text        NOT NULL,
  assigned_at timestamptz NOT NULL,
  CONSTRAINT role_assignments_role_known CHECK (role IN ('admin', 'user')),
  CONSTRAINT role_assignments_source_known CHECK (source IN ('admin-env', 'default-user')),
  -- The admin role may only originate from the environment-resolved captain
  -- identity. A 'default-user' source can never carry it.
  CONSTRAINT role_assignments_admin_source CHECK (
    role <> 'admin' OR source = 'admin-env'
  )
);

-- At most one admin, ever. Multi-admin needs a captain decision, so it is
-- refused by the database as well as by the application.
CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_single_admin
  ON role_assignments ((true))
  WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS sessions (
  session_id   text        PRIMARY KEY,
  user_id      text        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  -- 'kids' is intentionally absent: Kids never shares identity with another
  -- SceneAxi surface, so a Kids session cannot be stored here at all.
  surface      text        NOT NULL,
  issued_at    timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  -- SHA-256 hex digest. There is no column a raw token fits in, so a leaked
  -- table is not a set of credentials.
  token_digest char(64)    NOT NULL,
  CONSTRAINT sessions_surface_known CHECK (
    surface IN ('web-shell', 'desktop-shell', 'site')
  ),
  CONSTRAINT sessions_expiry_after_issue CHECK (expires_at > issued_at),
  CONSTRAINT sessions_token_digest_shape CHECK (token_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
