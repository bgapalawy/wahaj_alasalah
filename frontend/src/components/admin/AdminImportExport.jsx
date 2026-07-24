import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { adminApi } from "../../api/admin.js";

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
  const [exportStatus, setExportStatus] = useState("idle");
  const [convertStatus, setConvertStatus] = useState("idle");
  const [convertResult, setConvertResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    adminApi.listTables().then(setTableOptions).catch(() => setTableOptions([]));
  }, []);

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

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found in this file.`);
      }

      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headers = jsonData[0];
      const dataRows = jsonData.slice(1);
      const primaryKeyHeader = headers[0];

      const rows = dataRows
        .filter((row) => row.length > 0 && row.some((cell) => cell !== undefined && cell !== null && cell !== ""))
        .map((row) => {
          const record = { villaID: row[0] };
          headers.slice(1).forEach((header, i) => {
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

      const result = await adminApi.importRows(selectedTable, rows, selectedTableMeta?.isDateTable ?? false);
      setImportResult(result);
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
      const rows = await adminApi.exportTable(selectedTable);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "data");
      XLSX.writeFile(workbook, `${selectedTable}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setExportStatus("idle");
      window.alert(`Download complete. Total records: ${rows.length}`);
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

      <div className="admin-fields">
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

        <div className="admin-actions">
          <button type="button" className="admin-btn-primary" onClick={handleImport} disabled={importStatus === "working"}>
            {importStatus === "working" ? "Uploading…" : "Upload to Database"}
          </button>
          <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={exportStatus === "working"}>
            {exportStatus === "working" ? "Preparing…" : "Download Table Data"}
          </button>
        </div>

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
      </div>

      <div className="admin-convert-section">
        <h4>Bulk invoice fixes</h4>
        <div className="admin-actions">
          <button type="button" className="admin-btn-warning" onClick={handleConvertReadyToPayToPaid} disabled={convertStatus === "working"}>
            Convert all ReadyToPay → Paid
          </button>
          <button type="button" className="admin-btn-warning" onClick={handleConvertCompletedToReadyToPay} disabled={convertStatus === "working"}>
            Backfill: Completed → ReadyToPay
          </button>
        </div>
        {convertResult && <p className="admin-result">{convertResult}</p>}
      </div>
    </div>
  );
}
