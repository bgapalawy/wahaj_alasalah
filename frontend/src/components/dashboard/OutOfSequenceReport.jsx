import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { findOutOfSequenceItems } from "../../utils/outOfSequenceUtils.js";

/**
 * Surfaces every (villa, item) where an item is marked Completed while
 * at least one of its OWN predecessors isn't — a real scheduling
 * anomaly, distinct from the existing "blocked" status (which only ever
 * applies to NotStarted items waiting their turn, see scheduleUtils.js).
 *
 * Data-wise this rides on useAllVillaStatuses, the same hook already
 * used by Schedule coloring mode — no new backend endpoint needed for
 * something this cheap to compute once the data's in memory client-side.
 */
export function OutOfSequenceReport({ onClose }) {
  const { data: allVillaStatuses, status } = useAllVillaStatuses(true);
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const [villaFilter, setVillaFilter] = useState("");

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

  const findings = useMemo(
    () => findOutOfSequenceItems(allVillaStatuses, constructionItemsTemplate),
    [allVillaStatuses, constructionItemsTemplate]
  );

  const filtered = useMemo(() => {
    if (!villaFilter.trim()) return findings;
    const needle = villaFilter.trim().toLowerCase();
    return findings.filter((f) => f.villaID.toLowerCase().includes(needle));
  }, [findings, villaFilter]);

  function handleExport() {
    const rows = filtered.map((f) => ({
      Villa: f.villaID,
      "Completed Item": f.item.name,
      "Completed Item ID": f.item.TableItemID,
      "Incomplete Predecessor(s)": f.incompletePredecessors.map((p) => `${p.name} (${p.status})`).join("; "),
      "Incomplete Predecessor Count": f.incompletePredecessors.length,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Out of Sequence");
    XLSX.writeFile(wb, "out_of_sequence_report.xlsx");
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graph-modal-header">
          <h3>Out of Sequence</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="file-status-hint">
          Items marked Completed while at least one of their own predecessors isn't — a real scheduling
          anomaly, not the same thing as a "blocked" (not-yet-started) item.
        </p>

        {isLoading ? (
          <p className="file-status-hint">Loading…</p>
        ) : (
          <>
            <div className="admin-actions" style={{ marginBottom: "0.75rem" }}>
              <input
                type="text"
                placeholder="Filter by villa (e.g. V_9)"
                value={villaFilter}
                onChange={(e) => setVillaFilter(e.target.value)}
                style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)" }}
              />
              <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
                Export to Excel
              </button>
            </div>

            <p className="file-status-hint">
              {filtered.length} out-of-sequence item{filtered.length === 1 ? "" : "s"} found
              {villaFilter.trim() ? ` matching "${villaFilter.trim()}"` : ""}.
            </p>

            {filtered.length === 0 ? (
              <p className="file-status-hint">No out-of-sequence items found — every Completed item's predecessors are also Completed.</p>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Villa</th>
                      <th>Completed Item</th>
                      <th>Incomplete Predecessor(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => (
                      <tr key={`${f.villaID}-${f.item.TableItemID}`}>
                        <td>{f.villaID}</td>
                        <td>
                          {f.item.name}
                          <br />
                          <span className="file-status-hint">{f.item.TableItemID}</span>
                        </td>
                        <td>
                          {f.incompletePredecessors.map((pred) => (
                            <div key={pred.TableItemID}>
                              {pred.name} — <strong>{pred.status}</strong>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
