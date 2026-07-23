import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { dashboardApi } from "../../api/dashboard.js";
import { calculateDashboardMetrics, getProjectDateRange, formatCurrency } from "../../utils/dashboardUtils.js";
import { computeScheduleStatusFast } from "../../utils/scheduleUtils.js";
import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";
import { ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { SCHEDULE_STATUS_ORDER, INVOICE_STATUS_ORDER } from "../../config/scheduleInvoiceColors.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { useColorPreferences } from "../../contexts/ColorPreferencesContext.jsx";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLOR_MODES = [
  { id: "status", label: "Status" },
  { id: "schedule", label: "Schedule" },
  { id: "invoice", label: "Invoice" },
];

/**
 * Replaces the "monitoring type 1/2/3" flows from
 * dashboardconstructionitem.js: pick one construction item, see its
 * breakdown across all villas — now under any of the three lenses the
 * map's "Color map by item" control also has: Status, Schedule
 * (date + dependency-graph readiness), or Invoice (billing status).
 */
export function ConstructionItemDashboard() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [colorMode, setColorMode] = useState("status");
  const [sortKey, setSortKey] = useState("villaID");
  const [sortDir, setSortDir] = useState("asc");
  const { villaMetaByID } = useVillaGeoMeta();
  const { data: allVillaStatuses } = useAllVillaStatuses(colorMode === "schedule");
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

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

  // Every real villa in the GeoJSON, not just the ones the backend has
  // data for — same fix as the Overview tab's villa count. Villas missing
  // from the backend get a zero-cost/NotStarted placeholder row.
  const enrichedRows = useMemo(() => {
    const knownRows = rows.map((r) => ({
      ...r,
      blocknum: villaMetaByID[r.villaID]?.blocknum ?? r.blocknum ?? null,
    }));
    const knownVillaIDs = new Set(rows.map((r) => r.villaID));
    const missingVillaIDs = Object.keys(villaMetaByID).filter((id) => !knownVillaIDs.has(id));
    const synthesized = missingVillaIDs.map((villaID) => ({
      villaID,
      blocknum: villaMetaByID[villaID]?.blocknum ?? null,
      plannedCost: 0,
      actualCost: 0,
      plannedStartDate: null,
      plannedFinishDate: null,
      actualStatus: "NotStarted",
      invoiceStatus: "NotStarted",
      actualCompletedDate: null,
    }));
    return [...knownRows, ...synthesized];
  }, [rows, villaMetaByID]);

  // Map<id> / Map<TableItemID> lookups for the fast classifier — built
  // once per template load, not per villa.
  const itemMaps = useMemo(() => {
    const itemById = new Map(constructionItemsTemplate.map((t) => [t.id, t]));
    const itemByTableId = new Map(constructionItemsTemplate.map((t) => [t.TableItemID, t]));
    return { itemById, itemByTableId };
  }, [constructionItemsTemplate]);

  // Schedule status is computed client-side per villa, reusing the FAST
  // classifier (verified equivalent to the recursive version — see
  // scheduleUtils.js). Benchmarked ~7x faster at ~1,540 villas; the
  // recursive version was enough synchronous work to feel like a freeze
  // on a slower machine every time Schedule mode was touched.
  const scheduleStatusByVilla = useMemo(() => {
    if (colorMode !== "schedule" || !selectedItem || !allVillaStatuses || constructionItemsTemplate.length === 0) {
      return null;
    }
    const cutoff = new Date(`${analysisDate}T00:00:00`);
    const lookup = {};
    enrichedRows.forEach((r) => {
      lookup[r.villaID] = computeScheduleStatusFast({
        targetTableItemId: selectedItem.TableItemID,
        targetActualStatus: r.actualStatus,
        targetPlannedStartDate: r.plannedStartDate,
        cutoffDate: cutoff,
        itemById: itemMaps.itemById,
        itemByTableId: itemMaps.itemByTableId,
        villaStatusMap: allVillaStatuses[r.villaID] ?? {},
      });
    });
    return lookup;
  }, [colorMode, selectedItem, allVillaStatuses, constructionItemsTemplate.length, itemMaps, enrichedRows, analysisDate]);

  // Which field each row's "current status" comes from, for whichever
  // mode is active — everything else (pie, table column, counts) just
  // reads this one derived value instead of branching everywhere.
  const rowsWithDisplayStatus = useMemo(() => {
    return enrichedRows.map((r) => ({
      ...r,
      displayStatus:
        colorMode === "invoice"
          ? r.invoiceStatus
          : colorMode === "schedule"
            ? (scheduleStatusByVilla?.[r.villaID] ?? "NotStarted")
            : r.actualStatus,
    }));
  }, [enrichedRows, colorMode, scheduleStatusByVilla]);

  const { getColors } = useColorPreferences();
  const statusColors = getColors(colorMode === "invoice" ? "invoice" : colorMode === "schedule" ? "schedule" : "status");
  const statusOrder = colorMode === "invoice" ? INVOICE_STATUS_ORDER : colorMode === "schedule" ? SCHEDULE_STATUS_ORDER : ITEM_STATUS_ORDER;

  const statusCounts = useMemo(() => {
    const counts = {};
    rowsWithDisplayStatus.forEach((r) => {
      counts[r.displayStatus] = (counts[r.displayStatus] ?? 0) + 1;
    });
    return counts;
  }, [rowsWithDisplayStatus]);

  const metrics = useMemo(() => {
    const date = new Date(`${analysisDate}T00:00:00`);
    return calculateDashboardMetrics(enrichedRows, date);
  }, [enrichedRows, analysisDate]);

  const dateSummary = useMemo(() => getProjectDateRange(enrichedRows), [enrichedRows]);

  const sortedRows = useMemo(() => {
    return [...rowsWithDisplayStatus].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rowsWithDisplayStatus, sortKey, sortDir]);

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
      Schedule: colorMode === "schedule" ? r.displayStatus : "—",
      Invoice: r.invoiceStatus,
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

      {selectedItem && (
        <div className="map-color-mode-row" style={{ maxWidth: 320, marginTop: "0.5rem" }}>
          {COLOR_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`map-color-mode-btn ${colorMode === m.id ? "is-active" : ""}`}
              onClick={() => setColorMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {!selectedItem && <p className="file-status-hint">Select a construction item to see its progress across all villas.</p>}

      {selectedItem && status === "loading" && <p>Loading {selectedItem.name}…</p>}
      {selectedItem && status === "error" && <p>Couldn't load data for {selectedItem.name}.</p>}

      {selectedItem && status === "success" && (
        <>
          <div className="dashboard-summary-cards">
            <div className="summary-card">
              <span>Active Villas</span>
              <strong>{enrichedRows.length}</strong>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
              Total — whole item, any date
            </h4>
            <div className="dashboard-summary-cards">
              <div className="summary-card">
                <span>Total Planned</span>
                <strong>{formatCurrency(metrics.grandTotal)}</strong>
              </div>
              <div className="summary-card">
                <span>Total Actual</span>
                <strong>{formatCurrency(metrics.totalActual)}</strong>
              </div>
              <div className="summary-card">
                <span>% Spent</span>
                <strong>{metrics.totalActualPercent.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
              Up to {analysisDate} — date-adjusted
            </h4>
            <div className="dashboard-controls" style={{ marginBottom: "0.5rem" }}>
              <label>
                Analysis date {colorMode === "schedule" && "(also the Schedule cutoff date)"}
                <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} />
              </label>
            </div>
            <div className="dashboard-summary-cards">
              <div className="summary-card">
                <span>Planned Value (to date)</span>
                <strong>{formatCurrency(metrics.plannedCostToDate)}</strong>
              </div>
              <div className="summary-card">
                <span>Actual Value (to date)</span>
                <strong>{formatCurrency(metrics.actualCostToDate)}</strong>
              </div>
              <div className="summary-card">
                <span>% Spent (to date)</span>
                <strong>{metrics.actualPercent.toFixed(1)}%</strong>
              </div>
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
              <h4>
                Villas by {COLOR_MODES.find((m) => m.id === colorMode).label} — {selectedItem.name}
              </h4>
              <Pie
                data={{
                  labels: statusOrder,
                  datasets: [
                    {
                      data: statusOrder.map((s) => statusCounts[s] ?? 0),
                      backgroundColor: statusOrder.map((s) => statusColors[s]),
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
                    ["displayStatus", COLOR_MODES.find((m) => m.id === colorMode).label],
                    ["plannedCost", "Planned Cost"],
                    ["actualCost", "Actual Cost"],
                    ["plannedFinishDate", "Planned Finish"],
                    ["actualCompletedDate", "Actual Finish"],
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
                    <td>{r.displayStatus}</td>
                    <td>{formatCurrency(r.plannedCost)}</td>
                    <td>{formatCurrency(r.actualCost)}</td>
                    <td>{r.plannedFinishDate ?? "—"}</td>
                    <td>{r.actualCompletedDate ?? "—"}</td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="dashboard-table-empty">
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
