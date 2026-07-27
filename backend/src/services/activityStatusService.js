import { query } from "../config/postgres.js";
import { constructionItems } from "../data/constructionItems.js";
import { autoUpdateInvoiceOnCompletion } from "./invoiceService.js";

/**
 * Tracks per-villa, per-construction-item status + completion date.
 *
 * MIGRATED to Postgres — was two DynamoDB tables (shams_elgroubData for status,
 * Actual_dates for completedDate) merged in JS. Now a single
 * villa_item_status table already has both columns (status, actual_date)
 * on the same row, from the migration that combined all six wide
 * DynamoDB tables. Every function below still returns the same
 * { status, completedDate } shape callers already expect (the
 * dashboards, the dependency graph, computeVillaStatus) — only the data
 * source changed, not the contract.
 *
 * `completedDate` now also carries the status date for NCR/Rejected, not
 * just Completed (kept the same field name rather than renaming it
 * everywhere that already reads it, but it really means "the date this
 * status was set to"). `note` carries reason text for NCR/Rejected, or
 * general notes for Completed/Notes/NotStarted (NOTE_STATUSES below is
 * intentionally wider than DATED_STATUSES — a note doesn't require a
 * date), stored both as the CURRENT value on villa_item_status (fast to
 * read alongside status) and appended to villa_item_status_history (see
 * recordStatusHistory below), which is what the new status timeline
 * reads from.
 */

const DATED_STATUSES = new Set(["Completed", "NCR", "Rejected"]);
const NOTE_STATUSES = new Set(["Completed", "NCR", "Rejected", "Notes", "NotStarted"]);

export async function getActivityStatus(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT status, note, to_char(actual_date, 'YYYY-MM-DD') AS actual_date FROM villa_item_status WHERE villa_id = $1 AND table_item_id = $2`,
    [villaID, tableItemId]
  );
  if (rows.length === 0) return { status: "NotStarted", completedDate: null, note: null };
  return { status: rows[0].status ?? "NotStarted", completedDate: rows[0].actual_date, note: rows[0].note ?? null };
}

/**
 * Returns every construction item's status for a villa — used to color
 * the dependency graph with real per-villa progress. Note: only items
 * that actually have a row appear as keys here (same as the old
 * DynamoDB version returning {} for a villa with no shams_elgroubData entry at
 * all) — computeVillaStatus and downstream consumers already default
 * missing items to "NotStarted" via `?.status ?? "NotStarted"`, so this
 * doesn't need to pad in all 82 items itself.
 */
export async function getAllActivityStatuses(villaID) {
  const { rows } = await query(
    `SELECT table_item_id, status, note, to_char(actual_date, 'YYYY-MM-DD') AS actual_date FROM villa_item_status WHERE villa_id = $1`,
    [villaID]
  );
  const result = {};
  rows.forEach((r) => {
    result[r.table_item_id] = { status: r.status ?? "NotStarted", completedDate: r.actual_date ?? null, note: r.note ?? null };
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
const VALID_ACTIVITY_STATUSES = new Set(["NotStarted", "InProgress", "Completed", "NCR", "Rejected", "Notes"]);

export async function updateActivityStatus(villaID, tableItemId, { status, completedDate, note }) {
  if (!VALID_ACTIVITY_STATUSES.has(status)) {
    const err = new Error(`"${status}" is not a valid activity status.`);
    err.status = 400;
    throw err;
  }
  // Completed/NCR/Rejected all carry a date now — Completed still won't
  // silently default (the frontend enforces picking one deliberately),
  // but this COALESCE stays as a defensive backend fallback for all
  // three so status/actual_date can never end up mismatched even if a
  // caller other than the current UI forgets to send one. Any other
  // status always clears both the date and the note, so nothing lingers
  // from a previous NCR/Rejected/Completed pass once you move off it.
  const normalizedCompletedDate = DATED_STATUSES.has(status) ? completedDate || null : null;
  const normalizedNote = NOTE_STATUSES.has(status) ? note?.trim() || null : null;

  const previous = await getActivityStatus(villaID, tableItemId).catch(() => ({ status: "NotStarted" }));
  const previousStatus = previous.status;

  let result;
  try {
    const { rows } = await query(
      `INSERT INTO villa_item_status (villa_id, table_item_id, status, actual_date, note)
       VALUES ($1, $2, $3, CASE WHEN $3 IN ('Completed','NCR','Rejected') THEN COALESCE($4::date, CURRENT_DATE) ELSE NULL END, $5)
       ON CONFLICT (villa_id, table_item_id) DO UPDATE SET
         status = EXCLUDED.status,
         actual_date = EXCLUDED.actual_date,
         note = EXCLUDED.note,
         actual_cost = CASE WHEN EXCLUDED.status = 'Completed'
                             THEN villa_item_status.planned_cost
                             ELSE NULL END
       RETURNING status, to_char(actual_date, 'YYYY-MM-DD') AS actual_date, actual_cost::float8 AS actual_cost, note`,
      [villaID, tableItemId, status, normalizedCompletedDate, normalizedNote]
    );
    result = rows[0];
  } catch (err) {
    const wrapped = new Error(`Could not save activity status: ${err.message}`);
    wrapped.status = 500;
    throw wrapped;
  }

  // Append-only log for the status timeline — one row per save,
  // regardless of status, so the timeline can show the full lifecycle
  // (NotStarted -> InProgress -> ... -> Completed), not just the dated
  // statuses. A failure here shouldn't fail the status save itself; the
  // current status already saved successfully above.
  await recordStatusHistory(villaID, tableItemId, {
    status: result?.status ?? status,
    statusDate: result?.actual_date ?? normalizedCompletedDate,
    note: result?.note ?? normalizedNote,
  }).catch((err) => {
    console.error(`Could not record status history: ${err.message}`);
  });

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
    note: result?.note ?? normalizedNote,
  };
}

/**
 * Appends one row to villa_item_status_history — the source for the
 * status timeline (StatusTimeline.jsx). Separate table from
 * villa_item_status on purpose: villa_item_status is "current state,
 * fast to read"; this is "every change, ever," so it only ever grows
 * and is never updated in place.
 */
async function recordStatusHistory(villaID, tableItemId, { status, statusDate, note }) {
  await query(
    `INSERT INTO villa_item_status_history (villa_id, table_item_id, status, status_date, note)
     VALUES ($1, $2, $3, $4::date, $5)`,
    [villaID, tableItemId, status, statusDate, note]
  );
}

/**
 * Full status history for one villa/item, oldest first — powers the
 * "Not Started -> ... -> Completed" timeline. `created_at` (not
 * status_date, which is often null for undated statuses like InProgress)
 * is the real chronological order these changes actually happened in.
 */
export async function getActivityStatusHistory(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT status, to_char(status_date, 'YYYY-MM-DD') AS status_date, note,
            created_at
     FROM villa_item_status_history
     WHERE villa_id = $1 AND table_item_id = $2
     ORDER BY created_at ASC`,
    [villaID, tableItemId]
  );
  return rows.map((r) => ({
    status: r.status,
    statusDate: r.status_date,
    note: r.note,
    recordedAt: r.created_at,
  }));
}

