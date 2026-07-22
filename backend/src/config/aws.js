import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

// This file only ever runs on the server. Nothing here is bundled into the
// browser build — that's the entire point of moving to a backend layer.
const region = process.env.AWS_REGION;

const dynamoClient = new DynamoDBClient({ region });
export const ddb = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const s3 = new S3Client({ region });

export const tables = {
  villas: process.env.DDB_VILLAS_TABLE,
  plannedCosts: process.env.DDB_PLANNED_COSTS_TABLE,
  actualCosts: process.env.DDB_ACTUAL_COSTS_TABLE,
  plannedDates: process.env.DDB_PLANNED_DATES_TABLE,
  actualDates: process.env.DDB_ACTUAL_DATES_TABLE,
  plannedDatesFinish: process.env.DDB_PLANNED_DATES_FINISH_TABLE,
  specialQuery: process.env.DDB_SPECIAL_QUERY_TABLE,
  // The REAL, original per-villa/per-item status source (confirmed against
  // your AWS console) — plain string values like "Completed"/"NotStarted"
  // directly on each TableItemID column, not the nested {status,
  // completedDate} shape Actual_dates uses. Actual_dates is still used for
  // completedDate tracking; wajhaData is now the source of truth for
  // *current status* everywhere (villa status, map coloring, dashboards).
  wajhaData: process.env.DDB_WAJHA_DATA_TABLE,
  // Invoice status per villa/item — same plain-string wide-table shape as
  // wajhaData, e.g. { villaID, "Civil-1": "ReadyToPay", ... }. Confirmed
  // to already exist in the real AWS account.
  invoices: process.env.DDB_INVOICE_TABLE,
};

export const s3Bucket = process.env.S3_BUCKET_NAME;
