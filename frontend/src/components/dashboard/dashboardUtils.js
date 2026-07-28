/**
 * Ported from the aggregateWeeklyMonthlyData / renderDashboard math in
 * dashboardvilla.js: group activities by the period their planned finish
 * date falls in, then compute running cumulative cost and percent-of-total
 * for both planned and actual cost.
 *
 * Weekly periods are keyed by the ISO date of that week's Monday (e.g.
 * "2024-06-30") rather than a week number — sorts correctly as a plain
 * string, and formatPeriodLabel() below turns it into an actual date range
 * for display instead of a "Www" label.
 */
function getWeekStart(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Monday = 1 ... Sunday = 7
  d.setUTCDate(d.getUTCDate() - dayNum + 1);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function periodKeyFor(dateStr, viewType) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date)) return null;
  return viewType === "weekly"
    ? toISODate(getWeekStart(date))
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Turns a period key into a human date range/label for charts and tables. */
export function formatPeriodLabel(periodKey, viewType) {
  if (viewType === "weekly") {
    const start = new Date(`${periodKey}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const fmt = (d) => `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
    return `${fmt(start)} – ${fmt(end)}, ${end.getUTCFullYear()}`;
  }
  const [year, month] = periodKey.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export function aggregateByPeriod(activities, viewType) {
  const periods = {};
  const allPeriodKeys = [];

  activities.forEach((activity) => {
    if (!activity.plannedFinishDate) return;
    const periodKey = periodKeyFor(activity.plannedFinishDate, viewType);
    if (!periodKey) return;

    if (!periods[periodKey]) {
      periods[periodKey] = {
        totalCost: 0,
        totalCostActual: 0,
        cumulativeCost: 0,
        cumulativeCostActual: 0,
        percentOfTotal: 0,
        percentOfTotalActual: 0,
        cumPercent: 0,
        cumPercentActual: 0,
      };
      allPeriodKeys.push(periodKey);
    }

    periods[periodKey].totalCost += activity.plannedCost || 0;
    periods[periodKey].totalCostActual += activity.actualCost || 0;
  });

  const sortedPeriods = allPeriodKeys.sort();
  const grandTotal = activities.reduce((sum, a) => sum + (a.plannedCost || 0), 0);

  let cumulativeCost = 0;
  let cumulativeCostActual = 0;
  sortedPeriods.forEach((period) => {
    const p = periods[period];

    cumulativeCost += p.totalCost;
    p.cumulativeCost = cumulativeCost;
    p.percentOfTotal = grandTotal > 0 ? (p.totalCost / grandTotal) * 100 : 0;
    p.cumPercent = grandTotal > 0 ? (cumulativeCost / grandTotal) * 100 : 0;

    cumulativeCostActual += p.totalCostActual;
    p.cumulativeCostActual = cumulativeCostActual;
    p.percentOfTotalActual = grandTotal > 0 ? (p.totalCostActual / grandTotal) * 100 : 0;
    p.cumPercentActual = grandTotal > 0 ? (cumulativeCostActual / grandTotal) * 100 : 0;
  });

  return { periods, sortedPeriods };
}

/**
 * Planned/actual cost totals as of a specific analysis date — feeds the
 * two "% (Selected Date)" pie charts.
 *
 * actualCostToDate uses plannedFinishDate as the inclusion test (was
 * activity.actualCompletedDate — but that field is only set when someone
 * manually marks an activity "Completed" through this app, which covers
 * almost none of the real data, so it was silently zeroing out actual
 * cost). Same fix already applied to the portfolio dashboard's
 * aggregateByCategory.
 */
export function calculateDashboardMetrics(activities, specificDate) {
  const grandTotal = activities.reduce((sum, a) => sum + (a.plannedCost || 0), 0);
  const totalActual = activities.reduce((sum, a) => sum + (a.actualCost || 0), 0);

  const plannedCostToDate = activities.reduce((sum, a) => {
    if (!a.plannedFinishDate) return sum;
    const finish = new Date(`${a.plannedFinishDate}T00:00:00`);
    return finish <= specificDate ? sum + (a.plannedCost || 0) : sum;
  }, 0);

  const actualCostToDate = activities.reduce((sum, a) => {
    if (!a.plannedFinishDate) return sum + (a.actualCost || 0); // nothing to exclude it by — include it
    const finish = new Date(`${a.plannedFinishDate}T00:00:00`);
    return finish <= specificDate ? sum + (a.actualCost || 0) : sum;
  }, 0);

  return {
    grandTotal,
    totalActual,
    plannedCostToDate,
    actualCostToDate,
    // Every percent below divides by the same denominator (grandTotal)
    // so all four numbers are directly comparable, same convention as
    // the portfolio dashboard's category breakdown.
    totalPlannedPercent: grandTotal > 0 ? 100 : 0,
    totalActualPercent: grandTotal > 0 ? (totalActual / grandTotal) * 100 : 0,
    plannedPercent: grandTotal > 0 ? (plannedCostToDate / grandTotal) * 100 : 0,
    actualPercent: grandTotal > 0 ? (actualCostToDate / grandTotal) * 100 : 0,
  };
}

/**
 * The villa's overall planned timeline: earliest planned start date across
 * all activities, and latest planned finish date. Plain string min/max
 * works here because dates are normalized to "YYYY-MM-DD", which sorts
 * lexicographically the same as chronologically.
 */
export function getProjectDateRange(activities) {
  const startDates = activities.map((a) => a.plannedStartDate).filter(Boolean);
  const finishDates = activities.map((a) => a.plannedFinishDate).filter(Boolean);
  const actualDates = activities.map((a) => a.actualCompletedDate).filter(Boolean);
  return {
    earliestStart: startDates.length ? startDates.reduce((min, d) => (d < min ? d : min)) : null,
    latestFinish: finishDates.length ? finishDates.reduce((max, d) => (d > max ? d : max)) : null,
    firstActualDateRecorded: actualDates.length ? actualDates.reduce((min, d) => (d < min ? d : min)) : null,
    lastActualDateRecorded: actualDates.length ? actualDates.reduce((max, d) => (d > max ? d : max)) : null,
  };
}

export const formatCurrency = (n) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 0 });

