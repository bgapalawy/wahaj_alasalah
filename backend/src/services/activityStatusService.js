import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../config/aws.js";
import { constructionItems } from "../data/constructionItems.js";
import { getVillaWideItem, getManyVillaWideItems } from "./wideTableService.js";
import { autoUpdateInvoiceOnCompletion } from "./invoiceService.js";

/**
 * Tracks per-villa, per-construction-item status + completion date, now
 * sourced from TWO tables instead of one:
 *
 *   - wajhaData (wajha_project_data_table) — the REAL, original status
 *     source, confirmed against a live AWS console screenshot. Plain
 *     string values directly on each TableItemID column, e.g.
 *     { villaID: "V_1", "Civil-1": "Completed", "Civil-2": "NotStarted", ... }
 *     This is now the source of truth for *current status* everywhere.
 *
 *   - Actual_dates — kept for completedDate tracking, nested shape:
 *     { villaID: "V_1", "Civil-1": { status, completedDate, updatedAt }, ... }
 *     Its own `status` field is now redundant with wajhaData but still
 *     written on save for consistency, per instruction to update both.
 *
 * Every function below still returns the same { status, completedDate }
 * shape callers already expect (computeVillaStatus, the dashboards, the
 * dependency graph) — only the data source changed, not the contract.
 */

function mergeStatusAndDate(statusMap, dateMap) {
  const merged = {};
  const allKeys = new Set([...Object.keys(statusMap), ...Object.keys(dateMap)]);
  allKeys.forEach((key) => {
    merged[key] = {
      status: statusMap[key] ?? "NotStarted",
      completedDate: dateMap[key]?.completedDate ?? null,
    };
  });
  return merged;
}

export async function getActivityStatus(villaID, tableItemId) {
  const [statusItem, dateItem] = await Promise.all([
    getVillaWideItem(tables.wajhaData, villaID),
    getVillaWideItem(tables.actualDates, villaID),
  ]);
  return {
    status: statusItem[tableItemId] ?? "NotStarted",
    completedDate: dateItem[tableItemId]?.completedDate ?? null,
  };
}

/**
 * Returns every construction item's status for a villa in two GetItem
 * calls (one per table, in parallel) — used to color the dependency graph
 * with real per-villa progress instead of the static "NotStarted"
 * placeholder baked into constructionItems.js.
 */
export async function getAllActivityStatuses(villaID) {
  const [statusItem, dateItem] = await Promise.all([
    getVillaWideItem(tables.wajhaData, villaID),
    getVillaWideItem(tables.actualDates, villaID),
  ]);
  return mergeStatusAndDate(statusItem, dateItem);
}

/**
 * Saves a status change to BOTH tables: the plain-string status in
 * wajhaData (authoritative for reads), and the nested
 * {status, completedDate} entry in Actual_dates (authoritative for
 * completion-date tracking). Both writes are attempted regardless of
 * whether one table name is misconfigured, so a broken table doesn't
 * silently swallow a write to the other.
 */
/**
 * Saves a status change to BOTH tables: the plain-string status in
 * wajhaData (authoritative for reads), and the nested
 * {status, completedDate} entry in Actual_dates (authoritative for
 * completion-date tracking). Both writes are attempted regardless of
 * whether one table name is misconfigured, so a broken table doesn't
 * silently swallow a write to the other.
 *
 * Also ports the original app's invoice auto-trigger: reads the
 * PREVIOUS status first, and if this change transitions the activity
 * INTO "Completed" from something else, automatically marks its invoice
 * "ReadyToPay" (see invoiceService.autoUpdateInvoiceOnCompletion). This
 * read-before-write is the only way to know it's a transition rather
 * than an already-Completed item being re-saved.
 */
export async function updateActivityStatus(villaID, tableItemId, { status, completedDate }) {
  const previousStatusItem = await getVillaWideItem(tables.wajhaData, villaID).catch(() => ({}));
  const previousStatus = previousStatusItem[tableItemId] ?? "NotStarted";

  const writeStatus = ddb
    .send(
      new UpdateCommand({
        TableName: tables.wajhaData,
        Key: { villaID },
        UpdateExpression: "SET #item = :status",
        ExpressionAttributeNames: { "#item": tableItemId },
        ExpressionAttributeValues: { ":status": status },
        ReturnValues: "ALL_NEW",
      })
    )
    .catch((err) => {
      console.error(`Could not write status to "${tables.wajhaData}": ${err.message}`);
      return null;
    });

  const writeDate = ddb
    .send(
      new UpdateCommand({
        TableName: tables.actualDates,
        Key: { villaID },
        // #item is an ExpressionAttributeName because TableItemID values
        // like "Civil-1" contain a hyphen, which isn't valid directly in
        // an UpdateExpression path.
        UpdateExpression: "SET #item = :value",
        ExpressionAttributeNames: { "#item": tableItemId },
        ExpressionAttributeValues: {
          ":value": {
            status,
            completedDate: completedDate ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
        ReturnValues: "ALL_NEW",
      })
    )
    .catch((err) => {
      console.error(`Could not write date to "${tables.actualDates}": ${err.message}`);
      return null;
    });

  const [statusResult, dateResult] = await Promise.all([writeStatus, writeDate]);

  if (!statusResult && !dateResult) {
    const err = new Error("Could not save status to either table — check backend logs for table name issues.");
    err.status = 500;
    throw err;
  }

  if (statusResult) {
    await autoUpdateInvoiceOnCompletion(villaID, tableItemId, previousStatus, status).catch((err) => {
      // Don't fail the whole status save just because the invoice
      // auto-update failed — the activity status itself already saved
      // successfully, and this is a secondary side-effect.
      console.error(`Could not auto-update invoice status: ${err.message}`);
    });
  }

  return {
    status: statusResult?.Attributes?.[tableItemId] ?? status,
    completedDate: dateResult?.Attributes?.[tableItemId]?.completedDate ?? completedDate ?? null,
  };
}

/**
 * Derives a villa's overall status from its individual activity statuses:
 *   - every one of the 82 activities is "Completed"  -> "Completed"
 *   - at least one activity is anything but "NotStarted" -> "InProgress"
 *   - otherwise -> "NotStarted"
 * This is computed on read, not stored — there is no separate "villa
 * status" field to keep in sync.
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
 * when listing all villas, e.g. for map coloring) — two BatchGetCommand
 * passes (wajhaData + Actual_dates), each chunked and parallelized.
 */
export async function getManyActivityStatuses(villaIDs) {
  const [statusByVilla, dateByVilla] = await Promise.all([
    getManyVillaWideItems(tables.wajhaData, villaIDs),
    getManyVillaWideItems(tables.actualDates, villaIDs),
  ]);

  const merged = {};
  villaIDs.forEach((villaID) => {
    merged[villaID] = mergeStatusAndDate(statusByVilla[villaID] ?? {}, dateByVilla[villaID] ?? {});
  });
  return merged;
}
