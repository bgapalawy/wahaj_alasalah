import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { villasApi } from "../../api/villas.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import {
  getZoneOptions,
  getBlockOptions,
  getVillaTypeOptions,
  getVillaOptions,
  matchesGeoFilters,
  matchesMultiSelect,
  matchesDateRange,
  sortRows,
} from "../../utils/qualityFilterUtils.js";
import { getVillaNumber, toExcelDate, applyDateCellFormat } from "../../utils/dashboardUtils.js";
import { useTableSort } from "../../utils/useTableSort.js";
import { MultiSelectFilter } from "./MultiSelectFilter.jsx";
import { SortableTh } from "./SortableTh.jsx";

const ENTITY_LABELS = {
  activity_status: "Activity Status",
  ncr: "NCR",
  schedule_note: "Schedule Note",
  file: "File",
};

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * "field" carries different things per entity type — for file events
 * it's the upload slot label from buildSlotPrefix (e.g. "Notes1",
 * "Approval"), which is exactly "what status was this file uploaded
 * under" — the detail this column exists to surface. For other entity
 * types (status, note edits) it's already a plain field name like
 * "status" or "closed", shown as-is. "Notes1" -> "Notes (slot 1)";
 * "Approval" (no trailing digit) is left alone.
 */
function formatFieldLabel(field) {
  if (!field) return null;
  const match = /^([A-Za-z]+)(\d+)$/.exec(field);
  if (!match) return field;
  const [, name, slot] = match;
  return `${name} (slot ${slot})`;
}

/**
 * Every tracked change across the project — who changed what, when, and
 * (where applicable) from what to what. Reads from the generic
 * audit_log table (auditLogService.js), currently populated by activity
 * status changes, NCR add/close, schedule note additions, and file
 * uploads/deletes (upload.routes.js) — see migration_audit_log.sql for
 * why this is one shared table rather than stitching several history
 * sources together. Coverage is exactly what's wired in server-side; if
 * a mutation elsewhere in the app doesn't call recordAuditLog, it won't
 * show up here.
 *
 * `embedded`, when true, renders just the content (no modal backdrop/
 * header) — used by QualityDashboard.jsx.
 */
