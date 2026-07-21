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
import { Pie, Chart as MixedChart } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { villasApi } from "../../api/villas.js";
import {
  aggregateByPeriod,
  calculateDashboardMetrics,
  formatCurrency,
  formatPeriodLabel,
  downloadChartAsImage,
  getProjectDateRange,
} from "../../utils/dashboardUtils.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const PIE_COLORS = ["#22c55e", "#e5e7eb"];

function PercentPie({ label, percent }) {
  return (
    <div className="dashboard-pie">
      <h4>{label}</h4>
      <p className="dashboard-pie-value">{percent.toFixed(2)}%</p>
      <Pie
        data={{
          labels: ["Complete", "Remaining"],
          datasets: [{ data: [percent, Math.max(0, 100 - percent)], backgroundColor: PIE_COLORS, borderWidth: 0 }],
        }}
        options={{ plugins: { legend: { display: false } }, aspectRatio: 1 }}
      />
    </div>
  );
}

/**
 * Replaces the per-villa popup dashboard from dashboardvilla.js: planned vs
 * actual cost, a selectable analysis date, weekly/monthly period charts,
 * a comparison table, and Excel/PNG export.
 */
export function VillaDashboard({ villaID }) {
  const [activities, setActivities] = useState([]);
  const [status, setStatus] = useState("loading");
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewType, setViewType] = useState("monthly");
  const chartRef = useRef(null);

  useEffect(() => {
    setStatus("loading");
    villasApi
      .getDashboard(villaID)
      .then((data) => {
        setActivities(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [villaID]);

  const metrics = useMemo(() => {
    const date = new Date(`${analysisDate}T00:00:00`);
    return calculateDashboardMetrics(activities, date);
  }, [activities, analysisDate]);

  const { periods, sortedPeriods } = useMemo(
    () => aggregateByPeriod(activities, viewType),
    [activities, viewType]
  );

  const { earliestStart, latestFinish, firstActualDateRecorded, lastActualDateRecorded } = useMemo(
    () => getProjectDateRange(activities),
    [activities]
  );

  const chartData = {
    labels: sortedPeriods.map((p) => formatPeriodLabel(p, viewType)),
    datasets: [
      {
        type: "bar",
        label: "Planned Cost (SAR)",
        data: sortedPeriods.map((p) => periods[p].totalCost),
        backgroundColor: "rgba(59, 130, 246, 0.6)",
      },
      {
        type: "bar",
        label: "Actual Cost (SAR)",
        data: sortedPeriods.map((p) => periods[p].totalCostActual),
        backgroundColor: "rgba(34, 197, 94, 0.6)",
      },
      {
        type: "line",
        label: "Planned Cumulative (SAR)",
        data: sortedPeriods.map((p) => periods[p].cumulativeCost),
        borderColor: "rgba(236, 72, 153, 1)",
        backgroundColor: "rgba(236, 72, 153, 0.3)",
        yAxisID: "y1",
      },
      {
        type: "line",
        label: "Actual Cumulative (SAR)",
        data: sortedPeriods.map((p) => periods[p].cumulativeCostActual),
        borderColor: "rgba(139, 92, 246, 1)",
        backgroundColor: "rgba(139, 92, 246, 0.3)",
        yAxisID: "y1",
      },
    ],
  };

  function downloadExcel() {
    const rows = sortedPeriods.map((p) => ({
      Period: formatPeriodLabel(p, viewType),
      "Planned Cost": periods[p].totalCost,
      "Actual Cost": periods[p].totalCostActual,
      "Planned Cumulative": periods[p].cumulativeCost,
      "Actual Cumulative": periods[p].cumulativeCostActual,
      "Planned %": periods[p].cumPercent.toFixed(2),
      "Actual %": periods[p].cumPercentActual.toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost Trend");
    XLSX.writeFile(wb, `Villa_${villaID}_Cost_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function downloadChartImage() {
    downloadChartAsImage(chartRef, `Villa_${villaID}_chart`);
  }

  if (status === "loading") return <p>Loading dashboard…</p>;
  if (status === "error") return <p>Couldn't load dashboard data for {villaID}.</p>;

  return (
    <div className="villa-dashboard">
      <div className="dashboard-controls">
        <label>
          Analysis date
          <input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} />
        </label>
        <button type="button" onClick={() => setViewType((v) => (v === "monthly" ? "weekly" : "monthly"))}>
          Switch to {viewType === "monthly" ? "Weekly" : "Monthly"} view
        </button>
      </div>

      <div>
        <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>Timeline</h4>
        <div className="dashboard-summary-cards">
          <div className="summary-card">
            <span>Planned Start Date</span>
            <strong>{earliestStart ?? "—"}</strong>
          </div>
          <div className="summary-card">
            <span>Planned Finish Date</span>
            <strong>{latestFinish ?? "—"}</strong>
          </div>
          <div className="summary-card">
            <span>First Actual Date Recorded</span>
            <strong>{firstActualDateRecorded ?? "—"}</strong>
          </div>
          <div className="summary-card">
            <span>Last Actual Date Recorded</span>
            <strong>{lastActualDateRecorded ?? "—"}</strong>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
          Total Budget — whole villa, any date
        </h4>
        <div className="dashboard-summary-cards">
          <div className="summary-card">
            <span>Total Planned Cost</span>
            <strong>{formatCurrency(metrics.grandTotal)}</strong>
          </div>
          <div className="summary-card">
            <span>Total Actual Cost</span>
            <strong>{formatCurrency(metrics.totalActual)}</strong>
          </div>
          <div className="summary-card">
            <span>Planned %</span>
            <strong>{metrics.totalPlannedPercent.toFixed(1)}%</strong>
          </div>
          <div className="summary-card">
            <span>Actual %</span>
            <strong>{metrics.totalActualPercent.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
          Up to {analysisDate} — date-adjusted
        </h4>
        <div className="dashboard-summary-cards">
          <div className="summary-card">
            <span>Planned Cost (to date)</span>
            <strong>{formatCurrency(metrics.plannedCostToDate)}</strong>
          </div>
          <div className="summary-card">
            <span>Actual Cost (to date)</span>
            <strong>{formatCurrency(metrics.actualCostToDate)}</strong>
          </div>
          <div className="summary-card">
            <span>Planned %</span>
            <strong>{metrics.plannedPercent.toFixed(1)}%</strong>
          </div>
          <div className="summary-card">
            <span>Actual %</span>
            <strong>{metrics.actualPercent.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-pies">
        <PercentPie label="Planned % (Selected Date)" percent={metrics.plannedPercent} />
        <PercentPie label="Actual % (Selected Date)" percent={metrics.actualPercent} />
      </div>

      <div className="dashboard-chart-section">
        <div className="dashboard-chart-actions">
          <button type="button" onClick={downloadExcel}>
            Download Table
          </button>
          <button type="button" onClick={downloadChartImage}>
            Download Chart
          </button>
        </div>
        <div className="dashboard-chart-container">
          <MixedChart
            ref={chartRef}
            type="bar"
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { type: "linear", position: "left", title: { display: true, text: "Period Cost (SAR)" } },
                y1: {
                  type: "linear",
                  position: "right",
                  title: { display: true, text: "Cumulative (SAR)" },
                  grid: { drawOnChartArea: false },
                },
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
              <th>Planned %</th>
              <th>Actual %</th>
            </tr>
          </thead>
          <tbody>
            {sortedPeriods.map((p) => (
              <tr key={p}>
                <td>{formatPeriodLabel(p, viewType)}</td>
                <td>{formatCurrency(periods[p].totalCost)}</td>
                <td>{formatCurrency(periods[p].totalCostActual)}</td>
                <td>{periods[p].cumPercent.toFixed(1)}%</td>
                <td>{periods[p].cumPercentActual.toFixed(1)}%</td>
              </tr>
            ))}
            {sortedPeriods.length === 0 && (
              <tr>
                <td colSpan={5} className="dashboard-table-empty">
                  No planned finish dates found for this villa yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
