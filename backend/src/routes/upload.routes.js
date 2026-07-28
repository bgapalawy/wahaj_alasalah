import { Router } from "express";
import {
  findObjectByPrefix,
  deleteObjectsByPrefix,
  getUploadUrl,
  getDownloadUrl,
} from "../services/uploadService.js";
import {
  MAX_UPLOAD_SIZE_MB,
  ALL_VALID_EXTENSIONS,
  isValidExtension,
} from "../config/uploadLimits.js";
import { isValidUploadPrefix } from "../services/uploadPrefixValidation.js";
import { recordAuditLog } from "../services/auditLogService.js";

/**
 * Inverse of buildSlotPrefix (frontend/src/config/fileStatusConfig.js) —
 * duplicated here since the backend has no shared code with the
 * frontend's config, kept in sync with that file's exact format:
 *   `${constructionItemId}-VillaID:${villaID}-${suffix}`
 * where suffix is "Approval" or `${state}${slotNumber}` (e.g. "NCR1").
 * villaID never contains a hyphen ("V_63") and neither does the suffix,
 * so `[^-]+` safely isolates it even though constructionItemId itself
 * can (e.g. "Civil-15") — only used for audit-log labeling (which
 * villa/item/slot a file event belongs to), never for validation;
 * isValidUploadPrefix already does that job on the raw string.
 */
function parseUploadPrefix(prefix) {
  const match = /^(.+)-VillaID:([^-]+)-([A-Za-z]+\d*)$/.exec(prefix ?? "");
  if (!match) return { villaID: null, tableItemId: null, label: prefix ?? null };
  const [, tableItemId, villaID, suffix] = match;
  return { villaID, tableItemId, label: suffix };
}

export const uploadRouter = Router();

/**
 * GET /api/uploads/limits — lets the frontend show the real allowed
 * extensions/size upfront (see FileUploadSlot.jsx) instead of the user
 * finding out by trial and error after an upload gets rejected. Single
 * source of truth stays uploadLimits.js; this just exposes it.
 */
uploadRouter.get("/limits", (req, res) => {
  res.json({ maxSizeMB: MAX_UPLOAD_SIZE_MB, extensions: ALL_VALID_EXTENSIONS });
});

/**
 * GET /api/uploads/lookup?prefix=...
 * Does this file-status "slot" already have a file? Replaces the old
 * s3.listObjects(...).filter(...) call that ran in the browser on popup open.
 */
uploadRouter.get("/lookup", async (req, res, next) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ error: "prefix is required" });
    if (!(await isValidUploadPrefix(prefix))) {
      return res.status(400).json({ error: "Invalid prefix — doesn't match a real villa/item/status combination." });
    }
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
    if (!(await isValidUploadPrefix(prefix))) {
      return res.status(400).json({ error: "Invalid prefix — doesn't match a real villa/item/status combination." });
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
 * POST /api/uploads/confirm
 * body: { prefix, fileName }
 * Called by FileUploadSlot.jsx right after the browser's direct-to-S3
 * PUT actually succeeds — NOT from presign-put above, which only issues
 * a URL and has no idea whether the browser went on to use it. Logging
 * here means an "uploaded" entry in the History tab always reflects a
 * real, completed upload, not just a URL that was requested.
 */
uploadRouter.post("/confirm", async (req, res, next) => {
  try {
    const { prefix, fileName } = req.body;
    if (!prefix) return res.status(400).json({ error: "prefix is required" });
    if (!(await isValidUploadPrefix(prefix))) {
      return res.status(400).json({ error: "Invalid prefix — doesn't match a real villa/item/status combination." });
    }

    const { villaID, tableItemId, label } = parseUploadPrefix(prefix);
    await recordAuditLog({
      villaID,
      tableItemId,
      entityType: "file",
      action: "uploaded",
      field: label,
      newValue: fileName ?? null,
      changedBy: req.user?.username ?? null,
    }).catch((err) => {
      console.error(`Could not record audit log: ${err.message}`);
    });

    res.status(204).end();
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
    const prefixOnly = key.replace(/\.[^.]+$/, "");
    if (!(await isValidUploadPrefix(prefixOnly))) {
      return res.status(400).json({ error: "Invalid key — doesn't match a real villa/item/status combination." });
    }
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
    if (!(await isValidUploadPrefix(prefix))) {
      return res.status(400).json({ error: "Invalid prefix — doesn't match a real villa/item/status combination." });
    }

    // Look up what's actually there BEFORE deleting it — need the real
    // filename for a meaningful log entry, and this also means nothing
    // gets logged for a delete call against an already-empty slot.
    const existing = await findObjectByPrefix(prefix);
    await deleteObjectsByPrefix(prefix);

    if (existing) {
      const { villaID, tableItemId, label } = parseUploadPrefix(prefix);
      await recordAuditLog({
        villaID,
        tableItemId,
        entityType: "file",
        action: "deleted",
        field: label,
        oldValue: existing.key.split("/").pop(),
        changedBy: req.user?.username ?? null,
      }).catch((err) => {
        console.error(`Could not record audit log: ${err.message}`);
      });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
