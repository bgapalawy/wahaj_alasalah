import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { villasApi } from "../../api/villas.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import { getZoneOptions, getBlockOptions, getVillaTypeOptions, getVillaOptions, matchesGeoFilters, matchesMultiSelect, matchesDateRange, sortRows } from "../../utils/qualityFilterUtils.js";
import { getVillaNumber, toExcelDate, applyDateCellFormat } from "../../utils/dashboardUtils.js";
import { useTableSort } from "../../utils/useTableSort.js";
import { StatusCountChart } from "./StatusCountChart.jsx";
import { MultiSelectFilter } from "./MultiSelectFilter.jsx";
import { SortableTh } from "./SortableTh.jsx";

/**
 * Surfaces every NCR across the whole project — an item can now have
 * more than one (see NcrList.jsx), each independently closeable, so
 * this shows one row per NCR (not per villa+item) with its own date,
 * reason, and closed/closed-date state. Reads directly from the
 * dedicated /villas/ncr-report endpoint (ncrService.js's
 * getNcrReportRows), which sources from villa_item_ncr.
 *
 * `embedded`, when true, renders just the content (no modal backdrop/
 * header) — used by QualityDashboard.jsx, which supplies its own single
 * shared modal shell around all three Quality tabs.
 */
export function NcrReport({ onClose, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const { villaMetaByID } = useVillaGeoMeta();

  const [villaFilters, setVillaFilters] = useState([]);
  const [zoneFilters, setZoneFilters] = useState([]);
  const [blockFilters, setBlockFilters] = useState([]);
  const [villaTypeFilters, setVillaTypeFilters] = useState([]);
  const [itemFilter, setItemFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Replaces the old plain "Open only" checkbox — same default (only
  // open NCRs shown until you change it), but as a multi-select so
  // "Open", "Closed", or both can be picked, consistent with every
  // other status filter across the Quality tabs.
  const [statusFilters, setStatusFilters] = useState(["Open"]);
  const [clearing, setClearing] = useState(false);

  function loadReport() {
    setStatus("loading");
    villasApi
      .getNcrReport()
      .then((data) => {
        setRows(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(() => {
    loadReport();
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
  const statusOptions = [
    { value: "Open", label: "Open" },
    { value: "Closed", label: "Closed" },
  ];

  const findings = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        villaID: r.villaID,
        date: r.date,
        note: r.note,
        closed: r.closed,
        closedDate: r.closedDate,
        closingNote: r.closingNote,
        item: itemsById.get(r.tableItemId) ?? { TableItemID: r.tableItemId, name: r.tableItemId },
      })),
    [rows, itemsById]
  );

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (!matchesMultiSelect(f.closed ? "Closed" : "Open", statusFilters)) return false;
      if (!matchesMultiSelect(f.villaID, villaFilters)) return false;
      if (!matchesGeoFilters(f.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return false;
      if (itemFilter && f.item.TableItemID !== itemFilter) return false;
      if (!matchesDateRange(f.date, dateFrom, dateTo)) return false;
      return true;
    });
  }, [findings, villaFilters, zoneFilters, blockFilters, villaTypeFilters, itemFilter, dateFrom, dateTo, statusFilters, villaMetaByID]);

  const { sortKey, sortDir, toggleSort } = useTableSort();
  const sortedFiltered = useMemo(() => {
    return sortRows(filtered, sortKey, sortDir, (f, key) => {
      switch (key) {
        case "villa": return f.villaID;
        case "zone": return villaMetaByID[f.villaID]?.zonenum ?? null;
        case "block": return villaMetaByID[f.villaID]?.blocknum ?? null;
        case "item": return f.item.name;
        case "date": return f.date;
        case "reason": return f.note;
        case "closed": return f.closed ? 1 : 0;
        case "closedDate": return f.closedDate;
        case "closingReason": return f.closingNote;
        default: return null;
      }
    });
  }, [filtered, sortKey, sortDir, villaMetaByID]);

  function handleExport() {
    const exportRows = filtered.map((f) => ({
      Villa: f.villaID,
      "Villa Number": getVillaNumber(f.villaID),
      Zone: villaMetaByID[f.villaID]?.zonenum ?? "",
      Block: villaMetaByID[f.villaID]?.blocknum ?? "",
      "Villa Type": villaMetaByID[f.villaID]?.villatype ?? "",
      Item: f.item.name,
      "Item ID": f.item.TableItemID,
      Date: toExcelDate(f.date),
      Reason: f.note ?? "",
      Closed: f.closed ? "Yes" : "No",
      "Closed Date": toExcelDate(f.closedDate),
      "Closing Reason": f.closingNote ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(exportRows, { cellDates: true });
    applyDateCellFormat(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "NCRs");
    XLSX.writeFile(wb, "ncr_report.xlsx");
  }

  // Destructive, project-wide, no undo — double confirmation (the typed
  // count is a real deterrent against a reflexive click, not just a
  // second "are you sure").
  async function handleClearAll() {
    if (rows.length === 0) return;
    const confirmed = window.confirm(
      `This permanently deletes all ${rows.length} NCR${rows.length === 1 ? "" : "s"} across the ` +
        `whole project (open and closed) — not just what's currently filtered/shown. This cannot be undone. Continue?`
    );
    if (!confirmed) return;
    const typed = window.prompt(`Type the number ${rows.length} to confirm.`);
    if (typed !== String(rows.length)) return;

    setClearing(true);
    try {
      await villasApi.clearNcrReport();
      loadReport();
    } catch {
      window.alert("Couldn't clear NCR data — please try again.");
    } finally {
      setClearing(false);
    }
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  const content = (
    <>
      <p className="file-status-hint">
        Every NCR logged across the project — an item can have more than one.
      </p>

      {status === "error" && <p className="upload-error">Couldn't load the NCR report.</p>}

      {isLoading ? (
        <p className="file-status-hint">Loading…</p>
      ) : (
        <>
          <div className="admin-actions" style={{ marginBottom: "0.5rem", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
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
            <MultiSelectFilter label="Status" options={statusOptions} selected={statusFilters} onChange={setStatusFilters} />
            <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="file-status-hint" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              Export to Excel
            </button>
            <button
              type="button"
              className="admin-btn-secondary"
              style={{ color: "#dc2626", borderColor: "#dc2626" }}
              onClick={handleClearAll}
              disabled={rows.length === 0 || clearing}
            >
              {clearing ? "Clearing…" : "Clear all NCR data"}
            </button>
          </div>

          <StatusCountChart items={filtered} getLabel={(f) => (f.closed ? "Closed" : "Open")} />

          <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
            {filtered.length} NCR{filtered.length === 1 ? "" : "s"} found.
          </p>

          {filtered.length === 0 ? (
            <p className="file-status-hint">No NCRs match the current filters.</p>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <SortableTh column="villa" label="Villa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="zone" label="Zone" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="block" label="Block" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="item" label="Item" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="date" label="Date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="reason" label="Reason" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="closed" label="Closed" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="closedDate" label="Closed Date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh column="closingReason" label="Closing Reason" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((f) => (
                    <tr key={f.id}>
                      <td>{f.villaID}</td>
                      <td>{villaMetaByID[f.villaID]?.zonenum ?? "—"}</td>
                      <td>{villaMetaByID[f.villaID]?.blocknum ?? "—"}</td>
                      <td>
                        {f.item.name}
                        <br />
                        <span className="file-status-hint">{f.item.TableItemID}</span>
                      </td>
                      <td>{f.date ?? "—"}</td>
                      <td>{f.note ?? "—"}</td>
                      <td>{f.closed ? "Yes" : "No"}</td>
                      <td>{f.closedDate ?? "—"}</td>
                      <td>{f.closingNote ?? "—"}</td>
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
          <h3>NCRs</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
