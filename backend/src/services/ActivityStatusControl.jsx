import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { ACTIVITY_STATUS_OPTIONS } from "../../config/fileStatusConfig.js";

const STATUS_OPTIONS = ACTIVITY_STATUS_OPTIONS; // NotStarted/NCR/Notes/Rejected/Completed — no Approval

/**
 * Lets you set an activity's status for a specific villa, with a
 * completion date when marking it Completed. Writes to wajhaData +
 * Actual_dates (see activityStatusService.js), and — matching the
 * original app — auto-marks the invoice "ReadyToPay" when transitioning
 * into Completed. If you're un-completing something whose invoice was
 * already "Paid," this warns before saving, same as the original.
 */
export function ActivityStatusControl({ villaID, tableItemId, onSaved }) {
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
    // User must explicitly provide a date when marking something
    // Completed — no more silent default-to-today, since that's exactly
    // how the actual_date/status mismatch happened in the first place
    // (a date getting set without anyone deliberately choosing it).
    if (draftStatus === "Completed" && !draftDate) {
      setErrorMessage("Enter a completion date before marking this item Completed.");
      setState("error");
      return;
    }

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
        // actual_date from ever drifting apart again.
        completedDate: draftStatus === "Completed" ? draftDate : null,
      });
      setCurrent(updated);
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
            required
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
