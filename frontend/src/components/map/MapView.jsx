import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { VillaLayer } from "./VillaLayer.jsx";
import { MapItemColorControl } from "./MapItemColorControl.jsx";
import { MAP_DEFAULTS, GEOJSON_URL } from "../../config/mapConfig.js";
import { useVillas } from "../../hooks/useVillas.js";
import { useConstructionItemStatus } from "../../hooks/useConstructionItemStatus.js";

// Below this zoom level, ~600 villanum labels overlap into an unreadable
// cluster (confirmed by screenshot) — only show them once you're zoomed
// in far enough that each parcel actually has room for its own label.
const LABEL_MIN_ZOOM = 18;

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

/** Tracks zoom level so villa labels can be shown/hidden without prop-drilling the map instance. */
function ZoomTracker({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
}

export function MapView({ onVillaClick, colorByItem, onColorByItemChange }) {
  const [geojson, setGeojson] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [zoom, setZoom] = useState(MAP_DEFAULTS.zoom);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedVillas, setSelectedVillas] = useState([]);
  const [selectedVillaTypes, setSelectedVillaTypes] = useState([]);
  const { villas } = useVillas();

  // Was a ref before — mutating a ref doesn't trigger a re-render, so
  // villa colors could silently stay stale until something else happened
  // to re-render MapView. State fixes that.
  const [villaLookup, setVillaLookup] = useState({});
  useEffect(() => {
    setVillaLookup(Object.fromEntries((villas ?? []).map((v) => [v.villaID, v])));
  }, [villas]);

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

  const blockOptions = useMemo(
    () => [...new Set(Object.values(villaMetaByID).map((m) => m.blocknum))].filter(Boolean).sort(),
    [villaMetaByID]
  );
  const zoneOptions = useMemo(
    () => [...new Set(Object.values(villaMetaByID).map((m) => m.zonenum))].filter(Boolean).sort(),
    [villaMetaByID]
  );
  const villaTypeOptions = useMemo(
    () => [...new Set(Object.values(villaMetaByID).map((m) => m.villatype))].filter(Boolean).sort(),
    [villaMetaByID]
  );
  const villaOptions = useMemo(
    () => Object.keys(villaMetaByID).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [villaMetaByID]
  );

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

  const { lookup: itemStatusLookup, status: itemStatusLoadStatus } = useConstructionItemStatus(
    colorByItem?.TableItemID ?? null
  );

  const statusCounts = useMemo(() => {
    if (!itemStatusLookup) return {};
    const counts = {};
    Object.entries(itemStatusLookup).forEach(([villaID, status]) => {
      if (filteredVillaIDs && !filteredVillaIDs.has(villaID)) return;
      counts[status] = (counts[status] ?? 0) + 1;
    });
    return counts;
  }, [itemStatusLookup, filteredVillaIDs]);

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
          villaLookup={villaLookup}
          itemStatusLookup={itemStatusLookup}
          filteredVillaIDs={filteredVillaIDs}
          showLabels={zoom >= LABEL_MIN_ZOOM}
          onVillaClick={onVillaClick}
        />
        <FitToBounds geojson={geojson} />
        <ZoomTracker onZoomChange={setZoom} />
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
      />
    </>
  );
}
