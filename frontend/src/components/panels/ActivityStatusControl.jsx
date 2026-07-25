import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { ACTIVITY_STATUS_OPTIONS } from "../../config/fileStatusConfig.js";

const STATUS_OPTIONS = ACTIVITY_STATUS_OPTIONS; // NotStarted/NCR/Notes/Rejected/Completed — no Approval

/**
 * Lets you set an activity's status for a specific villa, with a
 * completion date when marking it Completed. Writes to shams_elgroubData +
 * Actual_dates (see activityStatusService.js), and — matching the
 * original app — auto-marks the invoice "ReadyToPay" when transitioning
 * into Completed. If you're un-completing something whose invoice was
 * already "Paid," this warns before saving, same as the original.
 */
export function ActivityStatusControl({ villaID, tableItemId, onSaved, onStatusLoaded }) {
  const [current, setCurrent] = useState(null);
  const [draftStatus, setDraftStatus] = useState("NotStarted");
  const [draftDate, setDraftDate] = useState("");
  const [state, setState] = useState("loading"); // loading | ready | saving | error
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    villasApi
      .getActivityStatus(villaID, tableItemId)
      .then((data) => {
        if (cancelled) return;
        setCurrent(data);
        setDraftStatus(data.status ?? "NotStarted");
        setDraftDate(data.completedDate ?? "");
        setState("ready");
        // Lighter than onSaved on purpose — nothing actually changed
        // server-side just because the panel opened, so this only needs
        // to inform the parent of the real current status (e.g. for
        // FileStatusSection's default tab), not trigger a map/other-
        // panel refetch cascade the way a real save should.
        onStatusLoaded?.(tableItemId, data);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [villaID, tableItemId]);

  async function handleSave() {
    // Matches the original app: warn before un-completing an activity
    // whose invoice was already marked "Paid" — reverting it silently
    // would be a real financial side-effect, not something to do without
    // a heads-up.
    if (current?.status === "Completed" && draftStatus !== "Completed") {
      try {
        const invoice = await villasApi.getInvoiceStatus(villaID, tableItemId);
        if (invoice.status === "Paid") {
          const confirmed = window.confirm(
            `This item was previously Completed and its invoice is already marked "Paid". ` +
              `Changing its status won't automatically revert the invoice, but you may want to review it. Continue?`
          );
          if (!confirmed) return;
        }
      } catch {
        // If the invoice check itself fails, don't block the save on it —
        // just proceed without the warning.
      }
    }

    setState("saving");
    setErrorMessage(null);
    try {
      const updated = await villasApi.updateActivityStatus(villaID, tableItemId, {
        status: draftStatus,
        // Non-Completed always clears the date server-side too (belt and
        // suspenders — see activityStatusService.js), keeping status and
        // actual_date from ever drifting apart again. Left blank while
        // Completed -> defaults to today (also enforced server-side as
        // the authoritative fallback, in case anything else calls the
        // API directly without a date).
        completedDate: draftStatus === "Completed" ? draftDate || null : null,
      });
      setCurrent(updated);
      // Re-sync the date input to what the server actually saved, not
      // just what was typed — the two should already match, but this
      // makes the input authoritative on the response instead of
      // silently trusting local state after a round trip.
      setDraftDate(updated.completedDate ?? "");
      setState("ready");
      onSaved?.(tableItemId, updated);
    } catch (err) {
      setErrorMessage(err.message);
      setState("error");
    }
  }

  if (state === "loading") return <p className="activity-status-hint">Loading status…</p>;

  return (
    <div className="activity-status-control">
      <h3>Activity status</h3>
      {current && (
        <p className="activity-status-current">
          Current: <strong>{current.status ?? "NotStarted"}</strong>
          {current.completedDate && ` — completed ${current.completedDate}`}
        </p>
      )}

      <div className="activity-status-form">
        <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {draftStatus === "Completed" && (
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            placeholder="Defaults to today if left blank"
          />
        )}

        <button type="button" onClick={handleSave} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
      </div>

      {state === "error" && <p className="upload-error">{errorMessage}</p>}
    </div>
  );
}
