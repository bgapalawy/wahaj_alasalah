-- Shams El Ghroub — Postgres schema (Neon)
--
-- Replaces several DynamoDB "wide" tables (one row per villa, one COLUMN
-- per construction item, e.g. "Civil-1", "Mechanical-1", ...) with proper
-- normalized tables. This is what makes the Custom Query Builder a real
-- WHERE clause, dashboards a real GROUP BY, and the bulk invoice-fix
-- buttons a single UPDATE statement instead of scan-then-loop-and-write.
--
-- Run once against a fresh Neon database:
--   psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

-- ----------------------------------------------------------------------
-- villas — was: villaID-keyed rows in DDB_VILLAS_TABLE
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villas (
  villa_id    TEXT PRIMARY KEY,   -- "V_993" — kept identical to DynamoDB's
                                   -- key so the frontend/routes never need
                                   -- to know the migration happened
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
-- construction_items — was: the static array in data/constructionItems.js
-- Kept as a real table (not hardcoded JS) so it can be queried/joined,
-- per the original ARCHITECTURE.md note calling this out as "a good
-- candidate to move into the database itself later."
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS construction_items (
  table_item_id TEXT PRIMARY KEY,   -- "Civil-1"
  item_id       INTEGER NOT NULL,   -- 1..82, the original ordering
  name          TEXT NOT NULL,
  name_arabic   TEXT,
  predecessors  INTEGER[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_construction_items_item_id ON construction_items (item_id);

-- ----------------------------------------------------------------------
-- villa_item_status — was: one column per TableItemID across
-- DDB_WAJHA_DATA_TABLE (current status), DDB_PLANNED_DATES_TABLE,
-- DDB_PLANNED_DATES_FINISH_TABLE, DDB_ACTUAL_DATES_TABLE,
-- DDB_PLANNED_COSTS_TABLE, DDB_ACTUAL_COSTS_TABLE — merged into ONE
-- long-format table, one row per (villa, item).
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_item_status (
  villa_id        TEXT NOT NULL REFERENCES villas (villa_id) ON DELETE CASCADE,
  table_item_id   TEXT NOT NULL REFERENCES construction_items (table_item_id),
  status          TEXT NOT NULL DEFAULT 'NotStarted', -- NotStarted/InProgress/Completed
  planned_start   DATE,
  planned_finish  DATE,
  actual_date     DATE,             -- completion date, was Actual_dates' completedDate
  planned_cost    NUMERIC(14, 2),
  actual_cost     NUMERIC(14, 2),
  PRIMARY KEY (villa_id, table_item_id)
);

CREATE INDEX IF NOT EXISTS idx_vis_item_status ON villa_item_status (table_item_id, status);
CREATE INDEX IF NOT EXISTS idx_vis_villa ON villa_item_status (villa_id);

-- ----------------------------------------------------------------------
-- villa_item_invoice — was: DDB_INVOICE_TABLE, same wide shape
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
-- special_query_values — was: DDB_SPECIAL_QUERY_TABLE, arbitrary extra
-- per-villa columns used by the "Column" color mode / custom query
-- builder. Kept as a flexible key/value table since these columns are
-- user-defined and don't have a fixed schema.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villa_special_query_values (
  villa_id     TEXT NOT NULL REFERENCES villas (villa_id) ON DELETE CASCADE,
  column_name  TEXT NOT NULL,
  value        TEXT,
  PRIMARY KEY (villa_id, column_name)
);

CREATE INDEX IF NOT EXISTS idx_sqv_column_value ON villa_special_query_values (column_name, value);

COMMIT;