export function HistoryReport({ onClose, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const { villaMetaByID } = useVillaGeoMeta();

  const [villaFilters, setVillaFilters] = useState([]);
  const [zoneFilters, setZoneFilters] = useState([]);
  const [blockFilters, setBlockFilters] = useState([]);
  const [villaTypeFilters, setVillaTypeFilters] = useState([]);
  const [itemFilter, setItemFilter] = useState("");
  const [userFilters, setUserFilters] = useState([]);
  const [entityFilters, setEntityFilters] = useState([]);
  const [actionFilters, setActionFilters] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setStatus("loading");
    villasApi
      .getAuditLog()
      .then((data) => {
        setRows(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

  const itemsById = useMemo(
    () => new Map(constructionItemsTemplate.map((item) => [item.TableItemID, item])),
    [constructionItemsTemplate]
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
  const userOptions = useMemo(() => {
    const seen = new Set(rows.map((r) => r.changedBy).filter(Boolean));
    return [...seen].sort().map((u) => ({ value: u, label: u }));
  }, [rows]);
  const entityOptions = useMemo(() => {
    const seen = new Set(rows.map((r) => r.entityType).filter(Boolean));
    return [...seen].sort().map((e) => ({ value: e, label: ENTITY_LABELS[e] ?? e }));
  }, [rows]);
  const actionOptions = useMemo(() => {
    const seen = new Set(rows.map((r) => r.action).filter(Boolean));
    return [...seen].sort().map((a) => ({ value: a, label: a }));
  }, [rows]);

  const findings = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        item: r.tableItemId ? itemsById.get(r.tableItemId) ?? { TableItemID: r.tableItemId, name: r.tableItemId } : null,
        dateOnly: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : null,
      })),
    [rows, itemsById]
  );

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (f.villaID) {
        if (!matchesMultiSelect(f.villaID, villaFilters)) return false;
        if (!matchesGeoFilters(f.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return false;
      } else if (villaFilters.length > 0 || zoneFilters.length > 0 || blockFilters.length > 0 || villaTypeFilters.length > 0) {
        return false; // a villa-scoped filter is active but this entry has no villa
      }
      if (itemFilter && f.tableItemId !== itemFilter) return false;
      if (!matchesMultiSelect(f.changedBy, userFilters)) return false;
      if (!matchesMultiSelect(f.entityType, entityFilters)) return false;
      if (!matchesMultiSelect(f.action, actionFilters)) return false;
      if (!matchesDateRange(f.dateOnly, dateFrom, dateTo)) return false;
      return true;
    });
  }, [
    findings,
    villaFilters,
    zoneFilters,
    blockFilters,
    villaTypeFilters,
    itemFilter,
    userFilters,
    entityFilters,
    actionFilters,
    dateFrom,
    dateTo,
    villaMetaByID,
  ]);

  const { sortKey, sortDir, toggleSort } = useTableSort("dateTime", "desc");
  const sortedFiltered = useMemo(() => {
    return sortRows(filtered, sortKey, sortDir, (f, key) => {
      switch (key) {
        case "dateTime": return f.createdAt;
        case "user": return f.changedBy;
        case "villa": return f.villaID;
        case "item": return f.item?.name ?? null;
        case "entity": return ENTITY_LABELS[f.entityType] ?? f.entityType;
        case "details": return formatFieldLabel(f.field);
        case "action": return f.action;
        case "value": return f.newValue ?? f.oldValue;
        default: return null;
      }
    });
  }, [filtered, sortKey, sortDir]);

  function handleExport() {
    const exportRows = filtered.map((f) => ({
      "Date/Time": toExcelDate(f.createdAt),
      User: f.changedBy ?? "",
      Villa: f.villaID ?? "",
      "Villa Number": f.villaID ? getVillaNumber(f.villaID) : "",
      Zone: f.villaID ? villaMetaByID[f.villaID]?.zonenum ?? "" : "",
      Block: f.villaID ? villaMetaByID[f.villaID]?.blocknum ?? "" : "",
      "Villa Type": f.villaID ? villaMetaByID[f.villaID]?.villatype ?? "" : "",
      Item: f.item?.name ?? "",
      "Item ID": f.tableItemId ?? "",
      Entity: ENTITY_LABELS[f.entityType] ?? f.entityType,
      Action: f.action,
      Details: formatFieldLabel(f.field) ?? "",
      "Old Value": f.oldValue ?? "",
      "New Value": f.newValue ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(exportRows, { cellDates: true });
    applyDateCellFormat(sheet, "yyyy-mm-dd hh:mm");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "History");
    XLSX.writeFile(wb, "history_report.xlsx");
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  const content = (
    <>
      <p className="file-status-hint">
        Every tracked change across the project — who changed what, when. Coverage: activity status changes, NCR
        add/close, schedule notes, and file uploads/deletes so far.
      </p>

      {status === "error" && <p className="upload-error">Couldn't load the history log.</p>}

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
            <MultiSelectFilter label="Villas" options={villaOptions} selected={villaFilters} onChange={setVillaFilters} />
            <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="">All items</option>
              {constructionItemsTemplate.map((item) => (
                <option key={item.TableItemID} value={item.TableItemID}>{item.name}</option>
              ))}
            </select>
            <MultiSelectFilter label="Users" options={userOptions} selected={userFilters} onChange={setUserFilters} />
            <MultiSelectFilter label="Entity" options={entityOptions} selected={entityFilters} onChange={setEntityFilters} />
            <MultiSelectFilter label="Action" options={actionOptions} selected={actionFilters} onChange={setActionFilters} />
            <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              Export to Excel
            </button>
          </div>

          <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} found
            {rows.length >= 5000 ? " (capped at the most recent 5,000 — narrow the filters for older entries)" : ""}.
          </p>

          {filtered.length === 0 ? (
            <p className="file-status-hint">No history entries match the current filters.</p>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <SortableTh column="dateTime" label="Date/Time" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="user" label="User" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="villa" label="Villa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="item" label="Item" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="entity" label="Entity" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="details" label="Details" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="action" label="Action" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="value" label="Old → New" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((f) => (
                    <tr key={f.id}>
                      <td>{formatDateTime(f.createdAt)}</td>
                      <td>{f.changedBy ?? "—"}</td>
                      <td>{f.villaID ?? "—"}</td>
                      <td>
                        {f.item ? (
                          <>
                            {f.item.name}
                            <br />
                            <span className="file-status-hint">{f.item.TableItemID}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{ENTITY_LABELS[f.entityType] ?? f.entityType}</td>
                      <td>{formatFieldLabel(f.field) ?? "—"}</td>
                      <td>{f.action}</td>
                      <td>
                        {f.oldValue != null && <span className="file-status-hint">{f.oldValue} → </span>}
                        {f.newValue ?? "—"}
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
          <h3>History</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
