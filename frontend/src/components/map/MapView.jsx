import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, useMap } from "react-leaflet";
import { VillaLayer } from "./VillaLayer.jsx";
import { BoundaryLayer } from "./BoundaryLayer.jsx";
import { MapPanControl } from "./MapPanControl.jsx";
import { MapItemColorControl } from "./MapItemColorControl.jsx";
import { ProjectBranding } from "./ProjectBranding.jsx";
import { MAP_DEFAULTS, GEOJSON_URL, BOUNDARY_GEOJSON_URL } from "../../config/mapConfig.js";
import { cachedJsonFetch } from "../../utils/cachedFetch.js";
import { useConstructionItemData } from "../../hooks/useConstructionItemData.js";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { useAllVillaInvoiceStatuses } from "../../hooks/useAllVillaInvoiceStatuses.js";
import { useSpecialQueryData } from "../../hooks/useSpecialQueryData.js";
import { renderPrintableMap } from "../../utils/renderPrintableMap.js";
import { computeScheduleStatusFast } from "../../utils/scheduleUtils.js";
import { evaluateCustomQuery } from "../../utils/customQueryUtils.js";
import { computeEdgeOrientation } from "../../utils/blockOrientation.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { SCHEDULE_STATUS_ORDER, INVOICE_STATUS_ORDER, OUT_OF_SEQUENCE_ORDER } from "../../config/scheduleInvoiceColors.js";
import { useColorPreferences } from "../../contexts/ColorPreferencesContext.jsx";

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

// Villa number labels default to off and auto-hide the instant any zoom
// starts (wheel, +/- buttons, or double-click) — the user re-enables
// them deliberately via the floating toggle when they actually want to
// read numbers, rather than labels persisting through every zoom step.
function HideLabelsOnZoom({ onZoomStart }) {
  const map = useMap();
  useEffect(() => {
    map.on("zoomstart", onZoomStart);
    return () => map.off("zoomstart", onZoomStart);
  }, [map, onZoomStart]);
  return null;
}

// Highlighted block/zone label, positioned in screen pixels (like
// MapPanControl) rather than as a Leaflet Marker/divIcon — needs the
// block's on-screen pixel width every pan/zoom to size its own text, and
// pixels are what that width naturally comes in.
//
// No pill/background anymore, and no decluttering that moves a label off
// its own block — sized to fit within the block's own width instead, so
// it sits right on its block without spilling into a neighbor, and reads
// as plain bold text over the parcel fill (a thin light halo keeps it
// legible over the darker villa colors without needing a solid box).
function HighlightLabelsOverlay({ groups }) {
  const map = useMap();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!map || groups.length === 0) {
      setItems([]);
      return;
    }

    const MIN_FONT_PX = 7;
    const MAX_FONT_PX = 12;

    function recompute() {
      const next = groups.map((g) => {
        const center = g.bounds.getCenter();
        const labelPt = map.latLngToContainerPoint(g.labelLatLng);
        const westPt = map.latLngToContainerPoint(L.latLng(center.lat, g.bounds.getWest()));
        const eastPt = map.latLngToContainerPoint(L.latLng(center.lat, g.bounds.getEast()));
        const blockWidthPx = Math.abs(eastPt.x - westPt.x);
        // Solve for the font size whose estimated text width just fits
        // 85% of the block's own width, so there's always a small
        // margin before the label would reach a neighboring block.
        const fontPx = Math.min(
          Math.max((blockWidthPx * 0.85) / (g.label.length * 0.62), MIN_FONT_PX),
          MAX_FONT_PX
        );
        return {
          key: g.key,
          label: g.label,
          x: labelPt.x,
          y: labelPt.y,
          fontPx,
          // CSS rotate() is clockwise-positive; computeEdgeOrientation
          // returns jsPDF's convention (CCW-positive as viewed) so the
          // PDF and the live map end up visually matching — negate it
          // here to convert between the two.
          rotationDeg: -(g.rotationDeg ?? 0),
        };
      });
      setItems(next);
    }

    recompute();
    map.on("move zoom", recompute);
    return () => map.off("move zoom", recompute);
  }, [map, groups]);

  return (
    <>
      {items.map((it) => (
        <div
          key={it.key}
          className="highlight-block-label-overlay"
          style={{
            left: it.x,
            top: it.y,
            fontSize: `${it.fontPx}px`,
            transform: `translate(-50%, -50%) rotate(${it.rotationDeg}deg)`,
          }}
        >
          {it.label}
        </div>
      ))}
    </>
  );
}

