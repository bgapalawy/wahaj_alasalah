import { apiClient } from "./client.js";

export const uploadsApi = {
  lookup: (prefix) => apiClient.get(`/uploads/lookup?prefix=${encodeURIComponent(prefix)}`),

  presignPut: ({ prefix, fileName, contentType, fileSizeBytes }) =>
    apiClient.post("/uploads/presign-put", { prefix, fileName, contentType, fileSizeBytes }),

  presignGet: (key, fileName) =>
    apiClient.get(
      `/uploads/presign-get?key=${encodeURIComponent(key)}${
        fileName ? `&fileName=${encodeURIComponent(fileName)}` : ""
      }`
    ),

  remove: (prefix) =>
    fetch(`${import.meta.env.VITE_API_BASE_URL}/uploads?prefix=${encodeURIComponent(prefix)}`, {
      method: "DELETE",
    }),

  /** Uploads the file bytes straight to S3 using a presigned URL — no AWS SDK, no credentials in the browser. */
  putToS3: (url, file) =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    }),
};