// getNcrReportRows moved to ncrService.js — the NCR report now reads
// from the dedicated villa_item_ncr table (supports multiple/closeable
// NCRs per item) instead of deriving NCR membership from this table's
// single-value status column.

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
    `SELECT villa_id, table_item_id, status, note, to_char(actual_date, 'YYYY-MM-DD') AS actual_date FROM villa_item_status WHERE villa_id = ANY($1)`,
    [villaIDs]
  );
  rows.forEach((r) => {
    merged[r.villa_id][r.table_item_id] = { status: r.status ?? "NotStarted", completedDate: r.actual_date ?? null, note: r.note ?? null };
  });
  return merged;
}

/**
 * Every (villa, item) that has EVER had a status recorded, across the
 * whole project — feeds the new "Villa Status" tab in the Quality
 * dashboard (QualityDashboard.jsx / VillaStatusReport.jsx). Deliberately
 * scoped the same way the NCR and Out-of-Sequence reports already are:
 * rows that exist, not a full villas x construction_items cross-product
 * (~1,500 villas x 82 items) — a villa/item with no row here is
 * implicitly NotStarted and not shown, same convention
 * getAllActivityStatuses already uses. Zone/block for filtering are
 * joined client-side against useVillaGeoMeta, not here, since that data
 * is already loaded once for the whole map and this avoids a second
 * join query that would just duplicate it.
 */
export async function getStatusReportRows() {
  const { rows } = await query(
    `SELECT villa_id, table_item_id, status, note, to_char(actual_date, 'YYYY-MM-DD') AS actual_date
     FROM villa_item_status
     ORDER BY villa_id, table_item_id`
  );
  return rows.map((r) => ({
    villaID: r.villa_id,
    tableItemId: r.table_item_id,
    status: r.status ?? "NotStarted",
    date: r.actual_date,
    note: r.note,
  }));
}
