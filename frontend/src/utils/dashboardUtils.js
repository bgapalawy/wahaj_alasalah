/**
 * Ported from the aggregateWeeklyMonthlyData / renderDashboard math in
 * dashboardvilla.js: group activities by the period their planned finish
 * date falls in, then compute running cumulative cost and percent-of-total
 * for both planned and actual cost.
 *
 * One deliberate deviation from the original: weekly period keys are
 * "YYYY-Www" (e.g. "2026-W05") instead of a bare week number, so weeks
 * sort correctly across year boundaries — the original's plain numeric
 * week sort would have collided/misordered across years.
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function periodKeyFor(dateStr, viewType) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date)) return null;
  return viewType === "weekly"
    ? `${date.getFullYear()}-W${String(getISOWeek(date)).padStart(2, "0")}`
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    if (activity.actualCompletedDate) {
      periods[periodKey].totalCostActual += activity.actualCost || 0;
    }
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
 */
export function calculateDashboardMetrics(activities, specificDate) {
  const grandTotal = activities.reduce((sum, a) => sum + (a.plannedCost || 0), 0);

  const plannedCostToDate = activities.reduce((sum, a) => {
    if (!a.plannedFinishDate) return sum;
    const finish = new Date(`${a.plannedFinishDate}T00:00:00`);
    return finish <= specificDate ? sum + (a.plannedCost || 0) : sum;
  }, 0);

  const actualCostToDate = activities.reduce((sum, a) => {
    if (!a.actualCompletedDate) return sum;
    const completed = new Date(`${a.actualCompletedDate}T00:00:00`);
    return completed <= specificDate ? sum + (a.actualCost || 0) : sum;
  }, 0);

  return {
    grandTotal,
    plannedCostToDate,
    actualCostToDate,
    plannedPercent: grandTotal > 0 ? (plannedCostToDate / grandTotal) * 100 : 0,
    actualPercent: grandTotal > 0 ? (actualCostToDate / grandTotal) * 100 : 0,
  };
}

export const formatCurrency = (n) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 0 });
