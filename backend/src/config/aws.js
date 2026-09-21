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

// Neon Object Storage is S3-API-compatible, so this is still the same
// @aws-sdk/client-s3 client used everywhere else in the app (uploads,
// presigned URLs) — just pointed at Neon's endpoint instead of real AWS,
// with the two settings Neon's S3 compatibility requires:
//   - endpoint: Neon's S3-compatible endpoint URL for this bucket/branch
//     (from the bucket's "Storage" tab in the Neon Console, NOT the
//     "Postgres database" tab — that one shows the DATABASE_URL instead)
//   - forcePathStyle: true — Neon only supports path-style addressing
//     (bucket-as-part-of-the-path), not virtual-hosted-style
//     (bucket-as-subdomain), which is the AWS SDK's default. Uploads
//     silently fail/404 without this.
// NEON_S3_ENDPOINT / NEON_S3_ACCESS_KEY_ID / NEON_S3_SECRET_ACCESS_KEY
// come from that same "Storage" tab. Falls back to real AWS S3
// (unchanged behavior) if those aren't set, so this is safe to deploy
// before the Neon bucket exists yet, or for a project (like Shams) that
// hasn't moved off real S3.
const usingNeonStorage = Boolean(process.env.NEON_S3_ENDPOINT);

export const s3 = new S3Client(
  usingNeonStorage
    ? {
        region: process.env.NEON_S3_REGION || "us-east-2", // matches the bucket's Neon region
        endpoint: process.env.NEON_S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.NEON_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.NEON_S3_SECRET_ACCESS_KEY,
        },
      }
    : { region }
);

export const tables = {
  villas: process.env.DDB_VILLAS_TABLE,
  plannedCosts: process.env.DDB_PLANNED_COSTS_TABLE,
  actualCosts: process.env.DDB_ACTUAL_COSTS_TABLE,
  plannedDates: process.env.DDB_PLANNED_DATES_TABLE,
  actualDates: process.env.DDB_ACTUAL_DATES_TABLE,
  plannedDatesFinish: process.env.DDB_PLANNED_DATES_FINISH_TABLE,
  specialQuery: process.env.DDB_SPECIAL_QUERY_TABLE,
  shams_elgroubData: process.env.DDB_WAJHA_DATA_TABLE,
  invoices: process.env.DDB_INVOICE_TABLE,
};

export const s3Bucket = process.env.S3_BUCKET_NAME;
