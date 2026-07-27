import { Router } from "express";
import { listVillas, getVillaById, updateVilla } from "../services/villaService.js";
import { getActivityStatus, updateActivityStatus, getAllActivityStatuses, getActivityStatusHistory, getStatusReportRows } from "../services/activityStatusService.js";
import { getVillaDashboardData, getPlannedDatesForItem } from "../services/villaDashboardService.js";
import { getInvoiceStatus, getAllInvoiceStatuses, updateInvoiceStatus } from "../services/invoiceService.js";
import { getNcrsForItem, addNcr, updateNcr, getNcrReportRows, clearAllNcrs } from "../services/ncrService.js";

export const villasRouter = Router();

// GET /api/villas -> attribute table, joined onto geometry on the frontend
// (or joined here later, once the ArcGIS villaID/blocknum schema is in place)
villasRouter.get("/", async (req, res, next) => {
  try {
    const villas = await listVillas();
    res.json(villas);
  } catch (err) {
    next(err);
  }
});

// Every (villa, item) that has ever had a status recorded — feeds the
// "Villa Status" tab of the Quality dashboard. Same registration-order
// requirement as /ncr-report above (must come before GET /:villaID).
villasRouter.get("/status-report", async (req, res, next) => {
  try {
    const rows = await getStatusReportRows();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Every NCR across the project (open and closed), with date + reason —
// must be registered BEFORE GET /:villaID below, or Express would match
// a request to /ncr-report as villaID="ncr-report" instead (param
// routes match any literal segment, including this one, in registration
// order).
villasRouter.get("/ncr-report", async (req, res, next) => {
  try {
    const rows = await getNcrReportRows();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Wipes every NCR across the whole project — a hard reset, not scoped
// to one villa/item. The frontend confirms with the user before calling
// this (see NcrReport.jsx's "Clear all NCR data" button); no undo once
// it runs. DELETE on the same path as the GET above is a distinct route
// (Express matches by method+path together), so no ordering conflict
// with GET /:villaID either way — but kept next to the GET for
// readability.
villasRouter.delete("/ncr-report", async (req, res, next) => {
  try {
    const result = await clearAllNcrs();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

villasRouter.get("/:villaID", async (req, res, next) => {
  try {
    const villa = await getVillaById(req.params.villaID);
    res.json(villa);
  } catch (err) {
    next(err);
  }
});

villasRouter.patch("/:villaID", async (req, res, next) => {
  try {
    const updated = await updateVilla(req.params.villaID, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// All construction-item statuses for a villa in one call — feeds the
// dependency graph so it reflects live progress instead of the static
// "NotStarted" placeholder in constructionItems.js.
villasRouter.get("/:villaID/activities", async (req, res, next) => {
  try {
    const statuses = await getAllActivityStatuses(req.params.villaID);
    res.json(statuses);
  } catch (err) {
    next(err);
  }
});

// Joined planned/actual cost + date data for the villa dashboard.
villasRouter.get("/:villaID/dashboard", async (req, res, next) => {
  try {
    const data = await getVillaDashboardData(req.params.villaID);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Just this item's planned start/finish date for this villa — used by the
// construction-item picker, cheaper than the full dashboard join.
villasRouter.get("/:villaID/activities/:tableItemId/planned-dates", async (req, res, next) => {
  try {
    const dates = await getPlannedDatesForItem(req.params.villaID, req.params.tableItemId);
    res.json(dates);
  } catch (err) {
    next(err);
  }
});

// Per-villa, per-construction-item status + completion date.
villasRouter.get("/:villaID/activities/:tableItemId", async (req, res, next) => {
  try {
    const status = await getActivityStatus(req.params.villaID, req.params.tableItemId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// Full status-change history for one villa/item, oldest first — powers
// the status timeline (Not Started -> ... -> Completed, with dates and
// notes at each step).
villasRouter.get("/:villaID/activities/:tableItemId/history", async (req, res, next) => {
  try {
    const history = await getActivityStatusHistory(req.params.villaID, req.params.tableItemId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// Every NCR (open and closed) logged against one villa/item — a villa
// can have several at once, independent of its main activity status.
villasRouter.get("/:villaID/activities/:tableItemId/ncrs", async (req, res, next) => {
  try {
    const ncrs = await getNcrsForItem(req.params.villaID, req.params.tableItemId);
    res.json(ncrs);
  } catch (err) {
    next(err);
  }
});

// Opens a new NCR — never overwrites an existing one, which is what
// lets an item accumulate 2+ open NCRs at once.
villasRouter.post("/:villaID/activities/:tableItemId/ncrs", async (req, res, next) => {
  try {
    const { openedDate, note } = req.body;
    const created = await addNcr(req.params.villaID, req.params.tableItemId, { openedDate, note });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Updates one NCR — the "closed" checkbox + closing date + closing
// reason, or an edit to its opening note/opened date.
villasRouter.patch("/:villaID/activities/:tableItemId/ncrs/:ncrId", async (req, res, next) => {
  try {
    const { closed, closedDate, closingNote, note, openedDate } = req.body;
    const updated = await updateNcr(req.params.villaID, req.params.tableItemId, req.params.ncrId, {
      closed,
      closedDate,
      closingNote,
      note,
      openedDate,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

villasRouter.patch("/:villaID/activities/:tableItemId", async (req, res, next) => {
  try {
    const { status, completedDate, note } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });
    const updated = await updateActivityStatus(req.params.villaID, req.params.tableItemId, {
      status,
      completedDate,
      note,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// All invoice statuses for a villa (all construction items) in one call.
villasRouter.get("/:villaID/invoices", async (req, res, next) => {
  try {
    const statuses = await getAllInvoiceStatuses(req.params.villaID);
    res.json(statuses);
  } catch (err) {
    next(err);
  }
});

villasRouter.get("/:villaID/invoices/:tableItemId", async (req, res, next) => {
  try {
    const status = await getInvoiceStatus(req.params.villaID, req.params.tableItemId);
    res.json({ status });
  } catch (err) {
    next(err);
  }
});

villasRouter.patch("/:villaID/invoices/:tableItemId", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });
    const updated = await updateInvoiceStatus(req.params.villaID, req.params.tableItemId, status);
    res.json({ status: updated });
  } catch (err) {
    next(err);
  }
});
