import { useState } from "react";
import { useColorPreferences } from "../../contexts/ColorPreferencesContext.jsx";
import { ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { SCHEDULE_STATUS_ORDER, INVOICE_STATUS_ORDER } from "../../config/scheduleInvoiceColors.js";

const MODES = [
  { id: "status", label: "Item Status", order: ITEM_STATUS_ORDER },
  { id: "schedule", label: "Schedule", order: SCHEDULE_STATUS_ORDER },
  { id: "invoice", label: "Invoice", order: INVOICE_STATUS_ORDER },
  { id: "overallStatus", label: "Overall Villa Status", order: ["NotStarted", "InProgress", "Completed"] },
  { id: "customQuery", label: "Custom Query", order: ["match", "noMatch"] },
];

const DISPLAY_LABELS = { match: "Matches the query", noMatch: "Doesn't match" };

export function ColorSettingsPanel() {
  const { getColors, setColor, resetMode } = useColorPreferences();
  const [activeMode, setActiveMode] = useState("status");
  const modeInfo = MODES.find((m) => m.id === activeMode);
  const colors = getColors(activeMode);

  return (
    <div className="color-settings-panel">
      <div className="map-color-mode-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`map-color-mode-btn ${activeMode === m.id ? "is-active" : ""}`}
            onClick={() => setActiveMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="color-settings-rows">
        {modeInfo.order.map((key) => (
          <label key={key} className="color-settings-row">
            <span>{DISPLAY_LABELS[key] ?? key}</span>
            <input
              type="color"
              value={colors[key] ?? "#cccccc"}
              onChange={(e) => setColor(activeMode, key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <button type="button" className="map-item-color-clear" onClick={() => resetMode(activeMode)}>
        Reset {modeInfo.label} to defaults
      </button>

      <p className="file-status-hint">
        Changes apply everywhere this status set is shown — the map, its legend, every dashboard pie, and printed PDFs —
        and are saved on this device.
      </p>
    </div>
  );
}
