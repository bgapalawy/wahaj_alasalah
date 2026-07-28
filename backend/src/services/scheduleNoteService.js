import { query } from "../config/postgres.js";
import { recordAuditLog } from "./auditLogService.js";

/**
 * A dated log of manual remarks against an item's computed SCHEDULE
 * status (e.g. "procurement issue" noted against an item whose schedule
 * classification is currently Ready/Delayed/etc. — see
 * scheduleUtils.js's computeScheduleStatusFast, which is what actually
 * computes that status; this table only stores the human commentary
 * about it). Multiple notes per villa/item are expected — an ongoing
 * situation might get several dated updates over time.
 */

function rowToNote(row) {
  return {
    id: row.id,
    villaID: row.villa_id,
    tableItemId: row.table_item_id,
    note: row.note,
    noteDate: row.note_date,
    createdAt: row.created_at,
  };
}

/** Every schedule note for one villa/item, most recent first. */
export async function getScheduleNotesForItem(villaID, tableItemId) {
  const { rows } = await query(
    `SELECT id, villa_id, table_item_id, note,
            to_char(note_date, 'YYYY-MM-DD') AS note_date,
            created_at
     FROM villa_item_schedule_note
     WHERE villa_id = $1 AND table_item_id = $2
     ORDER BY note_date DESC, id DESC`,
    [villaID, tableItemId]
  );
  return rows.map(rowToNote);
}

/** Adds a new schedule note — never overwrites an existing one, same "append, don't replace" pattern as NCRs. */
export async function addScheduleNote(villaID, tableItemId, { noteDate, note, changedBy = null }) {
  const trimmed = note?.trim();
  if (!trimmed) {
    const err = new Error("note is required");
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `INSERT INTO villa_item_schedule_note (villa_id, table_item_id, note, note_date)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))
     RETURNING id, villa_id, table_item_id, note,
               to_char(note_date, 'YYYY-MM-DD') AS note_date,
               created_at`,
    [villaID, tableItemId, trimmed, noteDate || null]
  );
  const created = rowToNote(rows[0]);

  await recordAuditLog({
    villaID,
    tableItemId,
    entityType: "schedule_note",
    action: "created",
    newValue: created.note,
    changedBy,
  }).catch((err) => {
    console.error(`Could not record audit log: ${err.message}`);
  });

  return created;
}

/**
 * Every schedule note across the whole project — feeds the "Scheduling"
 * tab of the Quality dashboard. Joined against villa_item_status for
 * planned_start + current actual status, so the frontend can compute
 * each row's live schedule classification (computeScheduleStatusFast
 * needs a planned start date and the item's own actual status — neither
 * of which this table stores itself) without a second round-trip.
 */
export async function getScheduleNoteReportRows() {
  const { rows } = await query(
    `SELECT sn.villa_id, sn.table_item_id, sn.note,
            to_char(sn.note_date, 'YYYY-MM-DD') AS note_date,
            sn.created_at,
            to_char(vis.planned_start, 'YYYY-MM-DD') AS planned_start_date,
            COALESCE(vis.status, 'NotStarted') AS actual_status
     FROM villa_item_schedule_note sn
     LEFT JOIN villa_item_status vis
       ON vis.villa_id = sn.villa_id AND vis.table_item_id = sn.table_item_id
     ORDER BY sn.note_date DESC, sn.id DESC`
  );
  return rows.map((r) => ({
    villaID: r.villa_id,
    tableItemId: r.table_item_id,
    note: r.note,
    noteDate: r.note_date,
    createdAt: r.created_at,
    plannedStartDate: r.planned_start_date,
    actualStatus: r.actual_status,
  }));
}
