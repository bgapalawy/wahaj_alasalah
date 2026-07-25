import { Router } from "express";
import { getConstructionItemsCatalog } from "../services/constructionItemsCatalogService.js";
import { constructionItems as staticFallback } from "../data/constructionItems.js";

export const constructionItemsRouter = Router();

constructionItemsRouter.get("/", async (req, res, next) => {
  try {
    const items = await getConstructionItemsCatalog();
    // Guards against a genuinely empty table (shouldn't happen post-
    // migration, but better to fall back to the static file than serve
    // an empty catalog and break every dropdown in the app).
    res.json(items.length > 0 ? items : staticFallback);
  } catch (err) {
    next(err);
  }
});
