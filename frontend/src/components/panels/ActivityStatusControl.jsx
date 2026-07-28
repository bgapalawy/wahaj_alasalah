import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { ACTIVITY_STATUS_OPTIONS } from "../../config/fileStatusConfig.js";
import { StatusTimeline } from "./StatusTimeline.jsx";
import { NcrList } from "./NcrList.jsx";

const STATUS_OPTIONS = ACTIVITY_STATUS_OPTIONS; // NotStarted/NCR/Notes/Rejected/Completed — no Approval

// Completed, NCR, and Rejected carry a date. The notes box now shows
// for those three PLUS Notes and NotStarted (not just the dated ones
// anymore) — InProgress is the only status without one. Kept as small
// helpers instead of inline checks scattered through the JSX below.
const DATED_STATUSES = new Set(["Completed", "NCR", "Rejected"]);
const NOTE_STATUSES = new Set(["Completed", "NCR", "Rejected", "Notes", "NotStarted"]);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Lets you set an activity's status for a specific villa, with a date
 * (Completed/NCR/Rejected — defaulting to today, but changeable) and a
 * notes box (reason for NCR/Rejected, general notes for Completed/
 * Notes/NotStarted). Writes to villa_item_status and appends to
 * villa_item_status_history (see activityStatusService.js) — the latter
 * is what powers the "View timeline" button below.
 *
 * "NCR" is never a manual choice in this dropdown — the only way an
 * item's status becomes "NCR" is by actually adding one in the NcrList
 * section below, which sets it automatically. While the item has any
 * open NCR, only "NCR" (already set, can't be picked again) and
 * "Rejected" remain available — every other status is locked out until
 * every open NCR is closed, so an item can't silently move on (or get
 * marked Completed) while an unresolved non-conformance sits against it.
 *
 * Matching the original app, also auto-marks the invoice "ReadyToPay"
 * when transitioning into Completed, and warns before un-completing an
 * activity whose invoice was already "Paid."
 */
