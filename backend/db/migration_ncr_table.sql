-- Run this in Neon's SQL Editor, same as migration_status_history.sql
-- before it. Adds a dedicated NCR log — separate from villa_item_status
-- (which still has its own single-value "NCR" status option, unchanged)
-- because a villa/item can now have MULTIPLE simultaneous NCRs, each
-- independently closeable with its own closing date. A single-value
-- status column can't represent that; this table can.

CREATE TABLE IF NOT EXISTS villa_item_ncr (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT NOT NULL,
  table_item_id TEXT NOT NULL,
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every NCR read is scoped to one villa+item (the panel) or filtered by
-- open/closed (the report), so both patterns get an index.
CREATE INDEX IF NOT EXISTS idx_villa_item_ncr_lookup
  ON villa_item_ncr (villa_id, table_item_id);

CREATE INDEX IF NOT EXISTS idx_villa_item_ncr_closed
  ON villa_item_ncr (closed);
