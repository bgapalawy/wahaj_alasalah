import { useEffect, useMemo, useState } from "react";
import { GEOJSON_URL } from "../config/mapConfig.js";
import { cachedJsonFetch } from "../utils/cachedFetch.js";

/**
 * Fetches the villa-parcels GeoJSON and builds a villaID -> {blocknum,
 * zonenum, villatype} lookup. block/zone/villatype only exist on the
 * GeoJSON (the ArcGIS export), not in the DynamoDB villas table, so
 * anything needing them (the map's filters, the portfolio dashboard's
 * filters) needs this same lookup. Skips "NOT_VILLA" placeholder parcels.
 *
 * Goes through cachedJsonFetch — this hook alone is used in 3
 * components, plus MapView.jsx fetches the same file separately for
 * rendering, so without the shared cache this file was being requested
 * repeatedly on every page load.
 */
export function useVillaGeoMeta() {
  const [geojson, setGeojson] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    cachedJsonFetch(GEOJSON_URL)
      .then((data) => {
        setGeojson(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, []);

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

  return { villaMetaByID, status };
}
