import { Router } from "express";
import { getAllProjectsDashboardData } from "../services/portfolioDashboardService.js";
import { getConstructionItemDashboardData } from "../services/constructionItemDashboardService.js";
import { getAllVillaStatuses, getAllVillaInvoiceStatuses, getSpecialQueryData } from "../services/allVillaStatusesService.js";

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

// Every real villa's full status map — used by the Schedule coloring
// mode to check predecessor completion via the dependency graph.
dashboardRouter.get("/all-villa-statuses", async (req, res, next) => {
  try {
    const data = await getAllVillaStatuses();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Same shape, from the invoices table — used by the Custom Query builder.
dashboardRouter.get("/all-villa-invoice-statuses", async (req, res, next) => {
  try {
    const data = await getAllVillaInvoiceStatuses();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// The original app's actual "custom query" data source: a dedicated
// DynamoDB table (wajha_special_query) with villaID plus whatever
// dynamic columns exist in it — the original discovered those columns
// at runtime rather than hardcoding a field list, and let the user pick
// any of them to filter/color by. Raw records returned as-is; the
// frontend derives column names and each column's distinct values from
// this, same as the original's getdynamoDBClientColumns() did.
dashboardRouter.get("/special-query-data", async (req, res, next) => {
  try {
    const data = await getSpecialQueryData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});
