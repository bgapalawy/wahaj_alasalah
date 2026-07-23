import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../config/aws.js";
import { scanEntireTable } from "./wideTableService.js";

/**
 * Ports the original app's uploadingtodatabasefromexcel.js — a genuinely
 * powerful bulk-write admin tool. Architecture differs from the original
 * on purpose: the original ran the AWS SDK directly in the browser and
 * parsed + wrote the Excel file all client-side. This app moved AWS
 * access server-side for security, so the split here is: the FRONTEND
 * parses the uploaded .xlsx file (using the xlsx library already a
 * dependency for exports elsewhere) and sends plain JSON rows here; this
 * service does the actual DynamoDB writes.
 *
 * Table names are validated against the known `tables` config (not
 * accepted as an arbitrary string from the request) so this can't be
 * pointed at some other AWS resource by a malformed request.
 */

const ALLOWED_TABLES = new Set(Object.values(tables).filter(Boolean));

function assertKnownTable(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    const err = new Error(`"${tableName}" is not one of this app's known tables.`);
    err.status = 400;
    throw err;
  }
}

/** Inverse of costDateNormalizers.excelSerialToISODate — verified to round-trip exactly. */
function isoDateToExcelSerial(isoDateString) {
  const date = new Date(`${isoDateString}T00:00:00Z`);
  const utcDays = date.getTime() / 86400000;
  return Math.round(utcDays + 25569);
}

/**
 * Bulk-writes parsed Excel rows into a table. Each row is expected as
 * { villaID: "V_1", "Civil-1": "2024-01-01" | 500 | "Completed", ... } —
 * first column is always the primary key (matches the original's
 * `headers[0]` convention), every other column becomes a SET on that
 * villa's wide item. Empty/blank cells are skipped (not written as
 * empty strings), matching the original's behavior.
 *
 * `isDateTable` mirrors the original's dateTables check — date columns
 * get converted to Excel serial numbers (matching how this app's date
 * tables are already stored, per costDateNormalizers.js) rather than
 * written as raw date strings.
 *
 * Writes run with bounded concurrency (20 at a time) rather than the
 * original's fully sequential loop (slow for real villa counts) or fully
 * unbounded parallel (risks throttling DynamoDB's write capacity).
 */
export async function bulkImportRows(tableName, rows, isDateTable) {
  assertKnownTable(tableName);

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

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    let i = 0;

    for (const [column, value] of Object.entries(columns)) {
      if (value === undefined || value === null || value === "") continue;

      const nameKey = `#attr${i}`;
      const valueKey = `:val${i}`;
      expressionAttributeNames[nameKey] = column;

      if (isDateTable) {
        // Frontend sends dates as "YYYY-MM-DD" (parsed from Excel with
        // cellDates:true) — convert to the Excel serial number this
        // table's other rows already use, so reads via
        // costDateNormalizers.excelSerialToISODate keep working.
        const serial = isoDateToExcelSerial(String(value));
        if (Number.isNaN(serial)) {
          continue; // not a parseable date — skip this cell rather than write garbage
        }
        expressionAttributeValues[valueKey] = serial;
      } else if (typeof value === "number") {
        expressionAttributeValues[valueKey] = value;
      } else {
        expressionAttributeValues[valueKey] = String(value).trim();
      }

      updateExpression.push(`${nameKey} = ${valueKey}`);
      i++;
    }

    if (updateExpression.length === 0) {
      successCount++; // nothing to write for this row — not an error, matches original
      return;
    }

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { villaID: String(villaID).trim() },
          UpdateExpression: "SET " + updateExpression.join(", "),
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );
      successCount++;
    } catch (err) {
      errorCount++;
      errors.push({ villaID, error: err.message });
    }
  }

  const CONCURRENCY = 20;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(writeOneRow));
  }

  return { successCount, errorCount, errors: errors.slice(0, 50) }; // cap error list, not meant as a full audit log
}

/**
 * Every row in a table, raw — the frontend converts this to Excel via
 * the xlsx library (same pattern already used for every other "Download
 * Table" button in this app).
 */
export async function exportTableData(tableName) {
  assertKnownTable(tableName);
  return scanEntireTable(tableName);
}

/**
 * Ports "button_convert_readyToPay_to_Paid": every invoice currently
 * "ReadyToPay" becomes "Paid", across every villa/item. A genuinely bulk,
 * hard-to-undo operation — the frontend should confirm before calling this.
 */
export async function convertReadyToPayToPaid() {
  const items = await scanEntireTable(tables.invoices);
  let updatedCount = 0;

  async function processItem(item) {
    const { villaID, ...columns } = item;
    const toUpdate = Object.entries(columns).filter(([, status]) => status === "ReadyToPay");
    if (toUpdate.length === 0) return;

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    toUpdate.forEach(([tableItemId], i) => {
      const nameKey = `#attr${i}`;
      const valueKey = `:val${i}`;
      expressionAttributeNames[nameKey] = tableItemId;
      expressionAttributeValues[valueKey] = "Paid";
      updateExpression.push(`${nameKey} = ${valueKey}`);
    });

    await ddb.send(
      new UpdateCommand({
        TableName: tables.invoices,
        Key: { villaID },
        UpdateExpression: "SET " + updateExpression.join(", "),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
    updatedCount += toUpdate.length;
  }

  const CONCURRENCY = 20;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(processItem));
  }

  return { updatedCount };
}

/**
 * Ports "button_convert_Completed_fromProgresstable__to_readyToPay": a
 * bulk backfill — for every activity marked "Completed" in the real
 * status table (wajhaData) whose invoice ISN'T already ReadyToPay or
 * Paid, set its invoice to "ReadyToPay". This is the same rule as the
 * live auto-trigger in activityStatusService.updateActivityStatus, just
 * applied retroactively across everything already in the database
 * instead of only firing on new status changes going forward.
 */
export async function convertCompletedToReadyToPay() {
  const [statusItems, invoiceItems] = await Promise.all([
    scanEntireTable(tables.wajhaData),
    scanEntireTable(tables.invoices),
  ]);

  const invoiceByVilla = new Map(invoiceItems.map((item) => [item.villaID, item]));
  let updatedCount = 0;

  async function processVilla(statusItem) {
    const { villaID, ...statuses } = statusItem;
    const invoiceItem = invoiceByVilla.get(villaID) ?? {};

    const toUpdate = Object.entries(statuses).filter(([tableItemId, status]) => {
      if (status !== "Completed") return false;
      const currentInvoice = invoiceItem[tableItemId] ?? "NotStarted";
      return currentInvoice !== "ReadyToPay" && currentInvoice !== "Paid";
    });
    if (toUpdate.length === 0) return;

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    toUpdate.forEach(([tableItemId], i) => {
      const nameKey = `#attr${i}`;
      const valueKey = `:val${i}`;
      expressionAttributeNames[nameKey] = tableItemId;
      expressionAttributeValues[valueKey] = "ReadyToPay";
      updateExpression.push(`${nameKey} = ${valueKey}`);
    });

    await ddb.send(
      new UpdateCommand({
        TableName: tables.invoices,
        Key: { villaID },
        UpdateExpression: "SET " + updateExpression.join(", "),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
    updatedCount += toUpdate.length;
  }

  const CONCURRENCY = 20;
  for (let i = 0; i < statusItems.length; i += CONCURRENCY) {
    const chunk = statusItems.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(processVilla));
  }

  return { updatedCount };
}
