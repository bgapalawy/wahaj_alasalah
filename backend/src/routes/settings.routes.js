import { Router } from "express";
import { getProjectSettings, updateProjectSettings } from "../services/projectSettingsService.js";

export const settingsRouter = Router();

// Any authenticated user can view or edit this — it's shared project
// branding, not a per-user or admin-only setting.
settingsRouter.get("/branding", async (req, res, next) => {
  try {
    res.json(await getProjectSettings());
  } catch (err) {
    next(err);
  }
});

settingsRouter.put("/branding", async (req, res, next) => {
  try {
    const { projectName, logoCaptions } = req.body ?? {};
    res.json(await updateProjectSettings({ projectName, logoCaptions }));
  } catch (err) {
    next(err);
  }
});
