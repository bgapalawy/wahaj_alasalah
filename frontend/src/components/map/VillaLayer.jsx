import { useEffect, useMemo, useRef } from "react";
import { GeoJSON } from "react-leaflet";
import { VILLA_STATUS_COLORS } from "../../config/mapConfig.js";
import { ITEM_STATUS_COLORS } from "../../config/itemStatusColors.js";

const NOT_VILLA_STYLE = { color: "#c7cbd1", weight: 0.5, fillColor: "#e5e7eb", fillOpacity: 0.12 };

/**
 * Renders villa parcel polygons, colored one of two ways:
 *  - default: each villa's overall computed status (NotStarted/InProgress/Completed)
 *  - item mode (itemStatusLookup provided): a single construction item's
 *    status for that villa (NotStarted/NCR/Notes/Rejected/Completed) —
 *    replaces the original app's coloringvillas() feature.
 *
 * Parcels whose villaID is the literal string "NOT_VILLA" (roads, common
 * areas, etc.) always render in a flat "off" style, are not clickable,
 * and are excluded from status counts/coloring regardless of any filter.
 *
 * Restyling uses Leaflet's imperative `setStyle()` on the existing layer
 * group instead of remounting the whole GeoJSON layer on every change.
 * The earlier version forced a remount via a changing `key` prop, which
 * meant every single multi-select checkbox click destroyed and rebuilt
 * ~600 polygon layers from scratch — cheap for the odd item-selection
 * change, but bad enough on rapid filter clicks to freeze the tab.
 * setStyle() just recolors the existing layers, no rebuild.
 */
export function VillaLayer({
  geojson,
  villaLookup = {},
  itemStatusLookup = null,
  filteredVillaIDs = null,
  showLabels = true,
  onVillaClick,
}) {
  const layerRef = useRef(null);

  const styleFn = useMemo(
    () => (feature) => {
      const villaID = feature.properties?.villaID;
      if (!villaID || villaID === "NOT_VILLA") return NOT_VILLA_STYLE;

      // Villa is outside the active filter — render muted instead of
      // excluded, matching the original app's coloringvillas() treatment.
      if (itemStatusLookup && filteredVillaIDs && !filteredVillaIDs.has(villaID)) {
        return { color: "#1f2937", weight: 1, fillColor: "#000000", fillOpacity: 0.3 };
      }

      if (itemStatusLookup) {
        const itemStatus = itemStatusLookup[villaID] ?? "NotStarted";
        return {
          color: "#1f2937",
          weight: 1,
          fillColor: ITEM_STATUS_COLORS[itemStatus] ?? ITEM_STATUS_COLORS.NotStarted,
          fillOpacity: 0.75,
        };
      }

      const villa = villaLookup[villaID];
      const status = villa?.status ?? "NotStarted";
      return {
        color: "#1f2937",
        weight: 1,
        fillColor: VILLA_STATUS_COLORS[status] ?? VILLA_STATUS_COLORS.NotStarted,
        fillOpacity: 0.6,
      };
    },
    [villaLookup, itemStatusLookup, filteredVillaIDs]
  );

  // Restyle in place whenever the style function changes, instead of
  // remounting the GeoJSON layer.
  useEffect(() => {
    layerRef.current?.setStyle(styleFn);
  }, [styleFn]);

  // Show/hide the permanent villanum labels without touching the layers
  // themselves — see the zoom-level note in MapView for why.
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.eachLayer((layer) => {
      if (!layer.getTooltip?.()) return;
      if (showLabels) layer.openTooltip();
      else layer.closeTooltip();
    });
  }, [showLabels, geojson]);

  const onEachFeature = (feature, layer) => {
    const villaID = feature.properties?.villaID;
    if (!villaID || villaID === "NOT_VILLA") return; // not a real villa — no click, no label

    const villanum = feature.properties?.villanum;
    if (villanum && villanum !== "NOT_VILLA") {
      layer.bindTooltip(String(villanum), {
        permanent: true,
        direction: "center",
        className: "villa-label-tooltip",
      });
    }

    layer.on("click", () => onVillaClick?.(villaID, feature));
  };

  if (!geojson) return null;

  return <GeoJSON ref={layerRef} data={geojson} style={styleFn} onEachFeature={onEachFeature} />;
}
