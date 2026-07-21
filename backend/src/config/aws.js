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
};

export const s3Bucket = process.env.S3_BUCKET_NAME;
