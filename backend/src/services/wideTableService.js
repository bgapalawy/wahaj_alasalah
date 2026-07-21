import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../config/aws.js";

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
