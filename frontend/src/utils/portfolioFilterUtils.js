/**
 * Ported directly from updateCategoryChart()/countWorkingDays() in
 * dashboardallproject.js: if an activity's planned finish date falls
 * after the selected date range's end, only count the portion of its
 * planned cost "earned" by the elapsed working days (excluding Fridays)
 * out of its total working-day span. This is what makes the category
 * pies and top-items chart reflect "cost planned to be spent by this
 * date" rather than "total cost of everything touched at all."
 */
function countWorkingDays(start, end) {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  while (current <= endDay) {
    if (current.getDay() !== 5) count++; // exclude Friday
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function getAdjustedPlannedCost(record, rangeEndDate) {
  if (!record.plannedCost) return 0;
  if (!record.plannedStartDate) return record.plannedCost;

  const startDate = new Date(`${record.plannedStartDate}T00:00:00`);
  const finishDate = record.plannedFinishDate ? new Date(`${record.plannedFinishDate}T00:00:00`) : null;
  const normalizedEnd = new Date(rangeEndDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  if (!finishDate) return record.plannedCost;
  finishDate.setHours(23, 59, 59, 999);

  if (finishDate <= normalizedEnd) return record.plannedCost;

  const totalWorkingDays = countWorkingDays(startDate, finishDate);
  const elapsedWorkingDays = countWorkingDays(startDate, normalizedEnd);
  return totalWorkingDays > 0 && elapsedWorkingDays >= 0
    ? (elapsedWorkingDays / totalWorkingDays) * record.plannedCost
    : 0;
}

/**
 * Category cost breakdown "up to a date": planned cost is date-adjusted
 * per getAdjustedPlannedCost above. Actual cost counts an activity's full
 * actual cost only if its PLANNED finish date is on or before rangeEndDate
 * — using plannedFinishDate as a proxy for "should have been incurred by
 * now," since actualCompletedDate (only set when someone manually marks
 * an activity "Completed" through this app) is too sparse across real
 * records to use directly. This makes "actual up to date" genuinely
 * responsive to the date range again, using data that's actually
 * populated. Activities with no plannedFinishDate at all are included
 * (nothing to exclude them by) rather than silently dropped.
 */
export function aggregateByCategory(records, rangeEndDate) {
  const planned = {};
  const actual = {};
  const normalizedEnd = new Date(rangeEndDate);
  normalizedEnd.setHours(23, 59, 59, 999);

  records.forEach((r) => {
    if (!r.category) return;
    planned[r.category] = (planned[r.category] ?? 0) + getAdjustedPlannedCost(r, rangeEndDate);

    const finishDate = r.plannedFinishDate ? new Date(`${r.plannedFinishDate}T00:00:00`) : null;
    const scheduledByNow = !finishDate || finishDate <= normalizedEnd;
    if (scheduledByNow) {
      actual[r.category] = (actual[r.category] ?? 0) + (r.actualCost || 0);
    }
  });
  const categories = [...new Set([...Object.keys(planned), ...Object.keys(actual)])].sort();
  return {
    categories,
    plannedCosts: categories.map((c) => planned[c] ?? 0),
    actualCosts: categories.map((c) => actual[c] ?? 0),
  };
}

/**
 * Category cost breakdown for the WHOLE filtered scope, ignoring the date
 * range entirely — the "total budget" figure to show alongside the
 * date-adjusted one above, so both "what's the full scope" and "where are
 * we as of this date" are visible at once.
 */
export function aggregateTotalBudget(records) {
  const planned = {};
  const actual = {};
  records.forEach((r) => {
    if (!r.category) return;
    planned[r.category] = (planned[r.category] ?? 0) + (r.plannedCost || 0);
    actual[r.category] = (actual[r.category] ?? 0) + (r.actualCost || 0);
  });
  const categories = [...new Set([...Object.keys(planned), ...Object.keys(actual)])].sort();
  return {
    categories,
    plannedCosts: categories.map((c) => planned[c] ?? 0),
    actualCosts: categories.map((c) => actual[c] ?? 0),
  };
}

/**
 * Top N items (by total planned budget across the filtered scope), each
 * with date-adjusted planned cost and actual cost — feeds the Top Items
 * chart.
 */
export function getTopItems(records, rangeEndDate, limit = 10) {
  const byItem = {};
  records.forEach((r) => {
    if (!r.item) return;
    if (!byItem[r.item]) byItem[r.item] = { planned: 0, actual: 0, totalBudget: 0, category: r.category };
    byItem[r.item].planned += getAdjustedPlannedCost(r, rangeEndDate);
    byItem[r.item].actual += r.actualCost || 0;
    byItem[r.item].totalBudget += r.plannedCost || 0;
  });
  return Object.entries(byItem)
    .sort((a, b) => b[1].totalBudget - a[1].totalBudget)
    .slice(0, limit)
    .map(([item, v]) => ({ item, ...v }));
}

export const formatSAR = (n) =>
  `${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} SAR`;

/**
 * Earliest planned start, latest planned finish, and most recent actual
 * date recorded — across whatever category/villa/block/stage filters are
 * applied, deliberately ignoring the date-range filter itself (that
 * filter picks a window to analyze; this answers "what's the full
 * timeline of the thing being analyzed," which wouldn't mean much if it
 * were clipped by the same window).
 */
export function getFilteredDateSummary(records) {
  const startDates = records.map((r) => r.plannedStartDate).filter(Boolean);
  const finishDates = records.map((r) => r.plannedFinishDate).filter(Boolean);
  const actualDates = records.map((r) => r.actualCompletedDate).filter(Boolean);
  return {
    earliestPlannedStart: startDates.length ? startDates.reduce((min, d) => (d < min ? d : min)) : null,
    latestPlannedFinish: finishDates.length ? finishDates.reduce((max, d) => (d > max ? d : max)) : null,
    firstActualDateRecorded: actualDates.length ? actualDates.reduce((min, d) => (d < min ? d : min)) : null,
    lastActualDateRecorded: actualDates.length ? actualDates.reduce((max, d) => (d > max ? d : max)) : null,
  };
}
