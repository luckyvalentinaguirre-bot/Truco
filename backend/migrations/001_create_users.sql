-- 001_create_users
-- Tabla de cuentas. Nunca se guardan contraseñas en texto plano: sólo el hash.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- para gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  -- email en minúsculas/trim para unicidad case-insensitive.
  email_normalized TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized_key UNIQUE (email_normalized),
  CONSTRAINT users_email_not_blank CHECK (length(btrim(email)) > 0)
);
