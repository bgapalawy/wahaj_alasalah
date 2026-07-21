import { Router } from "express";
import { getAllProjectsDashboardData } from "../services/portfolioDashboardService.js";
import { getConstructionItemDashboardData } from "../services/constructionItemDashboardService.js";

export const dashboardRouter = Router();

dashboardRouter.get("/all-projects", async (req, res, next) => {
  try {
    const data = await getAllProjectsDashboardData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/construction-item/:tableItemId", async (req, res, next) => {
  try {
    const data = await getConstructionItemDashboardData(req.params.tableItemId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
