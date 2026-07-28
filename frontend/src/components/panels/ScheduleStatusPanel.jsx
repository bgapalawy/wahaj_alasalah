import { useEffect, useMemo, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { computeScheduleStatusFast } from "../../utils/scheduleUtils.js";
import { getRootCauseBlockers } from "../../utils/qualityFilterUtils.js";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Shows this item's computed SCHEDULE status (Ready/Delayed/Blocked/
 * etc. — see scheduleUtils.js's computeScheduleStatusFast, the same
 * classifier the map's Schedule color mode and the dashboards already
 * use) for the selected villa, and — new — lets you attach dated
 * remarks explaining the situation (e.g. "procurement issue"), stored
 * in villa_item_schedule_note via scheduleNoteService.js. When Blocked,
 * also names the actual deep root-cause blocker(s) — the same recursive
 * predecessor-chain walk (findRootCauseBlockingActivities, in
 * graphUtils.js) the dependency graph itself already uses to answer
 * "why is this blocked," not just the item's immediate predecessors —
 * and if that root-cause item has its own schedule notes for this same
 * villa, those show inline as "Blocker notes" too, so the explanation
 * for the blocker doesn't require separately selecting it. Independent
 * of NcrList and the main activity status control: this is purely about
 * the schedule classification and commentary on it.
 */
