import { useEffect, useMemo, useState } from "react";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { getCategory } from "../../utils/graphUtils.js";

export function ConstructionItemSelect({ value, onChange }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    constructionItemsApi.list().then(setItems).catch(() => setItems([]));
  }, []);

  // Groups items under their category (same grouping the dependency graph
  // uses) so the dropdown reads like "Civil / Mechanical / ..." sections
  // instead of one flat 82-item list.
  const groups = useMemo(() => {
    const byCategory = new Map();
    items.forEach((item) => {
      const category = getCategory(item.TableItemID);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(item);
    });
    return [...byCategory.entries()];
  }, [items]);

  return (
    <label className="construction-item-select">
      Construction item
      <select
        value={value?.TableItemID ?? ""}
        onChange={(e) => {
          const selected = items.find((item) => item.TableItemID === e.target.value) ?? null;
          onChange(selected);
        }}
      >
        <option value="">— Select —</option>
        {groups.map(([category, categoryItems]) => (
          <optgroup key={category} label={category}>
            {categoryItems.map((item) => (
              <option key={item.TableItemID} value={item.TableItemID}>
                {item.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
