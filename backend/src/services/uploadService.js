import {
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, s3Bucket } from "../config/aws.js";

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes — plenty for a single upload/download

/**
 * Finds the single object stored under a given key prefix (a "slot" only
 * ever holds one file at a time, matching the old left_click.js behavior of
 * filtering S3 listObjects by `object.Key.split(".")[0] === objectKey`).
 */
export async function findObjectByPrefix(prefix) {
  const result = await s3.send(
    new ListObjectsV2Command({ Bucket: s3Bucket, Prefix: prefix })
  );
  const match = (result.Contents ?? []).find(
    (obj) => obj.Key.split(".").slice(0, -1).join(".") === prefix
  );
  if (!match) return null;
  return {
    key: match.Key,
    extension: match.Key.split(".").pop().toLowerCase(),
  };
}

/**
 * Deletes every object under a prefix (a slot should only ever have one,
 * but this cleans up stragglers the same way the old client-side
 * deleteObjects call did before uploading a replacement).
 */
export async function deleteObjectsByPrefix(prefix) {
  const result = await s3.send(
    new ListObjectsV2Command({ Bucket: s3Bucket, Prefix: prefix })
  );
  const objects = result.Contents ?? [];
  if (objects.length === 0) return;

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: s3Bucket,
      Delete: { Objects: objects.map((o) => ({ Key: o.Key })), Quiet: true },
    })
  );
}

export async function deleteObject(key) {
  await deleteObjectsByPrefix(key.split(".").slice(0, -1).join("."));
}

/**
 * Returns a short-lived presigned PUT URL. The browser uploads the file
 * bytes directly to S3 with a plain fetch() PUT — no AWS SDK and no AWS
 * credentials ever touch the browser.
 */
export async function getUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: contentType || undefined,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

/**
 * Presigned GET URL, optionally forcing a friendly download filename via
 * Content-Disposition (mirrors the old getSignedUrl("getObject", {...})
 * call in left_click.js's download button handler).
 */
export async function getDownloadUrl(key, downloadFileName) {
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ResponseContentDisposition: downloadFileName
      ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
      : undefined,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}
