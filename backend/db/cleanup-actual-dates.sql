-- One-time cleanup: enforce "actual_date only exists for Completed items"
-- across the whole table, per explicit decision after reviewing the
-- V_222 sample (40,199 of 48,380 rows had a date on a non-Completed
-- item — confirmed this is legacy/mismatched data, not a separate
-- meaningful field).
--
-- SAFETY: this touches ~83% of the table. Before running for real,
-- take a Neon branch snapshot so this is trivially reversible:
--   Neon dashboard -> Branches -> "New Branch" -> branch off "production"
--   at the current moment. If anything looks wrong after running this,
--   you can restore from that branch instead of trying to reconstruct
--   the original values by hand.
--
-- Run in Neon's SQL Editor, or: psql "$DATABASE_URL" -f db/cleanup-actual-dates.sql

BEGIN;

-- Sanity check BEFORE — compare this to the 40,199 you already saw.
SELECT
  count(*) FILTER (WHERE status != 'Completed' AND actual_date IS NOT NULL) AS to_be_cleared,
  count(*) FILTER (WHERE status = 'Completed' AND actual_date IS NULL) AS to_be_dated
FROM villa_item_status;

-- 1. Completed items missing a date -> today.
UPDATE villa_item_status
SET actual_date = CURRENT_DATE
WHERE status = 'Completed' AND actual_date IS NULL;

-- 2. Non-completed items -> no date.
UPDATE villa_item_status
SET actual_date = NULL
WHERE status != 'Completed' AND actual_date IS NOT NULL;

-- Sanity check AFTER — both should be 0 once this is committed.
SELECT
  count(*) FILTER (WHERE status != 'Completed' AND actual_date IS NOT NULL) AS should_be_zero_uncompleted_with_date,
  count(*) FILTER (WHERE status = 'Completed' AND actual_date IS NULL) AS should_be_zero_completed_without_date
FROM villa_item_status;

-- Review the counts printed above. If they look right, run COMMIT.
-- If anything looks off, run ROLLBACK instead and nothing is changed.
COMMIT;
