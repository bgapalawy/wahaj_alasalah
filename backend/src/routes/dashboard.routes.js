import { Router } from "express";
import { getAllProjectsDashboardData } from "../services/portfolioDashboardService.js";

export const dashboardRouter = Router();

dashboardRouter.get("/all-projects", async (req, res, next) => {
  try {
    const data = await getAllProjectsDashboardData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});
