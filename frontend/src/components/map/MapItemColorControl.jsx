import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";
import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { StatusDonut } from "./StatusDonut.jsx";
import { LoadingRing } from "../common/LoadingRing.jsx";
import { MultiSelect } from "../dashboard/MultiSelect.jsx";

/**
 * Replaces the original app's coloringvillas() feature: pick a
 * construction item and every villa on the map recolors to that item's
 * status for that villa, instead of the villa's overall status. Also
 * replaces the block/zone/villa/type filtering that fed into the same
 * feature — villas outside the filter render muted instead of excluded,
 * so you can still see where they are. All filters are multi-select.
 * "Zone" is sourced from the GeoJSON's zonenum field.
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
}) {
  const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="map-item-color-control">
      <div className="map-item-color-header">
        <span>Color map by item</span>
        {selectedItem && (
          <button type="button" className="map-item-color-clear" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      <ConstructionItemSelect value={selectedItem} onChange={onChange} />

      {selectedItem &&
        (blockOptions.length > 0 || zoneOptions.length > 0 || villaOptions.length > 0 || villaTypeOptions.length > 0) && (
          <div className="map-item-color-filters">
            {villaOptions.length > 0 && (
              <MultiSelect label="Villa" options={villaOptions} value={selectedVillas} onChange={onVillasChange} />
            )}
            {blockOptions.length > 0 && (
              <MultiSelect label="Block" options={blockOptions} value={selectedBlocks} onChange={onBlocksChange} />
            )}
            {zoneOptions.length > 0 && (
              <MultiSelect label="Zone" options={zoneOptions} value={selectedZones} onChange={onZonesChange} />
            )}
            {villaTypeOptions.length > 0 && (
              <MultiSelect
                label="Villa Type"
                options={villaTypeOptions}
                value={selectedVillaTypes}
                onChange={onVillaTypesChange}
              />
            )}
          </div>
        )}

      {loading && <LoadingRing label="Loading…" />}

      {!loading && selectedItem && (
        <div className="map-item-color-legend">
          <div className="map-item-color-legend-with-chart">
            <StatusDonut segments={ITEM_STATUS_ORDER.map((s) => ({ value: statusCounts[s] ?? 0, color: ITEM_STATUS_COLORS[s] }))} />
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
    </div>
  );
}
