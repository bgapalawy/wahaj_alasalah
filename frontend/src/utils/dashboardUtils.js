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
 * The project's working calendar — Primavera P6 spreads a cost-loaded
 * activity's cost across its WORKING days only (per the activity's
 * calendar), not every calendar day. Matching that is what closes the
 * remaining small gap against P6's own % Complete once dates already
 * line up (confirmed against P6's Data Date on WAHJ).
 *
 * Extracted DIRECTLY from the real P6 calendar in
 * WAHJ-ALASALAH_Baseline.xer (the CALENDAR table's clndr_data, "WAHJ
 * alasalh Calendar") — not assumed. Two findings worth knowing if this
 * ever needs rechecking against a newer baseline export:
 *
 *   - The weekly weekend in THIS calendar is Friday ONLY — Saturday is
 *     a normal working day here, unlike the more common Fri+Sat Saudi
 *     weekend. Confirmed from the exception list: 163 of 187
 *     "fully non-working" dates fall on a Friday, spread weekly across
 *     the whole project span; only 4 Saturdays appear off at all, and
 *     each of those 4 is inside one of the named-holiday clusters
 *     below (Eid breaks), not a weekly pattern.
 *   - HOLIDAYS below is the other 24 dates (every non-Friday exception
 *     in the calendar) — these read as Saudi National Day (23 Sep,
 *     every year) plus Eid al-Fitr and Eid al-Adha clusters (dates
 *     shift each year since they follow the Hijri calendar, which is
 *     exactly why they show up as individual exception dates in P6
 *     rather than a weekly rule).
 *
 * If a future baseline changes the calendar (different weekend, more/
 * fewer holiday dates), re-extract from the new .xer's CALENDAR table
 * rather than hand-editing this list from guesswork.
 */
const WEEKEND_DAYS = [5]; // Friday only, per the real P6 calendar — Saturday is a working day here
const HOLIDAYS = [
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
];

function isNonWorkingDay(date) {
  if (WEEKEND_DAYS.includes(date.getDay())) return true;
  if (HOLIDAYS.length === 0) return false;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return HOLIDAYS.includes(`${y}-${m}-${d}`);
}

/**
 * Count of working days in the half-open range [start, end) — i.e.
 * start counts if it's a working day, end does not. Using the same
 * half-open convention for both "elapsed" and "total" below keeps them
 * directly comparable (elapsed/total both measured the same way).
 */
function countWorkingDays(start, end) {
  if (end <= start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (!isNonWorkingDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * How much of ONE activity's planned cost has accrued by `specificDate`,
 * distributing the cost LINEARLY across the WORKING days in
 * [plannedStartDate, plannedFinishDate] — matching how Primavera P6
 * spreads a cost-loaded activity's budget across its own calendar's
 * working days, not calendar days. This replaces two earlier, less
 * accurate versions in order:
 *   1. All-or-nothing (full cost if finish <= date, else zero) — the
 *      original bug, off by a lot (e.g. 1.85% in P6 vs 2.2% here).
 *   2. Linear over CALENDAR days — closed most of the gap (2.36% vs
 *      2.6%) but still didn't match exactly, because P6 excludes
 *      weekends/holidays from the spread and this didn't.
 * This version (working days) is what actually matches P6's own
 * "Schedule % Complete" at the same Data Date, confirmed on WAHJ.
 *
 *   - No start date at all: can't judge progress against a timeline —
 *     falls back to the all-or-nothing rule against finish date alone
 *     (unchanged, since there's nothing to prorate against).
 *   - Before start: 0.
 *   - At/after finish: full cost.
 *   - Zero working days in the whole span (e.g. a milestone, or an
 *     activity that — unusually — spans only weekend/holiday days):
 *     can't prorate over zero working days — full cost once finish is
 *     reached, 0 before (same all-or-nothing fallback as the
 *     no-start-date case above).
 *   - In between: cost * (working days elapsed / total working days
 *     in the activity's span).
 */
function accruedCostByDate(cost, startDateStr, finishDateStr, specificDate) {
  if (!cost) return 0;
  if (!finishDateStr) return 0;
  const finish = new Date(`${finishDateStr}T00:00:00`);

  if (!startDateStr) {
    // No start date to prorate against — keep the previous behavior.
    return finish <= specificDate ? cost : 0;
  }

  const start = new Date(`${startDateStr}T00:00:00`);
  if (specificDate < start) return 0;
  if (specificDate >= finish) return cost;

  const totalWorkingDays = countWorkingDays(start, finish);
  if (totalWorkingDays <= 0) return 0; // no working days in the span at all — nothing to prorate against

  const elapsedWorkingDays = countWorkingDays(start, specificDate);
  const fraction = Math.min(1, elapsedWorkingDays / totalWorkingDays);
  return cost * fraction;
}

/**
 * Planned/actual cost totals as of a specific analysis date — feeds the
 * two "% (Selected Date)" pie charts.
 *
 * plannedCostToDate now prorates each activity linearly across its own
 * [plannedStartDate, plannedFinishDate] span (see accruedCostByDate
 * above) instead of counting it 100% or 0% depending only on whether
 * the finish date has passed — this is what was causing this app's
 * "planned %" to disagree with Primavera P6's own figure for the same
 * cutoff date.
 *
 * actualCostToDate uses plannedFinishDate as the inclusion test (was
 * activity.actualCompletedDate — but that field is only set when someone
 * manually marks an activity "Completed" through this app, which covers
 * almost none of the real data, so it was silently zeroing out actual
 * cost). Same fix already applied to the portfolio dashboard's
 * aggregateByCategory. Left as all-or-nothing rather than also
 * prorating: actual cost reflects money actually spent, which this data
 * doesn't track as a percent-through-the-activity the way planned cost
 * can be reasoned about from its date span alone.
 */
export function calculateDashboardMetrics(activities, specificDate) {
  const grandTotal = activities.reduce((sum, a) => sum + (a.plannedCost || 0), 0);
  const totalActual = activities.reduce((sum, a) => sum + (a.actualCost || 0), 0);

  const plannedCostToDate = activities.reduce(
    (sum, a) => sum + accruedCostByDate(a.plannedCost || 0, a.plannedStartDate, a.plannedFinishDate, specificDate),
    0
  );

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
 *
 * excludeGeneral: General-* items (Mobilization, NTP Obligations,
 * Procurement residuals, IDI, ...) now carry PROJECT-WIDE date spans
 * (e.g. General-1 runs 2026-07-08 through 2028-12-06 — mobilization
 * through demobilization) rather than a villa-specific window. Mixed
 * into a single villa's own min/max, that stretches the villa's
 * displayed Planned Start/Finish out to the whole project regardless
 * of when that villa's actual 39 execution items really run — pass
 * `{ excludeGeneral: true }` from a per-VILLA call (VillaDashboard.jsx)
 * to keep the timeline reflecting only that villa's real execution
 * items. Leave it false (default) for a per-ITEM call
 * (ConstructionItemDashboard.jsx), where every row already IS the
 * same single selected item — filtering would just blank the result
 * out entirely if that item happens to be a General one — and for any
 * project-wide summary, which should keep including General items
 * (that's portfolioFilterUtils.js's getFilteredDateSummary, a
 * separate function, unaffected by this).
 */
export function getProjectDateRange(activities, { excludeGeneral = false } = {}) {
  const relevant = excludeGeneral
    ? activities.filter((a) => !String(a.TableItemID ?? "").startsWith("General-"))
    : activities;
  const startDates = relevant.map((a) => a.plannedStartDate).filter(Boolean);
  const finishDates = relevant.map((a) => a.plannedFinishDate).filter(Boolean);
  const actualDates = relevant.map((a) => a.actualCompletedDate).filter(Boolean);
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
 * "V_5" -> "5" — the plain numeric villa number, same leading-non-digit
 * strip VillaLayer.jsx already uses for map labels. Every Excel export
 * that has a Villa (villaID) column also gets this alongside it, so a
 * downloaded sheet can be sorted/filtered by the plain number without
 * needing to parse "V_5" back apart in Excel.
 */
export function getVillaNumber(villaID) {
  return String(villaID ?? "").replace(/^\D+/, "");
}

/**
 * "2026-07-28" -> a real JS Date (midnight local) for a plain date
 * value, or an ISO timestamp string -> a real JS Date for a
 * date+time value. Returns null for anything empty/unparseable so a
 * missing date exports as a blank cell, not "Invalid Date" text.
 *
 * Excel export date handling, the AdminImportExport.jsx pattern applied
 * everywhere else: `XLSX.utils.json_to_sheet` only writes a real,
 * sortable/filterable Excel date cell when the value is an actual JS
 * Date object AND `{ cellDates: true }` is passed — a formatted STRING
 * like "Jul 28, 2026, 3:05 PM" (what every Quality export used to
 * write) looks fine on screen but Excel treats it as plain text: no
 * date-aware sort, no date filter dropdown, no re-formatting. Convert
 * with `toExcelDate`, pass `{ cellDates: true }` to json_to_sheet, then
 * call `applyDateCellFormat` on the resulting worksheet so those cells
 * also get a real display format instead of Excel's raw default.
 */
export function toExcelDate(value) {
  if (!value) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Sets a display format on every real date cell (XLSX marks these with
 * cell.t === "d") in a worksheet — json_to_sheet writes the underlying
 * date value correctly with `cellDates: true`, but doesn't set a
 * display format on its own, so cells would otherwise show as raw
 * serial numbers. `format` — "yyyy-mm-dd" for plain dates,
 * "yyyy-mm-dd hh:mm" for date+time columns.
 */
export function applyDateCellFormat(worksheet, format = "yyyy-mm-dd") {
  for (const cellRef of Object.keys(worksheet)) {
    if (cellRef.startsWith("!")) continue;
    const cell = worksheet[cellRef];
    if (cell?.t === "d") cell.z = format;
  }
}

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
