-- =============================================================
-- 006 · Administración: rol, baneos, auditoría, bloqueo y sesión admin.
-- No destructiva. Reutiliza `users` y `subscriptions` existentes.
-- =============================================================

-- Rol de usuario (user | admin). Default 'user' (no cambia cuentas existentes).
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- Estado de baneo (server-side: se chequea en cada request autenticado).
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_until TIMESTAMPTZ; -- NULL = permanente
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id);

-- Bloqueo global del panel admin por intentos fallidos (fila única id=TRUE).
CREATE TABLE IF NOT EXISTS admin_lockout (
  id               BOOLEAN PRIMARY KEY DEFAULT TRUE,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_lockout_singleton CHECK (id = TRUE)
);

-- Auditoría de acciones administrativas.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  reason          TEXT,
  result          TEXT NOT NULL DEFAULT 'ok',
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log (created_at DESC);

-- Sesión administrativa elevada (2ª credencial). Cookie httpOnly aparte.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (user_id);
