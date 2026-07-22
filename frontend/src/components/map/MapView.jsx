import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, useMap } from "react-leaflet";
import { VillaLayer } from "./VillaLayer.jsx";
import { BoundaryLayer } from "./BoundaryLayer.jsx";
import { MapPanControl } from "./MapPanControl.jsx";
import { MapItemColorControl } from "./MapItemColorControl.jsx";
import { MAP_DEFAULTS, GEOJSON_URL, BOUNDARY_GEOJSON_URL } from "../../config/mapConfig.js";
import { useConstructionItemData } from "../../hooks/useConstructionItemData.js";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { renderPrintableMap } from "../../utils/renderPrintableMap.js";
import { computeScheduleStatus } from "../../utils/scheduleUtils.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { SCHEDULE_STATUS_COLORS, SCHEDULE_STATUS_ORDER, INVOICE_STATUS_COLORS, INVOICE_STATUS_ORDER } from "../../config/scheduleInvoiceColors.js";

// Fits the map to the loaded geometry's bounds instead of relying on a
// hardcoded setView(). This is the fix that resolved the earlier
// "blank map / Null Island" bug — kept here as a small dedicated component
// so the fitting logic isn't buried inside a giant init function.
//
// Uses the `leaflet` package's own L.geoJSON directly rather than a global
// window.L, which is NOT guaranteed to exist when leaflet is pulled in only
// as an npm dependency of react-leaflet.
function FitToBounds({ geojson }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson) return;
    const layer = L.geoJSON(geojson);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [geojson, map]);
  return null;
}

