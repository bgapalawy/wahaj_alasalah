import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Pie, Bar, Chart as MixedChart } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { dashboardApi } from "../../api/dashboard.js";
import { aggregateByPeriod, formatPeriodLabel, formatCurrency, downloadChartAsImage } from "../../utils/dashboardUtils.js";
import { aggregateByCategory, aggregateTotalBudget, getTopItems, getFilteredDateSummary, formatSAR } from "../../utils/portfolioFilterUtils.js";
import { VILLA_STATUS_COLORS } from "../../config/mapConfig.js";
import { CATEGORY_COLOR_PALETTE } from "../../utils/graphUtils.js";
import { FilterBar } from "./FilterBar.jsx";
import { Tabs } from "./Tabs.jsx";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const PAGE_SIZE = 25;
const STATUS_ORDER = ["NotStarted", "InProgress", "Completed"];

function downloadRowsAsExcel(rows, sheetName, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Replaces the full portfolio-wide dashboard from dashboardallproject.js:
 * cascading filters (date range + category/item/villa/block/stage),
 * category cost pies (planned, date-adjusted for working days, vs actual),
 * a monthly/weekly cost trend chart, a top-10-items chart, a villa status
 * pie, and a detailed sortable/paginated per-activity data table with
 * separate "current page" / "all data" Excel export.
 *
 * One deliberate simplification, flagged rather than silently guessed:
 * the original's cost-trend chart spread each activity's cost across
 * every month it spanned from start to finish. I couldn't fully verify
 * that logic (the source was cut off mid-function), so this reuses the
 * simpler "assign cost to the period containing planned finish date"
 * approach already built and tested for the villa dashboard instead of
 * risking a wrong port of unverified spreading logic.
 */
export function AllProjectsDashboard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [filters, setFilters] = useState(null);
  const [viewType, setViewType] = useState("monthly");
  const [sortKey, setSortKey] = useState("villaID");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [tableSearch, setTableSearch] = useState("");

  const categoryPlannedRef = useRef(null);
  const categoryActualRef = useRef(null);
  const trendChartRef = useRef(null);
  const topItemsRef = useRef(null);

  useEffect(() => {
    dashboardApi
      .getAllProjects()
      .then((result) => {
        setData(result);
        setStatus("success");

        const dates = result.records.map((r) => r.plannedStartDate).filter(Boolean);
        const finishDates = result.records.map((r) => r.plannedFinishDate).filter(Boolean);
        const minDate = dates.length ? dates.reduce((min, d) => (d < min ? d : min)) : new Date().toISOString().slice(0, 10);
        const maxDate = finishDates.length
          ? finishDates.reduce((max, d) => (d > max ? d : max))
          : new Date().toISOString().slice(0, 10);
        setFilters({ startDate: minDate, endDate: maxDate, categories: [], items: [], villas: [], blocks: [], stages: [] });
      })
      .catch(() => setStatus("error"));
  }, []);

  const filteredRecords = useMemo(() => {
    if (!data || !filters) return [];
    return data.records.filter((r) => {
      if (filters.categories.length > 0 && !filters.categories.includes(r.category)) return false;
      if (filters.items.length > 0 && !filters.items.includes(r.item)) return false;
      if (filters.villas.length > 0 && !filters.villas.includes(r.villaID)) return false;
      if (filters.blocks.length > 0 && !filters.blocks.includes(r.blocknum)) return false;
      if (filters.stages.length > 0 && !filters.stages.includes(r.stage)) return false;
      return true;
    });
  }, [data, filters]);

  const rangeEndDate = filters ? new Date(`${filters.endDate}T00:00:00`) : new Date();

  // "Up to [end date]": planned cost date-adjusted for elapsed working
  // days, actual cost only counting what was completed by that date.
  const categoryBreakdown = useMemo(
    () => aggregateByCategory(filteredRecords, rangeEndDate),
    [filteredRecords, filters?.endDate]
  );

  // "Total budget": the whole filtered scope (category/villa/block/stage
  // filters still apply), ignoring the date range entirely.
  const totalBudgetBreakdown = useMemo(() => aggregateTotalBudget(filteredRecords), [filteredRecords]);

  const dateSummary = useMemo(() => getFilteredDateSummary(filteredRecords), [filteredRecords]);

  const topItems = useMemo(() => getTopItems(filteredRecords, rangeEndDate, 10), [filteredRecords, filters?.endDate]);

  const { periods, sortedPeriods } = useMemo(
    () => aggregateByPeriod(filteredRecords, viewType),
    [filteredRecords, viewType]
  );

  const sortedFilteredTable = useMemo(() => {
    const searched = tableSearch
      ? filteredRecords.filter(
          (r) =>
            r.villaID.toLowerCase().includes(tableSearch.toLowerCase()) ||
            r.item.toLowerCase().includes(tableSearch.toLowerCase())
        )
      : filteredRecords;
    return [...searched].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [filteredRecords, tableSearch, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedFilteredTable.length / PAGE_SIZE));
  const pageRows = sortedFilteredTable.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function tableRowsForExport(rows) {
    return rows.map((r) => ({
      Villa: r.villaID,
      Block: r.blocknum ?? "—",
      Stage: r.stage ?? "—",
      Item: r.item,
      Category: r.category,
      "Planned Cost": r.plannedCost,
      "Actual Cost": r.actualCost,
      "Planned Finish": r.plannedFinishDate ?? "—",
      "Actual Completed": r.actualCompletedDate ?? "—",
      Status: r.actualStatus,
    }));
  }

  if (status === "loading" || !filters) return <p>Loading project dashboard…</p>;
  if (status === "error") return <p>Couldn't load the project dashboard.</p>;

  const { statusCounts } = data;
  const totalPlannedFiltered = categoryBreakdown.plannedCosts.reduce((s, c) => s + c, 0);
  const totalActualFiltered = categoryBreakdown.actualCosts.reduce((s, c) => s + c, 0);

  const totalBudgetPlanned = totalBudgetBreakdown.plannedCosts.reduce((s, c) => s + c, 0);
  const totalBudgetActual = totalBudgetBreakdown.actualCosts.reduce((s, c) => s + c, 0);

  // Every percent below divides by the SAME denominator — total planned
  // budget for the whole filtered scope — so all four numbers are
  // directly comparable on one screen (same convention as the category
  // breakdown table).
  const totalBudgetPlannedPercent = totalBudgetPlanned > 0 ? (totalBudgetPlanned / totalBudgetPlanned) * 100 : 0;
  const totalBudgetActualPercent = totalBudgetPlanned > 0 ? (totalBudgetActual / totalBudgetPlanned) * 100 : 0;
  const upToDatePlannedPercent = totalBudgetPlanned > 0 ? (totalPlannedFiltered / totalBudgetPlanned) * 100 : 0;
  const upToDateActualPercent = totalBudgetPlanned > 0 ? (totalActualFiltered / totalBudgetPlanned) * 100 : 0;

  const statusTotal = STATUS_ORDER.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const statusTableRows = STATUS_ORDER.map((s) => ({
    status: s,
    count: statusCounts[s] ?? 0,
    percent: statusTotal > 0 ? ((statusCounts[s] ?? 0) / statusTotal) * 100 : 0,
  }));

  const categoryTableRows = categoryBreakdown.categories.map((category, i) => ({
    category,
    plannedCost: categoryBreakdown.plannedCosts[i],
    actualCost: categoryBreakdown.actualCosts[i],
    // Both percentages use the SAME denominator — total planned budget —
    // so they're directly comparable apples-to-apples on one row: "what
    // share of the whole project's planned budget does this category's
    // planned cost represent, and what share does its actual cost
    // represent." (Two earlier attempts got this wrong: first using two
    // different denominators for planned vs actual, which made actual %
    // look inconsistent with actual cost; then switching to a per-category
    // actual/planned ratio, which wasn't the metric being asked for.)
    plannedPercent: totalPlannedFiltered > 0 ? (categoryBreakdown.plannedCosts[i] / totalPlannedFiltered) * 100 : 0,
    actualPercent: totalPlannedFiltered > 0 ? (categoryBreakdown.actualCosts[i] / totalPlannedFiltered) * 100 : 0,
  }));

  return (
    <div className="villa-dashboard">
      <FilterBar
        records={data.records}
        minDate={filters.startDate}
        maxDate={filters.endDate}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                <div className="dashboard-summary-cards">
                  <div className="summary-card">
                    <span>Villas (filtered)</span>
                    <strong>{new Set(filteredRecords.map((r) => r.villaID)).size}</strong>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                    Project Timeline — filtered scope, ignoring the date range
                  </h4>
                  <div className="dashboard-summary-cards">
                    <div className="summary-card">
                      <span>Planned Start</span>
                      <strong>{dateSummary.earliestPlannedStart ?? "—"}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Planned Finish</span>
                      <strong>{dateSummary.latestPlannedFinish ?? "—"}</strong>
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

                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                    Total Budget — whole filtered scope, any date
                  </h4>
                  <div className="dashboard-summary-cards">
                    <div className="summary-card">
                      <span>Total Planned Cost</span>
                      <strong>{formatCurrency(totalBudgetPlanned)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Total Actual Cost</span>
                      <strong>{formatCurrency(totalBudgetActual)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Planned %</span>
                      <strong>{totalBudgetPlannedPercent.toFixed(1)}%</strong>
                    </div>
                    <div className="summary-card">
                      <span>Actual %</span>
                      <strong>{totalBudgetActualPercent.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                    Up to {filters.endDate} — date-adjusted
                  </h4>
                  <div className="dashboard-summary-cards">
                    <div className="summary-card">
                      <span>Planned Cost (adjusted, to date)</span>
                      <strong>{formatCurrency(totalPlannedFiltered)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Actual Cost (to date)</span>
                      <strong>{formatCurrency(totalActualFiltered)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Planned %</span>
                      <strong>{upToDatePlannedPercent.toFixed(1)}%</strong>
                    </div>
                    <div className="summary-card">
                      <span>Actual %</span>
                      <strong>{upToDateActualPercent.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>

                <div className="dashboard-pies">
                  <div className="dashboard-pie" style={{ width: 200 }}>
                    <h4>Villas by Status</h4>
                    <Pie
                      data={{
                        labels: STATUS_ORDER,
                        datasets: [
                          {
                            data: STATUS_ORDER.map((s) => statusCounts[s] ?? 0),
                            backgroundColor: STATUS_ORDER.map((s) => VILLA_STATUS_COLORS[s]),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
                    />
                  </div>

                  <div style={{ width: 260 }}>
                    <div className="dashboard-chart-actions">
                      <h4 style={{ fontSize: "0.75rem", margin: "0", color: "var(--color-text-muted)" }}>Category — Planned</h4>
                      <button type="button" onClick={() => downloadChartAsImage(categoryPlannedRef, "category_planned")}>
                        PNG
                      </button>
                    </div>
                    <Pie
                      ref={categoryPlannedRef}
                      data={{
                        labels: categoryBreakdown.categories,
                        datasets: [
                          {
                            data: categoryBreakdown.plannedCosts,
                            backgroundColor: categoryBreakdown.categories.map(
                              (c) => CATEGORY_COLOR_PALETTE[c] ?? CATEGORY_COLOR_PALETTE.Default
                            ),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
                          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatSAR(ctx.parsed)}` } },
                        },
                      }}
                    />
                  </div>

                  <div style={{ width: 260 }}>
                    <div className="dashboard-chart-actions">
                      <h4 style={{ fontSize: "0.75rem", margin: "0", color: "var(--color-text-muted)" }}>Category — Actual</h4>
                      <button type="button" onClick={() => downloadChartAsImage(categoryActualRef, "category_actual")}>
                        PNG
                      </button>
                    </div>
                    <Pie
                      ref={categoryActualRef}
                      data={{
                        labels: categoryBreakdown.categories,
                        datasets: [
                          {
                            data: categoryBreakdown.actualCosts,
                            backgroundColor: "rgba(34, 197, 94, 0.75)",
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
                          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatSAR(ctx.parsed)}` } },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="dashboard-chart-section">
                  <div className="dashboard-chart-actions">
                    <h4>Villas by Status — detail</h4>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRowsAsExcel(
                          statusTableRows.map((r) => ({ Status: r.status, Count: r.count, "% of Villas": r.percent.toFixed(1) })),
                          "Villas by Status",
                          "villas_by_status"
                        )
                      }
                    >
                      Download Table
                    </button>
                  </div>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>% of Villas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusTableRows.map((r) => (
                        <tr key={r.status}>
                          <td>{r.status}</td>
                          <td>{r.count}</td>
                          <td>{r.percent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dashboard-chart-section">
                  <div className="dashboard-chart-actions">
                    <h4>Category Breakdown — detail</h4>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRowsAsExcel(
                          categoryTableRows.map((r) => ({
                            Category: r.category,
                            "Planned Cost": r.plannedCost,
                            "Planned % of Total Budget": r.plannedPercent.toFixed(1),
                            "Actual Cost": r.actualCost,
                            "Actual % of Total Budget": r.actualPercent.toFixed(1),
                          })),
                          "Category Breakdown",
                          "category_breakdown"
                        )
                      }
                    >
                      Download Table
                    </button>
                  </div>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Planned Cost</th>
                        <th>Planned % of Total Budget</th>
                        <th>Actual Cost</th>
                        <th>Actual % of Total Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryTableRows.map((r) => (
                        <tr key={r.category}>
                          <td>{r.category}</td>
                          <td>{formatCurrency(r.plannedCost)}</td>
                          <td>{r.plannedPercent.toFixed(1)}%</td>
                          <td>{formatCurrency(r.actualCost)}</td>
                          <td>{r.actualPercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          },
          {
            id: "trend",
            label: "Cost Trend",
            content: (
              <div className="dashboard-chart-section">
                <div className="dashboard-chart-actions">
                  <h4>Cost Trend</h4>
                  <button type="button" onClick={() => setViewType((v) => (v === "monthly" ? "weekly" : "monthly"))}>
                    Switch to {viewType === "monthly" ? "Weekly" : "Monthly"} view
                  </button>
                  <button type="button" onClick={() => downloadChartAsImage(trendChartRef, "cost_trend_chart")}>
                    Download Chart
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadRowsAsExcel(
                        sortedPeriods.map((p) => ({
                          Period: formatPeriodLabel(p, viewType),
                          "Planned Cost": periods[p].totalCost,
                          "Actual Cost": periods[p].totalCostActual,
                          "Planned % (period)": periods[p].percentOfTotal.toFixed(2),
                          "Actual % (period)": periods[p].percentOfTotalActual.toFixed(2),
                          "Planned Cumulative": periods[p].cumulativeCost,
                          "Actual Cumulative": periods[p].cumulativeCostActual,
                          "Planned Cum %": periods[p].cumPercent.toFixed(2),
                          "Actual Cum %": periods[p].cumPercentActual.toFixed(2),
                        })),
                        "Cost Trend",
                        "cost_trend_data"
                      )
                    }
                  >
                    Download Data
                  </button>
                </div>
                <div className="dashboard-chart-container">
                  <MixedChart
                    ref={trendChartRef}
                    type="bar"
                    data={{
                      labels: sortedPeriods.map((p) => formatPeriodLabel(p, viewType)),
                      datasets: [
                        { type: "bar", label: "Planned Cost", data: sortedPeriods.map((p) => periods[p].totalCost), backgroundColor: "rgba(59,130,246,0.6)" },
                        { type: "bar", label: "Actual Cost", data: sortedPeriods.map((p) => periods[p].totalCostActual), backgroundColor: "rgba(34,197,94,0.6)" },
                        { type: "line", label: "Planned Cumulative", data: sortedPeriods.map((p) => periods[p].cumulativeCost), borderColor: "rgba(236,72,153,1)", backgroundColor: "rgba(236,72,153,0.3)", yAxisID: "y1" },
                        { type: "line", label: "Actual Cumulative", data: sortedPeriods.map((p) => periods[p].cumulativeCostActual), borderColor: "rgba(139,92,246,1)", backgroundColor: "rgba(139,92,246,0.3)", yAxisID: "y1" },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: { type: "linear", position: "left", title: { display: true, text: "Period Cost (SAR)" } },
                        y1: { type: "linear", position: "right", title: { display: true, text: "Cumulative (SAR)" }, grid: { drawOnChartArea: false } },
                      },
                    }}
                  />
                </div>

                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Planned Cost</th>
                      <th>Actual Cost</th>
                      <th>Planned % (period)</th>
                      <th>Actual % (period)</th>
                      <th>Planned Cum %</th>
                      <th>Actual Cum %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPeriods.map((p) => (
                      <tr key={p}>
                        <td>{formatPeriodLabel(p, viewType)}</td>
                        <td>{formatCurrency(periods[p].totalCost)}</td>
                        <td>{formatCurrency(periods[p].totalCostActual)}</td>
                        <td>{periods[p].percentOfTotal.toFixed(1)}%</td>
                        <td>{periods[p].percentOfTotalActual.toFixed(1)}%</td>
                        <td>{periods[p].cumPercent.toFixed(1)}%</td>
                        <td>{periods[p].cumPercentActual.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {sortedPeriods.length === 0 && (
                      <tr>
                        <td colSpan={7} className="dashboard-table-empty">
                          No periods to show for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "top-items",
            label: "Top Items",
            content: (
              <div className="dashboard-chart-section">
                <div className="dashboard-chart-actions">
                  <h4>Top 10 Items (by planned budget)</h4>
                  <button type="button" onClick={() => downloadChartAsImage(topItemsRef, "top_items_chart")}>
                    Download Chart
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadRowsAsExcel(
                        topItems.map((i) => ({
                          Item: i.item,
                          Category: i.category,
                          "Planned (adjusted)": i.planned,
                          Actual: i.actual,
                          "Planned % of Total Budget": totalPlannedFiltered > 0 ? ((i.totalBudget / totalPlannedFiltered) * 100).toFixed(2) : "0.00",
                          "Actual % of Total Budget": totalPlannedFiltered > 0 ? ((i.actual / totalPlannedFiltered) * 100).toFixed(2) : "0.00",
                        })),
                        "Top Items",
                        "top_items_data"
                      )
                    }
                  >
                    Download Data
                  </button>
                </div>
                <div className="dashboard-chart-container">
                  <Bar
                    ref={topItemsRef}
                    data={{
                      labels: topItems.map((i) => i.item),
                      datasets: [
                        { label: "Planned (adjusted)", data: topItems.map((i) => i.planned), backgroundColor: "rgba(59,130,246,0.7)" },
                        { label: "Actual", data: topItems.map((i) => i.actual), backgroundColor: "rgba(34,197,94,0.7)" },
                      ],
                    }}
                    options={{
                      indexAxis: "y",
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: "bottom" } },
                      scales: { x: { title: { display: true, text: "SAR" } } },
                    }}
                  />
                </div>

                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Planned (adjusted)</th>
                      <th>Planned % of Total Budget</th>
                      <th>Actual</th>
                      <th>Actual % of Total Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((i) => (
                      <tr key={i.item}>
                        <td>{i.item}</td>
                        <td>{i.category}</td>
                        <td>{formatCurrency(i.planned)}</td>
                        <td>{totalPlannedFiltered > 0 ? ((i.totalBudget / totalPlannedFiltered) * 100).toFixed(1) : "0.0"}%</td>
                        <td>{formatCurrency(i.actual)}</td>
                        <td>{totalPlannedFiltered > 0 ? ((i.actual / totalPlannedFiltered) * 100).toFixed(1) : "0.0"}%</td>
                      </tr>
                    ))}
                    {topItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="dashboard-table-empty">
                          No items to show for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "data",
            label: "Data Table",
            content: (
              <div className="dashboard-chart-section">
                <div className="dashboard-chart-actions">
                  <h4>Detailed Cost Data</h4>
                  <input
                    type="text"
                    placeholder="Search villa or item…"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <button type="button" onClick={() => downloadRowsAsExcel(tableRowsForExport(pageRows), "Data", "Data_Current_Page")}>
                    Download Current Page
                  </button>
                  <button type="button" onClick={() => downloadRowsAsExcel(tableRowsForExport(sortedFilteredTable), "Data", "Data_All")}>
                    Download All Data
                  </button>
                </div>

                <table className="dashboard-table">
                  <thead>
                    <tr>
                      {[
                        ["villaID", "Villa"],
                        ["blocknum", "Block"],
                        ["item", "Item"],
                        ["category", "Category"],
                        ["plannedCost", "Planned Cost"],
                        ["actualCost", "Actual Cost"],
                        ["plannedFinishDate", "Planned Finish"],
                        ["actualStatus", "Status"],
                      ].map(([key, label]) => (
                        <th key={key} onClick={() => toggleSort(key)}>
                          {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={`${r.villaID}-${r.TableItemID}-${i}`}>
                        <td>{r.villaID}</td>
                        <td>{r.blocknum ?? "—"}</td>
                        <td>{r.item}</td>
                        <td>{r.category}</td>
                        <td>{formatCurrency(r.plannedCost)}</td>
                        <td>{formatCurrency(r.actualCost)}</td>
                        <td>{r.plannedFinishDate ?? "—"}</td>
                        <td>{r.actualStatus}</td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="dashboard-table-empty">
                          No records match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="dashboard-controls">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span style={{ fontSize: "0.8rem" }}>
                    Page {page} of {pageCount} ({sortedFilteredTable.length} records)
                  </span>
                  <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
