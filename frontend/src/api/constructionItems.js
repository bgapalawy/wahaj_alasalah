import { apiClient } from "./client.js";

// Called independently from 7+ components (the dependency graph, every
// item picker, dashboards, the Out of Sequence report...) — without this,
// each one fired its own request for the same unchanging 82-item list.
// Memoized per page session; cleared on failure so a real error doesn't
// get "stuck" as a permanently-failing cached promise.
let cachedList = null;

export const constructionItemsApi = {
  list: () => {
    if (!cachedList) {
      cachedList = apiClient.get("/construction-items").catch((err) => {
        cachedList = null;
        throw err;
      });
    }
    return cachedList;
  },
};
