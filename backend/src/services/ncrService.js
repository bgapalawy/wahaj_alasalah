import { query } from "../config/postgres.js";
import { recordAuditLog } from "./auditLogService.js";

/**
 * A villa/item can have multiple, independently-tracked NCRs (Non-
 * Conformance Reports) open at once — deliberately separate from the
 * single-value "status" column on villa_item_status (which still has
 * its own "NCR" option, unchanged), since a single value can't
 * represent "2 open NCRs plus 1 already closed" on the same item.
 */

function rowToNcr(row) {
  return {
    id: row.id,
    villaID: row.villa_id,
    tableItemId: row.table_item_id,
    openedDate: row.opened_date,
    note: row.note,
    closed: row.closed,
    closedDate: row.closed_date,
    closingNote: row.closing_note,
    // Precise timestamps, not just the plain opened/closed dates — lets
    // the status timeline (StatusTimeline.jsx) merge NCR events in with
    // villa_item_status_history entries and sort everything correctly
    // even when several things happened on the same calendar date.
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every NCR (open and closed) for one villa/item, most recently opened first. */
export async function getNcrsForItem(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT id, villa_id, table_item_id,
            to_char(opened_date, 'YYYY-MM-DD') AS opened_date,
            note, closed,
            to_char(closed_date, 'YYYY-MM-DD') AS closed_date,
            closing_note,
            created_at, updated_at
     FROM villa_item_ncr
     WHERE villa_id = $1 AND table_item_id = $2
     ORDER BY opened_date DESC, id DESC`,
    [villaID, tableItemId]
  );
  return rows.map(rowToNcr);
}

/** Opens a new NCR — this is what lets an item have 2+ NCRs: every call inserts a new row, never overwrites an existing one. */
export async function addNcr(villaID, tableItemId, { openedDate, note, changedBy = null }) {
  const { rows } = await query(
    `INSERT INTO villa_item_ncr (villa_id, table_item_id, opened_date, note)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4)
     RETURNING id, villa_id, table_item_id,
               to_char(opened_date, 'YYYY-MM-DD') AS opened_date,
               note, closed,
               to_char(closed_date, 'YYYY-MM-DD') AS closed_date,
               closing_note,
               created_at, updated_at`,
    [villaID, tableItemId, openedDate || null, note?.trim() || null]
  );
  const created = rowToNcr(rows[0]);

  await recordAuditLog({
    villaID,
    tableItemId,
    entityType: "ncr",
    action: "created",
    newValue: created.note,
    changedBy,
  }).catch((err) => {
    console.error(`Could not record audit log: ${err.message}`);
  });

  return created;
}

/**
 * Updates one NCR — used for the "closed" checkbox + closing date +
 * closing reason, but general enough to also fix a typo'd opening note
 * or opened date later. Only the fields actually passed get changed;
 * leaving `closed` out (e.g. a pure note edit) doesn't accidentally
 * reopen or reclose anything. Closing without an explicit date defaults
 * to today, same "pick a date or take today" pattern as the main
 * activity status fields.
 */
export async function updateNcr(villaID, tableItemId, ncrId, { closed, closedDate, closingNote, note, openedDate, changedBy = null }) {
  const setClauses = ["updated_at = now()"];
  const params = [villaID, tableItemId, ncrId];

  if (closed !== undefined) {
    params.push(closed);
    setClauses.push(`closed = $${params.length}`);
    if (closed) {
      params.push(closedDate || null);
      setClauses.push(`closed_date = COALESCE($${params.length}::date, CURRENT_DATE)`);
      params.push(closingNote?.trim() || null);
      setClauses.push(`closing_note = $${params.length}`);
    } else {
      // Reopening clears the closing date AND reason rather than
      // leaving stale ones that no longer match "closed = false".
      setClauses.push(`closed_date = NULL`);
      setClauses.push(`closing_note = NULL`);
    }
  } else if (closingNote !== undefined) {
    // Editing the closing reason later without touching `closed` itself
    // (e.g. fixing a typo on an already-closed NCR).
    params.push(closingNote?.trim() || null);
    setClauses.push(`closing_note = $${params.length}`);
  }
  if (note !== undefined) {
    params.push(note?.trim() || null);
    setClauses.push(`note = $${params.length}`);
  }
  if (openedDate !== undefined) {
    params.push(openedDate || null);
    setClauses.push(`opened_date = COALESCE($${params.length}::date, opened_date)`);
  }

  const { rows } = await query(
    `UPDATE villa_item_ncr SET ${setClauses.join(", ")}
     WHERE villa_id = $1 AND table_item_id = $2 AND id = $3
     RETURNING id, villa_id, table_item_id,
               to_char(opened_date, 'YYYY-MM-DD') AS opened_date,
               note, closed,
               to_char(closed_date, 'YYYY-MM-DD') AS closed_date,
               closing_note,
               created_at, updated_at`,
    params
  );
  if (rows.length === 0) {
    const err = new Error(`NCR ${ncrId} not found for ${villaID}/${tableItemId}`);
    err.status = 404;
    throw err;
  }
  const updated = rowToNcr(rows[0]);

  // The "closed" toggle is the main action worth naming (close/reopen);
  // anything else (a note edit) is logged as a generic update. NcrList
  // sends "closed" alone or together with closedDate/closingNote in one
  // call, never those two alone, so this doesn't miss a real close/
  // reopen action.
  await recordAuditLog({
    villaID,
    tableItemId,
    entityType: "ncr",
    action: closed !== undefined ? (closed ? "closed" : "reopened") : "updated",
    field: closed !== undefined ? "closed" : "note",
    newValue: closed !== undefined ? (updated.closingNote ?? String(updated.closed)) : updated.note,
    changedBy,
  }).catch((err) => {
    console.error(`Could not record audit log: ${err.message}`);
  });

  return updated;
}

/**
 * Every NCR across the whole project (open and closed) — feeds
 * NcrReport.jsx directly. Item display names are joined in client-side
 * against constructionItemsApi.list(), same as before.
 */
export async function getNcrReportRows() {
  const { rows } = await query(
    `SELECT id, villa_id, table_item_id,
            to_char(opened_date, 'YYYY-MM-DD') AS opened_date,
            note, closed,
            to_char(closed_date, 'YYYY-MM-DD') AS closed_date,
            closing_note
     FROM villa_item_ncr
     ORDER BY closed ASC, opened_date DESC`,
    []
  );
  return rows.map((r) => ({
    id: r.id,
    villaID: r.villa_id,
    tableItemId: r.table_item_id,
    date: r.opened_date,
    note: r.note,
    closed: r.closed,
    closedDate: r.closed_date,
    closingNote: r.closing_note,
  }));
}

/**
 * Deletes EVERY NCR across the whole project — a hard reset of the
 * table, not a per-villa/item operation. Used by the "Clear all NCR
 * data" button in NcrReport.jsx; that button confirms with the user
 * before calling this, since there's no undo once these rows are gone.
 */
export async function clearAllNcrs() {
  const { rowCount } = await query(`DELETE FROM villa_item_ncr`, []);
  return { deletedCount: rowCount };
}
