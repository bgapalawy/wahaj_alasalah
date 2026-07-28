-- Run in Neon's SQL Editor, after the previous migrations.
-- A running, dated log of manual remarks against an item's SCHEDULE
-- status (which is itself computed, not stored — see scheduleUtils.js's
-- computeScheduleStatusFast) — e.g. "procurement issue" dated against
-- an item currently computed as Ready/Delayed. Deliberately separate
-- from villa_item_ncr: this isn't a non-conformance to open/close, just
-- a dated note explaining a scheduling situation. Multiple notes per
-- villa/item are expected (an ongoing situation might get several
-- dated updates), same append-only shape as villa_item_status_history.

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
