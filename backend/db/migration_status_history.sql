-- Run this once in Neon's SQL Editor (or via your usual migration path).
-- Adds:
--   1. A `note` column on villa_item_status — the CURRENT reason text for
--      NCR/Rejected (fast to read alongside status/actual_date, same
--      pattern already used for status + actual_date on this table).
--   2. A new villa_item_status_history table — one row inserted every
--      time a status is saved, which is what the new timeline reads from.

ALTER TABLE villa_item_status
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE TABLE IF NOT EXISTS villa_item_status_history (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT NOT NULL,
  table_item_id TEXT NOT NULL,
  status TEXT NOT NULL,
  status_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every timeline read and the NCR report's "current NCR rows" query both
-- filter/order by these, so index them together.
CREATE INDEX IF NOT EXISTS idx_villa_item_status_history_lookup
  ON villa_item_status_history (villa_id, table_item_id, created_at);

CREATE INDEX IF NOT EXISTS idx_villa_item_status_status
  ON villa_item_status (status);
