-- Adds individual user accounts, replacing the single shared
-- APP_PASSWORD. Passwords are stored as bcrypt hashes, never plaintext.
--
-- Run once in Neon's SQL Editor, or:
--   psql "$DATABASE_URL" -f db/schema-users.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
