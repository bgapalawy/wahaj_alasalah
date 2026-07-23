import { useEffect, useMemo, useState } from "react";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { getCategory } from "../../utils/graphUtils.js";
import { ITEM_STATUS_ORDER } from "../../config/itemStatusColors.js";
import { INVOICE_STATUS_ORDER } from "../../config/scheduleInvoiceColors.js";

const VILLA_ATTRIBUTE_FIELDS = [
  { value: "zonenum", label: "Zone" },
  { value: "blocknum", label: "Block" },
  { value: "villatype", label: "Villa Type" },
  { value: "villaID", label: "Villa" },
];

function makeCondition() {
  return {
    id: Math.random().toString(36).slice(2),
    conjunction: "AND",
    type: "specialQuery",
    column: "",
    tableItemId: "",
    statusSource: "actual",
    field: "zonenum",
    operator: "=",
    value: "",
  };
}

/**
 * Builds arbitrary AND/OR filter conditions across item status (actual
 * or invoice) and villa attributes (Zone/Block/Villa Type/Villa) —
 * e.g. "Civil-1 = Completed AND Block = 5". Shared between the map's
 * "Color map by item" control and the Project Dashboard's FilterBar;
 * evaluated by utils/customQueryUtils.evaluateCustomQuery.
 */
export function CustomQueryBuilder({ conditions, onChange, villaMetaByID, specialQueryColumns = [], specialQueryValuesByColumn = {} }) {
  const [constructionItems, setConstructionItems] = useState([]);

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItems).catch(() => setConstructionItems([]));
  }, []);

  const itemGroups = useMemo(() => {
    const byCategory = new Map();
    constructionItems.forEach((item) => {
      const category = getCategory(item.TableItemID);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(item);
    });
    return [...byCategory.entries()];
  }, [constructionItems]);

  const attributeOptions = useMemo(() => {
    const options = {};
    VILLA_ATTRIBUTE_FIELDS.forEach(({ value: field }) => {
      if (field === "villaID") {
        options[field] = Object.keys(villaMetaByID).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      } else {
        options[field] = [...new Set(Object.values(villaMetaByID).map((m) => m[field]))].filter(Boolean).sort();
      }
    });
    return options;
  }, [villaMetaByID]);

  function updateCondition(id, patch) {
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addCondition() {
    onChange([...conditions, makeCondition()]);
  }

  function removeCondition(id) {
    onChange(conditions.filter((c) => c.id !== id));
  }

  return (
    <div className="custom-query-builder">
      {conditions.map((cond, i) => (
        <div key={cond.id} className="custom-query-row">
          {i > 0 && (
            <select
              className="custom-query-conjunction"
              value={cond.conjunction}
              onChange={(e) => updateCondition(cond.id, { conjunction: e.target.value })}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          )}

          <select
            value={cond.type}
            onChange={(e) =>
              updateCondition(cond.id, {
                type: e.target.value,
                value: "",
              })
            }
          >
            <option value="specialQuery">Special query column</option>
            <option value="itemStatus">Item status</option>
            <option value="villaAttribute">Villa attribute</option>
          </select>

          {cond.type === "itemStatus" && (
            <>
              <select value={cond.tableItemId} onChange={(e) => updateCondition(cond.id, { tableItemId: e.target.value })}>
                <option value="">— item —</option>
                {itemGroups.map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((item) => (
                      <option key={item.TableItemID} value={item.TableItemID}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select value={cond.statusSource} onChange={(e) => updateCondition(cond.id, { statusSource: e.target.value, value: "" })}>
                <option value="actual">Status</option>
                <option value="invoice">Invoice</option>
              </select>
              <select value={cond.operator} onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}>
                <option value="=">=</option>
                <option value="!=">≠</option>
              </select>
              <select value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })}>
                <option value="">— value —</option>
                {(cond.statusSource === "invoice" ? INVOICE_STATUS_ORDER : ITEM_STATUS_ORDER).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          )}

          {cond.type === "specialQuery" && (
            <>
              <select value={cond.column} onChange={(e) => updateCondition(cond.id, { column: e.target.value, value: "" })}>
                <option value="">— column —</option>
                {specialQueryColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <select value={cond.operator} onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}>
                <option value="=">=</option>
                <option value="!=">≠</option>
              </select>
              <select value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })} disabled={!cond.column}>
                <option value="">— value —</option>
                {(specialQueryValuesByColumn[cond.column] ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </>
          )}

          {cond.type === "villaAttribute" && (
            <>
              <select value={cond.field} onChange={(e) => updateCondition(cond.id, { field: e.target.value, value: "" })}>
                {VILLA_ATTRIBUTE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select value={cond.operator} onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}>
                <option value="=">=</option>
                <option value="!=">≠</option>
              </select>
              <select value={cond.value} onChange={(e) => updateCondition(cond.id, { value: e.target.value })}>
                <option value="">— value —</option>
                {(attributeOptions[cond.field] ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </>
          )}

          <button type="button" className="custom-query-remove" onClick={() => removeCondition(cond.id)} aria-label="Remove condition">
            ×
          </button>
        </div>
      ))}

      <button type="button" className="custom-query-add" onClick={addCondition}>
        + Add condition
      </button>
    </div>
  );
}
