-- 002_create_profiles
-- Perfil público 1:1 con users. Preparado para estadísticas/ranking/cosméticos
-- futuros SIN implementarlos todavía.

CREATE TABLE IF NOT EXISTS profiles (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username     TEXT NOT NULL,
  display_name TEXT,
  avatar       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_key UNIQUE (username),
  CONSTRAINT profiles_username_not_blank CHECK (length(btrim(username)) > 0)
);

-- Búsqueda case-insensitive por username (login/futuro perfil público).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON profiles (lower(username));
