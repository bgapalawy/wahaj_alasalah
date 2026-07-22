import { useEffect, useMemo, useState } from "react";
import { GEOJSON_URL } from "../config/mapConfig.js";

/**
 * Fetches the villa-parcels GeoJSON and builds a villaID -> {blocknum,
 * zonenum, villatype} lookup. block/zone/villatype only exist on the
 * GeoJSON (the ArcGIS export), not in the DynamoDB villas table, so
 * anything needing them (the map's filters, the portfolio dashboard's
 * filters) needs this same lookup. Skips "NOT_VILLA" placeholder parcels.
 */
export function useVillaGeoMeta() {
  const [geojson, setGeojson] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${GEOJSON_URL} (${res.status})`);
        return res.json();
      })
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
