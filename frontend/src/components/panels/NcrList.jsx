import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Non-Conformance Report tracker for one villa/item — independent of
 * the main activity status dropdown above it. An item can have several
 * NCRs open at once (e.g. two separate defects raised at different
 * times); each is opened with a date + note and closed individually
 * with its own closing date AND closing reason, rather than the whole
 * item having a single NCR state. Reads/writes villa_item_ncr via
 * ncrService.js.
 *
 * `onOpenCountChange`, if given, is called with the current open-NCR
 * count every time it changes — ActivityStatusControl uses this to show
 * a warning badge and to lock the status dropdown to NCR/Rejected while
 * any NCR is open, without fetching the NCR list a second time itself.
 *
 * `onNcrAdded`, if given, is called with the newly-created NCR right
 * after a successful add — ActivityStatusControl uses this to
 * automatically set the item's status to "NCR" (see its
 * handleNcrAdded), so raising an NCR here doesn't also require a
 * separate manual dropdown change.
 */
export function NcrList({ villaID, tableItemId, onOpenCountChange, onNcrAdded }) {
  const [ncrs, setNcrs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState(today());
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  // Which NCR (by id) currently has its closing form open, plus that
  // form's own draft date/reason — only one at a time, mirroring the
  // add-NCR form above it.
  const [closingId, setClosingId] = useState(null);
  const [closingDate, setClosingDate] = useState(today());
  const [closingReason, setClosingReason] = useState("");
  const [closing, setClosing] = useState(false);

  function load() {
    setStatus("loading");
    villasApi
      .getNcrs(villaID, tableItemId)
      .then((data) => {
        setNcrs(data);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setStatus("error");
      });
  }

  useEffect(() => {
    setNcrs([]);
    load();
    setShowAddForm(false);
    setNewDate(today());
    setNewNote("");
    setClosingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villaID, tableItemId]);

  useEffect(() => {
    onOpenCountChange?.(ncrs.filter((n) => !n.closed).length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ncrs]);

  async function handleAdd() {
    setAdding(true);
    setErrorMessage(null);
    try {
      const created = await villasApi.addNcr(villaID, tableItemId, { openedDate: newDate, note: newNote });
      setNcrs((prev) => [created, ...prev]);
      setShowAddForm(false);
      setNewDate(today());
      setNewNote("");
      onNcrAdded?.(created);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setAdding(false);
    }
  }

  function openClosingForm(ncr) {
    setClosingId(ncr.id);
    setClosingDate(today());
    setClosingReason("");
  }

  async function handleConfirmClose(ncr) {
    setClosing(true);
    setErrorMessage(null);
    try {
      const updated = await villasApi.updateNcr(villaID, tableItemId, ncr.id, {
        closed: true,
        closedDate: closingDate,
        closingNote: closingReason,
      });
      setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? updated : n)));
      setClosingId(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setClosing(false);
    }
  }

  // Reopening doesn't need a reason — only closing does — so this stays
  // a plain, instant, optimistic toggle.
  async function handleReopen(ncr) {
    setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? { ...n, closed: false, closedDate: null, closingNote: null } : n)));
    try {
      const updated = await villasApi.updateNcr(villaID, tableItemId, ncr.id, { closed: false });
      setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? updated : n)));
    } catch (err) {
      setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? ncr : n))); // rollback
      setErrorMessage(err.message);
    }
  }

  async function handleClosedDateChange(ncr, closedDate) {
    setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? { ...n, closedDate } : n)));
    try {
      const updated = await villasApi.updateNcr(villaID, tableItemId, ncr.id, { closed: true, closedDate });
      setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? updated : n)));
    } catch (err) {
      setNcrs((prev) => prev.map((n) => (n.id === ncr.id ? ncr : n))); // rollback
      setErrorMessage(err.message);
    }
  }

  const openCount = ncrs.filter((n) => !n.closed).length;

  return (
    <div className="ncr-list">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>
          NCRs{ncrs.length > 0 && ` (${openCount} open, ${ncrs.length - openCount} closed)`}
        </h3>
        <button type="button" className="admin-btn-secondary" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add NCR"}
        </button>
      </div>

      {showAddForm && (
        <div className="ncr-add-form" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", margin: "0.5rem 0" }}>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} max={today()} />
          <textarea
            placeholder="Reason for this NCR"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
          />
          <button type="button" onClick={handleAdd} disabled={adding}>
            {adding ? "Adding…" : "Add NCR"}
          </button>
        </div>
      )}

      {status === "loading" && <p className="activity-status-hint">Loading NCRs…</p>}
      {status === "error" && <p className="upload-error">{errorMessage}</p>}

      {status === "ready" && ncrs.length === 0 && (
        <p className="activity-status-hint">No NCRs logged for this item.</p>
      )}

      {status === "ready" && ncrs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
          {ncrs.map((ncr) => (
            <div
              key={ncr.id}
              className="ncr-row"
              style={{
                border: "1px solid var(--color-border-strong)",
                borderRadius: "6px",
                padding: "0.5rem",
                opacity: ncr.closed ? 0.7 : 1,
              }}
            >
              <div>
                <strong>Opened {ncr.openedDate}</strong>
                {ncr.closed && ncr.closedDate && (
                  <span className="file-status-hint"> — closed {ncr.closedDate}</span>
                )}
                {ncr.note && <p style={{ margin: "0.25rem 0 0" }}>{ncr.note}</p>}
                {ncr.closed && ncr.closingNote && (
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.9em" }}>
                    <span className="file-status-hint">Closing reason: </span>
                    {ncr.closingNote}
                  </p>
                )}
              </div>

              {closingId === ncr.id ? (
                <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    Closing date
                    <input
                      type="date"
                      value={closingDate}
                      max={today()}
                      onChange={(e) => setClosingDate(e.target.value)}
                    />
                  </label>
                  <textarea
                    placeholder="Reason for closing this NCR"
                    value={closingReason}
                    onChange={(e) => setClosingReason(e.target.value)}
                    rows={2}
                  />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => handleConfirmClose(ncr)} disabled={closing}>
                      {closing ? "Closing…" : "Confirm Close"}
                    </button>
                    <button type="button" className="admin-btn-secondary" onClick={() => setClosingId(null)} disabled={closing}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  {ncr.closed ? (
                    <>
                      <button type="button" className="admin-btn-secondary" onClick={() => handleReopen(ncr)}>
                        Reopen
                      </button>
                      <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        Closed date
                        <input
                          type="date"
                          value={ncr.closedDate ?? today()}
                          max={today()}
                          onChange={(e) => handleClosedDateChange(ncr, e.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <button type="button" className="admin-btn-primary" onClick={() => openClosingForm(ncr)}>
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
