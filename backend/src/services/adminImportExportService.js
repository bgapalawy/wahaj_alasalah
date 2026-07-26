import { query } from "../config/postgres.js";
import { constructionItems } from "../data/constructionItems.js";

/**
 * MIGRATED to Postgres. This is the last file migrated in this project,
 * deliberately saved for last since it's the highest-blast-radius write
 * path (bulk imports touch potentially thousands of rows at once).
 *
 * The 8 DynamoDB "tables" the admin dropdown used to offer are now
 * consolidated into just 3 Postgres tables (villa_item_status,
 * villa_item_invoice, villa_special_query_values) — each old table now
 * maps to one specific COLUMN instead of an entire table. IMPORT_TARGETS
 * below is that mapping, and is the ONLY thing admin.routes.js's /tables
 * endpoint needs to expose keys for — the frontend still just receives
 * an opaque {value, label, isDateTable} list and round-trips `value`
 * back on import/export, so nothing in AdminImportExport.jsx needed to
 * change.
 *
 * Date handling is now simpler than it used to be: the old code had to
 * convert dates to Excel serial numbers to match how DynamoDB's date
 * tables stored them (isoDateToExcelSerial). Postgres DATE columns store
 * real dates — the frontend already sends "YYYY-MM-DD" strings (parsed
 * from Excel with cellDates:true), so those go straight into a
 * parameterized query with no conversion needed at all.
 */

const IMPORT_TARGETS = {
  shams_elgroubData: { table: "villa_item_status", column: "status", kind: "text" },
  invoices: { table: "villa_item_invoice", column: "status", kind: "text" },
  plannedDates: { table: "villa_item_status", column: "planned_start", kind: "date" },
  plannedDatesFinish: { table: "villa_item_status", column: "planned_finish", kind: "date" },
  actualDates: { table: "villa_item_status", column: "actual_date", kind: "date" },
  plannedCosts: { table: "villa_item_status", column: "planned_cost", kind: "numeric" },
  actualCosts: { table: "villa_item_status", column: "actual_cost", kind: "numeric" },
  specialQuery: { table: "villa_special_query_values", column: "value", kind: "text", isEAV: true },
};

export const IMPORT_TARGET_KEYS = Object.keys(IMPORT_TARGETS);

function assertKnownTarget(tableName) {
  if (!IMPORT_TARGETS[tableName]) {
    const err = new Error(`"${tableName}" is not one of this app's known import/export targets.`);
    err.status = 400;
    throw err;
  }
}

/** Parses one cell's raw Excel-derived value according to the target column's real type. */
function parseCell(rawValue, kind) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return { skip: true };
  if (kind === "numeric") {
    const n = typeof rawValue === "number" ? rawValue : Number(String(rawValue).replace(/,/g, ""));
    if (Number.isNaN(n)) return { skip: true };
    return { value: n };
  }
  if (kind === "date") {
    // Frontend already sends "YYYY-MM-DD" — just validate it roughly
    // looks like a date rather than re-deriving it, and let Postgres's
    // own ::date cast be the real validator.
    const s = String(rawValue).trim();
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return { skip: true };
    return { value: s.slice(0, 10) };
  }
  return { value: String(rawValue).trim() };
}

/**
 * Bulk-writes parsed Excel rows. Each row is expected as
 * { villaID: "V_1", "Civil-1": "2024-01-01" | 500 | "Completed", ... } —
 * first column is the primary key, every other column becomes one
 * upserted row in the target table (one per construction item / special
 * query column). Unknown construction item IDs and unknown villa IDs
 * are skipped and reported rather than crashing the whole batch — the
 * foreign keys to villas/construction_items would reject them anyway,
 * but doing it here gives a per-row error instead of failing the
 * transaction.
 */
