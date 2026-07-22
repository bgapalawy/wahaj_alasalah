import { GeoJSON } from "react-leaflet";

const BOUNDARY_STYLE = {
  color: "#c7cbd1",
  weight: 1,
  fill: false,
};

/**
 * The outer project boundary — a separate GeoJSON file from the villa
 * parcels. Geojson is fetched by the parent (MapView) rather than here,
 * so MapView can compute a combined villa+boundary extent for PDF export
 * instead of only fitting to the villa parcels and leaving the boundary
 * to sprawl outside the captured frame.
 */
export function BoundaryLayer({ geojson, visible }) {
  if (!visible || !geojson) return null;
  return <GeoJSON data={geojson} style={BOUNDARY_STYLE} interactive={false} />;
}
