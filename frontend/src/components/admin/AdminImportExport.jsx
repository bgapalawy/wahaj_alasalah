import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { adminApi } from "../../api/admin.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { villasApi } from "../../api/villas.js";
import { MultiSelect } from "../dashboard/MultiSelect.jsx";
import { useSpecialQueryData } from "../../hooks/useSpecialQueryData.js";
import { getVillaNumber } from "../../utils/dashboardUtils.js";

/**
 * Ports the original app's uploadingtodatabasefromexcel.js. That version
 * ran the AWS SDK directly in the browser and did everything client-side
 * — this app moved AWS access server-side (see the security notes
 * elsewhere in this project about credentials that used to be hardcoded
 * and committed to GitHub), so the split here is: this component parses
 * the uploaded Excel file and does the Excel export formatting (both
 * already client-side jobs elsewhere in this app), while the actual
 * DynamoDB reads/writes happen through /api/admin/* on the backend.
 *
 * This is a genuinely powerful bulk-write tool — it can overwrite real
 * production data straight from a spreadsheet. Confirmations are
 * required before any write; there's no undo.
 */
export function AdminImportExport() {
  const [tableOptions, setTableOptions] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [file, setFile] = useState(null);
  const [importStatus, setImportStatus] = useState("idle"); // idle | working | done | error
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importProgress, setImportProgress] = useState({ processedRows: 0, totalRows: 0 });
  const [exportStatus, setExportStatus] = useState("idle");
  const [convertStatus, setConvertStatus] = useState("idle");
  const [convertResult, setConvertResult] = useState(null);
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const [allVillas, setAllVillas] = useState([]);
  const [villaFilter, setVillaFilter] = useState([]); // empty = every villa
  const [itemFilter, setItemFilter] = useState([]); // empty = every item
  const [zoneFilter, setZoneFilter] = useState([]);
  const [blockFilter, setBlockFilter] = useState([]);
  const [villaTypeFilter, setVillaTypeFilter] = useState([]);
  const [specialQueryColumnFilter, setSpecialQueryColumnFilter] = useState([]);
  const fileInputRef = useRef(null);

  const { columns: specialQueryColumns } = useSpecialQueryData(selectedTable === "specialQuery");

  useEffect(() => {
    adminApi.listTables().then(setTableOptions).catch(() => setTableOptions([]));
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
    villasApi.list().then(setAllVillas).catch(() => setAllVillas([]));
  }, []);

  // Zone > Block > Villa Type > Villa — same cascade the Quality
  // dashboard's filters use (qualityFilterUtils.js): each level's
  // option list narrows based on whatever's selected above it.
  const distinctZones = [...new Set(allVillas.map((v) => v.zonenum).filter(Boolean))].sort();
  const distinctBlocks = [
    ...new Set(
      allVillas
        .filter((v) => zoneFilter.length === 0 || zoneFilter.includes(v.zonenum))
        .map((v) => v.blocknum)
        .filter(Boolean)
    ),
  ].sort();
  const distinctVillaTypes = [
    ...new Set(
      allVillas
        .filter((v) => zoneFilter.length === 0 || zoneFilter.includes(v.zonenum))
        .filter((v) => blockFilter.length === 0 || blockFilter.includes(v.blocknum))
        .map((v) => v.villatype)
        .filter(Boolean)
    ),
  ].sort();
  const allVillaIDs = allVillas
    .filter((v) => zoneFilter.length === 0 || zoneFilter.includes(v.zonenum))
    .filter((v) => blockFilter.length === 0 || blockFilter.includes(v.blocknum))
    .filter((v) => villaTypeFilter.length === 0 || villaTypeFilter.includes(v.villatype))
    .map((v) => v.villaID);
  const villaMetaByID = new Map(allVillas.map((v) => [v.villaID, v]));

  const selectedTableMeta = tableOptions.find((t) => t.value === selectedTable);

  async function handleImport() {
    if (!selectedTable) return window.alert("Please select a table.");
    if (!file) return window.alert("Please choose a file.");
    if (!sheetName.trim()) return window.alert("Please enter the sheet/tab name from your Excel file.");

    const confirmed = window.confirm(
      `This will overwrite data in "${selectedTableMeta?.label ?? selectedTable}" for every villaID found in the sheet "${sheetName}". This can't be undone. Continue?`
    );
    if (!confirmed) return;

    setImportStatus("working");
    setImportResult(null);
    setImportError(null);
    setImportProgress({ processedRows: 0, totalRows: 0 });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found in this file.`);
      }

      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headers = jsonData[0];
      const primaryKeyHeader = headers[0];

      // Skip the "English Name" / "Arabic Name" rows the export now adds
      // — lets a downloaded-edited-reuploaded file round-trip correctly
      // instead of treating those as garbage villa rows. Older exports
      // without these rows are unaffected (loop just doesn't match).
      let dataStartIndex = 1;
      while (dataStartIndex < jsonData.length && ["English Name", "Arabic Name"].includes(jsonData[dataStartIndex]?.[0])) {
        dataStartIndex++;
      }
      const dataRows = jsonData.slice(dataStartIndex);

      const REFERENCE_ONLY_COLUMNS = new Set(["Zone", "Block", "Villa Type"]);

      const rows = dataRows
        .filter((row) => row.length > 0 && row.some((cell) => cell !== undefined && cell !== null && cell !== ""))
        .map((row) => {
          const record = { villaID: row[0] };
          headers.slice(1).forEach((header, i) => {
            if (REFERENCE_ONLY_COLUMNS.has(header)) return; // read-only villa attributes, not per-item data
            const cellValue = row[i + 1];
            if (cellValue === undefined || cellValue === null || cellValue === "") return;
            // Dates come through as JS Date objects (cellDates:true) —
            // send as plain "YYYY-MM-DD"; the backend converts to this
            // table's Excel-serial storage format if isDateTable is set.
            record[header] = cellValue instanceof Date ? cellValue.toISOString().slice(0, 10) : cellValue;
          });
          return record;
        });

      if (rows.length === 0) {
        throw new Error("No data rows found in that sheet.");
      }
      if (!primaryKeyHeader) {
        throw new Error("First column must be the primary key (villaID).");
      }

      // Chunked instead of one giant request — a full 956-villa sheet is
      // tens of thousands of individual cell upserts server-side, which
      // used to take long enough that the button just sat on "Uploading…"
      // with no sense of progress the whole time. Splitting into batches
      // of BATCH_SIZE rows, awaited one at a time (not in parallel — the
      // backend is already writing each batch at its own internal
      // concurrency, and firing multiple batches at once would just
      // contend with itself for the same DB connections) lets the
      // progress bar move after every batch instead of only at the very
      // end, and keeps each individual request small enough to stay well
      // under any request-size/timeout limit regardless of sheet size.
      const BATCH_SIZE = 50;
      const isDateTable = selectedTableMeta?.isDateTable ?? false;
      setImportProgress({ processedRows: 0, totalRows: rows.length });

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const batchResult = await adminApi.importRows(selectedTable, batch, isDateTable);
        successCount += batchResult.successCount;
        errorCount += batchResult.errorCount;
        if (errors.length < 50) errors.push(...batchResult.errors.slice(0, 50 - errors.length));
        setImportProgress({ processedRows: Math.min(i + BATCH_SIZE, rows.length), totalRows: rows.length });
      }

      setImportResult({ successCount, errorCount, errors });
      setImportStatus("done");
    } catch (err) {
      setImportError(err.message);
      setImportStatus("error");
    }
  }

  async function handleExport() {
    if (!selectedTable) return window.alert("Please select a table.");
    setExportStatus("working");
    try {
      let rows = await adminApi.exportTable(selectedTable);
      const totalBeforeFilter = rows.length;

      const villaSet = villaFilter.length > 0 ? new Set(villaFilter) : null;
      const zoneSet = zoneFilter.length > 0 ? new Set(zoneFilter) : null;
      const blockSet = blockFilter.length > 0 ? new Set(blockFilter) : null;
      const typeSet = villaTypeFilter.length > 0 ? new Set(villaTypeFilter) : null;
      if (villaSet || zoneSet || blockSet || typeSet) {
        rows = rows.filter((r) => {
          const meta = villaMetaByID.get(r.villaID);
          if (villaSet && !villaSet.has(r.villaID)) return false;
          if (zoneSet && !zoneSet.has(meta?.zonenum)) return false;
          if (blockSet && !blockSet.has(meta?.blocknum)) return false;
          if (typeSet && !typeSet.has(meta?.villatype)) return false;
          return true;
        });
      }

      const isDateTable = selectedTableMeta?.isDateTable ?? false;
      // Special Query columns are user-defined, not real construction
      // items — there's no name/Arabic-name to look up for those, so
      // this only applies to the item-column tables (status, invoice,
      // dates, costs).
      const hasItemColumns = selectedTable !== "specialQuery" && constructionItemsTemplate.length > 0;
      const itemFilterIds = new Set(itemFilter.map((opt) => opt.split(" — ")[0]));

      function cellValue(rawValue) {
        if (isDateTable && typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
          return new Date(`${rawValue}T00:00:00`);
        }
        return rawValue ?? "";
      }

      function villaMetaRow(villaID) {
        const meta = villaMetaByID.get(villaID);
        return [meta?.zonenum ?? "", meta?.blocknum ?? "", meta?.villatype ?? ""];
      }

      let worksheet;

      if (hasItemColumns) {
        const nameById = new Map(constructionItemsTemplate.map((i) => [i.TableItemID, i]));
        // Ordered by the items' natural id order, restricted to columns
        // that actually appear in at least one row (not every villa/item
        // combination necessarily has data), and further restricted to
        // itemFilter if one was chosen.
        const orderedColumns = constructionItemsTemplate
          .map((i) => i.TableItemID)
          .filter((id) => rows.some((r) => Object.prototype.hasOwnProperty.call(r, id)))
          .filter((id) => itemFilterIds.size === 0 || itemFilterIds.has(id));

        // Zone/Block/Villa Type are reference-only columns (villa
        // attributes, not per-item data) — inserted right after villaID,
        // before the real item columns. "Villa Number" (the plain
        // numeric part of villaID, e.g. "V_5" -> "5") sits right next
        // to villaID itself, same convention as every other downloaded
        // sheet in the app now uses.
        const headerRow = ["villaID", "Villa Number", "Zone", "Block", "Villa Type", ...orderedColumns];
        const englishNameRow = ["English Name", "", "", "", "", ...orderedColumns.map((id) => nameById.get(id)?.name ?? "")];
        const arabicNameRow = ["Arabic Name", "", "", "", "", ...orderedColumns.map((id) => nameById.get(id)?.nameArabic ?? "")];
        const dataRows = rows.map((row) => [
          row.villaID,
          getVillaNumber(row.villaID),
          ...villaMetaRow(row.villaID),
          ...orderedColumns.map((id) => cellValue(row[id])),
        ]);

        worksheet = XLSX.utils.aoa_to_sheet([headerRow, englishNameRow, arabicNameRow, ...dataRows], { cellDates: true });
        worksheet["!freeze"] = { xSplit: 2, ySplit: 3 }; // keep villaID + Villa Number columns + the 3 header rows visible while scrolling
      } else {
        const columnFilterSet = new Set(specialQueryColumnFilter);
        const preparedRows = rows.map((row) => {
          const [zone, block, villaType] = villaMetaRow(row.villaID);
          const converted = { villaID: row.villaID, "Villa Number": getVillaNumber(row.villaID), Zone: zone, Block: block, "Villa Type": villaType };
          for (const [key, value] of Object.entries(row)) {
            if (key === "villaID") continue;
            if (selectedTable === "specialQuery" && columnFilterSet.size > 0 && !columnFilterSet.has(key)) continue;
            converted[key] = isDateTable ? cellValue(value) : value;
          }
          return converted;
        });
        worksheet = XLSX.utils.json_to_sheet(preparedRows, { cellDates: true });
      }

      if (isDateTable) {
        // json_to_sheet/aoa_to_sheet write real date cells for
        // Date-valued fields, but don't set a display format on their
        // own — without this they'd show as raw serial numbers instead
        // of a readable date. Cells in the name rows are plain strings
        // (type "s"), so this naturally leaves them untouched.
        for (const cellRef of Object.keys(worksheet)) {
          if (cellRef.startsWith("!")) continue;
          const cell = worksheet[cellRef];
          if (cell?.t === "d") cell.z = "yyyy-mm-dd";
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "data");
      XLSX.writeFile(workbook, `${selectedTable}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setExportStatus("idle");
      window.alert(
        villaFilter.length > 0 ||
          itemFilter.length > 0 ||
          zoneFilter.length > 0 ||
          blockFilter.length > 0 ||
          villaTypeFilter.length > 0 ||
          specialQueryColumnFilter.length > 0
          ? `Download complete. ${rows.length} of ${totalBeforeFilter} total records matched your filters.`
          : `Download complete. Total records: ${rows.length}`
      );
    } catch (err) {
      setExportStatus("idle");
      window.alert(`Export failed: ${err.message}`);
    }
  }

  async function handleConvertReadyToPayToPaid() {
    const confirmed = window.confirm(
      'This will mark every invoice currently "ReadyToPay" as "Paid", across the whole project. This can\'t be undone. Continue?'
    );
    if (!confirmed) return;
    setConvertStatus("working");
    try {
      const result = await adminApi.convertReadyToPayToPaid();
      setConvertResult(`Marked ${result.updatedCount} invoice item(s) Paid.`);
    } catch (err) {
      setConvertResult(`Failed: ${err.message}`);
    } finally {
      setConvertStatus("idle");
    }
  }

  async function handleConvertCompletedToReadyToPay() {
    const confirmed = window.confirm(
      "This will set the invoice to \"ReadyToPay\" for every activity marked Completed that isn't already ReadyToPay or Paid — a backfill for older data, across the whole project. Continue?"
    );
    if (!confirmed) return;
    setConvertStatus("working");
    try {
      const result = await adminApi.convertCompletedToReadyToPay();
      setConvertResult(`Set ${result.updatedCount} invoice item(s) to ReadyToPay.`);
    } catch (err) {
      setConvertResult(`Failed: ${err.message}`);
    } finally {
      setConvertStatus("idle");
    }
  }

  return (
    <div className="admin-import-export">
      <p className="admin-warning">
        ⚠ This directly writes to your real database. Double-check the table and sheet before uploading — there's no undo.
      </p>

      <div className="admin-table-select">
        <div className="admin-field">
          <label>Table</label>
          <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
            <option value="">— Select a table —</option>
            {tableOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-io-grid">
        <details className="admin-io-card is-upload" open>
          <summary>
            <span className="admin-io-icon">⬆</span> Upload
          </summary>

          <div className="admin-field">
            <label>Sheet/tab name in your Excel file</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="e.g. Sheet1"
            />
          </div>

          <div className="admin-field">
            <label>Excel file</label>
            <div className="admin-file-input">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="admin-actions is-block">
            <button type="button" className="admin-btn-primary" onClick={handleImport} disabled={importStatus === "working"}>
              {importStatus === "working" ? "Uploading…" : "Upload to Database"}
            </button>
          </div>

          {importStatus === "working" && importProgress.totalRows > 0 && (
            <div className="admin-progress" aria-live="polite">
              <div className="admin-progress-track">
                <div
                  className="admin-progress-fill"
                  style={{ width: `${Math.round((importProgress.processedRows / importProgress.totalRows) * 100)}%` }}
                />
              </div>
              <p className="admin-progress-label">
                {importProgress.processedRows} / {importProgress.totalRows} rows (
                {Math.round((importProgress.processedRows / importProgress.totalRows) * 100)}%)
              </p>
            </div>
          )}

          {importStatus === "done" && importResult && (
            <p className="admin-result">
              Upload complete. Successful: {importResult.successCount}, Errors: {importResult.errorCount}
              {importResult.errors.length > 0 && (
                <>
                  <br />
                  First error: {importResult.errors[0].villaID} — {importResult.errors[0].error}
                </>
              )}
            </p>
          )}
          {importStatus === "error" && <p className="admin-result admin-result-error">{importError}</p>}
        </details>

        <details className="admin-io-card is-download" open>
          <summary>
            <span className="admin-io-icon">⬇</span> Download
          </summary>

          <div className="admin-field">
            <label>Filter what gets downloaded (optional — leave blank for everything)</label>
            <div className="admin-filter-grid">
              <MultiSelect
                label="Zone"
                options={distinctZones}
                value={zoneFilter}
                onChange={(next) => {
                  setZoneFilter(next);
                  setBlockFilter([]);
                  setVillaTypeFilter([]);
                }}
              />
              <MultiSelect
                label="Block"
                options={distinctBlocks}
                value={blockFilter}
                onChange={(next) => {
                  setBlockFilter(next);
                  setVillaTypeFilter([]);
                }}
              />
              <MultiSelect label="Villa Type" options={distinctVillaTypes} value={villaTypeFilter} onChange={setVillaTypeFilter} />
              <MultiSelect label="Villas" options={allVillaIDs} value={villaFilter} onChange={setVillaFilter} />
              {selectedTable !== "specialQuery" && (
                <MultiSelect
                  label="Construction Items"
                  options={constructionItemsTemplate.map((i) => `${i.TableItemID} — ${i.name}`)}
                  value={itemFilter}
                  onChange={setItemFilter}
                />
              )}
              {selectedTable === "specialQuery" && (
                <MultiSelect label="Columns" options={specialQueryColumns} value={specialQueryColumnFilter} onChange={setSpecialQueryColumnFilter} />
              )}
            </div>
          </div>

          <div className="admin-actions is-block">
            <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={exportStatus === "working"}>
              {exportStatus === "working" ? "Preparing…" : "Download Table Data"}
            </button>
          </div>
        </details>
      </div>

      <details className="admin-convert-section" open>
        <summary>Bulk invoice fixes</summary>
        <div className="admin-actions">
          <button type="button" className="admin-btn-warning" onClick={handleConvertReadyToPayToPaid} disabled={convertStatus === "working"}>
            Convert all ReadyToPay → Paid
          </button>
          <button type="button" className="admin-btn-warning" onClick={handleConvertCompletedToReadyToPay} disabled={convertStatus === "working"}>
            Backfill: Completed → ReadyToPay
          </button>
        </div>
        {convertResult && <p className="admin-result">{convertResult}</p>}
      </details>
    </div>
  );
}