export async function bulkImportRows(tableName, rows, _isDateTableFromClient) {
  assertKnownTarget(tableName);
  const target = IMPORT_TARGETS[tableName]; // kind/date-ness is ALWAYS determined server-side, never trusting the client flag

  const validItemIds = target.isEAV ? null : new Set(constructionItems.map((c) => c.TableItemID));

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  async function writeOneRow(row) {
    const { villaID, ...columns } = row;
    if (!villaID || String(villaID).trim() === "") {
      errorCount++;
      errors.push({ villaID, error: "Missing villaID (primary key)" });
      return;
    }
    const villaId = String(villaID).trim();

    for (const [column, rawValue] of Object.entries(columns)) {
      const parsed = parseCell(rawValue, target.kind);
      if (parsed.skip) continue;

      if (!target.isEAV && !validItemIds.has(column)) {
        errorCount++;
        errors.push({ villaID: villaId, error: `"${column}" is not a known construction item — skipped` });
        continue;
      }

      try {
        if (target.isEAV) {
          await query(
            `INSERT INTO villa_special_query_values (villa_id, column_name, value)
             VALUES ($1, $2, $3)
             ON CONFLICT (villa_id, column_name) DO UPDATE SET value = EXCLUDED.value`,
            [villaId, column, parsed.value]
          );
        } else {
          await query(
            `INSERT INTO villa_item_status (villa_id, table_item_id, ${target.column})
             VALUES ($1, $2, $3)
             ON CONFLICT (villa_id, table_item_id) DO UPDATE SET ${target.column} = EXCLUDED.${target.column}`,
            [villaId, column, parsed.value]
          );
        }
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({ villaID: villaId, error: `${column}: ${err.message}` });
      }
    }
  }

  const CONCURRENCY = 20;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(writeOneRow));
  }

  return { successCount, errorCount, errors: errors.slice(0, 50) };
}

/**
 * Every row for a target, pivoted back to the same WIDE shape the
 * DynamoDB version returned ({ villaID, "Civil-1": value, ... }) so the
 * frontend's existing xlsx-export code needs no changes. Only villas
 * with at least one non-null value for this target appear as a row,
 * matching the old "only what's actually been entered" behavior.
 */
export async function exportTableData(tableName) {
  assertKnownTarget(tableName);
  const target = IMPORT_TARGETS[tableName];

  const dateFormatted = target.kind === "date" ? `to_char(${target.column}, 'YYYY-MM-DD')` : target.column;
  const [{ rows: villaRows }, { rows }] = await Promise.all([
    query(`SELECT villa_id FROM villas`),
    target.isEAV
      ? query(`SELECT villa_id, column_name AS item, value AS val FROM villa_special_query_values WHERE value IS NOT NULL`)
      : query(
          `SELECT villa_id, table_item_id AS item, ${dateFormatted} AS val
           FROM villa_item_status WHERE ${target.column} IS NOT NULL`
        ),
  ]);

  const byVilla = {};
  // Seed every real villa first — even one with zero rows in the target
  // table still gets included (its Zone/Block/Villa Type reference
  // columns, added client-side, need a row to attach to; every item
  // column is simply left blank for it).
  for (const v of villaRows) {
    byVilla[v.villa_id] = { villaID: v.villa_id };
  }
  for (const r of rows) {
    byVilla[r.villa_id] ??= { villaID: r.villa_id };
    byVilla[r.villa_id][r.item] = r.val;
  }
  return Object.values(byVilla);
}

/**
 * Every invoice currently "ReadyToPay" becomes "Paid" — a genuinely
 * bulk, hard-to-undo operation; the frontend confirms before calling it.
 */
export async function convertReadyToPayToPaid() {
  const result = await query(`UPDATE villa_item_invoice SET status = 'Paid' WHERE status = 'ReadyToPay'`);
  return { updatedCount: result.rowCount };
}

/**
 * For every activity marked "Completed" whose invoice isn't already
 * ReadyToPay or Paid, set its invoice to ReadyToPay — same rule as the
 * live auto-trigger in activityStatusService.updateActivityStatus,
 * applied retroactively. Upserts (not just updates) since a completed
 * activity might not have an invoice row at all yet.
 */
export async function convertCompletedToReadyToPay() {
  const result = await query(
    `INSERT INTO villa_item_invoice (villa_id, table_item_id, status)
     SELECT s.villa_id, s.table_item_id, 'ReadyToPay'
     FROM villa_item_status s
     LEFT JOIN villa_item_invoice i ON i.villa_id = s.villa_id AND i.table_item_id = s.table_item_id
     WHERE s.status = 'Completed' AND COALESCE(i.status, 'NotStarted') NOT IN ('ReadyToPay', 'Paid')
     ON CONFLICT (villa_id, table_item_id) DO UPDATE SET status = 'ReadyToPay'`
  );
  return { updatedCount: result.rowCount };
}
