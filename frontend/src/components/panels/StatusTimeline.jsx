import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";

// Same accent color used for NCR-ish emphasis elsewhere (highlight
// labels, etc.) — kept local rather than importing a shared palette
// since this is the only status-specific coloring this component needs.
const STATUS_DOT_COLORS = {
  NotStarted: "#9ca3af",
  InProgress: "#3b82f6",
  Notes: "#a855f7",
  NCR: "#ea580c",
  Rejected: "#dc2626",
  Completed: "#22c55e",
};
const NCR_OPENED_COLOR = "#ea580c";
const NCR_CLOSED_COLOR = "#16a34a";

function formatRecordedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Merges villa_item_status_history (Not Started -> ... -> Completed)
 * with every NCR logged against this item (NcrList.jsx / ncrService.js)
 * into one chronological timeline — each NCR contributes an "opened"
 * entry, and a second "closed" entry once it's been closed, sorted in
 * with the status changes by when they actually happened (recordedAt/
 * createdAt/updatedAt), not grouped separately. NCRs are independent of
 * the main status (an item can have open NCRs while InProgress, say),
 * so this is the one place that shows the full picture together.
 */
function buildTimelineEntries(statusHistory, ncrs) {
  const statusEntries = statusHistory.map((entry) => ({
    kind: "status",
    label: entry.status,
    date: entry.statusDate,
    note: entry.note,
    recordedAt: entry.recordedAt,
    dotColor: STATUS_DOT_COLORS[entry.status] ?? "#9ca3af",
  }));

  const ncrEntries = ncrs.flatMap((ncr) => {
    const entries = [
      {
        kind: "ncr-opened",
        label: "NCR opened",
        date: ncr.openedDate,
        note: ncr.note,
        recordedAt: ncr.createdAt ?? ncr.openedDate,
        dotColor: NCR_OPENED_COLOR,
      },
    ];
    if (ncr.closed) {
      entries.push({
        kind: "ncr-closed",
        label: "NCR closed",
        date: ncr.closedDate,
        note: ncr.closingNote,
        recordedAt: ncr.updatedAt ?? ncr.closedDate,
        dotColor: NCR_CLOSED_COLOR,
      });
    }
    return entries;
  });

  return [...statusEntries, ...ncrEntries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
}

/**
 * Reuses the same graph-modal-backdrop/graph-modal shell as the
 * dashboard, dependency-graph, and NCR-report modals elsewhere in this
 * app, so it inherits their existing styling without needing new CSS —
 * only the stepper rows themselves (dot + connecting line) are custom,
 * done with inline styles since they're specific to this one layout.
 */
export function StatusTimeline({ villaID, tableItemId, onClose }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      villasApi.getActivityStatusHistory(villaID, tableItemId),
      villasApi.getNcrs(villaID, tableItemId),
    ])
      .then(([statusHistory, ncrs]) => {
        if (cancelled) return;
        setEntries(buildTimelineEntries(statusHistory, ncrs));
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [villaID, tableItemId]);

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graph-modal-header">
          <h3>Status timeline — {tableItemId}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {status === "loading" && <p className="file-status-hint">Loading…</p>}
        {status === "error" && <p className="upload-error">Couldn't load the timeline.</p>}

        {status === "success" && entries.length === 0 && (
          <p className="file-status-hint">Nothing recorded yet for this item.</p>
        )}

        {status === "success" && entries.length > 0 && (
          <div style={{ padding: "0.25rem 0.5rem", maxHeight: "60vh", overflowY: "auto" }}>
            {entries.map((entry, i) => {
              const isLast = i === entries.length - 1;
              return (
                <div key={`${entry.kind}-${entry.recordedAt}-${i}`} style={{ display: "flex", gap: "0.75rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "1rem" }}>
                    <div
                      style={{
                        width: "0.75rem",
                        height: "0.75rem",
                        borderRadius: "50%",
                        backgroundColor: entry.dotColor,
                        flexShrink: 0,
                        marginTop: "0.3rem",
                      }}
                    />
                    {!isLast && (
                      <div style={{ flex: 1, width: "2px", backgroundColor: "var(--color-border-strong)", minHeight: "1.5rem" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: isLast ? 0 : "1rem", flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {entry.label}
                      {entry.date && (
                        <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}> — {entry.date}</span>
                      )}
                    </p>
                    <p className="file-status-hint" style={{ margin: "0.15rem 0 0" }}>
                      Recorded {formatRecordedAt(entry.recordedAt)}
                    </p>
                    {entry.note && (
                      <p style={{ margin: "0.35rem 0 0", fontSize: "0.9em" }}>
                        <span className="file-status-hint">
                          {entry.kind === "ncr-opened"
                            ? "Reason: "
                            : entry.kind === "ncr-closed"
                              ? "Closing reason: "
                              : "Notes: "}
                        </span>
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
