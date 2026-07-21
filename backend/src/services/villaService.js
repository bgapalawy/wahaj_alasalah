import {
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../config/aws.js";
import { computeVillaStatus, getAllActivityStatuses, getManyActivityStatuses } from "./activityStatusService.js";

/**
 * Wraps DynamoDB's ResourceNotFoundException with a message that actually
 * tells you what to fix: this fires when the table name in .env doesn't
 * exist in the configured AWS_REGION — either a typo in DDB_VILLAS_TABLE
 * or the table lives in a different region.
 */
function explainIfMissingTable(err, tableName) {
  if (err?.name === "ResourceNotFoundException") {
    err.status = 500;
    err.message = `DynamoDB table "${tableName}" not found in region "${process.env.AWS_REGION}". Check DDB_VILLAS_TABLE and AWS_REGION in backend/.env against the real table.`;
  }
  throw err;
}

/**
 * Returns every villa's attribute record from DynamoDB, with `status`
 * computed live from Actual_dates rather than returned as a stored field
 * (there isn't one to trust — see computeVillaStatus for the rule:
 * all activities Completed -> Completed, any activity started -> InProgress,
 * otherwise NotStarted).
 * Replaces the direct `dynamoDBClient.scan(...)` calls that used to live in
 * awsFunctions.js and run in the browser.
 */
export async function listVillas() {
  let villas;
  try {
    const result = await ddb.send(new ScanCommand({ TableName: tables.villas }));
    villas = result.Items ?? [];
  } catch (err) {
    explainIfMissingTable(err, tables.villas);
  }

  const villaIDs = villas.map((v) => v.villaID).filter(Boolean);
  let statusMap = {};
  try {
    statusMap = await getManyActivityStatuses(villaIDs);
  } catch (err) {
    // Don't let a broken Actual_dates table take down the whole villa
    // list — fall back to "NotStarted" for everyone and log it.
    console.error("Could not load activity statuses for villa list, defaulting to NotStarted:", err.message);
  }

  return villas.map((villa) => ({
    ...villa,
    status: computeVillaStatus(statusMap[villa.villaID] ?? {}),
  }));
}

export async function getVillaById(villaID) {
  let result;
  try {
    result = await ddb.send(
      new GetCommand({ TableName: tables.villas, Key: { villaID } })
    );
  } catch (err) {
    explainIfMissingTable(err, tables.villas);
  }
  if (!result.Item) {
    const err = new Error(`Villa ${villaID} not found`);
    err.status = 404;
    throw err;
  }

  let activityStatuses = {};
  try {
    activityStatuses = await getAllActivityStatuses(villaID);
  } catch (err) {
    console.error(`Could not load activity statuses for ${villaID}, defaulting to NotStarted:`, err.message);
  }

  return { ...result.Item, status: computeVillaStatus(activityStatuses) };
}

/**
 * Partial update of a villa record — for attributes like blocknum, notes,
 * etc. NOTE: `status` is no longer a field worth patching here — it's
 * computed live from activity data on every read (see getVillaById /
 * listVillas above), so writing a "status" value through this function
 * would just get overwritten the next time the villa is fetched.
 */
export async function updateVilla(villaID, updates) {
  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 0) {
    const err = new Error("No fields provided to update");
    err.status = 400;
    throw err;
  }

  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const setClauses = updateKeys.map((key, i) => {
    const nameKey = `#f${i}`;
    const valueKey = `:v${i}`;
    expressionAttributeNames[nameKey] = key;
    expressionAttributeValues[valueKey] = updates[key];
    return `${nameKey} = ${valueKey}`;
  });

  let result;
  try {
    result = await ddb.send(
      new UpdateCommand({
        TableName: tables.villas,
        Key: { villaID },
        UpdateExpression: `SET ${setClauses.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );
  } catch (err) {
    explainIfMissingTable(err, tables.villas);
  }
  return result.Attributes;
}
