import { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboard.js";

/**
 * Fetches one construction item's per-villa data once and derives the
 * lookups needed for all three "Color map by item" modes:
 *   - Status:  statusLookup  {villaID: actualStatus}
 *   - Invoice: invoiceLookup {villaID: invoiceStatus}
 *   - Schedule: needs `rows` directly (plannedStartDate + actualStatus)
 *     combined with the dependency graph — computed separately in
 *     MapView via utils/scheduleUtils.js, since it also needs every
 *     villa's FULL status map (a second fetch) to check predecessors.
 */
export function useConstructionItemData(tableItemId, refreshKey = 0) {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  useEffect(() => {
    if (!tableItemId) {
      setRows(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    dashboardApi
      .getConstructionItem(tableItemId)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setRows(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tableItemId, refreshKey]);

  const statusLookup = rows ? Object.fromEntries(rows.map((r) => [r.villaID, r.actualStatus])) : null;
  const invoiceLookup = rows ? Object.fromEntries(rows.map((r) => [r.villaID, r.invoiceStatus])) : null;

  return { rows, statusLookup, invoiceLookup, status };
}
