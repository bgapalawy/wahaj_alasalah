import { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboard.js";

/**
 * Every real villa's full invoice status map — same shape and caching
 * behavior as useAllVillaStatuses, from the invoices table instead of
 * wajhaData. Used by the Custom Query builder, which can filter on
 * either an item's actual status or its invoice status.
 */
export function useAllVillaInvoiceStatuses(enabled) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    setStatus("loading");
    dashboardApi
      .getAllVillaInvoiceStatuses()
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
