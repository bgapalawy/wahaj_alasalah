import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { ITEM_STATUS_COLORS } from "../../config/itemStatusColors.js";

const NOT_VILLA_STYLE = { color: "#c7cbd1", weight: 0.5, fillColor: "#e5e7eb", fillOpacity: 0.12 };
const NEUTRAL_VILLA_STYLE = { color: "#1f2937", weight: 1, fillColor: "#dbeafe", fillOpacity: 0.4 };
const HIGHLIGHT_COLOR = "#ea580c"; // safety-orange accent, consistent with the rest of the app

// A label only shows once its parcel is at least this big on screen —
// checked against real pixel size rather than a flat zoom cutoff, since
// parcel size varies a lot across the site and a single zoom threshold
// either hides labels somewhere they'd fit, or shows them somewhere they
// still overlap.
const LABEL_MIN_WIDTH_PX = 45;
const LABEL_MIN_HEIGHT_PX = 24;

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
 * `highlightVillaIDs`, when provided, draws a bright outline on matching
 * villas ON TOP of their normal fill color — a spotlight, not a filter.
 * Used for "highlight this block/zone" without muting everything else.
 *
 * Restyling uses Leaflet's imperative `setStyle()` on the existing layer
 * group instead of remounting the whole GeoJSON layer on every change —
 * a changing `key` prop used to force a full rebuild of ~600 layers on
 * every single filter click, which was cheap for occasional changes but
 * froze the tab under rapid multi-select clicking.
 */
export function VillaLayer({
  geojson,
  itemStatusLookup = null,
  filteredVillaIDs = null,
  highlightVillaIDs = null,
  showLabels = true,
  onVillaClick,
}) {
  const layerRef = useRef(null);
  const map = useMap();

  const styleFn = useMemo(
    () => (feature) => {
      const villaID = feature.properties?.villaID;
      if (!villaID || villaID === "NOT_VILLA") return NOT_VILLA_STYLE;

      const isHighlighted = highlightVillaIDs && highlightVillaIDs.has(villaID);

      // Villa is outside the active filter — render muted instead of
      // excluded, matching the original app's coloringvillas() treatment.
      if (itemStatusLookup && filteredVillaIDs && !filteredVillaIDs.has(villaID)) {
        return {
          color: isHighlighted ? HIGHLIGHT_COLOR : "#1f2937",
          weight: isHighlighted ? 3 : 1,
          fillColor: "#000000",
          fillOpacity: 0.3,
        };
      }

      let base;
      if (itemStatusLookup) {
        const itemStatus = itemStatusLookup[villaID] ?? "NotStarted";
        base = {
          fillColor: ITEM_STATUS_COLORS[itemStatus] ?? ITEM_STATUS_COLORS.NotStarted,
          fillOpacity: 0.75,
        };
      } else {
        // No construction item selected — flat neutral color for every
        // real villa instead of automatically rolling up overall status
        // across all 82 activities. That roll-up is still available (see
        // villaLookup/computeVillaStatus) but showing it unprompted read
        // as "why are villas colored when I haven't picked anything."
        base = NEUTRAL_VILLA_STYLE;
      }

      return {
        ...base,
        color: isHighlighted ? HIGHLIGHT_COLOR : "#1f2937",
        weight: isHighlighted ? 3 : 1,
      };
    },
    [itemStatusLookup, filteredVillaIDs, highlightVillaIDs]
  );

  // Restyle in place whenever the style function changes, instead of
  // remounting the GeoJSON layer.
  useEffect(() => {
    layerRef.current?.setStyle(styleFn);
  }, [styleFn]);

  // Bring highlighted parcels to the front so their thick outline isn't
  // hidden under a neighbor's border.
  useEffect(() => {
    if (!layerRef.current || !highlightVillaIDs) return;
    layerRef.current.eachLayer((layer) => {
      const villaID = layer.feature?.properties?.villaID;
      if (villaID && highlightVillaIDs.has(villaID)) layer.bringToFront();
    });
  }, [highlightVillaIDs]);

  // Show a villanum label only once its parcel is actually big enough on
  // screen to read, recomputed on zoom/pan. Checked in real pixels, not a
  // flat zoom cutoff, so it self-adapts across areas with very different
  // parcel sizes instead of over- or under-showing labels site-wide.
  useEffect(() => {
    if (!layerRef.current) return;

    function updateLabelVisibility() {
      layerRef.current.eachLayer((layer) => {
        if (!layer.getTooltip?.()) return;
        if (!showLabels) {
          layer.closeTooltip();
          return;
        }
        const bounds = layer.getBounds?.();
        if (!bounds || !bounds.isValid()) return;
        const nw = map.latLngToContainerPoint(bounds.getNorthWest());
        const se = map.latLngToContainerPoint(bounds.getSouthEast());
        const widthPx = Math.abs(se.x - nw.x);
        const heightPx = Math.abs(se.y - nw.y);
        const bigEnough = widthPx >= LABEL_MIN_WIDTH_PX && heightPx >= LABEL_MIN_HEIGHT_PX;
        if (bigEnough) layer.openTooltip();
        else layer.closeTooltip();
      });
    }

    updateLabelVisibility();
    map.on("zoomend", updateLabelVisibility);
    map.on("moveend", updateLabelVisibility);
    return () => {
      map.off("zoomend", updateLabelVisibility);
      map.off("moveend", updateLabelVisibility);
    };
  }, [map, showLabels, geojson]);

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
