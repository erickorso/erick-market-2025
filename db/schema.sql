-- Erick Market schema (Neon Postgres)
-- Run once: psql "$DATABASE_URL" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth0_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_user_month_idx ON trades (user_id, month, created_at DESC);

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
