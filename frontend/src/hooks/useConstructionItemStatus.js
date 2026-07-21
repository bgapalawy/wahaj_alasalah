import { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboard.js";

/**
 * Fetches one construction item's status for every villa and returns a
 * simple {villaID: status} lookup for map coloring. Returns null while
 * no item is selected or while loading, so callers can fall back to the
 * default overall-status coloring.
 */
export function useConstructionItemStatus(tableItemId) {
  const [lookup, setLookup] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  useEffect(() => {
    if (!tableItemId) {
      setLookup(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    dashboardApi
      .getConstructionItem(tableItemId)
      .then((rows) => {
        if (cancelled) return;
        const map = Object.fromEntries(rows.map((r) => [r.villaID, r.actualStatus]));
        setLookup(map);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setLookup(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tableItemId]);

  return { lookup, status };
}
