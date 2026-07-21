import { apiClient } from "./client.js";

export const dashboardApi = {
  getAllProjects: () => apiClient.get("/dashboard/all-projects"), // now includes .records
};
