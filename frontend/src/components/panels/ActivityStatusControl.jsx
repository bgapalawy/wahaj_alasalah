import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { ACTIVITY_STATUS_OPTIONS } from "../../config/fileStatusConfig.js";

const STATUS_OPTIONS = ACTIVITY_STATUS_OPTIONS; // NotStarted/NCR/Notes/Rejected/Completed — no Approval

/**
 * New feature (not a port of anything in the original app): lets you set
 * an activity's status for a specific villa, with a completion date when
 * marking it Completed. Writes to the same table your notes mention
 * (ActualDatesTable) — see the schema assumption documented in
 * backend/src/services/activityStatusService.js.
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
    setState("saving");
    setErrorMessage(null);
    try {
      const updated = await villasApi.updateActivityStatus(villaID, tableItemId, {
        status: draftStatus,
        completedDate: draftStatus === "Completed" ? draftDate || new Date().toISOString().slice(0, 10) : null,
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