/**
 * Variance/SPI formatting — shared by AllProjectsDashboard.jsx,
 * VillaDashboard.jsx, and ConstructionItemDashboard.jsx, each of which
 * used to keep its own copy of these four (moved here once this file's
 * real contents were available, to remove that duplication).
 *
 * Variance = Actual − Planned; SPI = Actual ÷ Planned. That SPI is this
 * dataset's own definition, not the textbook PMI one (Earned Value ÷
 * Planned Value) — this data doesn't track Earned Value separately from
 * Actual Cost, so what's computed here is really a cost ratio dressed
 * in schedule-metric terminology. Flagged here once rather than
 * repeated at every call site.
 *
 * Color convention (both functions): positive/above-1 (spent more than
 * planned so far) is red; negative/below-1 (spent less) is green. This
 * is a simple, common convention, not a judgment on whether that's
 * actually good — spending less can also mean behind schedule.
 */
export function varianceColor(variance) {
  if (variance > 0) return "#dc2626";
  if (variance < 0) return "#16a34a";
  return undefined;
}
export function spiColor(spi) {
  if (spi > 1) return "#dc2626";
  if (spi < 1 && spi > 0) return "#16a34a";
  return undefined;
}
export function formatVariancePercent(variance, planned) {
  if (!planned || planned <= 0) return "—";
  return `${((variance / planned) * 100).toFixed(1)}%`;
}
export function formatSpi(spi) {
  if (!isFinite(spi)) return "—";
  return spi.toFixed(2);
}

/**
 * Chart.js canvases are transparent by default, and canvas.toDataURL()
 * preserves that transparency — most photo viewers (especially dark-themed
 * ones) then render the "empty" areas as solid black instead of white.
 * This paints a white background onto a copy of the canvas before
 * exporting, so the downloaded PNG looks right regardless of viewer theme.
 */
export function downloadChartAsImage(chartRef, filename) {
  const sourceCanvas = chartRef.current?.canvas;
  if (!sourceCanvas) return;

  const flattened = document.createElement("canvas");
  flattened.width = sourceCanvas.width;
  flattened.height = sourceCanvas.height;
  const ctx = flattened.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flattened.width, flattened.height);
  ctx.drawImage(sourceCanvas, 0, 0);

  const link = document.createElement("a");
  link.href = flattened.toDataURL("image/png");
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
}
