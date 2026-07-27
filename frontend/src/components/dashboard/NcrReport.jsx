import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { findNcrItems } from "../../utils/ncrUtils.js";

/**
 * Surfaces every (villa, item) currently marked with status "NCR" across
 * the whole project — same shape and data source as OutOfSequenceReport
 * (useAllVillaStatuses + the construction items template, no new backend
 * endpoint needed), just for non-conformance instead of scheduling
 * anomalies.
 */
export function NcrReport({ onClose }) {
  const { data: allVillaStatuses, status } = useAllVillaStatuses(true);
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const [villaFilter, setVillaFilter] = useState("");

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

  const findings = useMemo(
    () => findNcrItems(allVillaStatuses, constructionItemsTemplate),
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
      Item: f.item.name,
      "Item ID": f.item.TableItemID,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "NCRs");
    XLSX.writeFile(wb, "ncr_report.xlsx");
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graph-modal-header">
          <h3>NCRs</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="file-status-hint">
          Every (villa, item) across the project currently marked with status "NCR".
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
              {filtered.length} NCR{filtered.length === 1 ? "" : "s"} found
              {villaFilter.trim() ? ` matching "${villaFilter.trim()}"` : ""}.
            </p>

            {filtered.length === 0 ? (
              <p className="file-status-hint">No NCRs found — nothing is currently marked NCR.</p>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Villa</th>
                      <th>Item</th>
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
