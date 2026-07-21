/**
 * FIRST-PASS ASSUMPTION about what a value looks like inside the wide
 * cost/date tables (plannedCostsTable, ActualCostsTable, Planned_dates,
 * Planned_dates_Finish) — confirmed shape is villaID-only partition key,
 * one wide item per villa. Costs turned out to be plain numbers; dates
 * turned out to be Excel serial date numbers (see excelSerialToISODate
 * below, confirmed against a real Planned_dates_Finish item). These
 * normalizers also accept a couple of alternate shapes (string dates,
 * nested {cost}/{date} objects) in case a table doesn't perfectly match.
 */
export function toCostNumber(raw) {
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
export function excelSerialToISODate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function toDateString(raw) {
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
