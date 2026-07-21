import { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import { VILLA_STATUS_COLORS } from "../../config/mapConfig.js";

/**
 * Renders villa parcel polygons and colors them by status.
 *
 * NOTE: this replaces the villaID/blocknum/villanum/TxtMemo filtering that
 * was temporarily bypassed in wajha_map_and_every_layer.js. Once the ArcGIS
 * spatial join populates those fields, pass a `villaLookup` map keyed by
 * villaID (built from `useVillas()`) so each polygon can pull its live
 * status/attributes instead of relying on the raw CAD-exported properties.
 */
export function VillaLayer({ geojson, villaLookup = {}, onVillaClick }) {
  const styleFn = useMemo(
    () => (feature) => {
      const villaID = feature.properties?.villaID;
      const villa = villaLookup[villaID];
      const status = villa?.status ?? "NotStarted";
      return {
        color: "#1f2937",
        weight: 1,
        fillColor: VILLA_STATUS_COLORS[status] ?? VILLA_STATUS_COLORS.NotStarted,
        fillOpacity: 0.6,
      };
    },
    [villaLookup]
  );

  const onEachFeature = (feature, layer) => {
    layer.on("click", () => {
      onVillaClick?.(feature.properties?.villaID, feature);
    });
  };

  if (!geojson) return null;

  return <GeoJSON data={geojson} style={styleFn} onEachFeature={onEachFeature} />;
}
