import { useEffect, useState } from "react";
import { FILE_STATUS_CATEGORIES, buildSlotPrefix, buildFriendlyFileName } from "../../config/fileStatusConfig.js";
import { FileUploadSlot } from "./FileUploadSlot.jsx";
import { uploadsApi } from "../../api/uploads.js";

const VALID_TAB_STATES = new Set(FILE_STATUS_CATEGORIES.map((c) => c.state));

/**
 * Replaces the "Files status" block + showFunction() tab-toggle logic from
 * left_click.js. Needs a constructionItemId + villaID to build S3 key
 * prefixes for each slot.
 */
export function FileStatusSection({ constructionItemId, constructionItemName, villaID, activityStatus }) {
  const [activeState, setActiveState] = useState(FILE_STATUS_CATEGORIES[0].state);
  const [uploadLimits, setUploadLimits] = useState(null);

  // Fetched once per panel open (not per-slot — there can be 11 slots
  // rendered at once) so the real allowed extensions/size can be shown
  // upfront instead of the user finding out by trial and error after a
  // rejected upload.
  useEffect(() => {
    uploadsApi.limits().then(setUploadLimits).catch(() => setUploadLimits(null));
  }, []);

  // Default (and re-sync) the open tab to match the activity's current
  // status, so new uploads land under the right category by default
  // instead of always opening on "Not Started" regardless of real
  // progress — and so completing an activity moves the default view
  // to "Completed" immediately rather than only on next open.
  useEffect(() => {
    if (activityStatus && VALID_TAB_STATES.has(activityStatus)) {
      setActiveState(activityStatus);
    }
  }, [activityStatus, constructionItemId, villaID]);

  if (!constructionItemId) {
    return <p className="file-status-hint">Select a construction item to manage its files.</p>;
  }

  return (
    <div className="file-status-section">
      <h3>Files status</h3>
      {uploadLimits && (
        <p className="file-status-hint">
          Images, documents, videos, and engineering files (CAD, BIM, GIS, schedules, Power BI) accepted — max{" "}
          {uploadLimits.maxSizeMB}MB per file
        </p>
      )}
      <div className="status-tabs">
        {FILE_STATUS_CATEGORIES.map(({ state, label }) => (
          <button
            key={state}
            type="button"
            className={state === activeState ? "active" : ""}
            onClick={() => setActiveState(state)}
          >
            {label}
          </button>
        ))}
      </div>

      {FILE_STATUS_CATEGORIES.filter((c) => c.state === activeState).map(({ state, slots }) => (
        <div key={state} className="all-Images-container">
          {Array.from({ length: slots }).map((_, slotIndex) => (
            <FileUploadSlot
              key={slotIndex}
              prefix={buildSlotPrefix({ constructionItemId, villaID, state, slotIndex })}
              friendlyNameBase={buildFriendlyFileName({ constructionItemName, villaID, state, slotIndex })}
              uploadLimits={uploadLimits}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
