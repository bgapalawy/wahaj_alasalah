import { Router } from "express";
import {
  findObjectByPrefix,
  deleteObjectsByPrefix,
  getUploadUrl,
  getDownloadUrl,
} from "../services/uploadService.js";
import {
  MAX_UPLOAD_SIZE_MB,
  isValidExtension,
} from "../config/uploadLimits.js";

export const uploadRouter = Router();

/**
 * GET /api/uploads/lookup?prefix=...
 * Does this file-status "slot" already have a file? Replaces the old
 * s3.listObjects(...).filter(...) call that ran in the browser on popup open.
 */
uploadRouter.get("/lookup", async (req, res, next) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ error: "prefix is required" });
    const match = await findObjectByPrefix(prefix);
    res.json(match); // null if nothing uploaded yet
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/uploads/presign-put
 * body: { prefix, fileName, contentType, fileSizeBytes }
 * Clears any existing file(s) under the prefix, then returns a short-lived
 * presigned PUT URL. The browser PUTs the file bytes straight to S3.
 */
uploadRouter.post("/presign-put", async (req, res, next) => {
  try {
    const { prefix, fileName, contentType, fileSizeBytes } = req.body;
    if (!prefix || !fileName) {
      return res.status(400).json({ error: "prefix and fileName are required" });
    }

    const extension = fileName.split(".").pop()?.toLowerCase();
    if (!isValidExtension(extension)) {
      return res.status(400).json({ error: `Unsupported file extension: .${extension}` });
    }
    if (fileSizeBytes && fileSizeBytes > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      return res.status(400).json({ error: `File exceeds ${MAX_UPLOAD_SIZE_MB}MB limit` });
    }

    await deleteObjectsByPrefix(prefix);

    const key = `${prefix}.${extension}`;
    const url = await getUploadUrl(key, contentType);
    res.json({ url, key });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/uploads/presign-get?key=...&fileName=optional-download-name
 */
uploadRouter.get("/presign-get", async (req, res, next) => {
  try {
    const { key, fileName } = req.query;
    if (!key) return res.status(400).json({ error: "key is required" });
    const url = await getDownloadUrl(key, fileName);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/uploads?prefix=...
 */
uploadRouter.delete("/", async (req, res, next) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ error: "prefix is required" });
    await deleteObjectsByPrefix(prefix);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
