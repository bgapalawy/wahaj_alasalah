import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { villasApi } from "../../api/villas.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import { getZoneOptions, getBlockOptions, getVillaTypeOptions, getVillaOptions, matchesGeoFilters, matchesMultiSelect, matchesDateRange } from "../../utils/qualityFilterUtils.js";
import { getVillaNumber, toExcelDate, applyDateCellFormat } from "../../utils/dashboardUtils.js";
import { StatusCountChart } from "./StatusCountChart.jsx";
import { MultiSelectFilter } from "./MultiSelectFilter.jsx";

const ALL_STATUSES = ["NotStarted", "InProgress", "Notes", "NCR", "Rejected", "Completed"];

/**
 * Every (villa, item) that has ever had a status recorded, across the
 * whole project — Not Started, In Progress, Completed, and everything
 * else, all in one filterable table (as opposed to NcrReport, which
 * only ever shows NCR rows). Reads from the dedicated /villas/status-
 * report endpoint (activityStatusService.js's getStatusReportRows).
 *
 * `embedded`, when true, renders just the content (no modal backdrop/
 * header) — used by QualityDashboard.jsx, which supplies its own single
 * shared modal shell around all three Quality tabs.
 */
export function VillaStatusReport({ onClose, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const { villaMetaByID } = useVillaGeoMeta();

  const [villaFilters, setVillaFilters] = useState([]);
  const [zoneFilters, setZoneFilters] = useState([]);
  const [blockFilters, setBlockFilters] = useState([]);
  const [villaTypeFilters, setVillaTypeFilters] = useState([]);
  const [itemFilter, setItemFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setStatus("loading");
    villasApi
      .getStatusReport()
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
  const statusOptions = ALL_STATUSES.map((s) => ({ value: s, label: s }));

  const findings = useMemo(
    () =>
      rows.map((r) => ({
        villaID: r.villaID,
        status: r.status,
        date: r.date,
        note: r.note,
        item: itemsById.get(r.tableItemId) ?? { TableItemID: r.tableItemId, name: r.tableItemId },
      })),
    [rows, itemsById]
  );

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (!matchesMultiSelect(f.villaID, villaFilters)) return false;
      if (!matchesGeoFilters(f.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return false;
      if (itemFilter && f.item.TableItemID !== itemFilter) return false;
      if (!matchesMultiSelect(f.status, statusFilters)) return false;
      if (!matchesDateRange(f.date, dateFrom, dateTo)) return false;
      return true;
    });
  }, [findings, villaFilters, zoneFilters, blockFilters, villaTypeFilters, itemFilter, statusFilters, dateFrom, dateTo, villaMetaByID]);

  function handleExport() {
    const exportRows = filtered.map((f) => ({
      Villa: f.villaID,
      "Villa Number": getVillaNumber(f.villaID),
      Zone: villaMetaByID[f.villaID]?.zonenum ?? "",
      Block: villaMetaByID[f.villaID]?.blocknum ?? "",
      "Villa Type": villaMetaByID[f.villaID]?.villatype ?? "",
      Item: f.item.name,
      "Item ID": f.item.TableItemID,
      Status: f.status,
      Date: toExcelDate(f.date),
      Notes: f.note ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(exportRows, { cellDates: true });
    applyDateCellFormat(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Villa Status");
    XLSX.writeFile(wb, "villa_status_report.xlsx");
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  const content = (
    <>
      <p className="file-status-hint">
        Every (villa, item) that has ever had a status recorded — Not Started, In Progress, Completed, and
        everything else, in one place.
      </p>

      {status === "error" && <p className="upload-error">Couldn't load the status report.</p>}

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
          </div>

          <StatusCountChart items={filtered} />

          <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
            {filtered.length} row{filtered.length === 1 ? "" : "s"} found.
          </p>

          {filtered.length === 0 ? (
            <p className="file-status-hint">No rows match the current filters.</p>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Villa</th>
                    <th>Zone</th>
                    <th>Block</th>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={`${f.villaID}-${f.item.TableItemID}`}>
                      <td>{f.villaID}</td>
                      <td>{villaMetaByID[f.villaID]?.zonenum ?? "—"}</td>
                      <td>{villaMetaByID[f.villaID]?.blocknum ?? "—"}</td>
                      <td>
                        {f.item.name}
                        <br />
                        <span className="file-status-hint">{f.item.TableItemID}</span>
                      </td>
                      <td>{f.status}</td>
                      <td>{f.date ?? "—"}</td>
                      <td>{f.note ?? "—"}</td>
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
          <h3>Villa Status</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
