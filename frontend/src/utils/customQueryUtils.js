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
 *     tableItemId, operator: "=" | "!=", value: string[] }
 *   { type: "villaAttribute", field: "zonenum"|"blocknum"|"villatype"|"villaID",
 *     operator: "=" | "!=", value: string[] }
 *   { type: "specialQuery", column, operator: "=" | "!=", value: string[] }
 *     — reads from the shams_elgroub_special_query table (the original app's
 *     actual custom-query data source), column chosen from whatever
 *     that table actually contains, not a fixed field list.
 *
 * `value` is now an array of one or more selected options (multi-select) —
 * "=" matches when the actual value is ANY of the selected options
 * ("Civil-1 is Completed OR NCR"), "!=" matches when it is NONE of them.
 * An empty selection means "no filter chosen yet": "=" then matches
 * nothing and "!=" matches everything, same as the old empty-string
 * single-select behaved.
 *
 * `toArray` keeps this backward-compatible with any previously-saved
 * conditions that still store `value` as a plain string.
 *
 * `context`:
 *   villaMetaByID        — {villaID: {zonenum, blocknum, villatype}} (from GeoJSON)
 *   allVillaStatuses     — {villaID: {TableItemID: actualStatus}}
 *   allVillaInvoiceStatuses — {villaID: {TableItemID: invoiceStatus}}
 *   specialQueryByVilla  — {villaID: {column: value, ...}}
 */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

export function evaluateCustomQuery(conditions, context) {
  const { villaMetaByID, allVillaStatuses, allVillaInvoiceStatuses, specialQueryByVilla } = context;
  const villaIDs = Object.keys(villaMetaByID);
  if (!conditions || conditions.length === 0) return null; // no query active

  function evaluateCondition(condition, villaID) {
    const selected = toArray(condition.value);

    if (condition.type === "itemStatus") {
      const source = condition.statusSource === "invoice" ? allVillaInvoiceStatuses : allVillaStatuses;
      const actual = source?.[villaID]?.[condition.tableItemId] ?? "NotStarted";
      const matches = selected.includes(actual);
      return condition.operator === "!=" ? !matches : matches;
    }
    if (condition.type === "villaAttribute") {
      const meta = villaMetaByID[villaID] ?? {};
      const actual = condition.field === "villaID" ? villaID : meta[condition.field] ?? null;
      const matches = selected.includes(actual);
      return condition.operator === "!=" ? !matches : matches;
    }
    if (condition.type === "specialQuery") {
      const row = specialQueryByVilla?.[villaID] ?? {};
      const actual = row[condition.column] ?? null;
      // Values from DynamoDB can come back as numbers where the UI's
      // picker always yields strings — compare loosely on string form
      // so "5" (from the picker) still matches a stored 5.
      const selectedStrings = selected.map((v) => String(v));
      const matches = selectedStrings.includes(String(actual ?? ""));
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

const VILLA_ATTRIBUTE_LABELS = { zonenum: "Zone", blocknum: "Block", villatype: "Villa Type", villaID: "Villa" };

/**
 * Human-readable, one-line-per-condition summary of a custom query — for
 * display anywhere the CustomQueryBuilder UI itself isn't available (e.g.
 * the printed PDF layout sheet's "Active Filters" box). Each line already
 * carries its own leading "AND"/"OR" conjunction (condition after the
 * first), matching the same left-to-right model evaluateCustomQuery uses.
 *
 * `constructionItemsById` — Map<TableItemID, item> (build from
 * constructionItemsApi.list() results) — used to resolve an itemStatus
 * condition's tableItemId into its readable name instead of the raw
 * TableItemID. Falls back to the raw id if the map/item isn't available.
 */
export function describeCustomQueryConditions(conditions, { constructionItemsById } = {}) {
  if (!conditions || conditions.length === 0) return [];
  return conditions.map((cond, i) => {
    const prefix = i === 0 ? "" : `${cond.conjunction ?? "AND"} `;
    const opWord = cond.operator === "!=" ? "is none of" : "is any of";
    const values = toArray(cond.value);
    const valueText = values.length > 0 ? values.join(", ") : "(none selected)";

    if (cond.type === "itemStatus") {
      const item = constructionItemsById?.get(cond.tableItemId);
      const itemLabel = item?.name ?? cond.tableItemId ?? "(item)";
      const sourceLabel = cond.statusSource === "invoice" ? "Invoice" : "Status";
      return `${prefix}${itemLabel} ${sourceLabel} ${opWord}: ${valueText}`;
    }
    if (cond.type === "villaAttribute") {
      return `${prefix}${VILLA_ATTRIBUTE_LABELS[cond.field] ?? cond.field} ${opWord}: ${valueText}`;
    }
    if (cond.type === "specialQuery") {
      return `${prefix}${cond.column || "(column)"} ${opWord}: ${valueText}`;
    }
    return `${prefix}(unknown condition)`;
  });
}
