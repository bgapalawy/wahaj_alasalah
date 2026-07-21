import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import { BOUNDARY_GEOJSON_URL } from "../../config/mapConfig.js";

const BOUNDARY_STYLE = {
  color: "#c7cbd1",
  weight: 1,
  fill: false,
};

/**
 * The outer project boundary — a separate GeoJSON file from the villa
 * parcels. Only fetched once actually toggled on, since it's a
 * nice-to-have overlay, not part of the core map.
 */
export function BoundaryLayer({ visible }) {
  const [geojson, setGeojson] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  useEffect(() => {
    if (!visible || geojson || status === "loading" || status === "error") return;
    setStatus("loading");
    fetch(BOUNDARY_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${BOUNDARY_GEOJSON_URL} (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setGeojson(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [visible, geojson, status]);

  if (!visible || !geojson) return null;

  return <GeoJSON data={geojson} style={BOUNDARY_STYLE} interactive={false} />;
}
