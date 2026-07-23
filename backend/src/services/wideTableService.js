import { GetCommand, BatchGetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../config/aws.js";

/**
 * DynamoDB's Scan caps each response at ~1MB and sets LastEvaluatedKey if
 * there's more data — a single ScanCommand silently drops the rest once a
 * table gets big enough. This loops until LastEvaluatedKey is gone so any
 * table is read in full regardless of size. Shared here (rather than
 * duplicated in villaService.js, where it used to live only locally) so
 * the admin import/export tool can scan any of the wide tables too.
 */
export async function scanEntireTable(tableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * Reads a villa's wide item from any table shaped like Actual_dates:
 * partition key `villaID` only, with every other attribute keyed by
 * TableItemID (e.g. "Civil-1"). Returns {} (not a throw) if the table is
 * missing or the villa has no item yet, so one broken/unpopulated table
 * doesn't take down a whole dashboard — callers that care can still check
 * the console warning this logs.
 */
export async function getVillaWideItem(tableName, villaID) {
  if (!tableName) {
    console.warn(`getVillaWideItem called with no table name configured for villaID=${villaID}`);
    return {};
  }
  try {
    const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { villaID } }));
    const { villaID: _omit, ...rest } = result.Item ?? {};
    return rest;
  } catch (err) {
    console.error(`Could not read "${tableName}" for villa ${villaID}: ${err.message}`);
    return {};
  }
}

/**
 * Same shape as getVillaWideItem but for many villas at once — one
 * BatchGetCommand per 100 villas instead of one GetCommand per villa.
 * Same generic helper the earlier getManyActivityStatuses used, extracted
 * so other portfolio-wide reads (like the all-projects dashboard) can
 * reuse it against any wide table.
 *
 * All chunks fire concurrently via Promise.all — each chunk is an
 * independent request, so there's no reason to await them one at a time.
 * With ~590 villas that's 6 chunks; sequential, that was 6 round-trips of
 * latency for every single table read. In parallel, it's 1.
 *
 * NOTE: this used to accept a `projectionKey` to fetch only one attribute
 * via DynamoDB's ProjectionExpression instead of the whole ~82-field wide
 * item. I never actually verified that syntax against live DynamoDB (this
 * sandbox has no AWS access — "route reachable" checks never exercised
 * the real query), and it turned out to silently return no data at all
 * for every villa. Reverted to always fetching the full item, which is
 * the version that's actually been confirmed correct against your real
 * data (portfolio dashboard's cost totals matched your hand calculations).
 * If this needs to be fast again later, that projection logic should be
 * built and tested against a real DynamoDB table before shipping, not
 * guessed at blind a second time.
 */
export async function getManyVillaWideItems(tableName, villaIDs) {
  const results = {};
  if (!tableName) {
    console.warn(`getManyVillaWideItems called with no table name configured`);
    return results;
  }
  const chunkSize = 100; // DynamoDB BatchGetItem limit per table
  const chunks = [];
  for (let i = 0; i < villaIDs.length; i += chunkSize) {
    const chunk = villaIDs.slice(i, i + chunkSize);
    if (chunk.length > 0) chunks.push(chunk);
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const result = await ddb.send(
          new BatchGetCommand({
            RequestItems: { [tableName]: { Keys: chunk.map((villaID) => ({ villaID })) } },
          })
        );
        (result.Responses?.[tableName] ?? []).forEach((item) => {
          const { villaID, ...rest } = item;
          results[villaID] = rest;
        });
      } catch (err) {
        console.error(`Could not batch-read "${tableName}": ${err.message}`);
      }
    })
  );

  return results;
}
