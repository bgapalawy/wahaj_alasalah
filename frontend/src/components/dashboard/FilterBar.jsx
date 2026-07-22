import { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "./MultiSelect.jsx";

/**
 * Replaces the filter section from dashboardallproject.js: date range +
 * category/item/villa/block/zone/type multi-selects (item options
 * cascade from the selected categories, matching updateItemFilter()),
 * Apply/Reset buttons, active filter badges, and a selection-count
 * summary. Zone and Villa Type come from the same GeoJSON-sourced
 * metadata the map's filters use — records are expected to already carry
 * `zonenum`/`villatype` fields (see AllProjectsDashboard's enrichedRecords).
 *
 * No Stages filter — confirmed there's no "stage" concept in the real
 * project data (the field was always empty/unconfirmed).
 */
export function FilterBar({ records, minDate, maxDate, onApply }) {
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [villas, setVillas] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [zones, setZones] = useState([]);
  const [villaTypes, setVillaTypes] = useState([]);

  const allCategories = useMemo(
    () => [...new Set(records.map((r) => r.category))].filter(Boolean).sort(),
    [records]
  );
  const allZones = useMemo(() => [...new Set(records.map((r) => r.zonenum))].filter(Boolean).sort(), [records]);

  // Hierarchy: Zone > Block > Villa Type > Villa. Each level narrows the
  // options for the next, same as the map's "Color map by item" filters.
  const availableBlocks = useMemo(() => {
    const scoped = zones.length > 0 ? records.filter((r) => zones.includes(r.zonenum)) : records;
    return [...new Set(scoped.map((r) => r.blocknum))].filter(Boolean).sort();
  }, [records, zones]);

  const availableVillaTypes = useMemo(() => {
    let scoped = records;
    if (zones.length > 0) scoped = scoped.filter((r) => zones.includes(r.zonenum));
    if (blocks.length > 0) scoped = scoped.filter((r) => blocks.includes(r.blocknum));
    return [...new Set(scoped.map((r) => r.villatype))].filter(Boolean).sort();
  }, [records, zones, blocks]);

  const availableVillas = useMemo(() => {
    let scoped = records;
    if (zones.length > 0) scoped = scoped.filter((r) => zones.includes(r.zonenum));
    if (blocks.length > 0) scoped = scoped.filter((r) => blocks.includes(r.blocknum));
    if (villaTypes.length > 0) scoped = scoped.filter((r) => villaTypes.includes(r.villatype));
    return [...new Set(scoped.map((r) => r.villaID))].filter(Boolean).sort();
  }, [records, zones, blocks, villaTypes]);

  // Item options cascade from selected categories, mirroring updateItemFilter().
  const availableItems = useMemo(() => {
    const scoped = categories.length > 0 ? records.filter((r) => categories.includes(r.category)) : records;
    return [...new Set(scoped.map((r) => r.item))].filter(Boolean).sort();
  }, [records, categories]);

  // Drop any selections that fell out of scope when a parent filter changed.
  useEffect(() => {
    setItems((prev) => prev.filter((i) => availableItems.includes(i)));
  }, [availableItems]);
  useEffect(() => {
    setBlocks((prev) => prev.filter((b) => availableBlocks.includes(b)));
  }, [availableBlocks]);
  useEffect(() => {
    setVillaTypes((prev) => prev.filter((t) => availableVillaTypes.includes(t)));
  }, [availableVillaTypes]);
  useEffect(() => {
    setVillas((prev) => prev.filter((v) => availableVillas.includes(v)));
  }, [availableVillas]);

  function apply() {
    onApply({ startDate, endDate, categories, items, villas, blocks, zones, villaTypes });
  }

  function reset() {
    setStartDate(minDate);
    setEndDate(maxDate);
    setCategories([]);
    setItems([]);
    setVillas([]);
    setBlocks([]);
    setZones([]);
    setVillaTypes([]);
    onApply({
      startDate: minDate,
      endDate: maxDate,
      categories: [],
      items: [],
      villas: [],
      blocks: [],
      zones: [],
      villaTypes: [],
    });
  }

  const badges = [
    categories.length > 0 && { label: `Categories: ${categories.join(", ")}`, className: "badge-success" },
    items.length > 0 && {
      label: items.length <= 2 ? `Items: ${items.join(", ")}` : `Items: ${items.slice(0, 2).join(", ")} +${items.length - 2} more`,
      className: "badge-info",
    },
    blocks.length > 0 && { label: `Blocks: ${blocks.join(", ")}`, className: "badge-warning" },
    zones.length > 0 && { label: `Zones: ${zones.join(", ")}`, className: "badge-primary" },
    villaTypes.length > 0 && { label: `Types: ${villaTypes.join(", ")}`, className: "badge-info" },
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
        <MultiSelect label="Zones" options={allZones} value={zones} onChange={setZones} />
        <MultiSelect label="Blocks" options={availableBlocks} value={blocks} onChange={setBlocks} />
        <MultiSelect label="Villa Types" options={availableVillaTypes} value={villaTypes} onChange={setVillaTypes} />
        <MultiSelect label="Villas" options={availableVillas} value={villas} onChange={setVillas} />
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
          {items.length === 1 ? "" : "s"}, {zones.length} zone{zones.length === 1 ? "" : "s"}, {blocks.length} block
          {blocks.length === 1 ? "" : "s"}, {villaTypes.length} type{villaTypes.length === 1 ? "" : "s"}, {villas.length}{" "}
          villa{villas.length === 1 ? "" : "s"} selected
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
