import { useState } from "react";
import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";
import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { StatusDonut } from "./StatusDonut.jsx";
import { LoadingRing } from "../common/LoadingRing.jsx";
import { MultiSelect } from "../dashboard/MultiSelect.jsx";
import { useDraggable } from "../../hooks/useDraggable.js";
import { CustomQueryBuilder } from "../shared/CustomQueryBuilder.jsx";

const COLOR_MODES = [
  { id: "status", label: "Status" },
  { id: "schedule", label: "Schedule" },
  { id: "invoice", label: "Invoice" },
  { id: "outOfSequence", label: "Out of Sequence" },
  { id: "column", label: "Column" },
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
  customQueryConditions = [],
  onCustomQueryConditionsChange,
  villaMetaByID = {},
  specialQueryColumns = [],
  specialQueryValuesByColumn = {},
  customQueryColors = { match: "#2563eb", noMatch: "#d1d5db" },
  selectedSpecialQueryColumn = "",
  onSelectedSpecialQueryColumnChange,
  distinctColumnValues = [],
  selectedColumnValues = [],
  onSelectedColumnValuesChange,
  columnColors = {},
  onSetColumnColor,
  onResetColumnColors,
}) {
  // Starts collapsed: at 320px wide with unbounded height, this panel
  // covers most of a phone-width viewport when expanded (see the "takes
  // more area" complaint) — better to open on demand than to greet
  // every session with the map half-hidden.
  const [collapsed, setCollapsed] = useState(true);
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

          {colorMode === "column" ? (
            <div className="admin-field">
              <label>Special query column</label>
              <select value={selectedSpecialQueryColumn} onChange={(e) => onSelectedSpecialQueryColumnChange?.(e.target.value)}>
                <option value="">— Select a column —</option>
                {specialQueryColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <ConstructionItemSelect value={selectedItem} onChange={onChange} />
          )}

          {loading && <LoadingRing label="Loading…" />}

          {colorMode === "column" && selectedSpecialQueryColumn && (
            <MultiSelect
              label="Values"
              options={distinctColumnValues}
              value={selectedColumnValues}
              onChange={onSelectedColumnValuesChange}
            />
          )}

          {colorMode === "schedule" && (
            <label className="map-cutoff-date-field">
              Cutoff date (is it due yet?)
              <input type="date" value={cutoffDate} onChange={(e) => onCutoffDateChange?.(e.target.value)} />
            </label>
          )}

          {selectedItem &&
            (blockOptions.length > 0 || zoneOptions.length > 0 || villaOptions.length > 0 || villaTypeOptions.length > 0) && (
              <details className="filters-section">
                <summary>
                  Filters
                  {(() => {
                    const activeCount =
                      selectedZones.length + selectedBlocks.length + selectedVillaTypes.length + selectedVillas.length;
                    return activeCount > 0 ? ` (${activeCount} active)` : "";
                  })()}
                </summary>
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
              </details>
            )}

          {/* Independent of item selection on purpose — this is a visual
              spotlight (bright outline on a zone/block), not tied to any
              construction item's data, so it shouldn't require picking
              one first. */}
          {(blockOptions.length > 0 || zoneOptions.length > 0) && (
            <details className="filters-section">
              <summary>
                Highlight
                {highlightZones.length + highlightBlocks.length > 0
                  ? ` (${highlightZones.length + highlightBlocks.length} active)`
                  : ""}
              </summary>
              <div className="map-highlight-row">
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
            </details>
          )}

          <details className="custom-query-section">
            <summary>
              Custom query {customQueryConditions.length > 0 && `(${customQueryConditions.length} condition${customQueryConditions.length === 1 ? "" : "s"})`}
            </summary>
            <p className="file-status-hint" style={{ marginTop: "0.4rem" }}>
              Combine conditions across item status, invoice status, and villa attributes — e.g. "Civil-1 = Completed AND
              Block = 5". Narrows the map on top of the filters above.
            </p>
            <CustomQueryBuilder
              conditions={customQueryConditions}
              onChange={onCustomQueryConditionsChange}
              villaMetaByID={villaMetaByID}
              specialQueryColumns={specialQueryColumns}
              specialQueryValuesByColumn={specialQueryValuesByColumn}
            />
            {customQueryConditions.length > 0 && (
              <div className="map-item-color-legend-rows" style={{ marginTop: "0.5rem" }}>
                <span className="map-item-color-legend-row">
                  <span className="legend-swatch" style={{ backgroundColor: customQueryColors.match }} />
                  Matches the query
                </span>
                <span className="map-item-color-legend-row">
                  <span className="legend-swatch" style={{ backgroundColor: customQueryColors.noMatch }} />
                  Doesn't match
                </span>
              </div>
            )}
          </details>

          <label className="map-boundary-toggle">
            <input type="checkbox" checked={showBoundary} onChange={(e) => onShowBoundaryChange(e.target.checked)} />
            Show project boundary
          </label>

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

          {!loading && (selectedItem || (colorMode === "column" && selectedSpecialQueryColumn)) && (
            <div className="map-item-color-legend">
              <div className="map-item-color-legend-with-chart">
                <StatusDonut segments={statusOrder.map((s) => ({ value: statusCounts[s] ?? 0, color: statusColors[s] }))} />
                <div className="map-item-color-legend-rows">
                  {statusOrder.map((s) => {
                    const count = statusCounts[s] ?? 0;
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    const isActive = statusHighlight && statusHighlight.has(s);
                    if (colorMode === "column") {
                      return (
                        <span key={s} className="map-item-color-legend-row">
                          <input
                            type="color"
                            className="column-legend-color-input"
                            value={columnColors[s] ?? "#cccccc"}
                            onChange={(e) => onSetColumnColor?.(s, e.target.value)}
                          />
                          {s}
                          <span className="map-item-color-count">
                            {count} <span className="map-item-color-percent">({percent.toFixed(0)}%)</span>
                          </span>
                        </span>
                      );
                    }
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
              {colorMode === "column" && (
                <button type="button" className="map-item-color-clear" onClick={onResetColumnColors}>
                  Reset column colors
                </button>
              )}
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
