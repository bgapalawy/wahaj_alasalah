import { query } from "../config/postgres.js";
import { constructionItems } from "../data/constructionItems.js";
import { autoUpdateInvoiceOnCompletion } from "./invoiceService.js";

/**
 * Tracks per-villa, per-construction-item status + completion date.
 *
 * MIGRATED to Postgres — was two DynamoDB tables (wajhaData for status,
 * Actual_dates for completedDate) merged in JS. Now a single
 * villa_item_status table already has both columns (status, actual_date)
 * on the same row, from the migration that combined all six wide
 * DynamoDB tables. Every function below still returns the same
 * { status, completedDate } shape callers already expect (the
 * dashboards, the dependency graph, computeVillaStatus) — only the data
 * source changed, not the contract.
 */

export async function getActivityStatus(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT status, to_char(actual_date, 'YYYY-MM-DD') AS actual_date FROM villa_item_status WHERE villa_id = $1 AND table_item_id = $2`,
    [villaID, tableItemId]
  );
  if (rows.length === 0) return { status: "NotStarted", completedDate: null };
  return { status: rows[0].status ?? "NotStarted", completedDate: rows[0].actual_date };
}

/**
 * Returns every construction item's status for a villa — used to color
 * the dependency graph with real per-villa progress. Note: only items
 * that actually have a row appear as keys here (same as the old
 * DynamoDB version returning {} for a villa with no wajhaData entry at
 * all) — computeVillaStatus and downstream consumers already default
 * missing items to "NotStarted" via `?.status ?? "NotStarted"`, so this
 * doesn't need to pad in all 82 items itself.
 */
export async function getAllActivityStatuses(villaID) {
  const { rows } = await query(
    `SELECT table_item_id, status, to_char(actual_date, 'YYYY-MM-DD') AS actual_date FROM villa_item_status WHERE villa_id = $1`,
    [villaID]
  );
  const result = {};
  rows.forEach((r) => {
    result[r.table_item_id] = { status: r.status ?? "NotStarted", completedDate: r.actual_date ?? null };
  });
  return result;
}

/**
 * Saves a status change (upsert — a villa/item with no prior row at all
 * gets one created). Ports the original app's invoice auto-trigger:
 * reads the PREVIOUS status first, and if this change transitions the
 * activity INTO "Completed" from something else, automatically marks
 * its invoice "ReadyToPay" (see invoiceService.autoUpdateInvoiceOnCompletion).
 * This read-before-write is the only way to know it's a transition
 * rather than an already-Completed item being re-saved.
 *
 * The UPSERT only ever touches status/actual_date — planned_cost,
 * planned_start, planned_finish are left completely alone on conflict,
 * same as the old DynamoDB version only ever wrote to its own two
 * tables and never touched plannedCosts/plannedDates.
 */
export async function updateActivityStatus(villaID, tableItemId, { status, completedDate }) {
  // No longer a hard requirement — if left blank while marking Completed,
  // this defaults to today (via the database's own CURRENT_DATE, not the
  // Node process's clock, for the same timezone-safety reason actual_date
  // is read back with to_char() elsewhere in this file). Still enforces
  // the other half of the rule unconditionally: non-Completed always
  // clears the date, so status and actual_date can't drift apart.
  const normalizedCompletedDate = status === "Completed" ? completedDate || null : null;

  const previous = await getActivityStatus(villaID, tableItemId).catch(() => ({ status: "NotStarted" }));
  const previousStatus = previous.status;

  let result;
  try {
    const { rows } = await query(
      `INSERT INTO villa_item_status (villa_id, table_item_id, status, actual_date)
       VALUES ($1, $2, $3, CASE WHEN $3 = 'Completed' THEN COALESCE($4::date, CURRENT_DATE) ELSE NULL END)
       ON CONFLICT (villa_id, table_item_id) DO UPDATE SET
         status = EXCLUDED.status,
         actual_date = EXCLUDED.actual_date,
         actual_cost = CASE WHEN EXCLUDED.status = 'Completed'
                             THEN villa_item_status.planned_cost
                             ELSE NULL END
       RETURNING status, to_char(actual_date, 'YYYY-MM-DD') AS actual_date, actual_cost::float8 AS actual_cost`,
      [villaID, tableItemId, status, normalizedCompletedDate]
    );
    result = rows[0];
  } catch (err) {
    const wrapped = new Error(`Could not save activity status: ${err.message}`);
    wrapped.status = 500;
    throw wrapped;
  }

  await autoUpdateInvoiceOnCompletion(villaID, tableItemId, previousStatus, status).catch((err) => {
    // Don't fail the whole status save just because the invoice
    // auto-update failed — the activity status itself already saved
    // successfully, and this is a secondary side-effect.
    console.error(`Could not auto-update invoice status: ${err.message}`);
  });

  return {
    status: result?.status ?? status,
    completedDate: result?.actual_date ?? normalizedCompletedDate,
    actualCost: result?.actual_cost ?? null,
  };
}

/**
 * Derives a villa's overall status from its individual activity statuses:
 *   - every one of the 82 activities is "Completed"  -> "Completed"
 *   - at least one activity is anything but "NotStarted" -> "InProgress"
 *   - otherwise -> "NotStarted"
 * This is computed on read, not stored — there is no separate "villa
 * status" field to keep in sync. Pure function, unchanged by the
 * migration — no DB access here at all.
 */
export function computeVillaStatus(activityStatusMap = {}) {
  const statuses = constructionItems.map(
    (item) => activityStatusMap[item.TableItemID]?.status ?? "NotStarted"
  );
  const allCompleted = statuses.every((s) => s === "Completed");
  if (allCompleted) return "Completed";
  const anyStarted = statuses.some((s) => s !== "NotStarted");
  return anyStarted ? "InProgress" : "NotStarted";
}

/**
 * Batch version of getAllActivityStatuses for many villas at once (used
 * when listing all villas, e.g. for map coloring) — one query instead of
 * per-villa DynamoDB BatchGetCommand passes across two tables.
 */
export async function getManyActivityStatuses(villaIDs) {
  const merged = {};
  villaIDs.forEach((id) => { merged[id] = {}; });

  if (villaIDs.length === 0) return merged;

  const { rows } = await query(
    `SELECT villa_id, table_item_id, status, to_char(actual_date, 'YYYY-MM-DD') AS actual_date FROM villa_item_status WHERE villa_id = ANY($1)`,
    [villaIDs]
  );
  rows.forEach((r) => {
    merged[r.villa_id][r.table_item_id] = { status: r.status ?? "NotStarted", completedDate: r.actual_date ?? null };
  });
  return merged;
}
