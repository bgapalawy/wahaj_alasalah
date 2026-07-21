import { apiClient } from "./client.js";

export const constructionItemsApi = {
  list: () => apiClient.get("/construction-items"),
};
