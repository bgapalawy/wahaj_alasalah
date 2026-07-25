import { useEffect, useState } from "react";
import { settingsApi } from "../../api/settings.js";
import { uploadsApi } from "../../api/uploads.js";

const LOGO_SLOT_COUNT = 5;
const LOGO_PREFIXES = Array.from({ length: LOGO_SLOT_COUNT }, (_, i) => `branding-logo-${i + 1}`);

/**
 * Shared project branding — one project name + up to 5 stacked logos
 * (each with its own caption), for the whole app (not per-user, not
 * per-villa), editable by any logged-in user, not gated behind Admin.
 * Reuses the existing villa-file S3 upload system under 5 fixed
 * prefixes ("branding-logo-1".."branding-logo-5") rather than a
 * separate upload path — see uploadPrefixValidation.js.
 *
 * Collapsible with a persistent header (matches MapItemColorControl's
 * pattern) — the collapse toggle stays reachable in every state
 * (collapsed, expanded, or mid-edit), instead of a save/cancel flow
 * being the only way back to a stable view.
 *
 * Also read directly by buildVectorLayoutPdf.js so the PDF export shows
 * the same branding in the title block.
 */
export function ProjectBranding() {
  const [settings, setSettings] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCaptions, setDraftCaptions] = useState(Array(LOGO_SLOT_COUNT).fill(""));
  const [pendingLogoFiles, setPendingLogoFiles] = useState(Array(LOGO_SLOT_COUNT).fill(null));
  const [uploadLimits, setUploadLimits] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    settingsApi
      .getBranding()
      .then(setSettings)
      .catch(() => setSettings({ projectName: null, logos: Array(LOGO_SLOT_COUNT).fill({ caption: null, logoUrl: null }) }));
    uploadsApi.limits().then(setUploadLimits).catch(() => setUploadLimits(null));
  }, []);

  function startEditing() {
    setDraftName(settings?.projectName ?? "");
    setDraftCaptions(Array.from({ length: LOGO_SLOT_COUNT }, (_, i) => settings?.logos?.[i]?.caption ?? ""));
    setPendingLogoFiles(Array(LOGO_SLOT_COUNT).fill(null));
    setErrorMessage(null);
    setEditing(true);
  }

  function handleFileChange(slotIndex, e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (uploadLimits) {
      const extension = selected.name.split(".").pop()?.toLowerCase();
      if (!["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
        setErrorMessage(`Logo must be an image file. Allowed: jpg, jpeg, png, webp, gif`);
        e.target.value = "";
        return;
      }
      if (selected.size > uploadLimits.maxSizeMB * 1024 * 1024) {
        setErrorMessage(`File exceeds ${uploadLimits.maxSizeMB}MB limit`);
        e.target.value = "";
        return;
      }
    }
    setPendingLogoFiles((prev) => prev.map((f, i) => (i === slotIndex ? selected : f)));
  }

  function handleCaptionChange(slotIndex, value) {
    setDraftCaptions((prev) => prev.map((c, i) => (i === slotIndex ? value : c)));
  }

  async function handleDeleteLogo(slotIndex) {
    setStatus("saving");
    setErrorMessage(null);
    try {
      await uploadsApi.remove(LOGO_PREFIXES[slotIndex]);
      const clearedCaptions = draftCaptions.map((c, i) => (i === slotIndex ? "" : c));
      const updated = await settingsApi.updateBranding({ projectName: draftName, logoCaptions: clearedCaptions });
      setSettings(updated);
      setDraftCaptions(clearedCaptions);
      setPendingLogoFiles((prev) => prev.map((f, i) => (i === slotIndex ? null : f)));
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMessage(null);
    try {
      for (let i = 0; i < LOGO_SLOT_COUNT; i++) {
        const file = pendingLogoFiles[i];
        if (!file) continue;
        const { url } = await uploadsApi.presignPut({
          prefix: LOGO_PREFIXES[i],
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
        });
        const uploadResponse = await uploadsApi.putToS3(url, file);
        if (!uploadResponse.ok) throw new Error(`Logo ${i + 1} upload to storage failed`);
      }
      const updated = await settingsApi.updateBranding({ projectName: draftName, logoCaptions: draftCaptions });
      setSettings(updated);
      setEditing(false);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  }

  if (!settings) return null;

  const activeLogos = (settings.logos ?? []).filter((l) => l?.logoUrl || l?.caption);

  return (
    <div className={`map-branding ${editing ? "is-editing" : ""}`}>
      <div className="map-branding-header">
        <span className="map-branding-header-title">{settings.projectName || "Branding"}</span>
        <span className="map-branding-header-actions">
          {!collapsed && !editing && (
            <button type="button" className="map-branding-edit-icon-btn" onClick={startEditing} title="Edit project branding">
              ✎
            </button>
          )}
          <button
            type="button"
            className="map-branding-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▼" : "▲"}
          </button>
        </span>
      </div>

      {!collapsed && !editing && (
        <div className="map-branding-body">
          {activeLogos.length === 0 && <p className="map-branding-hint">No logos added yet — click ✎ to add one.</p>}
          {activeLogos.map((logo, i) => (
            <div key={i} className="map-branding-logo-row">
              {logo.logoUrl && <img src={logo.logoUrl} alt="" className="map-branding-logo" />}
              {logo.caption && <div className="map-branding-caption">{logo.caption}</div>}
            </div>
          ))}
        </div>
      )}

      {!collapsed && editing && (
        <div className="map-branding-body map-branding-editing">
          <label className="map-branding-field">
            Project name
            <input type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </label>

          {Array.from({ length: LOGO_SLOT_COUNT }).map((_, i) => (
            <div key={i} className="map-branding-logo-slot">
              <label className="map-branding-field">
                Logo {i + 1} {uploadLimits && <span className="map-branding-hint">(max {uploadLimits.maxSizeMB}MB)</span>}
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(i, e)} />
              </label>
              {pendingLogoFiles[i] && <p className="map-branding-hint">Selected: {pendingLogoFiles[i].name}</p>}
              {settings?.logos?.[i]?.logoUrl && !pendingLogoFiles[i] && (
                <button type="button" className="map-branding-delete-btn" onClick={() => handleDeleteLogo(i)} disabled={status === "saving"}>
                  Delete this logo
                </button>
              )}
              <label className="map-branding-field">
                Caption under logo {i + 1}
                <input type="text" value={draftCaptions[i]} onChange={(e) => handleCaptionChange(i, e.target.value)} />
              </label>
            </div>
          ))}

          {errorMessage && <p className="map-branding-error">{errorMessage}</p>}
          <div className="map-branding-actions">
            <button type="button" onClick={handleSave} disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={status === "saving"}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
