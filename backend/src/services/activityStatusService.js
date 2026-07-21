import { GetCommand, BatchGetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../config/aws.js";
import { constructionItems } from "../data/constructionItems.js";

/**
 * Tracks per-villa, per-construction-item status + completion date.
 *
 * CONFIRMED SCHEMA (from the AWS console — Actual_dates table):
 *   Partition key: villaID (string) — NO sort key.
 *   That means DynamoDB allows exactly ONE item per villa. So every
 *   construction item's status/date has to live as a nested attribute
 *   *inside* that single item, keyed by TableItemID. A villa's item looks
 *   roughly like:
 *     {
 *       villaID: "V_1",
 *       "Civil-1": { status: "Completed", completedDate: "2026-01-05", updatedAt: "..." },
 *       "Civil-2": { status: "NotStarted", completedDate: null, updatedAt: "..." },
 *       ...
 *     }
 *   (My first pass assumed villaID+TableItemID as a composite key, which
 *   doesn't match this table and threw "provided key element does not
 *   match the schema" — fixed here.)
 */

function explainIfMissingTable(err, tableName) {
  if (err?.name === "ResourceNotFoundException") {
    err.status = 500;
    err.message = `DynamoDB table "${tableName}" not found in region "${process.env.AWS_REGION}". Check DDB_ACTUAL_DATES_TABLE and AWS_REGION in backend/.env.`;
  }
  throw err;
}

export async function getActivityStatus(villaID, tableItemId) {
  try {
    const result = await ddb.send(
      new GetCommand({ TableName: tables.actualDates, Key: { villaID } })
    );
    return result.Item?.[tableItemId] ?? { status: "NotStarted", completedDate: null };
  } catch (err) {
    explainIfMissingTable(err, tables.actualDates);
  }
}

/**
 * Returns every construction item's status for a villa in a single
 * GetItem call — since the table is one item per villa, this is far
 * cheaper than calling getActivityStatus() 82 times. Used to color the
 * dependency graph with real per-villa progress instead of the static
 * "NotStarted" placeholder baked into constructionItems.js.
 */
export async function getAllActivityStatuses(villaID) {
  try {
    const result = await ddb.send(
      new GetCommand({ TableName: tables.actualDates, Key: { villaID } })
    );
    const { villaID: _omit, ...statuses } = result.Item ?? {};
    return statuses; // { "Civil-1": { status, completedDate, updatedAt }, ... }
  } catch (err) {
    explainIfMissingTable(err, tables.actualDates);
  }
}

export async function updateActivityStatus(villaID, tableItemId, { status, completedDate }) {
  try {
    const result = await ddb.send(
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
    );
    return result.Attributes?.[tableItemId];
  } catch (err) {
    explainIfMissingTable(err, tables.actualDates);
  }
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
 * when listing all villas, e.g. for map coloring) — one BatchGetCommand
 * per 100 villas instead of one GetCommand per villa.
 */
export async function getManyActivityStatuses(villaIDs) {
  const results = {};
  const chunkSize = 100; // DynamoDB BatchGetItem limit per table
  const chunks = [];
  for (let i = 0; i < villaIDs.length; i += chunkSize) {
    const chunk = villaIDs.slice(i, i + chunkSize);
    if (chunk.length > 0) chunks.push(chunk);
  }

  // All chunks fire concurrently — see wideTableService.getManyVillaWideItems
  // for why this matters (was 6 sequential round-trips for ~590 villas).
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const result = await ddb.send(
          new BatchGetCommand({
            RequestItems: { [tables.actualDates]: { Keys: chunk.map((villaID) => ({ villaID })) } },
          })
        );
        (result.Responses?.[tables.actualDates] ?? []).forEach((item) => {
          const { villaID, ...statuses } = item;
          results[villaID] = statuses;
        });
      } catch (err) {
        explainIfMissingTable(err, tables.actualDates);
      }
    })
  );
  return results;
}
