import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { formatCurrency } from "../../utils/dashboardUtils.js";

/**
 * Shows the selected construction item's planned start/finish date AND
 * planned/actual cost for this villa. Deliberately lightweight (its own
 * tiny endpoint, no chart libraries) since it just needs to show next to
 * the item picker.
 */
export function PlannedDatesDisplay({ villaID, tableItemId }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    villasApi
      .getPlannedDates(villaID, tableItemId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [villaID, tableItemId]);

  if (status === "loading") return <p className="planned-dates-hint">Loading item details…</p>;
  if (status === "error") return null;

  return (
    <div className="planned-dates-display">
      <p>
        Planned: <strong>{data?.plannedStartDate ?? "—"}</strong> → <strong>{data?.plannedFinishDate ?? "—"}</strong>
      </p>
      <p>
        Planned Cost: <strong>{formatCurrency(data?.plannedCost)}</strong> · Actual Cost:{" "}
        <strong>{formatCurrency(data?.actualCost)}</strong>
      </p>
    </div>
  );
}
