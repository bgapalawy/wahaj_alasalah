-- Same rule as cleanup-actual-dates.sql, applied to actual_cost:
-- a cost only means something once the activity is actually Completed,
-- and per the new workflow rule, a Completed item's actual_cost should
-- equal its planned_cost.
--
-- UPDATE: as of this change, activityStatusService.updateActivityStatus()
-- now enforces this live too — marking an activity Completed sets
-- actual_cost = planned_cost automatically, and un-completing clears it
-- back to NULL. So this script is now a one-time backfill for existing
-- data, not the only thing keeping the rule true going forward.
--
-- SAFETY: take a Neon branch snapshot first if you want an easy way
-- back. Run in Neon's SQL Editor.

BEGIN;

-- Before
SELECT
  count(*) FILTER (WHERE status != 'Completed' AND actual_cost IS NOT NULL) AS to_be_cleared,
  count(*) FILTER (WHERE status = 'Completed' AND actual_cost IS DISTINCT FROM planned_cost) AS to_be_set_to_planned
FROM villa_item_status;

-- 1. Non-completed items -> no cost.
UPDATE villa_item_status
SET actual_cost = NULL
WHERE status != 'Completed' AND actual_cost IS NOT NULL;

-- 2. Completed items -> actual_cost matches planned_cost.
UPDATE villa_item_status
SET actual_cost = planned_cost
WHERE status = 'Completed' AND actual_cost IS DISTINCT FROM planned_cost;

-- After — both should be 0
SELECT
  count(*) FILTER (WHERE status != 'Completed' AND actual_cost IS NOT NULL) AS should_be_zero_uncompleted_with_cost,
  count(*) FILTER (WHERE status = 'Completed' AND actual_cost IS DISTINCT FROM planned_cost) AS should_be_zero_completed_mismatch
FROM villa_item_status;

-- Review the counts above; swap COMMIT for ROLLBACK below if anything looks wrong.
COMMIT;
