-- WAHJ Alasalah — Postgres schema (Neon), fresh database
--
-- Consolidates the original 8 migration files (schema.sql,
-- schema-users.sql, schema-project-settings.sql + v2,
-- migration_status_history.sql, migration_ncr_table.sql +
-- migration_ncr_closing_note.sql, migration_schedule_notes.sql,
-- migration_audit_log.sql) into one file, in the correct dependency
-- order, for setting up a brand-new project's database in one pass —
-- rather than re-running 8 separate ALTER-heavy migration files that
-- were written incrementally against an already-live Shams database.
--
-- NOT included: cleanup-actual-costs.sql / cleanup-actual-dates.sql —
-- those were one-time backfills for pre-existing bad data on the old
-- Shams database. A fresh database has no rows yet, so there's nothing
-- for them to clean up.
--
-- Run once against a fresh Neon database:
--   psql "postgresql://neondb_owner:npg_gWb6j8ZNkrGa@ep-sweet-salad-b45u33cb-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require" -f db/schema.sql

BEGIN;

-- ----------------------------------------------------------------------
-- villas
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villas (
  villa_id    TEXT PRIMARY KEY,   -- e.g. "V_993" — matches villaID in villa-parcels.geojson
  villa_num   INTEGER,
  zone        TEXT,
  block       TEXT,
  villa_type  TEXT,
  txt_memo    TEXT,
  ref_name    TEXT
);

CREATE INDEX IF NOT EXISTS idx_villas_zone ON villas (zone);
CREATE INDEX IF NOT EXISTS idx_villas_block ON villas (block);
CREATE INDEX IF NOT EXISTS idx_villas_villa_type ON villas (villa_type);
CREATE INDEX IF NOT EXISTS idx_villas_villa_num ON villas (villa_num);

-- ----------------------------------------------------------------------
-- construction_items
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS construction_items (
  table_item_id TEXT PRIMARY KEY,   -- e.g. "Civil-1"
  item_id       INTEGER NOT NULL,   -- ordering, matches data/constructionItems.js's `id`
  name          TEXT NOT NULL,
  name_arabic   TEXT,
  predecessors  INTEGER[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_construction_items_item_id ON construction_items (item_id);

-- ----------------------------------------------------------------------
-- villa_item_status
-- (includes the `note` column from migration_status_history.sql
-- directly, rather than as a later ALTER)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_item_status (
  villa_id        TEXT NOT NULL REFERENCES villas (villa_id) ON DELETE CASCADE,
  table_item_id   TEXT NOT NULL REFERENCES construction_items (table_item_id),
  status          TEXT NOT NULL DEFAULT 'NotStarted', -- NotStarted/InProgress/Completed/NCR/Rejected
  planned_start   DATE,
  planned_finish  DATE,
  actual_date     DATE,
  planned_cost    NUMERIC(14, 2),
  actual_cost     NUMERIC(14, 2),
  note            TEXT,
  PRIMARY KEY (villa_id, table_item_id)
);

CREATE INDEX IF NOT EXISTS idx_vis_item_status ON villa_item_status (table_item_id, status);
CREATE INDEX IF NOT EXISTS idx_vis_villa ON villa_item_status (villa_id);
CREATE INDEX IF NOT EXISTS idx_villa_item_status_status ON villa_item_status (status);

-- ----------------------------------------------------------------------
-- villa_item_status_history — append-only log, one row per status save
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_item_status_history (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT NOT NULL,
  table_item_id TEXT NOT NULL,
  status TEXT NOT NULL,
  status_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_villa_item_status_history_lookup
  ON villa_item_status_history (villa_id, table_item_id, created_at);

-- ----------------------------------------------------------------------
-- villa_item_invoice
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_item_invoice (
  villa_id       TEXT NOT NULL REFERENCES villas (villa_id) ON DELETE CASCADE,
  table_item_id  TEXT NOT NULL REFERENCES construction_items (table_item_id),
  status         TEXT NOT NULL DEFAULT 'NotStarted', -- NotStarted/ReadyToPay/Paid
  PRIMARY KEY (villa_id, table_item_id)
);

CREATE INDEX IF NOT EXISTS idx_vii_item_status ON villa_item_invoice (table_item_id, status);
CREATE INDEX IF NOT EXISTS idx_vii_villa ON villa_item_invoice (villa_id);

-- ----------------------------------------------------------------------
-- villa_special_query_values — arbitrary user-defined per-villa columns
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_special_query_values (
  villa_id     TEXT NOT NULL REFERENCES villas (villa_id) ON DELETE CASCADE,
  column_name  TEXT NOT NULL,
  value        TEXT,
  PRIMARY KEY (villa_id, column_name)
);

CREATE INDEX IF NOT EXISTS idx_sqv_column_value ON villa_special_query_values (column_name, value);

-- ----------------------------------------------------------------------
-- villa_item_ncr
-- (includes closing_note from migration_ncr_closing_note.sql directly)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_item_ncr (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT NOT NULL,
  table_item_id TEXT NOT NULL,
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_date DATE,
  closing_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_villa_item_ncr_lookup
  ON villa_item_ncr (villa_id, table_item_id);

CREATE INDEX IF NOT EXISTS idx_villa_item_ncr_closed
  ON villa_item_ncr (closed);

-- ----------------------------------------------------------------------
-- villa_item_schedule_note
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_item_schedule_note (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT NOT NULL,
  table_item_id TEXT NOT NULL,
  note TEXT NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_villa_item_schedule_note_lookup
  ON villa_item_schedule_note (villa_id, table_item_id);

-- ----------------------------------------------------------------------
-- audit_log — shared audit trail across activity status / NCR / notes
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT,
  table_item_id TEXT,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_lookup ON audit_log (villa_id, table_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at);

-- ----------------------------------------------------------------------
-- project_settings — singleton row, shared branding (name + 5 logo captions)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  project_name  TEXT,
  logo_caption  TEXT,           -- superseded by logo_caption_1..5 below, kept for compatibility
  logo_caption_1 TEXT,
  logo_caption_2 TEXT,
  logo_caption_3 TEXT,
  logo_caption_4 TEXT,
  logo_caption_5 TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seeded with WAHJ's own name from the start (was "Sahms ElGhroub" in
-- the original file — that's what caused the branding widget to show
-- the wrong project name/logos before this project had its own database).
INSERT INTO project_settings (id, project_name)
VALUES (1, 'WAHJ Alasalah')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
