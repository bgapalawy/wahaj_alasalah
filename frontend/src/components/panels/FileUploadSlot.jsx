import { useEffect, useRef, useState } from "react";
import { uploadsApi } from "../../api/uploads.js";

/**
 * One upload "slot" — mirrors a single createImageUploadSection() instance
 * from left_click.js, but the S3 SDK calls are gone. The browser now only
 * ever talks to our backend for a presigned URL, then PUTs straight to S3.
 */
export function FileUploadSlot({ prefix, friendlyNameBase, uploadLimits }) {
  const [file, setFile] = useState(null); // { key, extension, previewUrl }
  const [status, setStatus] = useState("loading"); // loading | empty | ready | uploading | error
  const [errorMessage, setErrorMessage] = useState(null);
  const inputRef = useRef(null);

  // Friendly display/download name (e.g. "Steel Fixing - Villa V_8 -
  // Completed1.pdf") — falls back to the raw S3 key if no friendly base
  // was passed in, so this component still works standalone.
  const friendlyFileName = file
    ? friendlyNameBase
      ? `${friendlyNameBase}.${file.extension}`
      : file.key.split("/").pop()
    : null;

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
        const friendlyName = friendlyNameBase ? `${friendlyNameBase}.${match.extension}` : match.key.split("/").pop();
        const { url } = await uploadsApi.presignGet(match.key, friendlyName);
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

    if (uploadLimits) {
      const extension = selected.name.split(".").pop()?.toLowerCase();
      if (!uploadLimits.extensions.includes(extension)) {
        setErrorMessage(`Unsupported file type ".${extension}". Allowed: ${uploadLimits.extensions.map((e) => `.${e}`).join(", ")}`);
        event.target.value = "";
        return;
      }
      if (selected.size > uploadLimits.maxSizeMB * 1024 * 1024) {
        setErrorMessage(`File exceeds ${uploadLimits.maxSizeMB}MB limit`);
        event.target.value = "";
        return;
      }
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
    try {
      const { url } = await uploadsApi.presignGet(file.key, friendlyFileName);
      // Can't just window.open() or use <a download> directly on the S3
      // URL — browsers ignore the download attribute on cross-origin
      // links (which a presigned S3 URL always is), so that would just
      // navigate to/open the file instead of downloading it. Fetching it
      // as a blob first gives a same-origin blob: URL that a real
      // download actually works on, with no new tab involved.
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download file");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = friendlyFileName || `file.${file.extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  }

  async function handlePreview() {
    if (!file) return;
    try {
      // No friendly filename passed here on purpose — that would set
      // Content-Disposition: attachment and force a download instead of
      // letting the browser render it inline (PDFs, images, etc.).
      // Preview is the one case where a new tab is actually correct,
      // since viewing (not saving) is the whole point.
      const { url } = await uploadsApi.presignGet(file.key);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
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
        accept={uploadLimits ? uploadLimits.extensions.map((e) => `.${e}`).join(",") : undefined}
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
          <div className="file-generic">📄 {friendlyFileName}</div>
        )}
        {status === "error" && <span className="upload-error">{errorMessage}</span>}
      </div>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={status === "uploading"}>
        Select File
      </button>
      <div className="button-group">
        <button type="button" onClick={handlePreview} disabled={!file}>
          Preview
        </button>
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
