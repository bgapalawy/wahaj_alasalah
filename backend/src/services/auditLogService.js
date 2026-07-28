import { query } from "../config/postgres.js";

/**
 * Generic, reusable audit trail — see migration_audit_log.sql for why
 * this is one shared table (entity_type column) rather than a separate
 * history table per feature. `recordAuditLog` is the write side, called
 * from wherever a mutation happens (activityStatusService.js,
 * ncrService.js, scheduleNoteService.js so far); `getAuditLogRows` is
 * the read side, feeding the Quality dashboard's "History" tab.
 *
 * A failed audit-log write should never fail the actual mutation it's
 * describing — every call site wraps this in a .catch() that just logs
 * to the console, same pattern already used for
 * autoUpdateInvoiceOnCompletion's own best-effort side-effect.
 */
export async function recordAuditLog({
  villaID = null,
  tableItemId = null,
  entityType,
  action,
  field = null,
  oldValue = null,
  newValue = null,
  changedBy = null,
}) {
  await query(
    `INSERT INTO audit_log (villa_id, table_item_id, entity_type, action, field, old_value, new_value, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      villaID,
      tableItemId,
      entityType,
      action,
      field,
      oldValue != null ? String(oldValue) : null,
      newValue != null ? String(newValue) : null,
      changedBy,
    ]
  );
}

/**
 * Every audit log entry, most recent first — feeds the Quality
 * dashboard's History tab, which does its own client-side
 * filter/search, same pattern as the other Quality reports. Capped at
 * 5,000 rows (not unbounded) since this table only ever grows; a
 * project running long enough to exceed that in practice is a sign
 * this needs real pagination, not a reason to silently return
 * everything and slow the tab down.
 */
export async function getAuditLogRows() {
  const { rows } = await query(
    `SELECT id, villa_id, table_item_id, entity_type, action, field, old_value, new_value, changed_by, created_at
     FROM audit_log
     ORDER BY created_at DESC
     LIMIT 5000`
  );
  return rows.map((r) => ({
    id: r.id,
    villaID: r.villa_id,
    tableItemId: r.table_item_id,
    entityType: r.entity_type,
    action: r.action,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    changedBy: r.changed_by,
    createdAt: r.created_at,
  }));
}
