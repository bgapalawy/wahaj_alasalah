import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { findOutOfSequenceItems } from "../../utils/outOfSequenceUtils.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import { getZoneOptions, getBlockOptions, getVillaTypeOptions, getVillaOptions, matchesGeoFilters, matchesMultiSelect, sortRows } from "../../utils/qualityFilterUtils.js";
import { getVillaNumber } from "../../utils/dashboardUtils.js";
import { useTableSort } from "../../utils/useTableSort.js";
import { StatusCountChart } from "./StatusCountChart.jsx";
import { MultiSelectFilter } from "./MultiSelectFilter.jsx";
import { SortableTh } from "./SortableTh.jsx";

/**
 * Surfaces every (villa, item) where an item is marked Completed while
 * at least one of its OWN predecessors isn't — a real scheduling
 * anomaly, distinct from the existing "blocked" status (which only ever
 * applies to NotStarted items waiting their turn, see scheduleUtils.js).
 *
 * Data-wise this rides on useAllVillaStatuses, the same hook already
 * used by Schedule coloring mode — no new backend endpoint needed for
 * something this cheap to compute once the data's in memory client-side.
 *
 * `embedded`, when true, renders just the content (no modal backdrop/
 * header) — used by QualityDashboard.jsx, which supplies its own single
 * shared modal shell around all three Quality tabs.
 */
