import { Router } from "express";
import { constructionItems } from "../data/constructionItems.js";

export const constructionItemsRouter = Router();

constructionItemsRouter.get("/", (req, res) => {
  res.json(constructionItems);
});
