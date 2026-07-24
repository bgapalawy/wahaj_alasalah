import { query } from "../config/postgres.js";

/**
 * Returns every construction item joined with this villa's planned/actual
 * cost and planned/actual dates — the raw material the villa dashboard
 * aggregates into charts on the frontend.
 *
 * MIGRATED to Postgres — was 5 DynamoDB reads (2 getVillaWideItem calls +
 * getAllActivityStatuses, itself multiple reads) merged against the
 * static constructionItems.js array in JS. Now one query, joined FROM
 * construction_items (not villas) so all 82 items always appear in a
 * fixed order, same as the original array-based version — a villa with
 * no activity entered yet for an item still gets a row with NotStarted/
 * null defaults via the LEFT JOIN.
 */
export async function getVillaDashboardData(villaID) {
  const { rows } = await query(
    `SELECT
       ci.table_item_id                        AS "TableItemID",
       ci.name,
       s.planned_cost::float8                  AS "plannedCost",
       s.actual_cost::float8                   AS "actualCost",
       to_char(s.planned_start, 'YYYY-MM-DD')  AS "plannedStartDate",
       to_char(s.planned_finish, 'YYYY-MM-DD') AS "plannedFinishDate",
       COALESCE(s.status, 'NotStarted')        AS "actualStatus",
       to_char(s.actual_date, 'YYYY-MM-DD')    AS "actualCompletedDate"
     FROM construction_items ci
     LEFT JOIN villa_item_status s
       ON s.table_item_id = ci.table_item_id AND s.villa_id = $1
     ORDER BY ci.item_id`,
    [villaID]
  );
  return rows;
}

/**
 * Planned/actual cost + planned start/finish date for one construction
 * item on one villa — used by the construction-item picker in the panel.
 * Lighter than the full 82-item dashboard join since it only reads the
 * one item this villa's panel actually needs.
 *
 * MIGRATED to Postgres. Kept the same "always return an object, default
 * missing costs to 0 and missing dates to null" behavior as the old
 * DynamoDB version (getVillaWideItem returned {} for a villa/item with
 * no row, and toCostNumber(undefined) -> 0, toDateString(undefined) ->
 * null) — a plain WHERE query returns zero rows in that case instead of
 * an empty object, so that fallback is now explicit here.
 */
export async function getPlannedDatesForItem(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT
       planned_cost::float8                  AS "plannedCost",
       actual_cost::float8                   AS "actualCost",
       to_char(planned_start, 'YYYY-MM-DD')  AS "plannedStartDate",
       to_char(planned_finish, 'YYYY-MM-DD') AS "plannedFinishDate"
     FROM villa_item_status
     WHERE villa_id = $1 AND table_item_id = $2`,
    [villaID, tableItemId]
  );
  if (rows.length === 0) {
    return { plannedStartDate: null, plannedFinishDate: null, plannedCost: 0, actualCost: 0 };
  }
  const row = rows[0];
  return {
    plannedStartDate: row.plannedStartDate,
    plannedFinishDate: row.plannedFinishDate,
    plannedCost: row.plannedCost ?? 0,
    actualCost: row.actualCost ?? 0,
  };
}
