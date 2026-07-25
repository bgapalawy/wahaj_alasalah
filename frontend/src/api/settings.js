import { apiClient } from "./client.js";

export const settingsApi = {
  getBranding: () => apiClient.get("/settings/branding"),
  updateBranding: (updates) => apiClient.put("/settings/branding", updates),
};