export function ScheduleStatusPanel({ villaID, tableItemId, constructionItemsTemplate, liveStatusMap }) {
  const [plannedStartDate, setPlannedStartDate] = useState(null);
  const [cutoffDate, setCutoffDate] = useState(today());
  const [notes, setNotes] = useState([]);
  const [blockerNotesByItem, setBlockerNotesByItem] = useState({}); // TableItemID -> notes[]
  const [loadStatus, setLoadStatus] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState(today());
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLoadStatus("loading");
    setShowAddForm(false);
    setNewDate(today());
    setNewNote("");
    Promise.all([villasApi.getPlannedDates(villaID, tableItemId), villasApi.getScheduleNotes(villaID, tableItemId)])
      .then(([dates, notesData]) => {
        setPlannedStartDate(dates.plannedStartDate);
        setNotes(notesData);
        setLoadStatus("ready");
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setLoadStatus("error");
      });
  }, [villaID, tableItemId]);

  const itemMaps = useMemo(() => {
    const itemById = new Map(constructionItemsTemplate.map((t) => [t.id, t]));
    const itemByTableId = new Map(constructionItemsTemplate.map((t) => [t.TableItemID, t]));
    return { itemById, itemByTableId };
  }, [constructionItemsTemplate]);

  // computeScheduleStatusFast expects villaStatusMap as {TableItemID: "StatusString"}
  // (see its usage in ConstructionItemDashboard.jsx/AllProjectsDashboard.jsx) —
  // liveStatusMap from VillaDetailsPanel is {TableItemID: {status, completedDate, note}},
  // so this flattens it to match.
  const flatStatusMap = useMemo(() => {
    const flat = {};
    Object.entries(liveStatusMap ?? {}).forEach(([id, v]) => {
      flat[id] = typeof v === "string" ? v : v?.status ?? "NotStarted";
    });
    return flat;
  }, [liveStatusMap]);

  const targetActualStatus = flatStatusMap[tableItemId] ?? "NotStarted";

  const scheduleStatus = useMemo(() => {
    if (constructionItemsTemplate.length === 0) return null;
    return computeScheduleStatusFast({
      targetTableItemId: tableItemId,
      targetActualStatus,
      targetPlannedStartDate: plannedStartDate,
      cutoffDate: new Date(`${cutoffDate}T00:00:00`),
      itemById: itemMaps.itemById,
      itemByTableId: itemMaps.itemByTableId,
      villaStatusMap: flatStatusMap,
    });
  }, [constructionItemsTemplate.length, tableItemId, targetActualStatus, plannedStartDate, cutoffDate, itemMaps, flatStatusMap]);

  // The TRUE root-cause blocker(s) — same recursive walk
  // (findRootCauseBlockingActivities, ported in qualityFilterUtils.js)
  // the dependency graph itself already uses, not just an approximation
  // from immediate predecessors. Needs the raw constructionItemsTemplate
  // array (not the id/TableItemID Maps used elsewhere here), since the
  // ported function does its own array .find() lookups the same way the
  // original does.
  const blockingPredecessors = useMemo(
    () => getRootCauseBlockers(itemMaps.itemByTableId.get(tableItemId), constructionItemsTemplate, flatStatusMap),
    [tableItemId, itemMaps, constructionItemsTemplate, flatStatusMap]
  );

  // Fetches this villa's own notes for each BLOCKER item too (not just
  // the selected item) — a blocker being NotStarted might already have
  // its own noted explanation (e.g. "procurement issue") that's exactly
  // what you want to see right here instead of having to go select that
  // other item separately. Keyed by the blocker's own TableItemID so
  // multiple blockers each get their own note list.
  useEffect(() => {
    if (blockingPredecessors.length === 0) {
      setBlockerNotesByItem({});
      return;
    }
    let cancelled = false;
    Promise.all(
      blockingPredecessors.map((p) =>
        villasApi
          .getScheduleNotes(villaID, p.TableItemID)
          .then((data) => [p.TableItemID, data])
          .catch(() => [p.TableItemID, []])
      )
    ).then((entries) => {
      if (cancelled) return;
      setBlockerNotesByItem(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [villaID, blockingPredecessors]);

  async function handleAdd() {
    setAdding(true);
    setErrorMessage(null);
    try {
      const created = await villasApi.addScheduleNote(villaID, tableItemId, { noteDate: newDate, note: newNote });
      setNotes((prev) => [created, ...prev]);
      setShowAddForm(false);
      setNewDate(today());
      setNewNote("");
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="schedule-status-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Schedule status</h3>
        <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          As of
          <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
        </label>
      </div>

      {loadStatus === "loading" && <p className="activity-status-hint">Loading…</p>}
      {loadStatus === "error" && <p className="upload-error">{errorMessage}</p>}

      {loadStatus === "ready" && (
        <>
          <p className="activity-status-current">
            Current: <strong>{scheduleStatus ?? "—"}</strong>
            {plannedStartDate && <span className="file-status-hint"> — planned start {plannedStartDate}</span>}
          </p>

          {blockingPredecessors.length > 0 && (
            <div className="file-status-hint" style={{ margin: "0.15rem 0 0.5rem" }}>
              Blocked by:{" "}
              {blockingPredecessors.map((p) => (
                <div key={p.TableItemID} style={{ marginTop: "0.2rem" }}>
                  {p.name} (<strong>{p.status}</strong>)
                  {(blockerNotesByItem[p.TableItemID] ?? []).length > 0 && (
                    <div style={{ margin: "0.15rem 0 0 0.75rem" }}>
                      {blockerNotesByItem[p.TableItemID].map((n) => (
                        <div key={n.id}>
                          <span style={{ fontWeight: 600 }}>Blocker notes</span> — {n.noteDate}: {n.note}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
            <span className="file-status-hint">
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </span>
            <button type="button" className="admin-btn-secondary" onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? "Cancel" : "+ Add note"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", margin: "0.5rem 0" }}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} max={today()} />
              <textarea
                placeholder="e.g. procurement issue delaying material delivery"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
              />
              <button type="button" onClick={handleAdd} disabled={adding || !newNote.trim()}>
                {adding ? "Adding…" : "Add note"}
              </button>
            </div>
          )}

          {notes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{ border: "1px solid var(--color-border-strong)", borderRadius: "6px", padding: "0.4rem 0.5rem" }}
                >
                  <strong>{n.noteDate}</strong>
                  <p style={{ margin: "0.2rem 0 0" }}>{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