export const MapView = forwardRef(function MapView(
  { onVillaClick, colorByItem, onColorByItemChange, refreshKey = 0, labelsEnabled = false, onLabelsEnabledChange },
  ref
) {
  const { getColors, getColumnColors, setColumnColor, resetColumnColors } = useColorPreferences();
  const [geojson, setGeojson] = useState(null);
  const [boundaryGeojson, setBoundaryGeojson] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedVillas, setSelectedVillas] = useState([]);
  const [selectedVillaTypes, setSelectedVillaTypes] = useState([]);
  const [customQueryConditions, setCustomQueryConditions] = useState([]);
  const [highlightBlocks, setHighlightBlocks] = useState([]);
  const [highlightZones, setHighlightZones] = useState([]);
  // Highlighting has two independent visual pieces — the bright
  // outline/bold border drawn on matching villas, and the block/zone
  // text label overlay — so either can be shown on its own (e.g. label
  // only, no border) instead of always toggling together.
  const [highlightShowBorder, setHighlightShowBorder] = useState(true);
  const [highlightShowLabel, setHighlightShowLabel] = useState(true);
  const [showBoundary, setShowBoundary] = useState(false);
  const [colorMode, setColorMode] = useState("status"); // status | schedule | invoice | column
  const [selectedSpecialQueryColumn, setSelectedSpecialQueryColumn] = useState("");
  const [selectedColumnValues, setSelectedColumnValues] = useState([]);
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
    colorByItem?.TableItemID ?? null,
    refreshKey
  );

  // Schedule mode needs every villa's FULL status map too (to check
  // predecessor completion via the dependency graph) — fetched once,
  // independent of which item is selected, only when actually needed.
  const { data: allVillaStatuses, status: allVillaStatusesLoadStatus } = useAllVillaStatuses(
    colorMode === "schedule" || colorMode === "outOfSequence" || customQueryConditions.length > 0,
    refreshKey
  );
  const { data: allVillaInvoiceStatuses } = useAllVillaInvoiceStatuses(customQueryConditions.length > 0, refreshKey);
  const {
    columns: specialQueryColumns,
    valuesByColumn: specialQueryValuesByColumn,
    byVilla: specialQueryByVilla,
  } = useSpecialQueryData(true);

  // Map<id> / Map<TableItemID> lookups for the fast classifier — built
  // once per template load, not per villa.
  const itemMaps = useMemo(() => {
    const itemById = new Map(constructionItemsTemplate.map((t) => [t.id, t]));
    const itemByTableId = new Map(constructionItemsTemplate.map((t) => [t.TableItemID, t]));
    return { itemById, itemByTableId };
  }, [constructionItemsTemplate]);

  // Uses the FAST classifier (verified equivalent to the recursive
  // version — see scheduleUtils.js) instead of the original recursive
  // one, which benchmarked at ~110ms for ~1,540 villas here (vs ~15ms
  // fast) — enough synchronous main-thread work on a slower machine to
  // feel like a freeze every time you touch Schedule mode.
  const scheduleLookup = useMemo(() => {
    if (colorMode !== "schedule" || !itemRows || !allVillaStatuses || constructionItemsTemplate.length === 0 || !colorByItem) {
      return null;
    }
    const cutoff = new Date(`${cutoffDate}T00:00:00`);
    const lookup = {};
    itemRows.forEach((r) => {
      lookup[r.villaID] = computeScheduleStatusFast({
        targetTableItemId: colorByItem.TableItemID,
        targetActualStatus: r.actualStatus,
        targetPlannedStartDate: r.plannedStartDate,
        cutoffDate: cutoff,
        itemById: itemMaps.itemById,
        itemByTableId: itemMaps.itemByTableId,
        villaStatusMap: allVillaStatuses[r.villaID] ?? {},
      });
    });
    return lookup;
  }, [colorMode, itemRows, allVillaStatuses, constructionItemsTemplate.length, itemMaps, colorByItem, cutoffDate]);

  // Colors the selected item, per villa, by whether it's Completed with
  // an incomplete predecessor — see outOfSequenceUtils.js for the same
  // rule used by the standalone Out of Sequence report; this is the
  // per-item, on-the-map view of the same anomaly.
  const outOfSequenceLookup = useMemo(() => {
    if (colorMode !== "outOfSequence" || !itemRows || !allVillaStatuses || !colorByItem) return null;
    const predecessors = colorByItem.predecessors ?? [];
    const lookup = {};
    itemRows.forEach((r) => {
      if (r.actualStatus !== "Completed") {
        lookup[r.villaID] = "NotCompletedYet";
        return;
      }
      const villaStatusMap = allVillaStatuses[r.villaID] ?? {};
      const hasIncompletePredecessor = predecessors.some((predId) => {
        const predItem = itemMaps.itemById.get(predId);
        if (!predItem) return false;
        return villaStatusMap[predItem.TableItemID] !== "Completed";
      });
      lookup[r.villaID] = hasIncompletePredecessor ? "OutOfSequence" : "OK";
    });
    return lookup;
  }, [colorMode, itemRows, allVillaStatuses, colorByItem, itemMaps]);

  const isLoading =
    colorMode === "schedule"
      ? itemDataLoadStatus === "loading" || allVillaStatusesLoadStatus === "loading" || (!!colorByItem && !scheduleLookup)
      : colorMode === "outOfSequence"
        ? itemDataLoadStatus === "loading" || allVillaStatusesLoadStatus === "loading" || (!!colorByItem && !outOfSequenceLookup)
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

      // Boundary data is now fetched lazily (see the effect above) — make
      // sure it's actually loaded before computing bounds from it, rather
      // than trusting React state, which won't have caught up yet on a
      // session's first export. Resolves instantly if already cached.
      let boundary = boundaryGeojson;
      if (!boundary) {
        boundary = await cachedJsonFetch(BOUNDARY_GEOJSON_URL).catch(() => null);
        if (boundary) setBoundaryGeojson(boundary);
      }

      const combined = L.latLngBounds([]);
      if (geojson) {
        const b = L.geoJSON(geojson).getBounds();
        if (b.isValid()) combined.extend(b);
      }
      if (boundary) {
        const b = L.geoJSON(boundary).getBounds();
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
        highlightVillaIDs: highlightShowBorder ? highlightVillaIDs : null,
        customQueryVillaIDs,
        customQueryColors: customQueryConditions.length > 0 ? getColors("customQuery") : null,
        titleText: "Sahms ElGhroub — Site Map",
        subtitleText: customQueryConditions.length > 0
          ? "Colored by custom query"
          : colorByItem
            ? `Colored by: ${colorByItem.name} (${colorMode})`
            : undefined,
      });
    },
    // Raw draw context for the TRUE-VECTOR PDF exporter
    // (buildVectorLayoutPdf) — same data VillaLayer consumes, handed
    // over un-rendered so jsPDF can draw real vector paths and
    // selectable text instead of embedding a raster image. Covers all
    // four color modes (status/schedule/invoice/column) plus the
    // custom-query overlay.
    getPrintContext(options = {}) {
      return {
        geojson,
        boundaryGeojson,
        itemStatusLookup,
        colorPalette: activeColors,
        statusOrder: activeOrder,
        statusCounts,
        filteredVillaIDs,
        highlightVillaIDs: highlightShowBorder ? highlightVillaIDs : null,
        // Leaflet's LatLngBounds isn't meaningful outside a Leaflet map —
        // the PDF exporter projects raw geo coordinates itself, so hand
        // it plain numbers instead of the Leaflet instance used
        // on-screen. lng/lat here is the EDGE anchor (near one end of
        // the block's long axis, not its center — see labelLatLng
        // above); westLng/eastLng stay at the bounds' own center
        // latitude, since those are only used for the width-fit font
        // sizing, not for where the label is drawn.
        highlightGroupLabels: (highlightShowLabel ? highlightGroupLabels : []).map((g) => {
          const center = g.bounds.getCenter();
          return {
            label: g.label,
            lng: g.labelLatLng.lng,
            lat: g.labelLatLng.lat,
            westLng: g.bounds.getWest(),
            eastLng: g.bounds.getEast(),
            widthSampleLat: center.lat,
            rotationDeg: g.rotationDeg,
          };
        }),
        customQueryVillaIDs,
        customQueryColors: customQueryConditions.length > 0 ? getColors("customQuery") : null,
        titleText: options.printWindow ? "Site Map — Selected Area" : "Site Map — Villa Status",
        subtitleText: customQueryConditions.length > 0
          ? "Colored by custom query"
          : colorMode === "column" && selectedSpecialQueryColumn
            ? `Colored by column: ${selectedSpecialQueryColumn}`
            : colorByItem
              ? `Colored by: ${colorByItem.name} (${colorMode})`
              : undefined,
        printWindow: options.printWindow ?? null,
      };
    },
    // AutoCAD "Plot > Window" selection: puts the live Leaflet map into a
    // one-shot rubber-band mode. The user drags a rectangle; we resolve
    // with its geographic bounds ({minLng,minLat,maxLng,maxLat}) or null
    // if cancelled (Escape / zero-size drag). Map panning is suspended
    // during the drag and fully restored afterwards.
    selectPrintArea() {
      const map = mapInstanceRef.current;
      if (!map) return Promise.resolve(null);

      return new Promise((resolve) => {
        const container = map.getContainer();
        const rubber = document.createElement("div");
        rubber.style.cssText =
          "position:absolute;border:2px dashed #2563eb;background:rgba(37,99,235,0.12);pointer-events:none;z-index:1000;display:none;";
        container.appendChild(rubber);
        container.style.cursor = "crosshair";
        map.dragging.disable();

        let startPt = null;

        const cleanup = () => {
          container.style.cursor = "";
          map.dragging.enable();
          rubber.remove();
          container.removeEventListener("mousedown", onDown);
          container.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          window.removeEventListener("keydown", onKey);
        };

        const toContainerPt = (e) => {
          const r = container.getBoundingClientRect();
          return { x: e.clientX - r.left, y: e.clientY - r.top };
        };

        const onDown = (e) => {
          startPt = toContainerPt(e);
          rubber.style.display = "block";
          rubber.style.left = `${startPt.x}px`;
          rubber.style.top = `${startPt.y}px`;
          rubber.style.width = "0px";
          rubber.style.height = "0px";
          e.preventDefault();
        };

        const onMove = (e) => {
          if (!startPt) return;
          const p = toContainerPt(e);
          rubber.style.left = `${Math.min(startPt.x, p.x)}px`;
          rubber.style.top = `${Math.min(startPt.y, p.y)}px`;
          rubber.style.width = `${Math.abs(p.x - startPt.x)}px`;
          rubber.style.height = `${Math.abs(p.y - startPt.y)}px`;
        };

        const onUp = (e) => {
          if (!startPt) return;
          const p = toContainerPt(e);
          const x0 = Math.min(startPt.x, p.x), x1 = Math.max(startPt.x, p.x);
          const y0 = Math.min(startPt.y, p.y), y1 = Math.max(startPt.y, p.y);
          cleanup();
          if (x1 - x0 < 8 || y1 - y0 < 8) { resolve(null); return; }
          const nw = map.containerPointToLatLng([x0, y0]);
          const se = map.containerPointToLatLng([x1, y1]);
          resolve({
            minLng: Math.min(nw.lng, se.lng),
            maxLng: Math.max(nw.lng, se.lng),
            minLat: Math.min(nw.lat, se.lat),
            maxLat: Math.max(nw.lat, se.lat),
          });
        };

        const onKey = (e) => {
          if (e.key === "Escape") { cleanup(); resolve(null); }
        };

        container.addEventListener("mousedown", onDown);
        container.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        window.addEventListener("keydown", onKey);
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

  // Column mode: color every villa by its value for a chosen
  // special-query column instead of a fixed status set. Reuses the SAME
  // itemStatusLookup/colorPalette mechanism VillaLayer already has for
  // Status/Schedule/Invoice — it's generic enough to just feed dynamic
  // data into, no new coloring machinery needed there.
  const columnValueLookup = useMemo(() => {
    if (colorMode !== "column" || !selectedSpecialQueryColumn) return null;
    const lookup = {};
    Object.keys(villaMetaByID).forEach((villaID) => {
      const value = specialQueryByVilla[villaID]?.[selectedSpecialQueryColumn];
      lookup[villaID] = value !== undefined && value !== null && value !== "" ? String(value) : "(no value)";
    });
    return lookup;
  }, [colorMode, selectedSpecialQueryColumn, specialQueryByVilla, villaMetaByID]);

  const distinctColumnValues = useMemo(() => {
    if (!selectedSpecialQueryColumn) return [];
    return [...new Set([...(specialQueryValuesByColumn[selectedSpecialQueryColumn] ?? []).map(String), "(no value)"])];
  }, [selectedSpecialQueryColumn, specialQueryValuesByColumn]);

  // Every value selected by default the moment a column is picked —
  // "see everything, then narrow down" rather than starting from
  // nothing selected.
  useEffect(() => {
    if (selectedSpecialQueryColumn) setSelectedColumnValues(distinctColumnValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpecialQueryColumn]);

  const columnColors = useMemo(() => {
    if (!selectedSpecialQueryColumn || distinctColumnValues.length === 0) return {};
    return getColumnColors(selectedSpecialQueryColumn, distinctColumnValues);
  }, [selectedSpecialQueryColumn, distinctColumnValues, getColumnColors]);

  // Villas whose column value isn't in the current multi-select get
  // muted, same "narrow, don't hide" treatment as every other filter.
  // null (not filtered at all) when every value is selected, since
  // muting nothing is the same as not filtering.
  const columnFilterVillaIDs = useMemo(() => {
    if (colorMode !== "column" || !selectedSpecialQueryColumn || !columnValueLookup) return null;
    if (selectedColumnValues.length >= distinctColumnValues.length) return null;
    const set = new Set();
    Object.entries(columnValueLookup).forEach(([villaID, value]) => {
      if (selectedColumnValues.includes(value)) set.add(villaID);
    });
    return set;
  }, [colorMode, selectedSpecialQueryColumn, columnValueLookup, selectedColumnValues, distinctColumnValues.length]);

  const itemStatusLookup =
    colorMode === "status"
      ? statusLookup
      : colorMode === "invoice"
        ? invoiceLookup
        : colorMode === "schedule"
          ? scheduleLookup
          : colorMode === "outOfSequence"
            ? outOfSequenceLookup
            : columnValueLookup;
  const activeColors = colorMode === "column" ? columnColors : getColors(colorMode);
  const activeOrder =
    colorMode === "status"
      ? ITEM_STATUS_ORDER
      : colorMode === "invoice"
        ? INVOICE_STATUS_ORDER
        : colorMode === "schedule"
          ? SCHEDULE_STATUS_ORDER
          : colorMode === "outOfSequence"
            ? OUT_OF_SEQUENCE_ORDER
            : selectedColumnValues;

  const customQueryVillaIDs = useMemo(() => {
    if (customQueryConditions.length === 0) return null;
    if (!allVillaStatuses || !allVillaInvoiceStatuses) return null; // still loading
    return evaluateCustomQuery(customQueryConditions, {
      villaMetaByID,
      allVillaStatuses,
      allVillaInvoiceStatuses,
      specialQueryByVilla,
    });
  }, [customQueryConditions, allVillaStatuses, allVillaInvoiceStatuses, villaMetaByID, specialQueryByVilla]);

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
      selectedVillaTypes.length === 0 &&
      !customQueryVillaIDs &&
      !columnFilterVillaIDs
    )
      return null;
    const set = new Set();
    Object.entries(villaMetaByID).forEach(([villaID, meta]) => {
      if (selectedVillas.length > 0 && !selectedVillas.includes(villaID)) return;
      if (selectedBlocks.length > 0 && !selectedBlocks.includes(meta.blocknum)) return;
      if (selectedZones.length > 0 && !selectedZones.includes(meta.zonenum)) return;
      if (selectedVillaTypes.length > 0 && !selectedVillaTypes.includes(meta.villatype)) return;
      if (customQueryVillaIDs && !customQueryVillaIDs.has(villaID)) return;
      if (columnFilterVillaIDs && !columnFilterVillaIDs.has(villaID)) return;
      set.add(villaID);
    });
    return set;
  }, [villaMetaByID, selectedBlocks, selectedZones, selectedVillas, selectedVillaTypes, customQueryVillaIDs, columnFilterVillaIDs]);

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

  // One label per highlighted group instead of a single combined label —
  // when several blocks and/or zones are highlighted at once, each gets
  // its own number shown right on its own location. Block and zone
  // labels are independent of each other and both render when both are
  // selected — a block label sits at that block's own center (scoped to
  // the selected zones, if any), while a zone label sits at the whole
  // zone's center regardless of which blocks within it are highlighted.
  //
  // `bounds` (not just a center point) is kept per group — both the
  // live map and the PDF size each label's text to fit within its own
  // block's width, so a label sits ON its block without bleeding into
  // a neighboring one.
  const highlightGroupLabels = useMemo(() => {
    if (!geojson || !highlightVillaIDs || highlightVillaIDs.size === 0) return [];

    const featuresByVillaID = new Map(
      (geojson.features ?? []).map((f) => [f.properties?.villaID, f])
    );

    const boundsFor = (villaIDs) => {
      const matchingFeatures = villaIDs.map((id) => featuresByVillaID.get(id)).filter(Boolean);
      if (matchingFeatures.length === 0) return null;
      const bounds = L.geoJSON({ type: "FeatureCollection", features: matchingFeatures }).getBounds();
      return bounds.isValid() ? bounds : null;
    };

    // Every ring vertex of every parcel in the group, in raw [lng, lat] —
    // feeds computeEdgeOrientation so the label rotates to follow the
    // block's own orientation (curved streets included) instead of
    // always sitting perfectly horizontal regardless of how the block
    // itself is laid out.
    const ringPointsFor = (villaIDs) => {
      const pts = [];
      villaIDs.forEach((id) => {
        const geom = featuresByVillaID.get(id)?.geometry;
        if (!geom) return;
        const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
        polys.forEach((rings) => {
          const outer = rings[0];
          if (outer) outer.forEach(([lng, lat]) => pts.push([lng, lat]));
        });
      });
      return pts;
    };

    const blockGroups = highlightBlocks.map((block) => {
      const matchingEntries = Object.entries(villaMetaByID).filter(
        ([, meta]) =>
          meta.blocknum === block &&
          (highlightZones.length === 0 || highlightZones.includes(meta.zonenum))
      );
      // A block normally sits inside a single zone, but derive it from the
      // matching villas themselves rather than assuming — if a block
      // number happens to appear in more than one zone, show all of them
      // instead of silently picking one.
      const zonesForBlock = [...new Set(matchingEntries.map(([, meta]) => meta.zonenum))].filter(Boolean);
      const label = zonesForBlock.length > 0
        ? `Zone ${zonesForBlock.join(", ")} / Block ${block}`
        : `Block ${block}`;
      return {
        key: `block-${block}`,
        label,
        villaIDs: matchingEntries.map(([villaID]) => villaID),
      };
    });

    const zoneGroups = highlightZones.map((zone) => ({
      key: `zone-${zone}`,
      label: `Zone ${zone}`,
      villaIDs: Object.entries(villaMetaByID)
        .filter(([, meta]) => meta.zonenum === zone)
        .map(([villaID]) => villaID),
    }));

    return [...blockGroups, ...zoneGroups]
      .map((g) => {
        const bounds = boundsFor(g.villaIDs);
        if (!bounds) return null;
        const center = bounds.getCenter();
        const orientation = computeEdgeOrientation(ringPointsFor(g.villaIDs), center.lat);
        // Positioned near one end of the block's own long axis (still
        // rotated the same way) instead of the dead-center of the whole
        // cluster — same idea as the villa numbers reading along a
        // parcel, but anchored toward the block's edge per request.
        const labelLatLng = L.latLng(center.lat + orientation.offsetLat, center.lng + orientation.offsetLng);
        return { ...g, bounds, rotationDeg: orientation.angleDeg, labelLatLng };
      })
      .filter(Boolean);
  }, [geojson, highlightVillaIDs, highlightBlocks, highlightZones, villaMetaByID]);

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
    cachedJsonFetch(GEOJSON_URL).then(setGeojson).catch(setLoadError);
  }, []);

  // Lazy on purpose — this was previously fetched unconditionally on
  // every page load "just in case" Download PDF needed it, but it's a
  // large file only actually used when the boundary layer is toggled on
  // or a PDF export starts (forceAllLabels), and most sessions never do
  // either. Fetching it eagerly put it on the critical path for
  // everyone to speed up a feature most people never touch — in one
  // observed load it alone took 18s. A 404 here is still fine, the
  // boundary feature is optional and this just leaves boundaryGeojson
  // null.
  useEffect(() => {
    if (!showBoundary && !forceAllLabels) return;
    if (boundaryGeojson) return;
    cachedJsonFetch(BOUNDARY_GEOJSON_URL)
      .then(setBoundaryGeojson)
      .catch(() => setBoundaryGeojson(null));
  }, [showBoundary, forceAllLabels, boundaryGeojson]);

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
        preferCanvas
        attributionControl={false}
        zoomAnimation={false}
      >
        <VillaLayer
          geojson={geojson}
          itemStatusLookup={itemStatusLookup}
          colorPalette={activeColors}
          filteredVillaIDs={filteredVillaIDs}
          highlightVillaIDs={highlightShowBorder ? highlightVillaIDs : null}
          statusHighlight={statusHighlight}
          customQueryVillaIDs={customQueryVillaIDs}
          customQueryColors={customQueryConditions.length > 0 ? getColors("customQuery") : null}
          forceAllLabels={forceAllLabels}
          showBoundary={showBoundary}
          showLabels={labelsEnabled}
          onVillaClick={onVillaClick}
        />
        <BoundaryLayer geojson={boundaryGeojson} visible={showBoundary || forceAllLabels} />
        <HighlightLabelsOverlay groups={highlightShowLabel ? highlightGroupLabels : []} />
        <FitToBounds geojson={geojson} />
        <MapPanControl />
        <HideLabelsOnZoom onZoomStart={() => onLabelsEnabledChange?.(false)} />
      </MapContainer>

      <button
        type="button"
        className={`map-labels-toggle ${labelsEnabled ? "is-active" : ""}`}
        onClick={() => onLabelsEnabledChange?.(!labelsEnabled)}
      >
        {labelsEnabled ? "🏷️ Hide Villa Numbers" : "🏷️ Show Villa Numbers"}
      </button>

      <ProjectBranding />

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
        highlightShowBorder={highlightShowBorder}
        onHighlightShowBorderChange={setHighlightShowBorder}
        highlightShowLabel={highlightShowLabel}
        onHighlightShowLabelChange={setHighlightShowLabel}
        statusHighlight={statusHighlight}
        onToggleStatusHighlight={toggleStatusHighlight}
        onClearStatusHighlight={clearStatusHighlight}
        showBoundary={showBoundary}
        onShowBoundaryChange={setShowBoundary}
        customQueryConditions={customQueryConditions}
        onCustomQueryConditionsChange={setCustomQueryConditions}
        villaMetaByID={villaMetaByID}
        specialQueryColumns={specialQueryColumns}
        specialQueryValuesByColumn={specialQueryValuesByColumn}
        customQueryColors={getColors("customQuery")}
        selectedSpecialQueryColumn={selectedSpecialQueryColumn}
        onSelectedSpecialQueryColumnChange={setSelectedSpecialQueryColumn}
        distinctColumnValues={distinctColumnValues}
        selectedColumnValues={selectedColumnValues}
        onSelectedColumnValuesChange={setSelectedColumnValues}
        columnColors={columnColors}
        onSetColumnColor={(value, color) => setColumnColor(selectedSpecialQueryColumn, value, color)}
        onResetColumnColors={() => resetColumnColors(selectedSpecialQueryColumn)}
      />
    </>
  );
});
