import { apiClient } from "./client.js";

export const villasApi = {
  list: () => apiClient.get("/villas"),
  getById: (villaID) => apiClient.get(`/villas/${villaID}`),
  update: (villaID, updates) => apiClient.patch(`/villas/${villaID}`, updates),

  getActivityStatus: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}`),
  getAllActivityStatuses: (villaID) => apiClient.get(`/villas/${villaID}/activities`),
  getDashboard: (villaID) => apiClient.get(`/villas/${villaID}/dashboard`),
  getPlannedDates: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/planned-dates`),
  updateActivityStatus: (villaID, tableItemId, { status, completedDate }) =>
    apiClient.patch(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}`, {
      status,
      completedDate,
    }),

  getInvoiceStatus: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/invoices/${encodeURIComponent(tableItemId)}`),
  getAllInvoiceStatuses: (villaID) => apiClient.get(`/villas/${villaID}/invoices`),
  updateInvoiceStatus: (villaID, tableItemId, status) =>
    apiClient.patch(`/villas/${villaID}/invoices/${encodeURIComponent(tableItemId)}`, { status }),
};
