import { Router } from "express";
import { listVillas, getVillaById, updateVilla } from "../services/villaService.js";
import { getActivityStatus, updateActivityStatus, getAllActivityStatuses } from "../services/activityStatusService.js";
import { getVillaDashboardData, getPlannedDatesForItem } from "../services/villaDashboardService.js";
import { getInvoiceStatus, getAllInvoiceStatuses, updateInvoiceStatus } from "../services/invoiceService.js";

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

villasRouter.patch("/:villaID/activities/:tableItemId", async (req, res, next) => {
  try {
    const { status, completedDate } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });
    const updated = await updateActivityStatus(req.params.villaID, req.params.tableItemId, {
      status,
      completedDate,
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
