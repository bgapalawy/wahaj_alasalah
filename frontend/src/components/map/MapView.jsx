import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { VillaLayer } from "./VillaLayer.jsx";
import { BoundaryLayer } from "./BoundaryLayer.jsx";
import { MapPanControl } from "./MapPanControl.jsx";
import { MapItemColorControl } from "./MapItemColorControl.jsx";
import { MAP_DEFAULTS, GEOJSON_URL } from "../../config/mapConfig.js";
import { useConstructionItemStatus } from "../../hooks/useConstructionItemStatus.js";

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

export function MapView({ onVillaClick, colorByItem, onColorByItemChange }) {
  const [geojson, setGeojson] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedVillas, setSelectedVillas] = useState([]);
  const [selectedVillaTypes, setSelectedVillaTypes] = useState([]);
  const [highlightBlock, setHighlightBlock] = useState(null);
  const [highlightZone, setHighlightZone] = useState(null);
  const [showBoundary, setShowBoundary] = useState(false);

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

  // Hierarchy: Zone > Block > Villa. Villa Type is a separate, independent
  // classification, not part of this geographic chain.
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

  const villaTypeOptions = useMemo(
    () => [...new Set(Object.values(villaMetaByID).map((m) => m.villatype))].filter(Boolean).sort(),
    [villaMetaByID]
  );

  const villaOptions = useMemo(() => {
    let scoped = Object.entries(villaMetaByID);
    if (selectedZones.length > 0) scoped = scoped.filter(([, m]) => selectedZones.includes(m.zonenum));
    if (selectedBlocks.length > 0) scoped = scoped.filter(([, m]) => selectedBlocks.includes(m.blocknum));
    return scoped.map(([id]) => id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [villaMetaByID, selectedZones, selectedBlocks]);

  // Drop selections that fall out of scope when a parent filter changes
  // (e.g. a block from a zone you just deselected) — same pattern as the
  // portfolio dashboard's category->item cascade.
  useEffect(() => {
    setSelectedBlocks((prev) => prev.filter((b) => blockOptions.includes(b)));
  }, [blockOptions]);
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

  // Highlight follows the same Zone > Block hierarchy: picking a zone
  // narrows which blocks are offered, and clears an out-of-scope block
  // selection instead of silently highlighting nothing.
  const highlightBlockOptions = useMemo(() => {
    const scoped = highlightZone
      ? Object.values(villaMetaByID).filter((m) => m.zonenum === highlightZone)
      : Object.values(villaMetaByID);
    return [...new Set(scoped.map((m) => m.blocknum))].filter(Boolean).sort();
  }, [villaMetaByID, highlightZone]);

  useEffect(() => {
    if (highlightBlock && !highlightBlockOptions.includes(highlightBlock)) setHighlightBlock(null);
  }, [highlightBlockOptions, highlightBlock]);

  // Spotlight, not a filter — villas matching the chosen block/zone get a
  // bright outline on top of their normal color, everything else is
  // untouched. Independent of the multi-select filters above.
  const highlightVillaIDs = useMemo(() => {
    if (!highlightBlock && !highlightZone) return null;
    const set = new Set();
    Object.entries(villaMetaByID).forEach(([villaID, meta]) => {
      if (highlightBlock && meta.blocknum !== highlightBlock) return;
      if (highlightZone && meta.zonenum !== highlightZone) return;
      set.add(villaID);
    });
    return set;
  }, [villaMetaByID, highlightBlock, highlightZone]);

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

  const highlightLabelText = [highlightBlock && `Block ${highlightBlock}`, highlightZone && `Zone ${highlightZone}`]
    .filter(Boolean)
    .join(" / ");

  const { lookup: itemStatusLookup, status: itemStatusLoadStatus } = useConstructionItemStatus(
    colorByItem?.TableItemID ?? null
  );

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

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${GEOJSON_URL} (${res.status})`);
        return res.json();
      })
      .then(setGeojson)
      .catch(setLoadError);
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
        center={MAP_DEFAULTS.center}
        zoom={MAP_DEFAULTS.zoom}
        minZoom={MAP_DEFAULTS.minZoom}
        maxZoom={MAP_DEFAULTS.maxZoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <VillaLayer
          geojson={geojson}
          itemStatusLookup={itemStatusLookup}
          filteredVillaIDs={filteredVillaIDs}
          highlightVillaIDs={highlightVillaIDs}
          onVillaClick={onVillaClick}
        />
        <BoundaryLayer visible={showBoundary} />
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
        loading={itemStatusLoadStatus === "loading"}
        statusCounts={statusCounts}
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
        highlightBlock={highlightBlock}
        highlightBlockOptions={highlightBlockOptions}
        onHighlightBlockChange={setHighlightBlock}
        highlightZone={highlightZone}
        onHighlightZoneChange={setHighlightZone}
        showBoundary={showBoundary}
        onShowBoundaryChange={setShowBoundary}
      />
    </>
  );
}
