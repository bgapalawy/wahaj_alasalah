import { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboard.js";

/**
 * Every real villa's full ~82-item status map — used by the Schedule
 * coloring mode to check predecessor completion. Independent of which
 * construction item is currently selected, so this only needs to be
 * fetched once per mount, not re-fetched on every item change.
 */
export function useAllVillaStatuses(enabled) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    setStatus("loading");
    dashboardApi
      .getAllVillaStatuses()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { data, status };
}
