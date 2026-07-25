import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { villasRouter } from "./routes/villas.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { constructionItemsRouter } from "./routes/constructionItems.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

if (!process.env.JWT_SECRET) {
  console.error(
    "JWT_SECRET is not set in backend/.env — refusing to start, since every login token would be " +
      "signed with an undefined secret (effectively no security at all). Add a long random string to .env."
  );
  process.exit(1);
}

const app = express();

// Required behind any reverse proxy (Render, and most hosts) — without
// this, express-rate-limit can't safely trust the X-Forwarded-For
// header it needs to identify unique clients, and throws internally in
// a way that leaves the request hanging with no response at all,
// rather than a clean error. `1` = trust exactly one hop (the
// platform's own proxy), not an arbitrary chain — safer than `true`.
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
// Default 100kb is nowhere near enough for a bulk Excel import — a full
// table (up to ~villaCount rows) sent as JSON can run several MB.
app.use(express.json({ limit: "25mb" }));

// General ceiling across the whole API — generous enough for normal use
// (loading the map, dashboards, a burst of file lookups) while still
// making a sustained hammering/scraping attempt impractical.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter ceiling specifically on Admin — this is the highest-blast-
// radius surface (bulk overwrites, whole-project invoice conversions),
// worth slowing down harder than ordinary browsing traffic even from an
// authenticated session.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", generalLimiter);
app.use("/api/auth", authRouter); // deliberately NOT behind requireAuth — this is how you get a token in the first place

app.use("/api/villas", requireAuth, villasRouter);
app.use("/api/uploads", requireAuth, uploadRouter);
app.use("/api/construction-items", requireAuth, constructionItemsRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/admin", requireAuth, adminLimiter, adminRouter);

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Shams_Elgroub API listening on http://localhost:${port}`);
});