export function OutOfSequenceReport({ onClose, embedded = false }) {
  const { data: allVillaStatuses, status } = useAllVillaStatuses(true);
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const { villaMetaByID } = useVillaGeoMeta();

  const [villaFilters, setVillaFilters] = useState([]);
  const [zoneFilters, setZoneFilters] = useState([]);
  const [blockFilters, setBlockFilters] = useState([]);
  const [villaTypeFilters, setVillaTypeFilters] = useState([]);
  const [itemFilter, setItemFilter] = useState("");
  // "Status" here filters by the STATUS OF THE INCOMPLETE PREDECESSOR(S)
  // causing the anomaly (e.g. "only show rows blocked by an NCR
  // predecessor") — there's no single top-level status on an
  // out-of-sequence finding itself (the completed item is always just
  // "Completed"), so this is the meaningful equivalent here.
  const [statusFilters, setStatusFilters] = useState([]);

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

  const findings = useMemo(
    () => findOutOfSequenceItems(allVillaStatuses, constructionItemsTemplate),
    [allVillaStatuses, constructionItemsTemplate]
  );

  const zoneOptions = useMemo(() => getZoneOptions(villaMetaByID).map((z) => ({ value: z, label: `Zone ${z}` })), [villaMetaByID]);
  const blockOptions = useMemo(
    () => getBlockOptions(villaMetaByID, zoneFilters).map((b) => ({ value: b, label: `Block ${b}` })),
    [villaMetaByID, zoneFilters]
  );
  const villaTypeOptions = useMemo(
    () => getVillaTypeOptions(villaMetaByID, zoneFilters, blockFilters).map((t) => ({ value: t, label: t })),
    [villaMetaByID, zoneFilters, blockFilters]
  );
  const villaOptions = useMemo(
    () => getVillaOptions(villaMetaByID, zoneFilters, blockFilters, villaTypeFilters).map((v) => ({ value: v, label: v })),
    [villaMetaByID, zoneFilters, blockFilters, villaTypeFilters]
  );
  const statusOptions = useMemo(() => {
    const seen = new Set();
    findings.forEach((f) => f.incompletePredecessors.forEach((p) => seen.add(p.status)));
    return [...seen].sort().map((s) => ({ value: s, label: s }));
  }, [findings]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (!matchesMultiSelect(f.villaID, villaFilters)) return false;
      if (!matchesGeoFilters(f.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return false;
      if (itemFilter && f.item.TableItemID !== itemFilter) return false;
      if (statusFilters.length > 0 && !f.incompletePredecessors.some((p) => statusFilters.includes(p.status))) return false;
      return true;
    });
  }, [findings, villaFilters, zoneFilters, blockFilters, villaTypeFilters, itemFilter, statusFilters, villaMetaByID]);

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedFiltered = useMemo(() => {
    return sortRows(filtered, sortKey, sortDir, (f, key) => {
      switch (key) {
        case "villa": return f.villaID;
        case "zone": return villaMetaByID[f.villaID]?.zonenum ?? null;
        case "block": return villaMetaByID[f.villaID]?.blocknum ?? null;
        case "completedItem": return f.item.name;
        case "predecessors":
          return f.incompletePredecessors.map((p) => p.name).join(", ");
        default: return null;
      }
    });
  }, [filtered, sortKey, sortDir, villaMetaByID]);

  function handleExport() {
    const rows = filtered.map((f) => ({
      Villa: f.villaID,
      "Villa Number": getVillaNumber(f.villaID),
      Zone: villaMetaByID[f.villaID]?.zonenum ?? "",
      Block: villaMetaByID[f.villaID]?.blocknum ?? "",
      "Villa Type": villaMetaByID[f.villaID]?.villatype ?? "",
      "Completed Item": f.item.name,
      "Completed Item ID": f.item.TableItemID,
      "Incomplete Predecessor(s)": f.incompletePredecessors.map((p) => `${p.name} (${p.status})`).join("; "),
      "Incomplete Predecessor Count": f.incompletePredecessors.length,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Out of Sequence");
    XLSX.writeFile(wb, "out_of_sequence_report.xlsx");
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  const content = (
    <>
      <p className="file-status-hint">
        Items marked Completed while at least one of their own predecessors isn't — a real scheduling
        anomaly, not the same thing as a "blocked" (not-yet-started) item.
      </p>

      {isLoading ? (
        <p className="file-status-hint">Loading…</p>
      ) : (
        <>
          <div className="admin-actions" style={{ marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <MultiSelectFilter
              label="Zones"
              options={zoneOptions}
              selected={zoneFilters}
              onChange={(next) => {
                setZoneFilters(next);
                setBlockFilters([]);
                setVillaTypeFilters([]);
              }}
            />
            <MultiSelectFilter
              label="Blocks"
              options={blockOptions}
              selected={blockFilters}
              onChange={(next) => {
                setBlockFilters(next);
                setVillaTypeFilters([]);
              }}
            />
            <MultiSelectFilter label="Villa Types" options={villaTypeOptions} selected={villaTypeFilters} onChange={setVillaTypeFilters} />
            <MultiSelectFilter label="Villas" options={villaOptions} selected={villaFilters} onChange={setVillaFilters} searchable />
            <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="">All items</option>
              {constructionItemsTemplate.map((item) => (
                <option key={item.TableItemID} value={item.TableItemID}>{item.name}</option>
              ))}
            </select>
            <MultiSelectFilter
              label="Predecessor status"
              options={statusOptions}
              selected={statusFilters}
              onChange={setStatusFilters}
            />
            <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              Export to Excel
            </button>
          </div>

          <StatusCountChart items={filtered} getLabel={(f) => f.item.name} />

          <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
            {filtered.length} out-of-sequence item{filtered.length === 1 ? "" : "s"} found.
          </p>

          {filtered.length === 0 ? (
            <p className="file-status-hint">No out-of-sequence items match the current filters.</p>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <SortableTh column="villa" label="Villa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="zone" label="Zone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="block" label="Block" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="completedItem" label="Completed Item" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="predecessors" label="Incomplete Predecessor(s)" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((f) => (
                    <tr key={`${f.villaID}-${f.item.TableItemID}`}>
                      <td>{f.villaID}</td>
                      <td>{villaMetaByID[f.villaID]?.zonenum ?? "—"}</td>
                      <td>{villaMetaByID[f.villaID]?.blocknum ?? "—"}</td>
                      <td>
                        {f.item.name}
                        <br />
                        <span className="file-status-hint">{f.item.TableItemID}</span>
                      </td>
                      <td>
                        {f.incompletePredecessors.map((pred) => (
                          <div key={pred.TableItemID}>
                            {pred.name} — <strong>{pred.status}</strong>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graph-modal-header">
          <h3>Out of Sequence</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
