/**
 * Evaluates a list of custom query conditions against every real villa,
 * returning the Set of matching villaIDs. Conditions are combined
 * left-to-right using each condition's own `conjunction` ("AND"/"OR",
 * ignored on the first condition) — no parentheses/precedence, matching
 * the simplest common query-builder UX (same left-to-right model as most
 * spreadsheet/BI tool "add condition" filters).
 *
 * Condition shapes:
 *   { type: "itemStatus", statusSource: "actual" | "invoice",
 *     tableItemId, operator: "=" | "!=", value }
 *   { type: "villaAttribute", field: "zonenum"|"blocknum"|"villatype"|"villaID",
 *     operator: "=" | "!=", value }
 *   { type: "specialQuery", column, operator: "=" | "!=", value }
 *     — reads from the shams_elgroub_special_query table (the original app's
 *     actual custom-query data source), column chosen from whatever
 *     that table actually contains, not a fixed field list.
 *
 * `context`:
 *   villaMetaByID        — {villaID: {zonenum, blocknum, villatype}} (from GeoJSON)
 *   allVillaStatuses     — {villaID: {TableItemID: actualStatus}}
 *   allVillaInvoiceStatuses — {villaID: {TableItemID: invoiceStatus}}
 *   specialQueryByVilla  — {villaID: {column: value, ...}}
 */
export function evaluateCustomQuery(conditions, context) {
  const { villaMetaByID, allVillaStatuses, allVillaInvoiceStatuses, specialQueryByVilla } = context;
  const villaIDs = Object.keys(villaMetaByID);
  if (!conditions || conditions.length === 0) return null; // no query active

  function evaluateCondition(condition, villaID) {
    if (condition.type === "itemStatus") {
      const source = condition.statusSource === "invoice" ? allVillaInvoiceStatuses : allVillaStatuses;
      const actual = source?.[villaID]?.[condition.tableItemId] ?? "NotStarted";
      return condition.operator === "!=" ? actual !== condition.value : actual === condition.value;
    }
    if (condition.type === "villaAttribute") {
      const meta = villaMetaByID[villaID] ?? {};
      const actual = condition.field === "villaID" ? villaID : meta[condition.field] ?? null;
      return condition.operator === "!=" ? actual !== condition.value : actual === condition.value;
    }
    if (condition.type === "specialQuery") {
      const row = specialQueryByVilla?.[villaID] ?? {};
      const actual = row[condition.column] ?? null;
      // Values from DynamoDB can come back as numbers where the UI's
      // <select> always yields strings — compare loosely on string form
      // so "5" (from the picker) still matches a stored 5.
      const matches = String(actual ?? "") === String(condition.value ?? "");
      return condition.operator === "!=" ? !matches : matches;
    }
    return false;
  }

  const matching = new Set();
  villaIDs.forEach((villaID) => {
    let result = evaluateCondition(conditions[0], villaID);
    for (let i = 1; i < conditions.length; i++) {
      const cond = conditions[i];
      const condResult = evaluateCondition(cond, villaID);
      result = cond.conjunction === "OR" ? result || condResult : result && condResult;
    }
    if (result) matching.add(villaID);
  });
  return matching;
}
