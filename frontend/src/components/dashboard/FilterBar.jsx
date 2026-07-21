import { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "./MultiSelect.jsx";

/**
 * Replaces the filter section from dashboardallproject.js: date range +
 * category/item/villa/block/stage multi-selects (item options cascade from
 * the selected categories, matching updateItemFilter()), Apply/Reset
 * buttons, active filter badges, and a selection-count summary.
 */
export function FilterBar({ records, minDate, maxDate, onApply }) {
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [villas, setVillas] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [stages, setStages] = useState([]);

  const allCategories = useMemo(
    () => [...new Set(records.map((r) => r.category))].filter(Boolean).sort(),
    [records]
  );
  const allVillas = useMemo(() => [...new Set(records.map((r) => r.villaID))].filter(Boolean).sort(), [records]);
  const allBlocks = useMemo(() => [...new Set(records.map((r) => r.blocknum))].filter(Boolean).sort(), [records]);
  const allStages = useMemo(() => [...new Set(records.map((r) => r.stage))].filter(Boolean).sort(), [records]);

  // Item options cascade from selected categories, mirroring updateItemFilter().
  const availableItems = useMemo(() => {
    const scoped = categories.length > 0 ? records.filter((r) => categories.includes(r.category)) : records;
    return [...new Set(scoped.map((r) => r.item))].filter(Boolean).sort();
  }, [records, categories]);

  // Drop any selected items that fell out of scope when categories changed.
  useEffect(() => {
    setItems((prev) => prev.filter((i) => availableItems.includes(i)));
  }, [availableItems]);

  function apply() {
    onApply({ startDate, endDate, categories, items, villas, blocks, stages });
  }

  function reset() {
    setStartDate(minDate);
    setEndDate(maxDate);
    setCategories([]);
    setItems([]);
    setVillas([]);
    setBlocks([]);
    setStages([]);
    onApply({ startDate: minDate, endDate: maxDate, categories: [], items: [], villas: [], blocks: [], stages: [] });
  }

  const badges = [
    categories.length > 0 && { label: `Categories: ${categories.join(", ")}`, className: "badge-success" },
    items.length > 0 && {
      label: items.length <= 2 ? `Items: ${items.join(", ")}` : `Items: ${items.slice(0, 2).join(", ")} +${items.length - 2} more`,
      className: "badge-info",
    },
    blocks.length > 0 && { label: `Blocks: ${blocks.join(", ")}`, className: "badge-warning" },
    stages.length > 0 && { label: `Stages: ${stages.join(", ")}`, className: "badge-danger" },
    villas.length > 0 && {
      label: villas.length <= 3 ? `Villas: ${villas.join(", ")}` : `Villas: ${villas.slice(0, 3).join(", ")} +${villas.length - 3} more`,
      className: "badge-primary",
    },
  ].filter(Boolean);

  return (
    <div className="portfolio-filter-bar">
      <div className="portfolio-filter-row">
        <label className="portfolio-filter-field">
          Date range
          <span className="portfolio-date-range">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </span>
        </label>
        <MultiSelect label="Categories" options={allCategories} value={categories} onChange={setCategories} />
        <MultiSelect label="Items" options={availableItems} value={items} onChange={setItems} />
        <MultiSelect label="Villas" options={allVillas} value={villas} onChange={setVillas} />
        <MultiSelect label="Blocks" options={allBlocks} value={blocks} onChange={setBlocks} />
        <MultiSelect label="Stages" options={allStages} value={stages} onChange={setStages} />
      </div>

      <div className="portfolio-filter-actions">
        <button type="button" onClick={apply} className="portfolio-apply-btn">
          Apply Filters
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
        <span className="portfolio-selection-count">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"}, {items.length} item
          {items.length === 1 ? "" : "s"}, {villas.length} villa{villas.length === 1 ? "" : "s"}, {blocks.length} block
          {blocks.length === 1 ? "" : "s"}, {stages.length} stage{stages.length === 1 ? "" : "s"} selected
        </span>
      </div>

      {badges.length > 0 && (
        <div className="portfolio-filter-badges">
          {badges.map((b) => (
            <span key={b.label} className={`portfolio-badge ${b.className}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
