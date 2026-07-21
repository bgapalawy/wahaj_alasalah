import { useState } from "react";
import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";
import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { StatusDonut } from "./StatusDonut.jsx";
import { LoadingRing } from "../common/LoadingRing.jsx";
import { MultiSelect } from "../dashboard/MultiSelect.jsx";
import { useDraggable } from "../../hooks/useDraggable.js";

/**
 * Replaces the original app's coloringvillas() feature: pick a
 * construction item and every villa on the map recolors to that item's
 * status for that villa, instead of the villa's overall status.
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
  loading,
  statusCounts = {},
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
  highlightBlock,
  highlightBlockOptions = [],
  onHighlightBlockChange,
  highlightZone,
  onHighlightZoneChange,
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
          <ConstructionItemSelect value={selectedItem} onChange={onChange} />

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
                <select
                  value={highlightZone ?? ""}
                  onChange={(e) => onHighlightZoneChange(e.target.value || null)}
                >
                  <option value="">Zone…</option>
                  {zoneOptions.map((z) => (
                    <option key={z} value={z}>
                      Zone {z}
                    </option>
                  ))}
                </select>
              )}
              {highlightBlockOptions.length > 0 && (
                <select
                  value={highlightBlock ?? ""}
                  onChange={(e) => onHighlightBlockChange(e.target.value || null)}
                >
                  <option value="">Block…</option>
                  {highlightBlockOptions.map((b) => (
                    <option key={b} value={b}>
                      Block {b}
                    </option>
                  ))}
                </select>
              )}
              {(highlightBlock || highlightZone) && (
                <button
                  type="button"
                  className="map-item-color-clear"
                  onClick={() => {
                    onHighlightBlockChange(null);
                    onHighlightZoneChange(null);
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

          {!loading && selectedItem && (
            <div className="map-item-color-legend">
              <div className="map-item-color-legend-with-chart">
                <StatusDonut
                  segments={ITEM_STATUS_ORDER.map((s) => ({ value: statusCounts[s] ?? 0, color: ITEM_STATUS_COLORS[s] }))}
                />
                <div className="map-item-color-legend-rows">
                  {ITEM_STATUS_ORDER.map((s) => {
                    const count = statusCounts[s] ?? 0;
                    const percent = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <span key={s} className="map-item-color-legend-row">
                        <span className="legend-swatch" style={{ backgroundColor: ITEM_STATUS_COLORS[s] }} />
                        {s}
                        <span className="map-item-color-count">
                          {count} <span className="map-item-color-percent">({percent.toFixed(0)}%)</span>
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
