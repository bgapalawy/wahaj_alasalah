import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";

/**
 * Shows the selected construction item's planned start/finish date for
 * this villa. Deliberately lightweight (its own tiny endpoint, no chart
 * libraries) since it just needs to show next to the item picker.
 */
export function PlannedDatesDisplay({ villaID, tableItemId }) {
  const [dates, setDates] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    villasApi
      .getPlannedDates(villaID, tableItemId)
      .then((data) => {
        if (cancelled) return;
        setDates(data);
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

  if (status === "loading") return <p className="planned-dates-hint">Loading planned dates…</p>;
  if (status === "error") return null;

  return (
    <p className="planned-dates-display">
      Planned: <strong>{dates?.plannedStartDate ?? "—"}</strong> →{" "}
      <strong>{dates?.plannedFinishDate ?? "—"}</strong>
    </p>
  );
}
