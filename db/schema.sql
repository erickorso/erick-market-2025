-- Erick Market schema (Neon Postgres)
-- Run once: psql "$DATABASE_URL" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth0_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  -- Blob URL, not the bytes. Image data in a row is how a database grows
  -- without anyone noticing, and this one is shared with another app.
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS portfolios (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  cash NUMERIC(18, 4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

CREATE TABLE IF NOT EXISTS positions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  month TEXT NOT NULL,
  company TEXT NOT NULL,
  qty NUMERIC(18, 6) NOT NULL CHECK (qty > 0),
  avg_cost NUMERIC(18, 6) NOT NULL CHECK (avg_cost >= 0),
  PRIMARY KEY (user_id, symbol, month)
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  qty NUMERIC(18, 6) NOT NULL CHECK (qty > 0),
  price NUMERIC(18, 6) NOT NULL CHECK (price >= 0),
  -- Written inside the same statement as the trade itself, which is what makes
  -- the ledger the authority on whether a key already ran. Without it, a crash
  -- between committing a trade and recording its response leaves a claim that
  -- nothing can resolve.
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trades ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS trades_idempotency_idx
  ON trades (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS trades_user_month_idx ON trades (user_id, month, created_at DESC);

-- Exactly-once for POST /api/trade.
--
-- A retry is only safe when the error proves nothing was written. A dropped
-- connection proves nothing: the trade may well have committed, and the user
-- who presses Buy again has no way to know. The primary key is what makes the
-- second attempt a lookup instead of a second purchase.
--
-- `response` is a cache, not the record of truth. It stays NULL while the trade
-- is in flight, and `trades.idempotency_key` is what settles the ambiguous case
-- — a claim with no response is only genuinely in progress if the ledger has no
-- trade under that key.
CREATE TABLE IF NOT EXISTS trade_requests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idempotency_key)
);

-- Scoped by user, so one caller's key can never collide with another's.
CREATE INDEX IF NOT EXISTS trade_requests_created_idx ON trade_requests (created_at);

CREATE TABLE IF NOT EXISTS league_scores (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  equity NUMERIC(18, 4) NOT NULL,
  cash NUMERIC(18, 4) NOT NULL,
  invested NUMERIC(18, 4) NOT NULL,
  pnl NUMERIC(18, 4) NOT NULL,
  pnl_pct NUMERIC(12, 4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

CREATE INDEX IF NOT EXISTS league_scores_month_equity_idx ON league_scores (month, equity DESC);

CREATE TABLE IF NOT EXISTS league_months (
  month TEXT PRIMARY KEY,
  winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
