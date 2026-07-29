import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { villasApi } from "../../api/villas.js";
import { dashboardApi } from "../../api/dashboard.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import { computeScheduleStatusFast } from "../../utils/scheduleUtils.js";
import {
  getZoneOptions,
  getBlockOptions,
  getVillaTypeOptions,
  getVillaOptions,
  matchesGeoFilters,
  matchesMultiSelect,
  getRootCauseBlockers,
} from "../../utils/qualityFilterUtils.js";
import { getVillaNumber, toExcelDate, applyDateCellFormat } from "../../utils/dashboardUtils.js";
import { StatusCountChart } from "./StatusCountChart.jsx";
import { MultiSelectFilter } from "./MultiSelectFilter.jsx";
import { ConstructionItemSelect } from "../panels/ConstructionItemSelect.jsx";

const today = () => new Date().toISOString().slice(0, 10);

// Fixed, not derived from findings — the overview status filter needs
// options that don't disappear from the dropdown once selected (which
// would happen if these were built from overviewFindings, since that's
// already filtered by this same control).
const SCHEDULE_STATUS_OPTIONS = [
  { value: "ready", label: "Ready" },
  { value: "blocked", label: "Blocked" },
  { value: "NotStarted", label: "NotStarted" },
  { value: "InProgress", label: "InProgress" },
  { value: "Completed", label: "Completed" },
];

/**
 * Pick a construction item, see its live schedule classification for
 * EVERY villa at once (same computeScheduleStatusFast classifier the
 * map's Schedule color mode and the other dashboards use), the actual
 * deep root-cause blocker(s) when Blocked (getRootCauseBlockers — the
 * same recursive predecessor-chain walk, findRootCauseBlockingActivities
 * in graphUtils.js, the dependency graph itself uses — not just an
 * item's immediate predecessors), and any dated notes logged for that
 * villa/item (ScheduleStatusPanel.jsx, in the villa panel). This is
 * "control of each status and notes of them" project-wide, scoped to
 * one item at a time rather than an exhaustive villa x item grid
 * (~1,500 x 82 — too much to be useful at once) — the same
 * one-item-at-a-time shape ConstructionItemDashboard's "By Item" tab
 * already uses for the same reason.
 *
 * `embedded`, when true, renders just the content (no modal backdrop/
 * header) — used by QualityDashboard.jsx.
 */
