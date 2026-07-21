import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { VillaLayer } from "./VillaLayer.jsx";
import { MAP_DEFAULTS, GEOJSON_URL } from "../../config/mapConfig.js";
import { useVillas } from "../../hooks/useVillas.js";

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

export function MapView({ onVillaClick }) {
  const [geojson, setGeojson] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const { villas } = useVillas();
  const villaLookup = useRef({});

  useEffect(() => {
    villaLookup.current = Object.fromEntries(
      (villas ?? []).map((v) => [v.villaID, v])
    );
  }, [villas]);

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
        villaLookup={villaLookup.current}
        onVillaClick={onVillaClick}
      />
      <FitToBounds geojson={geojson} />
    </MapContainer>
  );
}
