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

  const content = (
    <>
      <p className="file-status-hint">
        Pick an item to see its schedule status across every villa, with the root cause when Blocked and any notes
        logged against it.
      </p>

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