export function SchedulingReport({ onClose, embedded = false }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemRows, setItemRows] = useState([]);
  const [itemRowsStatus, setItemRowsStatus] = useState("idle"); // idle | loading | success | error
  const [allNotes, setAllNotes] = useState([]);
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const { data: allVillaStatuses } = useAllVillaStatuses(true);
  const { villaMetaByID } = useVillaGeoMeta();
  const [cutoffDate, setCutoffDate] = useState(today());

  const [villaFilters, setVillaFilters] = useState([]);
  const [zoneFilters, setZoneFilters] = useState([]);
  const [blockFilters, setBlockFilters] = useState([]);
  const [villaTypeFilters, setVillaTypeFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);

  // "All items" overview — every item's schedule status breakdown at
  // once, instead of picking one at a time. Not loaded automatically:
  // it's 82 parallel per-item API calls (same one this file already
  // makes for a single item, just for every item), which is real load
  // to put on the backend unprompted every time this tab opens.
  const [viewMode, setViewMode] = useState("single"); // single | overview
  const [overviewRows, setOverviewRows] = useState(null); // null = not loaded yet
  const [overviewStatus, setOverviewStatus] = useState("idle"); // idle | loading | error | success
  const [overviewStatusFilters, setOverviewStatusFilters] = useState([]);

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
    villasApi.getScheduleNotesReport().then(setAllNotes).catch(() => setAllNotes([]));
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setItemRows([]);
      return;
    }
    setItemRowsStatus("loading");
    dashboardApi
      .getConstructionItem(selectedItem.TableItemID)
      .then((rows) => {
        setItemRows(rows);
        setItemRowsStatus("success");
      })
      .catch(() => setItemRowsStatus("error"));
  }, [selectedItem]);

  const itemMaps = useMemo(() => {
    const itemById = new Map(constructionItemsTemplate.map((t) => [t.id, t]));
    const itemByTableId = new Map(constructionItemsTemplate.map((t) => [t.TableItemID, t]));
    return { itemById, itemByTableId };
  }, [constructionItemsTemplate]);

  // Fetches every item's per-villa planned-date data in parallel (82
  // calls, same dashboardApi.getConstructionItem the single-item view
  // above already uses one at a time) — only runs when explicitly
  // requested via the button below, not automatically on tab open.
  function loadOverview() {
    setOverviewStatus("loading");
    Promise.all(
      constructionItemsTemplate.map((item) =>
        dashboardApi
          .getConstructionItem(item.TableItemID)
          .then((rows) => ({ item, rows }))
          .catch(() => ({ item, rows: [] }))
      )
    )
      .then((perItem) => {
        setOverviewRows(perItem);
        setOverviewStatus("success");
      })
      .catch(() => setOverviewStatus("error"));
  }

  // One row per (item, villa) — filtered by the same zone/block/villa
  // type/villa selections as the single-item view, then rolled up into
  // a per-item status breakdown for display (a full 1,500 x 82 row
  // table would be unusable; this is the useful summary of it).
  const overviewFindings = useMemo(() => {
    if (!overviewRows || !allVillaStatuses) return [];
    const cutoff = new Date(`${cutoffDate}T00:00:00`);
    const results = [];
    overviewRows.forEach(({ item, rows }) => {
      const knownVillaIDs = new Set(rows.map((r) => r.villaID));
      const missing = Object.keys(villaMetaByID)
        .filter((id) => !knownVillaIDs.has(id))
        .map((villaID) => ({ villaID, plannedStartDate: null, actualStatus: "NotStarted" }));
      [...rows, ...missing].forEach((r) => {
        if (!matchesMultiSelect(r.villaID, villaFilters)) return;
        if (!matchesGeoFilters(r.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return;
        const scheduleStatus = computeScheduleStatusFast({
          targetTableItemId: item.TableItemID,
          targetActualStatus: r.actualStatus,
          targetPlannedStartDate: r.plannedStartDate,
          cutoffDate: cutoff,
          itemById: itemMaps.itemById,
          itemByTableId: itemMaps.itemByTableId,
          villaStatusMap: allVillaStatuses[r.villaID] ?? {},
        });
        if (!matchesMultiSelect(scheduleStatus, overviewStatusFilters)) return;
        // Only worth the recursive walk for rows that are actually
        // blocked — computing it for every Ready/NotStarted/Completed/
        // InProgress row too would be 82 x ~1,540 wasted calls.
        const blockingPredecessors =
          scheduleStatus === "blocked"
            ? getRootCauseBlockers(item, constructionItemsTemplate, allVillaStatuses[r.villaID] ?? {})
            : [];
        results.push({ item, villaID: r.villaID, scheduleStatus, blockingPredecessors });
      });
    });
    return results;
  }, [
    overviewRows,
    allVillaStatuses,
    villaMetaByID,
    villaFilters,
    zoneFilters,
    blockFilters,
    villaTypeFilters,
    overviewStatusFilters,
    cutoffDate,
    itemMaps,
    constructionItemsTemplate,
  ]);

  const overviewByItem = useMemo(() => {
    const map = new Map();
    overviewFindings.forEach((f) => {
      if (!map.has(f.item.TableItemID)) map.set(f.item.TableItemID, { item: f.item, counts: {}, blockers: new Map() });
      const entry = map.get(f.item.TableItemID);
      entry.counts[f.scheduleStatus] = (entry.counts[f.scheduleStatus] ?? 0) + 1;
      // Root-cause blockers, deduplicated per item and counted by how
      // many villas each one is actually the blocker for — "Civil-3
      // (NotStarted) — 12 villas" tells you far more than just a raw
      // blocked count does. Any schedule notes already logged against
      // that SAME blocker on that SAME villa (ScheduleStatusPanel.jsx,
      // per-villa) are pulled in too, tagged with which villa they're
      // from since one blocker can span many villas with different
      // notes each.
      f.blockingPredecessors.forEach((p) => {
        if (!entry.blockers.has(p.TableItemID)) {
          entry.blockers.set(p.TableItemID, { name: p.name, status: p.status, villaCount: 0, notes: [] });
        }
        const blockerEntry = entry.blockers.get(p.TableItemID);
        blockerEntry.villaCount += 1;
        allNotes
          .filter((n) => n.villaID === f.villaID && n.tableItemId === p.TableItemID)
          .forEach((n) => blockerEntry.notes.push({ villaID: f.villaID, noteDate: n.noteDate, note: n.note }));
      });
    });
    return [...map.values()];
  }, [overviewFindings, allNotes]);

  // Every real villa gets a row (not just the ones the backend has cost
  // data for), same "missing villa -> zero-cost/NotStarted placeholder"
  // fix ConstructionItemDashboard.jsx already applies for the same
  // underlying data source.
  const enrichedItemRows = useMemo(() => {
    const known = itemRows.map((r) => ({
      ...r,
      blocknum: villaMetaByID[r.villaID]?.blocknum ?? r.blocknum ?? null,
    }));
    const knownVillaIDs = new Set(itemRows.map((r) => r.villaID));
    const missing = Object.keys(villaMetaByID)
      .filter((id) => !knownVillaIDs.has(id))
      .map((villaID) => ({
        villaID,
        blocknum: villaMetaByID[villaID]?.blocknum ?? null,
        plannedStartDate: null,
        plannedFinishDate: null,
        actualStatus: "NotStarted",
      }));
    return [...known, ...missing];
  }, [itemRows, villaMetaByID]);

  const findings = useMemo(() => {
    if (!selectedItem || !allVillaStatuses || constructionItemsTemplate.length === 0) return [];
    const cutoff = new Date(`${cutoffDate}T00:00:00`);
    const targetItem = itemMaps.itemByTableId.get(selectedItem.TableItemID);
    return enrichedItemRows.map((r) => {
      const scheduleStatus = computeScheduleStatusFast({
        targetTableItemId: selectedItem.TableItemID,
        targetActualStatus: r.actualStatus,
        targetPlannedStartDate: r.plannedStartDate,
        cutoffDate: cutoff,
        itemById: itemMaps.itemById,
        itemByTableId: itemMaps.itemByTableId,
        villaStatusMap: allVillaStatuses[r.villaID] ?? {},
      });
      const blockingPredecessors = getRootCauseBlockers(
        targetItem,
        constructionItemsTemplate,
        allVillaStatuses[r.villaID] ?? {}
      ).map((p) => ({
        ...p,
        // Same villa's notes on the BLOCKER item itself — already have
        // every note project-wide loaded (allNotes), so this is a
        // filter, not a new fetch.
        notes: allNotes.filter((n) => n.villaID === r.villaID && n.tableItemId === p.TableItemID),
      }));
      const notes = allNotes.filter((n) => n.villaID === r.villaID && n.tableItemId === selectedItem.TableItemID);
      return { villaID: r.villaID, plannedStartDate: r.plannedStartDate, scheduleStatus, blockingPredecessors, notes };
    });
  }, [selectedItem, allVillaStatuses, constructionItemsTemplate, itemMaps, enrichedItemRows, cutoffDate, allNotes]);

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
    const seen = new Set(findings.map((f) => f.scheduleStatus).filter(Boolean));
    return [...seen].sort().map((s) => ({ value: s, label: s }));
  }, [findings]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (!matchesMultiSelect(f.villaID, villaFilters)) return false;
      if (!matchesGeoFilters(f.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return false;
      if (!matchesMultiSelect(f.scheduleStatus, statusFilters)) return false;
      return true;
    });
  }, [findings, villaFilters, zoneFilters, blockFilters, villaTypeFilters, statusFilters, villaMetaByID]);

  function handleExport() {
    const exportRows = filtered.map((f) => ({
      Villa: f.villaID,
      "Villa Number": getVillaNumber(f.villaID),
      Zone: villaMetaByID[f.villaID]?.zonenum ?? "",
      Block: villaMetaByID[f.villaID]?.blocknum ?? "",
      "Villa Type": villaMetaByID[f.villaID]?.villatype ?? "",
      "Schedule Status": f.scheduleStatus ?? "—",
      "Blocked By": f.blockingPredecessors
        .map((p) => `${p.name} (${p.status})${p.notes.length > 0 ? ` [blocker notes: ${p.notes.map((n) => `${n.noteDate}: ${n.note}`).join(" | ")}]` : ""}`)
        .join("; "),
      "Planned Start": toExcelDate(f.plannedStartDate),
      Notes: f.notes.map((n) => `${n.noteDate}: ${n.note}`).join(" | "),
    }));
    const sheet = XLSX.utils.json_to_sheet(exportRows, { cellDates: true });
    applyDateCellFormat(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Scheduling");
    XLSX.writeFile(wb, `scheduling_${selectedItem?.TableItemID ?? "report"}.xlsx`);
  }

  function handleExportOverview() {
    const statusesSeen = new Set();
    overviewByItem.forEach((e) => Object.keys(e.counts).forEach((s) => statusesSeen.add(s)));
    const statusCols = [...statusesSeen].sort();
    const exportRows = overviewByItem.map((e) => {
      const row = { Item: e.item.name, "Item ID": e.item.TableItemID };
      statusCols.forEach((s) => { row[s] = e.counts[s] ?? 0; });
      row.Total = Object.values(e.counts).reduce((a, b) => a + b, 0);
      row["Blocked By"] = [...e.blockers.values()]
        .map((b) => {
          const base = `${b.name} (${b.status}) — ${b.villaCount} villa${b.villaCount === 1 ? "" : "s"}`;
          const notesText = b.notes.map((n) => `${n.villaID} ${n.noteDate}: ${n.note}`).join(" | ");
          return notesText ? `${base} [notes: ${notesText}]` : base;
        })
        .join("; ");
      return row;
    });
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Scheduling Overview");
    XLSX.writeFile(wb, `scheduling_overview_${cutoffDate}.xlsx`);
  }

  const content = (
    <>
      <p className="file-status-hint">
        Pick an item to see its schedule status across every villa, with the root cause when Blocked and any notes
        logged against it — or switch to "All Items" for a project-wide breakdown of every item's schedule status
        at once, as of a chosen date.
      </p>

      <div className="status-tabs" style={{ marginBottom: "0.5rem" }}>
        <button type="button" className={viewMode === "single" ? "active" : ""} onClick={() => setViewMode("single")}>
          Single Item
        </button>
        <button type="button" className={viewMode === "overview" ? "active" : ""} onClick={() => setViewMode("overview")}>
          All Items
        </button>
      </div>

      {viewMode === "single" && (
        <>
          <ConstructionItemSelect value={selectedItem} onChange={setSelectedItem} />

      {!selectedItem && (
        <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
          Select a construction item above to see its schedule status grid.
        </p>
      )}

      {selectedItem && itemRowsStatus === "loading" && <p className="file-status-hint">Loading…</p>}
      {selectedItem && itemRowsStatus === "error" && <p className="upload-error">Couldn't load data for this item.</p>}

      {selectedItem && itemRowsStatus === "success" && (
        <>
          <div className="admin-actions" style={{ margin: "0.75rem 0 0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
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
            <MultiSelectFilter label="Status" options={statusOptions} selected={statusFilters} onChange={setStatusFilters} />
            <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              Status as of <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
            </label>
            <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              Export to Excel
            </button>
          </div>

          <StatusCountChart items={filtered} getLabel={(f) => f.scheduleStatus ?? "Unknown"} />

          <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
            {filtered.length} villa{filtered.length === 1 ? "" : "s"} — {selectedItem.name}.
          </p>

          <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Villa</th>
                  <th>Zone</th>
                  <th>Block</th>
                  <th>Schedule Status</th>
                  <th>Blocked By</th>
                  <th>Planned Start</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.villaID}>
                    <td>{f.villaID}</td>
                    <td>{villaMetaByID[f.villaID]?.zonenum ?? "—"}</td>
                    <td>{villaMetaByID[f.villaID]?.blocknum ?? "—"}</td>
                    <td>{f.scheduleStatus ?? "—"}</td>
                    <td>
                      {f.blockingPredecessors.length === 0
                        ? "—"
                        : f.blockingPredecessors.map((p) => (
                            <div key={p.TableItemID} style={{ marginBottom: "0.2rem" }}>
                              {p.name} (<strong>{p.status}</strong>)
                              {p.notes.length > 0 && (
                                <div style={{ marginLeft: "0.6rem" }}>
                                  {p.notes.map((n) => (
                                    <div key={n.id} className="file-status-hint">
                                      <span style={{ fontWeight: 600 }}>Blocker notes</span> — {n.noteDate}: {n.note}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                    </td>
                    <td>{f.plannedStartDate ?? "—"}</td>
                    <td>
                      {f.notes.length === 0
                        ? "—"
                        : f.notes.map((n) => (
                            <div key={n.id}>
                              <strong>{n.noteDate}:</strong> {n.note}
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="dashboard-table-empty">
                      No villas match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}

      {viewMode === "overview" && (
        <>
          <div className="admin-actions" style={{ margin: "0.75rem 0 0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
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
            <MultiSelectFilter label="Status" options={SCHEDULE_STATUS_OPTIONS} selected={overviewStatusFilters} onChange={setOverviewStatusFilters} />
            <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              Status as of <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
            </label>
            <button type="button" onClick={loadOverview} disabled={overviewStatus === "loading" || constructionItemsTemplate.length === 0}>
              {overviewStatus === "loading" ? "Loading…" : overviewRows ? "Reload" : "Load all items"}
            </button>
            {overviewByItem.length > 0 && (
              <button type="button" className="admin-btn-secondary" onClick={handleExportOverview}>
                Export to Excel
              </button>
            )}
          </div>

          {overviewStatus === "error" && <p className="upload-error">Couldn't load the overview — try again.</p>}
          {overviewStatus === "idle" && (
            <p className="file-status-hint">
              Click "Load all items" to fetch every item's schedule status across the filtered villas — this is 82
              requests at once, so it's on-demand rather than automatic.
            </p>
          )}

          {overviewByItem.length > 0 && (
            <>
              <StatusCountChart items={overviewFindings} getLabel={(f) => f.scheduleStatus ?? "Unknown"} />

              <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
                {overviewByItem.length} item{overviewByItem.length === 1 ? "" : "s"}, {overviewFindings.length} villa-item
                combinations as of {cutoffDate}.
              </p>

              <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Ready</th>
                      <th>Blocked</th>
                      <th>NotStarted</th>
                      <th>InProgress</th>
                      <th>Completed</th>
                      <th>Total</th>
                      <th>Blocked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewByItem.map((e) => {
                      const total = Object.values(e.counts).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={e.item.TableItemID}>
                          <td>
                            {e.item.name}
                            <br />
                            <span className="file-status-hint">{e.item.TableItemID}</span>
                          </td>
                          <td>{e.counts.ready ?? 0}</td>
                          <td>{e.counts.blocked ?? 0}</td>
                          <td>{e.counts.NotStarted ?? 0}</td>
                          <td>{e.counts.InProgress ?? 0}</td>
                          <td>{e.counts.Completed ?? 0}</td>
                          <td>{total}</td>
                          <td>
                            {e.blockers.size === 0
                              ? "—"
                              : [...e.blockers.values()].map((b) => (
                                  <div key={b.name} style={{ marginBottom: "0.3rem" }}>
                                    {b.name} (<strong>{b.status}</strong>) — {b.villaCount} villa{b.villaCount === 1 ? "" : "s"}
                                    {b.notes.length > 0 && (
                                      <div style={{ marginLeft: "0.6rem" }}>
                                        {b.notes.map((n, i) => (
                                          <div key={i} className="file-status-hint">
                                            <span style={{ fontWeight: 600 }}>{n.villaID}</span> — {n.noteDate}: {n.note}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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
          <h3>Scheduling</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
