import { useState } from "react";
import { FILE_STATUS_CATEGORIES, buildSlotPrefix } from "../../config/fileStatusConfig.js";
import { FileUploadSlot } from "./FileUploadSlot.jsx";

/**
 * Replaces the "Files status" block + showFunction() tab-toggle logic from
 * left_click.js. Needs a constructionItemId + villaID to build S3 key
 * prefixes for each slot.
 */
export function FileStatusSection({ constructionItemId, villaID }) {
  const [activeState, setActiveState] = useState(FILE_STATUS_CATEGORIES[0].state);

  if (!constructionItemId) {
    return <p className="file-status-hint">Select a construction item to manage its files.</p>;
  }

  return (
    <div className="file-status-section">
      <h3>Files status</h3>
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
            />
          ))}
        </div>
      ))}
    </div>
  );
}
