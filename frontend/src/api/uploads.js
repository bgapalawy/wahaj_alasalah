import { apiClient } from "./client.js";

export const uploadsApi = {
  lookup: (prefix) => apiClient.get(`/uploads/lookup?prefix=${encodeURIComponent(prefix)}`),
  limits: () => apiClient.get("/uploads/limits"),

  presignPut: ({ prefix, fileName, contentType, fileSizeBytes }) =>
    apiClient.post("/uploads/presign-put", { prefix, fileName, contentType, fileSizeBytes }),

  // Called right after a direct-to-S3 PUT actually succeeds — logs an
  // "uploaded" entry to the History tab. Never called from presignPut
  // itself, which only issues a URL and has no idea whether the browser
  // went on to use it successfully.
  confirmUpload: (prefix, fileName) => apiClient.post("/uploads/confirm", { prefix, fileName }),

  presignGet: (key, fileName) =>
    apiClient.get(
      `/uploads/presign-get?key=${encodeURIComponent(key)}${
        fileName ? `&fileName=${encodeURIComponent(fileName)}` : ""
      }`
    ),

  remove: (prefix) => apiClient.delete(`/uploads?prefix=${encodeURIComponent(prefix)}`),

  /** Uploads the file bytes straight to S3 using a presigned URL — no AWS SDK, no credentials in the browser. */
  putToS3: (url, file) =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    }),
};
