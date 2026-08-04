-- 003_create_sessions
-- Sesiones de autenticación futuras. Nunca se guarda el token en claro: sólo
-- su hash (token_hash). No se implementa login todavía.

CREATE TABLE IF NOT EXISTS sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  CONSTRAINT sessions_token_hash_key UNIQUE (token_hash)
);

-- Sesiones por usuario y limpieza por expiración.
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