export const MapView = forwardRef(function MapView({ onVillaClick, colorByItem, onColorByItemChange }, ref) {
  const [geojson, setGeojson] = useState(null);
  const [boundaryGeojson, setBoundaryGeojson] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedVillas, setSelectedVillas] = useState([]);
  const [selectedVillaTypes, setSelectedVillaTypes] = useState([]);
  const [highlightBlocks, setHighlightBlocks] = useState([]);
  const [highlightZones, setHighlightZones] = useState([]);
  const [showBoundary, setShowBoundary] = useState(false);
  const [colorMode, setColorMode] = useState("status"); // status | schedule | invoice
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  // Click a status in the legend to spotlight only that status on the
  // map — visual only, multi-select (Set for fast lookup in the style
  // function, which runs per-parcel).
  const [statusHighlight, setStatusHighlight] = useState(() => new Set());

  function toggleStatusHighlight(status) {
    setStatusHighlight((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function clearStatusHighlight() {
    setStatusHighlight(new Set());
  }

  // Clear the status spotlight when switching modes — a status from one
  // mode's vocabulary ("ready"/"blocked") wouldn't mean anything spotlit
  // against a different mode's colors.
  useEffect(() => {
    clearStatusHighlight();
  }, [colorMode]);

  const [forceAllLabels, setForceAllLabels] = useState(false);
  const mapInstanceRef = useRef(null);
  const savedViewRef = useRef(null);

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

  // One fetch per selected item, covering Status and Invoice modes.
  const { rows: itemRows, statusLookup, invoiceLookup, status: itemDataLoadStatus } = useConstructionItemData(
    colorByItem?.TableItemID ?? null
  );

  // Schedule mode needs every villa's FULL status map too (to check
  // predecessor completion via the dependency graph) — fetched once,
  // independent of which item is selected, only when actually needed.
  const { data: allVillaStatuses, status: allVillaStatusesLoadStatus } = useAllVillaStatuses(colorMode === "schedule");

  const scheduleLookup = useMemo(() => {
    if (colorMode !== "schedule" || !itemRows || !allVillaStatuses || constructionItemsTemplate.length === 0 || !colorByItem) {
      return null;
    }
    const cutoff = new Date(`${cutoffDate}T00:00:00`);
    const lookup = {};
    itemRows.forEach((r) => {
      lookup[r.villaID] = computeScheduleStatus({
        targetTableItemId: colorByItem.TableItemID,
        targetActualStatus: r.actualStatus,
        targetPlannedStartDate: r.plannedStartDate,
        cutoffDate: cutoff,
        allActivitiesTemplate: constructionItemsTemplate,
        villaStatusMap: allVillaStatuses[r.villaID] ?? {},
      });
    });
    return lookup;
  }, [colorMode, itemRows, allVillaStatuses, constructionItemsTemplate, colorByItem, cutoffDate]);

  const itemStatusLookup = colorMode === "status" ? statusLookup : colorMode === "invoice" ? invoiceLookup : scheduleLookup;
  const activeColors = colorMode === "status" ? ITEM_STATUS_COLORS : colorMode === "invoice" ? INVOICE_STATUS_COLORS : SCHEDULE_STATUS_COLORS;
  const activeOrder = colorMode === "status" ? ITEM_STATUS_ORDER : colorMode === "invoice" ? INVOICE_STATUS_ORDER : SCHEDULE_STATUS_ORDER;
  const isLoading =
    colorMode === "schedule"
      ? itemDataLoadStatus === "loading" || allVillaStatusesLoadStatus === "loading" || (!!colorByItem && !scheduleLookup)
      : itemDataLoadStatus === "loading";

  // Exposed to App.jsx so "Download PDF" can zoom out to fit BOTH the
  // villa parcels and the project boundary together, force every villa
  // label visible, wait for it to render, capture, then put the view
  // back exactly how it was. Fitting to villa parcels alone (the earlier
  // version) left the boundary sprawling outside the captured frame with
  // a large empty gap between it and the villa cluster.
  useImperativeHandle(ref, () => ({
    async prepareForExport() {
      const map = mapInstanceRef.current;
      if (!map) return;
      savedViewRef.current = { center: map.getCenter(), zoom: map.getZoom() };
      setForceAllLabels(true);

      const combined = L.latLngBounds([]);
      if (geojson) {
        const b = L.geoJSON(geojson).getBounds();
        if (b.isValid()) combined.extend(b);
      }
      if (boundaryGeojson) {
        const b = L.geoJSON(boundaryGeojson).getBounds();
        if (b.isValid()) combined.extend(b);
      }

      if (combined.isValid()) {
        await new Promise((resolve) => {
          map.once("moveend", resolve);
          map.fitBounds(combined, { padding: [30, 30], animate: false });
        });
      }

      // Best-effort wait for tiles at the new zoom/pan to finish loading
      // and for the debounced label-visibility pass to settle. There's no
      // fully reliable "everything is done rendering" signal to hook here
      // without much more plumbing, so this is a fixed buffer rather than
      // a precise one.
      await new Promise((resolve) => setTimeout(resolve, 900));
    },
    restoreAfterExport() {
      const map = mapInstanceRef.current;
      setForceAllLabels(false);
      if (map && savedViewRef.current) {
        map.setView(savedViewRef.current.center, savedViewRef.current.zoom, { animate: false });
      }
    },
    // Two earlier approaches to this both failed: native browser print of
    // the live Leaflet map came back blank (Leaflet positions its panes
    // with CSS transform, which browsers' print rendering frequently
    // fails to render), and an html2canvas screenshot of the map
    // container still wasn't reliable. This draws the map directly from
    // the raw GeoJSON onto a canvas — not a screenshot of anything, so
    // neither failure mode applies.
    captureMapSnapshot() {
      return renderPrintableMap({
        geojson,
        boundaryGeojson,
        itemStatusLookup,
        colorPalette: activeColors,
        statusOrder: activeOrder,
        filteredVillaIDs,
        highlightVillaIDs,
        titleText: "Sahms ElGhroub — Site Map",
        subtitleText: colorByItem ? `Colored by: ${colorByItem.name} (${colorMode})` : undefined,
      });
    },
  }));

  // Block, Zone (zonenum), and Villa Type all live on the GeoJSON feature
  // properties (the ArcGIS export) — not in the DynamoDB villas table,
  // which doesn't reliably have blocknum/stage populated. One metadata
  // map built straight from the geometry, skipping NOT_VILLA parcels.
  const villaMetaByID = useMemo(() => {
    if (!geojson) return {};
    const map = {};
    (geojson.features ?? []).forEach((f) => {
      const id = f.properties?.villaID;
      if (!id || id === "NOT_VILLA") return;
      const clean = (v) => (v && v !== "NOT_VILLA" ? v : null);
      map[id] = {
        blocknum: clean(f.properties?.blocknum),
        zonenum: clean(f.properties?.zonenum),
        villatype: clean(f.properties?.villatype),
      };
    });
    return map;
  }, [geojson]);

  // Hierarchy: Zone > Block > Villa Type > Villa. Each level narrows the
  // options for the next.
  const zoneOptions = useMemo(
    () => [...new Set(Object.values(villaMetaByID).map((m) => m.zonenum))].filter(Boolean).sort(),
    [villaMetaByID]
  );

  const blockOptions = useMemo(() => {
    const scoped =
      selectedZones.length > 0
        ? Object.values(villaMetaByID).filter((m) => selectedZones.includes(m.zonenum))
        : Object.values(villaMetaByID);
    return [...new Set(scoped.map((m) => m.blocknum))].filter(Boolean).sort();
  }, [villaMetaByID, selectedZones]);

  const villaTypeOptions = useMemo(() => {
    let scoped = Object.values(villaMetaByID);
    if (selectedZones.length > 0) scoped = scoped.filter((m) => selectedZones.includes(m.zonenum));
    if (selectedBlocks.length > 0) scoped = scoped.filter((m) => selectedBlocks.includes(m.blocknum));
    return [...new Set(scoped.map((m) => m.villatype))].filter(Boolean).sort();
  }, [villaMetaByID, selectedZones, selectedBlocks]);

  const villaOptions = useMemo(() => {
    let scoped = Object.entries(villaMetaByID);
    if (selectedZones.length > 0) scoped = scoped.filter(([, m]) => selectedZones.includes(m.zonenum));
    if (selectedBlocks.length > 0) scoped = scoped.filter(([, m]) => selectedBlocks.includes(m.blocknum));
    if (selectedVillaTypes.length > 0) scoped = scoped.filter(([, m]) => selectedVillaTypes.includes(m.villatype));
    return scoped.map(([id]) => id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [villaMetaByID, selectedZones, selectedBlocks, selectedVillaTypes]);

  // Drop selections that fall out of scope when a parent filter changes
  // (e.g. a block from a zone you just deselected) — same pattern as the
  // portfolio dashboard's category->item cascade.
  useEffect(() => {
    setSelectedBlocks((prev) => prev.filter((b) => blockOptions.includes(b)));
  }, [blockOptions]);
  useEffect(() => {
    setSelectedVillaTypes((prev) => prev.filter((t) => villaTypeOptions.includes(t)));
  }, [villaTypeOptions]);
  useEffect(() => {
    setSelectedVillas((prev) => prev.filter((v) => villaOptions.includes(v)));
  }, [villaOptions]);

  const filteredVillaIDs = useMemo(() => {
    if (
      selectedBlocks.length === 0 &&
      selectedZones.length === 0 &&
      selectedVillas.length === 0 &&
      selectedVillaTypes.length === 0
    )
      return null;
    const set = new Set();
    Object.entries(villaMetaByID).forEach(([villaID, meta]) => {
      if (selectedVillas.length > 0 && !selectedVillas.includes(villaID)) return;
      if (selectedBlocks.length > 0 && !selectedBlocks.includes(meta.blocknum)) return;
      if (selectedZones.length > 0 && !selectedZones.includes(meta.zonenum)) return;
      if (selectedVillaTypes.length > 0 && !selectedVillaTypes.includes(meta.villatype)) return;
      set.add(villaID);
    });
    return set;
  }, [villaMetaByID, selectedBlocks, selectedZones, selectedVillas, selectedVillaTypes]);

  // Highlight follows the same Zone > Block hierarchy: picking zones
  // narrows which blocks are offered, and drops out-of-scope block
  // selections instead of silently highlighting nothing. Both are now
  // multi-select — highlight several blocks/zones at once.
  const highlightBlockOptions = useMemo(() => {
    const scoped =
      highlightZones.length > 0
        ? Object.values(villaMetaByID).filter((m) => highlightZones.includes(m.zonenum))
        : Object.values(villaMetaByID);
    return [...new Set(scoped.map((m) => m.blocknum))].filter(Boolean).sort();
  }, [villaMetaByID, highlightZones]);

  useEffect(() => {
    setHighlightBlocks((prev) => prev.filter((b) => highlightBlockOptions.includes(b)));
  }, [highlightBlockOptions]);

  // Spotlight, not a filter — villas matching any chosen block/zone get a
  // bright outline on top of their normal color, everything else is
  // untouched. Independent of the multi-select filters above.
  const highlightVillaIDs = useMemo(() => {
    if (highlightBlocks.length === 0 && highlightZones.length === 0) return null;
    const set = new Set();
    Object.entries(villaMetaByID).forEach(([villaID, meta]) => {
      if (highlightBlocks.length > 0 && !highlightBlocks.includes(meta.blocknum)) return;
      if (highlightZones.length > 0 && !highlightZones.includes(meta.zonenum)) return;
      set.add(villaID);
    });
    return set;
  }, [villaMetaByID, highlightBlocks, highlightZones]);

  // Center point of whatever's currently highlighted, for the on-map
  // "Block X" / "Zone X" label — the combined bounding box of every
  // matching parcel, not an average of centroids (more representative of
  // where the block/zone actually sits).
  const highlightCenter = useMemo(() => {
    if (!geojson || !highlightVillaIDs || highlightVillaIDs.size === 0) return null;
    const matchingFeatures = (geojson.features ?? []).filter((f) => highlightVillaIDs.has(f.properties?.villaID));
    if (matchingFeatures.length === 0) return null;
    const bounds = L.geoJSON({ type: "FeatureCollection", features: matchingFeatures }).getBounds();
    return bounds.isValid() ? bounds.getCenter() : null;
  }, [geojson, highlightVillaIDs]);

  const highlightLabelText = [
    highlightBlocks.length > 0 && `Block ${highlightBlocks.join(", ")}`,
    highlightZones.length > 0 && `Zone ${highlightZones.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" / ");

  // Counts against every real villa in the GeoJSON (villaMetaByID), not
  // just the ones the backend has data for — your DB currently only has
  // ~590 of the ~1540 real villas populated. A villa missing from
  // itemStatusLookup defaults to NotStarted here, matching how VillaLayer
  // already colors it on the map (same `?? "NotStarted"` fallback), so
  // the legend's total now actually matches the site plan instead of
  // just "however many rows happen to exist in the database so far."
  const statusCounts = useMemo(() => {
    if (!itemStatusLookup) return {};
    const counts = {};
    Object.keys(villaMetaByID).forEach((villaID) => {
      if (filteredVillaIDs && !filteredVillaIDs.has(villaID)) return;
      const status = itemStatusLookup[villaID] ?? "NotStarted";
      counts[status] = (counts[status] ?? 0) + 1;
    });
    return counts;
  }, [itemStatusLookup, filteredVillaIDs, villaMetaByID]);

  // Villas excluded by the active filter — shown as a small standalone
  // "Remaining" badge, separate from the donut/legend (which now counts
  // only the filtered scope, per feedback that the previous "Other" row
  // was diluting those percentages with the whole project).
  const remainingCount = useMemo(() => {
    if (!filteredVillaIDs) return null;
    return Object.keys(villaMetaByID).length - filteredVillaIDs.size;
  }, [villaMetaByID, filteredVillaIDs]);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${GEOJSON_URL} (${res.status})`);
        return res.json();
      })
      .then(setGeojson)
      .catch(setLoadError);
  }, []);

  // Fetched eagerly (not just when toggled on) so "Download PDF" always
  // has the boundary's extent available to combine with the villa
  // parcels' bounds — a 404 here is fine, the boundary feature is
  // optional and this just leaves boundaryGeojson null.
  useEffect(() => {
    fetch(BOUNDARY_GEOJSON_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then(setBoundaryGeojson)
      .catch(() => setBoundaryGeojson(null));
  }, []);

  if (loadError) {
    return (
      <div className="map-error">
        Could not load site geometry: {loadError.message}
      </div>
    );
  }

  return (
    <>
      <MapContainer
        ref={mapInstanceRef}
        center={MAP_DEFAULTS.center}
        zoom={MAP_DEFAULTS.zoom}
        minZoom={MAP_DEFAULTS.minZoom}
        maxZoom={MAP_DEFAULTS.maxZoom}
        style={{ height: "100%", width: "100%" }}
      >
        <VillaLayer
          geojson={geojson}
          itemStatusLookup={itemStatusLookup}
          colorPalette={activeColors}
          filteredVillaIDs={filteredVillaIDs}
          highlightVillaIDs={highlightVillaIDs}
          statusHighlight={statusHighlight}
          forceAllLabels={forceAllLabels}
          onVillaClick={onVillaClick}
        />
        <BoundaryLayer geojson={boundaryGeojson} visible={showBoundary || forceAllLabels} />
        {highlightCenter && highlightLabelText && (
          <Marker
            position={highlightCenter}
            interactive={false}
            icon={L.divIcon({
              className: "highlight-block-label",
              html: `<span>${highlightLabelText}</span>`,
              iconSize: [0, 0],
            })}
          />
        )}
        <FitToBounds geojson={geojson} />
        <MapPanControl />
      </MapContainer>

      <MapItemColorControl
        selectedItem={colorByItem}
        onChange={onColorByItemChange}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        cutoffDate={cutoffDate}
        onCutoffDateChange={setCutoffDate}
        loading={isLoading}
        statusCounts={statusCounts}
        statusColors={activeColors}
        statusOrder={activeOrder}
        remainingCount={remainingCount}
        totalProjectVillas={Object.keys(villaMetaByID).length}
        blockOptions={blockOptions}
        zoneOptions={zoneOptions}
        selectedBlocks={selectedBlocks}
        onBlocksChange={setSelectedBlocks}
        selectedZones={selectedZones}
        onZonesChange={setSelectedZones}
        villaOptions={villaOptions}
        selectedVillas={selectedVillas}
        onVillasChange={setSelectedVillas}
        villaTypeOptions={villaTypeOptions}
        selectedVillaTypes={selectedVillaTypes}
        onVillaTypesChange={setSelectedVillaTypes}
        highlightBlocks={highlightBlocks}
        highlightBlockOptions={highlightBlockOptions}
        onHighlightBlocksChange={setHighlightBlocks}
        highlightZones={highlightZones}
        onHighlightZonesChange={setHighlightZones}
        statusHighlight={statusHighlight}
        onToggleStatusHighlight={toggleStatusHighlight}
        onClearStatusHighlight={clearStatusHighlight}
        showBoundary={showBoundary}
        onShowBoundaryChange={setShowBoundary}
      />
    </>
  );
});
