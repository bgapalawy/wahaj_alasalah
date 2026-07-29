/**
 * A clickable <th> showing a ▲/▼ arrow when it's the active sort
 * column — shared by every Quality dashboard table. `column` is the
 * key sortRows will match against; `label` is what's shown.
 */
export function SortableTh({ column, label, sortKey, sortDir, onSort }) {
  return (
    <th
      onClick={() => onSort(column)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      title={`Sort by ${label}`}
    >
      {label} {sortKey === column ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}
