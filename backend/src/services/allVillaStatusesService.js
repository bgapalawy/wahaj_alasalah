import { query } from "../config/postgres.js";

/**
 * MIGRATED to Postgres. This file was missed in the original migration
 * pass (services were migrated one at a time; this one slipped through)
 * — caught while building the out-of-sequence feature, which depends on
 * this data being live. Before this fix, Schedule coloring mode, the
 * Custom Query builder, and this data were all silently reading a frozen
 * DynamoDB snapshot from before the migration, never reflecting any
 * status/invoice changes saved since.
 *
 * Every real villa's full status map (all ~82 construction items) — used
 * by the frontend's Schedule coloring mode, which checks whether an
 * item's PREDECESSORS are Completed across every villa at once. Return
 * shape is PLAIN STRINGS ({villaID: {tableItemId: "Completed"}}), not
 * {status, completedDate} objects — scheduleUtils.js's
 * computeScheduleStatusFast does a direct `=== "Completed"` string
 * comparison against this, so the shape matters here specifically
 * (unlike getManyActivityStatuses in activityStatusService.js, which
 * intentionally returns the richer object shape for different callers).
 *
 * Every real villa gets an entry (even an empty {}) so callers that
 * iterate Object.keys() see the full villa list, matching the original
 * DynamoDB version's behavior.
 */
export async function getAllVillaStatuses() {
  const [villasResult, statusResult] = await Promise.all([
    query(`SELECT villa_id FROM villas`),
    query(`SELECT villa_id, table_item_id, status FROM villa_item_status`),
  ]);
  const result = {};
  for (const v of villasResult.rows) result[v.villa_id] = {};
  for (const r of statusResult.rows) {
    result[r.villa_id] ??= {};
    result[r.villa_id][r.table_item_id] = r.status;
  }
  return result;
}

/** Same shape as getAllVillaStatuses, from villa_item_invoice instead. */
export async function getAllVillaInvoiceStatuses() {
  const [villasResult, invoiceResult] = await Promise.all([
    query(`SELECT villa_id FROM villas`),
    query(`SELECT villa_id, table_item_id, status FROM villa_item_invoice`),
  ]);
  const result = {};
  for (const v of villasResult.rows) result[v.villa_id] = {};
  for (const r of invoiceResult.rows) {
    result[r.villa_id] ??= {};
    result[r.villa_id][r.table_item_id] = r.status;
  }
  return result;
}

/**
 * The Custom Query builder's data source — dynamic, user-defined columns
 * per villa (not a fixed schema), pivoted back from the EAV-shaped
 * villa_special_query_values table into the same wide
 * [{villaID, col1: val1, col2: val2}, ...] shape the original DynamoDB
 * scan returned, so the frontend's runtime column-discovery logic
 * (inspecting object keys) keeps working unchanged.
 */
export async function getSpecialQueryData() {
  const { rows } = await query(`SELECT villa_id, column_name, value FROM villa_special_query_values`);
  const byVilla = {};
  for (const r of rows) {
    byVilla[r.villa_id] ??= { villaID: r.villa_id };
    byVilla[r.villa_id][r.column_name] = r.value;
  }
  return Object.values(byVilla);
}
