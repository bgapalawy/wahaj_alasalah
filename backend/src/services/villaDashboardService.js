import { tables } from "../config/aws.js";
import { getVillaWideItem } from "./wideTableService.js";
import { getAllActivityStatuses } from "./activityStatusService.js";
import { constructionItems } from "../data/constructionItems.js";

/**
 * FIRST-PASS ASSUMPTION about what a value looks like inside these wide
 * tables — I don't have a confirmed example of a real item from
 * plannedCostsTable/ActualCostsTable/plannedDatesTable/plannedDatesFinishTable,
 * only confirmation that they share Actual_dates' key shape (villaID only,
 * no sort key). I'm assuming each TableItemID's value is either a plain
 * number (for costs) / plain date string (for dates), or an object with a
 * reasonably-named field — these normalizers try both so a real value in
 * either shape will work. If your real values look different, these two
 * functions are the only things that need to change.
 */
function toCostNumber(raw) {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object") {
    const value = raw.cost ?? raw.amount ?? raw.value ?? 0;
    return typeof value === "number" ? value : Number(value) || 0;
  }
  return Number(raw) || 0;
}

/**
 * Converts an Excel/Google Sheets serial date number (days since
 * 1899-12-30, with a fractional part for time-of-day — confirmed from a
 * real Planned_dates_Finish item: values like 45453.291666666) to an
 * ISO "YYYY-MM-DD" date string.
 */
function excelSerialToISODate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs).toISOString().slice(0, 10);
}

function toDateString(raw) {
  if (typeof raw === "number") return excelSerialToISODate(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Some rows may have the same Excel-serial number stored as a string.
    if (trimmed !== "" && /^[0-9.]+$/.test(trimmed)) return excelSerialToISODate(Number(trimmed));
    return trimmed || null;
  }
  if (raw && typeof raw === "object") {
    return raw.date ?? raw.plannedStartDate ?? raw.plannedFinishDate ?? null;
  }
  return null;
}

/**
 * Returns every construction item joined with this villa's planned/actual
 * cost and planned/actual dates — the raw material the villa dashboard
 * aggregates into charts on the frontend.
 */
export async function getVillaDashboardData(villaID) {
  const [plannedCosts, actualCosts, plannedStartDates, plannedFinishDates, actualStatuses] =
    await Promise.all([
      getVillaWideItem(tables.plannedCosts, villaID),
      getVillaWideItem(tables.actualCosts, villaID),
      getVillaWideItem(tables.plannedDates, villaID),
      getVillaWideItem(tables.plannedDatesFinish, villaID),
      getAllActivityStatuses(villaID),
    ]);

  return constructionItems.map((item) => {
    const id = item.TableItemID;
    const actual = actualStatuses[id] ?? {};
    return {
      TableItemID: id,
      name: item.name,
      plannedCost: toCostNumber(plannedCosts[id]),
      actualCost: toCostNumber(actualCosts[id]),
      plannedStartDate: toDateString(plannedStartDates[id]),
      plannedFinishDate: toDateString(plannedFinishDates[id]),
      actualStatus: actual.status ?? "NotStarted",
      actualCompletedDate: actual.completedDate ?? null,
    };
  });
}
