import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { dashboardApi } from "../../api/dashboard.js";
import { calculateDashboardMetrics, getProjectDateRange, formatCurrency } from "../../utils/dashboardUtils.js";
import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";
import { ITEM_STATUS_COLORS as STATUS_COLORS, ITEM_STATUS_ORDER as STATUS_ORDER } from "../../config/itemStatusColors.js";

ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * Replaces the "monitoring type 1" flow from dashboardconstructionitem.js /
 * constructionItemsContainer.js: pick one construction item, see how many
 * villas are at each status for it, plus planned/actual value and
 * timeline dates across all villas for that one item.
 */
export function ConstructionItemDashboard() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sortKey, setSortKey] = useState("villaID");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    if (!selectedItem) return;
    setStatus("loading");
    dashboardApi
      .getConstructionItem(selectedItem.TableItemID)
      .then((data) => {
        setRows(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [selectedItem]);

  const statusCounts = useMemo(() => {
    const counts = {};
    rows.forEach((r) => {
      counts[r.actualStatus] = (counts[r.actualStatus] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const metrics = useMemo(() => {
    const date = new Date(`${analysisDate}T00:00:00`);
    return calculateDashboardMetrics(rows, date);
  }, [rows, analysisDate]);

  const dateSummary = useMemo(() => getProjectDateRange(rows), [rows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function downloadExcel() {
    const exportRows = sortedRows.map((r) => ({
      Villa: r.villaID,
      Block: r.blocknum ?? "—",
      Status: r.actualStatus,
      "Planned Cost": r.plannedCost,
      "Actual Cost": r.actualCost,
      "Planned Finish": r.plannedFinishDate ?? "—",
      "Actual Completed": r.actualCompletedDate ?? "—",
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Progress");
    XLSX.writeFile(wb, `${selectedItem.TableItemID}_progress_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="villa-dashboard">
      <ConstructionItemSelect value={selectedItem} onChange={setSelectedItem} />
      <p className="file-status-hint" style={{ marginTop: "-0.5rem" }}>
        This view is independent of the filters above — it always covers every villa for the selected item.
      </p>

      {!selectedItem && <p className="file-status-hint">Select a construction item to see its progress across all villas.</p>}

      {selectedItem && status === "loading" && <p>Loading {selectedItem.name}…</p>}
      {selectedItem && status === "error" && <p>Couldn't load data for {selectedItem.name}.</p>}

      {selectedItem && status === "success" && (
        <>
          <div className="dashboard-controls">
            <label>
              Analysis date
              <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} />
            </label>
          </div>

          <div className="dashboard-summary-cards">
            <div className="summary-card">
              <span>Active Villas</span>
              <strong>{rows.length}</strong>
            </div>
            <div className="summary-card">
              <span>Planned Value (to date)</span>
              <strong>{formatCurrency(metrics.plannedCostToDate)}</strong>
            </div>
            <div className="summary-card">
              <span>Actual Value (to date)</span>
              <strong>{formatCurrency(metrics.actualCostToDate)}</strong>
            </div>
            <div className="summary-card">
              <span>Overall % Actual</span>
              <strong>{metrics.totalActualPercent.toFixed(1)}%</strong>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>Timeline</h4>
            <div className="dashboard-summary-cards">
              <div className="summary-card">
                <span>Planned Start Date</span>
                <strong>{dateSummary.earliestStart ?? "—"}</strong>
              </div>
              <div className="summary-card">
                <span>Planned Finish Date</span>
                <strong>{dateSummary.latestFinish ?? "—"}</strong>
              </div>
              <div className="summary-card">
                <span>First Actual Date Recorded</span>
                <strong>{dateSummary.firstActualDateRecorded ?? "—"}</strong>
              </div>
              <div className="summary-card">
                <span>Last Actual Date Recorded</span>
                <strong>{dateSummary.lastActualDateRecorded ?? "—"}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-pies">
            <div className="dashboard-pie" style={{ width: 220 }}>
              <h4>Villas by Status — {selectedItem.name}</h4>
              <Pie
                data={{
                  labels: STATUS_ORDER,
                  datasets: [
                    {
                      data: STATUS_ORDER.map((s) => statusCounts[s] ?? 0),
                      backgroundColor: STATUS_ORDER.map((s) => STATUS_COLORS[s]),
                      borderColor: "#d1d5db",
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
              />
            </div>
          </div>

          <div className="dashboard-chart-section">
            <div className="dashboard-chart-actions">
              <h4>Villas — {selectedItem.name}</h4>
              <button type="button" onClick={downloadExcel}>
                Download Table
              </button>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  {[
                    ["villaID", "Villa"],
                    ["blocknum", "Block"],
                    ["actualStatus", "Status"],
                    ["plannedCost", "Planned Cost"],
                    ["actualCost", "Actual Cost"],
                    ["plannedFinishDate", "Planned Finish"],
                  ].map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key)}>
                      {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.villaID}>
                    <td>{r.villaID}</td>
                    <td>{r.blocknum ?? "—"}</td>
                    <td>{r.actualStatus}</td>
                    <td>{formatCurrency(r.plannedCost)}</td>
                    <td>{formatCurrency(r.actualCost)}</td>
                    <td>{r.plannedFinishDate ?? "—"}</td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="dashboard-table-empty">
                      No villas found for this item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
