/**
 * Ported directly from updateCategoryChart()/countWorkingDays() in
 * dashboardallproject.js: if an activity's planned finish date falls
 * after the selected date range's end, only count the portion of its
 * planned cost "earned" by the elapsed working days out of its total
 * working-day span. This is what makes the category pies and top-items
 * chart reflect "cost planned to be spent by this date" rather than
 * "total cost of everything touched at all."
 *
 * Calendar extracted DIRECTLY from the real P6 baseline
 * (WAHJ-ALASALAH_Baseline.xer, CALENDAR table's clndr_data, "WAHJ
 * alasalh Calendar") — not assumed. Two things worth knowing if this
 * ever needs rechecking against a newer baseline export:
 *
 *   - The weekly weekend in THIS calendar is Friday ONLY (already
 *     correct in the code below, `getDay() !== 5`) — Saturday is a
 *     normal working day here, unlike the more common Fri+Sat Saudi
 *     weekend some other projects use.
 *   - HOLIDAYS below — previously missing entirely — is the other 24
 *     dates in the calendar's exception list (every non-Friday
 *     exception): Saudi National Day (23 Sep, every year) plus Eid
 *     al-Fitr and Eid al-Adha clusters (dates shift each year since
 *     they follow the Hijri calendar, which is exactly why they show
 *     up as individual exception dates in P6 rather than a weekly
 *     rule). Missing these was the source of the remaining small gap
 *     against P6's own Schedule % Complete after dates and weekly
 *     Friday exclusion already matched.
 *
 * If a future baseline changes the calendar (different weekend, more/
 * fewer holiday dates), re-extract from the new .xer's CALENDAR table
 * rather than hand-editing this list from guesswork.
 */
const HOLIDAYS = new Set([
  "2026-09-23", // Saudi National Day
  "2027-02-22",
  "2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", // Eid al-Fitr
  "2027-05-15", "2027-05-16", "2027-05-17", "2027-05-18", "2027-05-19", // Eid al-Adha
  "2027-09-23", // Saudi National Day
  "2028-02-22",
  "2028-02-26", "2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01", // Eid al-Fitr
  "2028-05-03", "2028-05-04", "2028-05-06", "2028-05-07", // Eid al-Adha
  "2028-09-23", // Saudi National Day
  "2029-02-22",
]);

function isHoliday(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return HOLIDAYS.has(`${y}-${m}-${d}`);
}

function countWorkingDays(start, end) {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  while (current <= endDay) {
    if (current.getDay() !== 5 && !isHoliday(current)) count++; // exclude Friday + official holidays
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function getAdjustedPlannedCost(record, rangeEndDate) {
  if (!record.plannedCost) return 0;
  // No start date at all means there's no timeline to judge progress
  // against — this is NOT the same as "already fully achieved." Items
  // like this (the site-wide "General" cost lines — Mobilization, NTP
  // Obligations, Procurement residuals, IDI — added on top of the real
  // P6 schedule for BOQ reconciliation, deliberately left undated since
  // they don't correspond to a single dated P6 task) used to fall
  // through to `return record.plannedCost` unconditionally here,
  // meaning they counted as 100% "achieved" on day one of the project
  // regardless of the selected date — which is what was inflating
  // "Planned Cost (adjusted, to date)" well above what P6 itself
  // reports for the same cutoff. Until an item has real dates, it
  // contributes nothing to a date-adjusted figure (it still counts
  // fully in the date-INDEPENDENT "whole scope, any date" totals
  // elsewhere, which is unaffected by this change).
  if (!record.plannedStartDate) return 0;

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