export function ActivityStatusControl({ villaID, tableItemId, onSaved }) {
  const [current, setCurrent] = useState(null);
  const [draftStatus, setDraftStatus] = useState("NotStarted");
  const [draftDate, setDraftDate] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [state, setState] = useState("loading"); // loading | ready | saving | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);
  // Reported up from NcrList (see its onOpenCountChange) — 0 while it's
  // still loading, same as "no open NCRs", which is the safe default:
  // Completed only gets disabled once we positively know there's an
  // open NCR, never speculatively before the count has loaded.
  const [openNcrCount, setOpenNcrCount] = useState(0);

  // While any NCR is open, only NCR/Rejected can be selected — every
  // other status is locked until every open NCR is closed (see NcrList).
  function isStatusLocked(s) {
    return openNcrCount > 0 && s !== "NCR" && s !== "Rejected";
  }

  // NCR is never a manual choice in this dropdown, whether or not any
  // NCR is currently open — the only way an item's status becomes "NCR"
  // is by actually adding one below (see handleNcrAdded), which sets
  // draftStatus directly and doesn't go through handleStatusChange at
  // all. This keeps "status says NCR" and "there's a real NCR record"
  // from ever drifting apart — no picking NCR from the list without one
  // actually existing, and no way to remove the status without going
  // through NcrList's own close flow either.
  function isManuallySelectable(s) {
    return s !== "NCR" && !isStatusLocked(s);
  }

  // Called by NcrList right after a new NCR is successfully added — the
  // item's status should reflect that automatically, not require a
  // separate manual dropdown change.
  async function handleNcrAdded(ncr) {
    setState("saving");
    setErrorMessage(null);
    try {
      const updated = await villasApi.updateActivityStatus(villaID, tableItemId, {
        status: "NCR",
        completedDate: today(),
        note: ncr.note,
      });
      setCurrent(updated);
      setDraftStatus("NCR");
      setDraftDate(updated.completedDate ?? today());
      setDraftNote(updated.note ?? "");
      setState("ready");
      onSaved?.(tableItemId, updated);
    } catch (err) {
      setErrorMessage(err.message);
      setState("error");
    }
  }

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
        setDraftNote(data.note ?? "");
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

  // Switching TO a dated status pre-fills today's date if nothing's
  // there yet ("take today as default", still changeable before
  // saving); switching AWAY from a notes-taking status clears the note
  // so a stale one can't accidentally get saved under a different status.
  function handleStatusChange(nextStatus) {
    if (!isManuallySelectable(nextStatus)) {
      // Belt and suspenders — the <option> below is already disabled in
      // this case, so this really only matters if it's reached some
      // other way, but it keeps this function correct on its own too.
      return;
    }
    setDraftStatus(nextStatus);
    if (DATED_STATUSES.has(nextStatus) && !draftDate) {
      setDraftDate(today());
    }
    if (!NOTE_STATUSES.has(nextStatus)) {
      setDraftNote("");
    }
  }

  async function handleSave() {
    // While any NCR is open, only NCR/Rejected can be saved — checked
    // here too, not just in the dropdown, in case draftStatus was
    // already something else from a previous load and a new NCR got
    // opened in the meantime.
    if (isStatusLocked(draftStatus)) {
      setErrorMessage(
        `This item has ${openNcrCount} open NCR${openNcrCount === 1 ? "" : "s"} — close ${
          openNcrCount === 1 ? "it" : "them"
        } before changing status to anything other than NCR or Rejected.`
      );
      setState("error");
      return;
    }

    // A date is required for any of the three dated statuses — no
    // silent default at SAVE time (that's exactly how the actual_date/
    // status mismatch happened originally), but switching to one of
    // these already pre-fills today automatically above, so this only
    // fires if that gets deliberately cleared.
    if (DATED_STATUSES.has(draftStatus) && !draftDate) {
      setErrorMessage(`Enter a date before marking this item ${draftStatus}.`);
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
        // Non-dated statuses always clear the date server-side too (belt
        // and suspenders — see activityStatusService.js), keeping status
        // and actual_date from ever drifting apart again.
        completedDate: DATED_STATUSES.has(draftStatus) ? draftDate : null,
        note: NOTE_STATUSES.has(draftStatus) ? draftNote : null,
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
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>Activity status</h3>
        {openNcrCount > 0 && (
          <span
            title={`${openNcrCount} open NCR${openNcrCount === 1 ? "" : "s"} on this item`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.8em",
              fontWeight: 600,
              color: "#ea580c",
              backgroundColor: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: "999px",
              padding: "0.1rem 0.55rem",
            }}
          >
            ⚠ {openNcrCount} open NCR{openNcrCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {current && (
        <p className="activity-status-current">
          Current: <strong>{current.status ?? "NotStarted"}</strong>
          {current.completedDate && ` — ${current.status === "Completed" ? "completed" : "dated"} ${current.completedDate}`}
          {current.note && (
            <>
              <br />
              <span className="activity-status-current-note">
                {current.status === "NCR" || current.status === "Rejected" ? "Reason" : "Notes"}: {current.note}
              </span>
            </>
          )}
        </p>
      )}

      <div className="activity-status-form">
        <select value={draftStatus} onChange={(e) => handleStatusChange(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} disabled={!isManuallySelectable(s)}>
              {s === "NCR"
                ? "NCR (add one below, doesn't set by hand)"
                : isStatusLocked(s)
                  ? `${s} (close open NCRs first)`
                  : s}
            </option>
          ))}
        </select>

        {DATED_STATUSES.has(draftStatus) && (
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            max={today()}
            required
          />
        )}

        <button type="button" onClick={handleSave} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
      </div>

      {NOTE_STATUSES.has(draftStatus) && (
        <textarea
          className="activity-status-note"
          placeholder={
            draftStatus === "NCR" || draftStatus === "Rejected"
              ? `Reason for ${draftStatus} (optional, but recommended)`
              : "Notes (optional)"
          }
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={2}
        />
      )}

      <button type="button" className="activity-status-timeline-toggle" onClick={() => setShowTimeline(true)}>
        View timeline
      </button>

      {state === "error" && <p className="upload-error">{errorMessage}</p>}

      <hr style={{ margin: "0.75rem 0" }} />
      <NcrList
        villaID={villaID}
        tableItemId={tableItemId}
        onOpenCountChange={setOpenNcrCount}
        onNcrAdded={handleNcrAdded}
      />

      {showTimeline && (
        <StatusTimeline villaID={villaID} tableItemId={tableItemId} onClose={() => setShowTimeline(false)} />
      )}
    </div>
  );
}
