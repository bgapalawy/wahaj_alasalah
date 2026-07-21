import { Router } from "express";
import { listVillas, getVillaById, updateVilla } from "../services/villaService.js";
import { getActivityStatus, updateActivityStatus, getAllActivityStatuses } from "../services/activityStatusService.js";
import { getVillaDashboardData } from "../services/villaDashboardService.js";

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
