import { Router } from "express";
import {
  bulkImportRows,
  exportTableData,
  convertReadyToPayToPaid,
  convertCompletedToReadyToPay,
} from "../services/adminImportExportService.js";

export const adminRouter = Router();

// Exposes the semantic import/export target keys (see IMPORT_TARGETS in
// adminImportExportService.js) — the frontend treats `value` as opaque,
// just round-tripping it back on import/export, so these no longer need
// to be real DynamoDB table names now that everything lives in Postgres.
adminRouter.get("/tables", (req, res) => {
  res.json([
    { value: "shams_elgroubData", label: "Shams_Elgroub progress (status) table", isDateTable: false },
    { value: "invoices", label: "Shams_Elgroub invoice table", isDateTable: false },
    { value: "plannedDates", label: "Planned Start Date table", isDateTable: true },
    { value: "plannedDatesFinish", label: "Planned dates (finish) table", isDateTable: true },
    { value: "actualDates", label: "Actual Finish Date table", isDateTable: true },
    { value: "plannedCosts", label: "Planned costs table", isDateTable: false },
    { value: "actualCosts", label: "Actual costs table", isDateTable: false },
    { value: "specialQuery", label: "Special query table", isDateTable: false },
  ]);
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
