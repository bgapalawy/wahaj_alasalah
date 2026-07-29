import { useState } from "react";

/**
 * Sort state (which column, which direction) for one table — shared by
 * every Quality dashboard report so clicking a column header behaves
 * the same way everywhere. Pairs with sortRows (qualityFilterUtils.js)
 * for the actual sorting and SortableTh.jsx for the clickable header
 * cells.
 */
export function useTableSort(initialKey = null, initialDir = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sortKey, sortDir, toggleSort };
}
