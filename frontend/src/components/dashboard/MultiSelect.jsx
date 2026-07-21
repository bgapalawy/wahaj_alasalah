import { useEffect, useRef, useState } from "react";

/**
 * Checkbox-dropdown multi-select: a trigger button showing a count chip,
 * a searchable panel of checkboxes. Replaces the native <select multiple>
 * (functional, but a five-row scrollbox reads as a legacy form control,
 * not a modern one) while keeping the same value/onChange contract.
 */
export function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(option) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }

  const triggerLabel =
    value.length === 0
      ? "All"
      : value.length <= 2
      ? value.join(", ")
      : `${value.length} selected`;

  return (
    <div className="multiselect" ref={rootRef}>
      <label className="portfolio-filter-field">
        {label}
        <button
          type="button"
          className={`multiselect-trigger ${value.length > 0 ? "has-selection" : ""}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{triggerLabel}</span>
          <span className="multiselect-caret">{open ? "▲" : "▼"}</span>
        </button>
      </label>

      {open && (
        <div className="multiselect-panel">
          {options.length > 6 && (
            <input
              type="text"
              className="multiselect-search"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          )}
          {filteredOptions.length === 0 && <div className="multiselect-empty">No matches</div>}
          {filteredOptions.map((option) => (
            <label key={option} className="multiselect-option">
              <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
