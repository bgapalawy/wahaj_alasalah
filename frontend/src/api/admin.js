import { apiClient } from "./client.js";

export const adminApi = {
  listTables: () => apiClient.get("/admin/tables"),
  importRows: (tableName, rows, isDateTable) =>
    apiClient.post("/admin/import", { tableName, rows, isDateTable }),
  exportTable: (tableName) => apiClient.get(`/admin/export/${encodeURIComponent(tableName)}`),
  convertReadyToPayToPaid: () => apiClient.post("/admin/convert-ready-to-pay-to-paid"),
  convertCompletedToReadyToPay: () => apiClient.post("/admin/convert-completed-to-ready-to-pay"),
};
