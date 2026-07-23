import { Router } from "express";
import {
  bulkImportRows,
  exportTableData,
  convertReadyToPayToPaid,
  convertCompletedToReadyToPay,
} from "../services/adminImportExportService.js";
import { tables } from "../config/aws.js";

export const adminRouter = Router();

// Exposes which real table each label maps to, so the frontend's table
// picker doesn't have to hardcode table names — matches the original
// app's dropdown ("Wajha progress All", "Wajha Invoice total", etc).
//
// Filters out any entry whose table name isn't actually configured
// (missing from backend/.env) rather than sending {value: undefined} —
// a browser's <option value={undefined}> silently falls back to using
// the option's TEXT as its value, which is exactly how a missing
// DDB_INVOICE_TABLE env var turned into "Wajha invoice table" (the
// label) being sent as a table name instead of the real one.
adminRouter.get("/tables", (req, res) => {
  const allOptions = [
    { value: tables.wajhaData, label: "Wajha progress (status) table", isDateTable: false },
    { value: tables.invoices, label: "Wajha invoice table", isDateTable: false },
    { value: tables.plannedDates, label: "Planned dates table", isDateTable: true },
    { value: tables.plannedDatesFinish, label: "Planned dates (finish) table", isDateTable: true },
    { value: tables.actualDates, label: "Actual dates table", isDateTable: true },
    { value: tables.plannedCosts, label: "Planned costs table", isDateTable: false },
    { value: tables.actualCosts, label: "Actual costs table", isDateTable: false },
    { value: tables.specialQuery, label: "Special query table", isDateTable: false },
  ];
  const missing = allOptions.filter((t) => !t.value).map((t) => t.label);
  if (missing.length > 0) {
    console.warn(`Admin table picker: these tables are missing from backend/.env and won't be selectable: ${missing.join(", ")}`);
  }
  res.json(allOptions.filter((t) => Boolean(t.value)));
});

adminRouter.post("/import", async (req, res, next) => {
  try {
    const { tableName, rows, isDateTable } = req.body;
    if (!tableName || !Array.isArray(rows)) {
      return res.status(400).json({ error: "tableName and rows[] are required" });
    }
    const result = await bulkImportRows(tableName, rows, Boolean(isDateTable));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/export/:tableName", async (req, res, next) => {
  try {
    const data = await exportTableData(req.params.tableName);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/convert-ready-to-pay-to-paid", async (req, res, next) => {
  try {
    const result = await convertReadyToPayToPaid();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/convert-completed-to-ready-to-pay", async (req, res, next) => {
  try {
    const result = await convertCompletedToReadyToPay();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
