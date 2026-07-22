import { useState } from "react";
import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";
import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { StatusDonut } from "./StatusDonut.jsx";
import { LoadingRing } from "../common/LoadingRing.jsx";
import { MultiSelect } from "../dashboard/MultiSelect.jsx";
import { useDraggable } from "../../hooks/useDraggable.js";

const COLOR_MODES = [
  { id: "status", label: "Status" },
  { id: "schedule", label: "Schedule" },
  { id: "invoice", label: "Invoice" },
];

/**
 * Replaces the original app's coloringvillas() feature: pick a
 * construction item and every villa on the map recolors to that item's
 * status for that villa, instead of the villa's overall status. Now
 * three modes (matching the original's "monitoring type" concept):
 *   - Status:   the item's actual progress status
 *   - Schedule: is it on track given its planned date + dependencies
 *   - Invoice:  its billing status (NotStarted/ReadyToPay/Paid)
 *
 * Also covers:
 *  - block/zone/villa/type multi-select filtering (muted, not excluded)
 *  - highlight a single block or zone with a bright outline (spotlight,
 *    independent of filtering)
 *  - toggle the outer project boundary overlay
 *  - collapse the whole panel down to just its header
 */
export function MapItemColorControl({
  selectedItem,
  onChange,
  colorMode = "status",
  onColorModeChange,
  cutoffDate,
  onCutoffDateChange,
  loading,
  statusCounts = {},
  statusColors = ITEM_STATUS_COLORS,
  statusOrder = ITEM_STATUS_ORDER,
  remainingCount = null,
  totalProjectVillas = null,
  statusHighlight = null,
  onToggleStatusHighlight,
  onClearStatusHighlight,
  blockOptions = [],
  zoneOptions = [],
  selectedBlocks = [],
  onBlocksChange,
  selectedZones = [],
  onZonesChange,
  villaOptions = [],
  selectedVillas = [],
  onVillasChange,
  villaTypeOptions = [],
  selectedVillaTypes = [],
  onVillaTypesChange,
  highlightBlocks = [],
  highlightBlockOptions = [],
  onHighlightBlocksChange,
  highlightZones = [],
  onHighlightZonesChange,
  showBoundary,
  onShowBoundaryChange,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { handleRef, style: dragStyle } = useDraggable();
  const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="map-item-color-control" style={dragStyle}>
      <div className="map-item-color-header" ref={handleRef}>
        <span>Color map by item</span>
        <span className="map-item-color-header-actions">
          {selectedItem && !collapsed && (
            <button type="button" className="map-item-color-clear" onClick={() => onChange(null)}>
              Clear
            </button>
          )}
          <button
            type="button"
            className="map-item-color-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▼" : "▲"}
          </button>
        </span>
      </div>

      {!collapsed && (
        <>
          <div className="map-color-mode-row">
            {COLOR_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`map-color-mode-btn ${colorMode === m.id ? "is-active" : ""}`}
                onClick={() => onColorModeChange?.(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <ConstructionItemSelect value={selectedItem} onChange={onChange} />

          {colorMode === "schedule" && (
            <label className="map-cutoff-date-field">
              Cutoff date (is it due yet?)
              <input type="date" value={cutoffDate} onChange={(e) => onCutoffDateChange?.(e.target.value)} />
            </label>
          )}

          {selectedItem &&
            (blockOptions.length > 0 || zoneOptions.length > 0 || villaOptions.length > 0 || villaTypeOptions.length > 0) && (
              <div className="map-item-color-filters">
                {/* Zone > Block > Villa hierarchy — Zone first narrows Block's
                    options, Block then narrows Villa's (handled in MapView). */}
                {zoneOptions.length > 0 && (
                  <MultiSelect label="Zone" options={zoneOptions} value={selectedZones} onChange={onZonesChange} />
                )}
                {blockOptions.length > 0 && (
                  <MultiSelect label="Block" options={blockOptions} value={selectedBlocks} onChange={onBlocksChange} />
                )}
                {villaTypeOptions.length > 0 && (
                  <MultiSelect
                    label="Villa Type"
                    options={villaTypeOptions}
                    value={selectedVillaTypes}
                    onChange={onVillaTypesChange}
                  />
                )}
                {villaOptions.length > 0 && (
                  <MultiSelect label="Villa" options={villaOptions} value={selectedVillas} onChange={onVillasChange} />
                )}
              </div>
            )}

          {(blockOptions.length > 0 || zoneOptions.length > 0) && (
            <div className="map-highlight-row">
              <span className="map-highlight-label">Highlight:</span>
              {zoneOptions.length > 0 && (
                <MultiSelect label="Zone" options={zoneOptions} value={highlightZones} onChange={onHighlightZonesChange} />
              )}
              {highlightBlockOptions.length > 0 && (
                <MultiSelect
                  label="Block"
                  options={highlightBlockOptions}
                  value={highlightBlocks}
                  onChange={onHighlightBlocksChange}
                />
              )}
              {(highlightBlocks.length > 0 || highlightZones.length > 0) && (
                <button
                  type="button"
                  className="map-item-color-clear"
                  onClick={() => {
                    onHighlightBlocksChange([]);
                    onHighlightZonesChange([]);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <label className="map-boundary-toggle">
            <input type="checkbox" checked={showBoundary} onChange={(e) => onShowBoundaryChange(e.target.checked)} />
            Show project boundary
          </label>

          {loading && <LoadingRing label="Loading…" />}

          {(remainingCount !== null || totalProjectVillas !== null) && (
            <div className="map-badge-row">
              {totalProjectVillas !== null && (
                <div className="map-remaining-badge" title="Every real villa in the site plan">
                  <span className="map-remaining-badge-icon">▦</span>
                  Total project: <strong>{totalProjectVillas}</strong>
                </div>
              )}
              {remainingCount !== null && remainingCount > 0 && (
                <div className="map-remaining-badge" title="Real villas outside the current filter">
                  <span className="map-remaining-badge-icon">⊘</span>
                  Not filtered: <strong>{remainingCount}</strong>
                </div>
              )}
            </div>
          )}

          {!loading && selectedItem && (
            <div className="map-item-color-legend">
              <div className="map-item-color-legend-with-chart">
                <StatusDonut segments={statusOrder.map((s) => ({ value: statusCounts[s] ?? 0, color: statusColors[s] }))} />
                <div className="map-item-color-legend-rows">
                  {statusOrder.map((s) => {
                    const count = statusCounts[s] ?? 0;
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    const isActive = statusHighlight && statusHighlight.has(s);
                    return (
                      <button
                        type="button"
                        key={s}
                        className={`map-item-color-legend-row map-item-color-legend-row-clickable ${isActive ? "is-active" : ""}`}
                        onClick={() => onToggleStatusHighlight?.(s)}
                        title="Click to spotlight this status on the map (doesn't change any counts)"
                      >
                        <span className="legend-swatch" style={{ backgroundColor: statusColors[s] }} />
                        {s}
                        <span className="map-item-color-count">
                          {count} <span className="map-item-color-percent">({percent.toFixed(0)}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {statusHighlight && statusHighlight.size > 0 && (
                <button type="button" className="map-item-color-clear" onClick={onClearStatusHighlight}>
                  Clear status spotlight
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
