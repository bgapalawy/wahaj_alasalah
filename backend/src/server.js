import "dotenv/config";
import express from "express";
import cors from "cors";
import { villasRouter } from "./routes/villas.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { constructionItemsRouter } from "./routes/constructionItems.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/villas", villasRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/construction-items", constructionItemsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Wajha API listening on http://localhost:${port}`);
});
