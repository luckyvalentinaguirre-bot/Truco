-- =============================================================
-- 004 · Sistema competitivo: suscripciones, pagos, ELO, temporadas,
--       partidas clasificatorias.
-- No destructiva: sólo CREATE TABLE / INDEX. No toca datos existentes.
-- =============================================================

-- ---- Temporadas ----
CREATE TABLE IF NOT EXISTS seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT season_dates_valid CHECK (ends_at > starts_at)
);

-- ---- Suscripción competitiva (US$3/mes) ----
-- Una fila por usuario. El estado EFECTIVO se deriva en el backend.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('active','pending','past_due','canceled','expired')),
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  current_period_end    TIMESTAMPTZ,
  -- Referencia del proveedor (p. ej. Stripe customer/subscription id). NO se
  -- guardan datos financieros sensibles (tarjetas, CVV): eso vive en el proveedor.
  provider              TEXT,
  provider_customer_id  TEXT,
  provider_subscription_id TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Pagos (historial + idempotencia de webhooks) ----
-- provider_event_id UNIQUE ⇒ un webhook repetido no registra dos pagos ni
-- activa dos veces la suscripción.
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  status            TEXT NOT NULL
                      CHECK (status IN ('succeeded','failed','refunded','pending')),
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_event_unique UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);

-- ---- Rating competitivo por usuario y temporada ----
CREATE TABLE IF NOT EXISTS competitive_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id   UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL DEFAULT 1000,
  wins        INTEGER NOT NULL DEFAULT 0,
  losses      INTEGER NOT NULL DEFAULT 0,
  best_rating INTEGER NOT NULL DEFAULT 1000,
  streak      INTEGER NOT NULL DEFAULT 0, -- + racha de victorias, - de derrotas
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rating_unique_per_season UNIQUE (user_id, season_id)
);
-- Ranking por temporada (orden por rating desc).
CREATE INDEX IF NOT EXISTS ratings_season_rank_idx
  ON competitive_ratings (season_id, rating DESC);

-- ---- Partidas clasificatorias ----
-- status='resolved' + resolución única evita doble finalización (concurrencia).
CREATE TABLE IF NOT EXISTS competitive_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL CHECK (mode IN ('1v1','2v2','3v3')),
  ranked        BOOLEAN NOT NULL DEFAULT TRUE,
  status        TEXT NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress','resolved','voided')),
  winner_team   SMALLINT, -- 0 o 1; NULL mientras no se resuelve
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_season_idx ON competitive_matches (season_id, created_at DESC);

-- ---- Participantes de una partida clasificatoria (ELO antes/después) ----
CREATE TABLE IF NOT EXISTS competitive_match_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES competitive_matches(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team          SMALLINT NOT NULL CHECK (team IN (0,1)),
  rating_before INTEGER,
  rating_after  INTEGER,
  rating_delta  INTEGER,
  abandoned     BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT match_player_unique UNIQUE (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS match_players_user_idx
  ON competitive_match_players (user_id);
