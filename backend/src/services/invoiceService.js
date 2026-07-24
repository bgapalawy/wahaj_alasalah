import { query } from "../config/postgres.js";

/**
 * Invoice status per villa/construction item — the original app's
 * "monitoring type 3" (Invoice) view. Valid values (matching the
 * original statusColorMapInvoice): NotStarted, InProgress, ReadyToPay,
 * Paid.
 *
 * MIGRATED to Postgres — reads/writes villa_item_invoice instead of the
 * DynamoDB wide invoice table. Migrated together with
 * activityStatusService.js in the same step since
 * autoUpdateInvoiceOnCompletion() below is called directly from that
 * file's updateActivityStatus() — splitting the write paths across two
 * different databases mid-transaction would risk exactly the kind of
 * silent inconsistency flagged in villaService.js's migration notes.
 */

export async function getInvoiceStatus(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT status FROM villa_item_invoice WHERE villa_id = $1 AND table_item_id = $2`,
    [villaID, tableItemId]
  );
  return rows[0]?.status ?? "NotStarted";
}

export async function getAllInvoiceStatuses(villaID) {
  const { rows } = await query(
    `SELECT table_item_id, status FROM villa_item_invoice WHERE villa_id = $1`,
    [villaID]
  );
  const result = {};
  rows.forEach((r) => { result[r.table_item_id] = r.status; });
  return result;
}

export async function getManyInvoiceStatuses(villaIDs) {
  const { rows } = await query(
    `SELECT villa_id, table_item_id, status FROM villa_item_invoice WHERE villa_id = ANY($1)`,
    [villaIDs]
  );
  const result = {};
  villaIDs.forEach((id) => { result[id] = {}; });
  rows.forEach((r) => { result[r.villa_id][r.table_item_id] = r.status; });
  return result;
}

export async function updateInvoiceStatus(villaID, tableItemId, status) {
  const { rows } = await query(
    `INSERT INTO villa_item_invoice (villa_id, table_item_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (villa_id, table_item_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING status`,
    [villaID, tableItemId, status]
  );
  return rows[0]?.status ?? status;
}

/**
 * Ports the original app's auto-invoice-trigger: when an activity's
 * status transitions INTO "Completed" from something else, its invoice
 * status is automatically set to "ReadyToPay" — someone still has to
 * mark it "Paid" manually, but it's surfaced as billable the moment the
 * work is done instead of requiring a separate manual step.
 *
 * Deliberately does NOT auto-revert the invoice when un-completing an
 * activity — unchanged from the original: the frontend only *warns* if
 * the invoice was already "Paid" and leaves any actual change to a
 * manual decision. Reverting a paid invoice automatically would be a
 * real financial side-effect to make silently.
 */
export async function autoUpdateInvoiceOnCompletion(villaID, tableItemId, previousStatus, newStatus) {
  if (newStatus === "Completed" && previousStatus !== "Completed") {
    await updateInvoiceStatus(villaID, tableItemId, "ReadyToPay");
  }
}
