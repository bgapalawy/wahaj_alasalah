-- Run in Neon's SQL Editor, after the previous migrations.
-- A generic, reusable audit trail — not specific to any one feature —
-- so any future mutation can log to it the same way. Currently wired
-- into: activity status changes, NCR add/close, schedule note
-- additions (see activityStatusService.js, ncrService.js,
-- scheduleNoteService.js). Deliberately NOT a per-entity table (e.g.
-- separate ncr_history, status_history tables) — one shared table with
-- an `entity_type` column is what lets the Quality "History" tab show
-- everything in one filterable timeline instead of stitching several
-- sources together.

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  villa_id TEXT,
  table_item_id TEXT,
  entity_type TEXT NOT NULL,   -- 'activity_status' | 'ncr' | 'schedule_note' | ... (more as coverage extends)
  action TEXT NOT NULL,        -- 'created' | 'updated' | 'closed' | 'reopened' | ...
  field TEXT,                  -- e.g. 'status', 'note', 'closed' — null when the whole record is the change (e.g. a new NCR)
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,             -- username from the JWT (req.user.username) — null if somehow unauthenticated
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_lookup ON audit_log (villa_id, table_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at);
