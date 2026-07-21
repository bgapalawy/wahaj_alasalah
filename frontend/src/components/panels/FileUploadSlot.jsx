import { useEffect, useRef, useState } from "react";
import { uploadsApi } from "../../api/uploads.js";
import { MAX_UPLOAD_SIZE_MB } from "../../config/uploadLimitsClient.js";

/**
 * One upload "slot" — mirrors a single createImageUploadSection() instance
 * from left_click.js, but the S3 SDK calls are gone. The browser now only
 * ever talks to our backend for a presigned URL, then PUTs straight to S3.
 */
export function FileUploadSlot({ prefix }) {
  const [file, setFile] = useState(null); // { key, extension, previewUrl }
  const [status, setStatus] = useState("loading"); // loading | empty | ready | uploading | error
  const [errorMessage, setErrorMessage] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    uploadsApi
      .lookup(prefix)
      .then(async (match) => {
        if (cancelled) return;
        if (!match) {
          setFile(null);
          setStatus("empty");
          return;
        }
        const { url } = await uploadsApi.presignGet(match.key);
        if (cancelled) return;
        setFile({ key: match.key, extension: match.extension, previewUrl: url });
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  async function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File exceeds ${MAX_UPLOAD_SIZE_MB}MB limit`);
      event.target.value = "";
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);
    try {
      const { url, key } = await uploadsApi.presignPut({
        prefix,
        fileName: selected.name,
        contentType: selected.type,
        fileSizeBytes: selected.size,
      });
      const putResponse = await uploadsApi.putToS3(url, selected);
      if (!putResponse.ok) throw new Error("Upload to storage failed");

      const previewUrl = URL.createObjectURL(selected);
      setFile({ key, extension: selected.name.split(".").pop().toLowerCase(), previewUrl });
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    } finally {
      event.target.value = "";
    }
  }

  async function handleDownload() {
    if (!file) return;
    const { url } = await uploadsApi.presignGet(file.key, file.key);
    window.open(url, "_blank", "noopener");
  }

  async function handleDelete() {
    if (!file) return;
    await uploadsApi.remove(prefix);
    setFile(null);
    setStatus("empty");
  }

  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(file?.extension);
  const isVideo = ["mp4", "mov", "webm"].includes(file?.extension);

  return (
    <div className="upload-slot">
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={handleFileChange}
        disabled={status === "uploading"}
      />
      <div className={`image-area ${file ? "active" : ""}`}>
        {status === "loading" && <span>Loading…</span>}
        {status === "uploading" && <span>Uploading…</span>}
        {status === "empty" && <span>Upload File</span>}
        {status === "ready" && file && isImage && (
          <img className="image" src={file.previewUrl} alt="" />
        )}
        {status === "ready" && file && isVideo && (
          <video className="image" src={file.previewUrl} controls />
        )}
        {status === "ready" && file && !isImage && !isVideo && (
          <div className="file-generic">📄 {file.key.split("/").pop()}</div>
        )}
        {status === "error" && <span className="upload-error">{errorMessage}</span>}
      </div>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={status === "uploading"}>
        Select File
      </button>
      <div className="button-group">
        <button type="button" onClick={handleDownload} disabled={!file}>
          Download
        </button>
        <button type="button" onClick={handleDelete} disabled={!file}>
          Delete
        </button>
      </div>
    </div>
  );
}
