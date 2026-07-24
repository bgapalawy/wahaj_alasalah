import { query } from "../config/postgres.js";

/**
 * One construction item's data across every villa — replaces the
 * "monitoring type 1" flow in dashboardconstructionitem.js /
 * constructionItemsContainer.js, which counted villas by status for a
 * single selected item and showed planned/actual value + timeline dates.
 *
 * MIGRATED to Postgres (Neon) — was six separate DynamoDB
 * getManyVillaWideItems() calls (plannedCosts/actualCosts/plannedDates/
 * plannedDatesFinish/wajhaData/actualDates) plus a villa scan, merged in
 * JS. Now a single query with LEFT JOINs, since villa_item_status
 * already merged those six wide tables into one row per (villa, item)
 * during the migration (see scripts/migrate-to-postgres.js).
 *
 * Return shape is UNCHANGED from the DynamoDB version on purpose — same
 * field names (villaID, blocknum, plannedCost, ...), same array-of-
 * objects-per-villa shape — so dashboard.routes.js and every frontend
 * component reading this (AllProjectsDashboard.jsx, FilterBar.jsx) work
 * without any changes.
 *
 * LEFT JOIN (not INNER) so a villa with zero activity entered for this
 * item still appears in the results with NotStarted/null defaults —
 * matching the old code's `?? "NotStarted"` / `?? null` fallbacks for
 * villas missing from the wide DynamoDB tables.
 *
 * to_char(...) for dates instead of returning Postgres's native DATE
 * type: node-pg parses DATE columns into JS Date objects in the
 * server's local timezone, which can silently shift the date by a day
 * depending on where this runs. Formatting to "YYYY-MM-DD" in SQL
 * sidesteps that entirely — the frontend only ever consumed a plain
 * ISO date string here anyway.
 */
export async function getConstructionItemDashboardData(tableItemId) {
  const { rows } = await query(
    `SELECT
       v.villa_id                              AS "villaID",
       v.block                                 AS "blocknum",
       s.planned_cost::float8                  AS "plannedCost",
       s.actual_cost::float8                   AS "actualCost",
       to_char(s.planned_start, 'YYYY-MM-DD')  AS "plannedStartDate",
       to_char(s.planned_finish, 'YYYY-MM-DD') AS "plannedFinishDate",
       COALESCE(s.status, 'NotStarted')        AS "actualStatus",
       to_char(s.actual_date, 'YYYY-MM-DD')    AS "actualCompletedDate",
       COALESCE(i.status, 'NotStarted')        AS "invoiceStatus"
     FROM villas v
     LEFT JOIN villa_item_status s
       ON s.villa_id = v.villa_id AND s.table_item_id = $1
     LEFT JOIN villa_item_invoice i
       ON i.villa_id = v.villa_id AND i.table_item_id = $1
     ORDER BY v.villa_id`,
    [tableItemId]
  );

  // stage was always null in the DynamoDB version too (no villa in the
  // original data ever actually carried a "stage" attribute) — kept in
  // the shape so nothing downstream that reads `.stage` breaks, even
  // though nothing currently sets it to a real value.
  return rows.map((r) => ({ ...r, stage: null }));
}
