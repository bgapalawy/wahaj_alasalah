import { useEffect, useRef, useState } from "react";

/**
 * A checkbox-list dropdown for multi-selecting filter values (zone,
 * block, villa, status) — shared by every Quality dashboard tab so
 * "select several zones at once" works the same way everywhere instead
 * of five separate implementations. Closes on any outside click.
 *
 * `options` — [{ value, label }]. `selected` — array of selected
 * values ([] = nothing selected = "all", matching every quality filter
 * util's own "[] means no filter" convention). `searchable` (default
 * true — every filter gets a search box now, not just the long ones
 * like Villas) adds a text box to narrow the option list; "Select all"
 * selects everything currently matching that search, not the full
 * unfiltered list, so "search then select all" works as a real
 * shortcut for "all of these."
 */
export function MultiSelectFilter({ label, options, selected, onChange, searchable = true }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const visibleOptions =
    searchable && search.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
      : options;

  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function selectAllVisible() {
    const visibleValues = visibleOptions.map((o) => o.value);
    onChange([...new Set([...selected, ...visibleValues])]);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "0.5rem 0.65rem",
          borderRadius: "6px",
          border: "1px solid var(--color-border-strong)",
          backgroundColor: selected.length > 0 ? "#eff6ff" : "#fff",
          color: "#1f2937",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {selected.length > 0 ? ` (${selected.length})` : ""} ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            backgroundColor: "#fff",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "8px",
            padding: "0.5rem",
            minWidth: "220px",
            maxHeight: "300px",
            overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}
        >
          {searchable && (
            <input
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.35rem", marginBottom: "0.4rem", borderRadius: "6px", border: "1px solid #d1d5db", color: "#1f2937" }}
            />
          )}
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.3rem" }}>
            {visibleOptions.length > 0 && (
              <button
                type="button"
                onClick={selectAllVisible}
                style={{ fontSize: "0.8em", color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Select all{search.trim() ? " (matching)" : ""}
              </button>
            )}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                style={{ fontSize: "0.8em", color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>
          {visibleOptions.length === 0 && (
            <p style={{ fontSize: "0.85em", color: "#6b7280", margin: 0 }}>No matches.</p>
          )}
          {visibleOptions.map((o) => (
            <label
              key={o.value}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.15rem 0", fontSize: "0.9em", color: "#1f2937", cursor: "pointer" }}
            >
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
