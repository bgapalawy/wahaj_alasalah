import { apiClient } from "./client.js";

export const villasApi = {
  list: () => apiClient.get("/villas"),
  getById: (villaID) => apiClient.get(`/villas/${villaID}`),
  update: (villaID, updates) => apiClient.patch(`/villas/${villaID}`, updates),

  getActivityStatus: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}`),
  getAllActivityStatuses: (villaID) => apiClient.get(`/villas/${villaID}/activities`),
  getActivityStatusHistory: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/history`),
  getDashboard: (villaID) => apiClient.get(`/villas/${villaID}/dashboard`),
  getPlannedDates: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/planned-dates`),
  updateActivityStatus: (villaID, tableItemId, { status, completedDate, note }) =>
    apiClient.patch(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}`, {
      status,
      completedDate,
      note,
    }),
  // Every villa/item currently marked NCR, with date + reason — feeds
  // NcrReport.jsx directly (not villa-scoped, so this sits alongside
  // /villas/:villaID rather than under it).
  getNcrReport: () => apiClient.get(`/villas/ncr-report`),
  // Every (villa, item) that has ever had a status recorded — feeds the
  // "Villa Status" tab of the Quality dashboard.
  getStatusReport: () => apiClient.get(`/villas/status-report`),
  // Wipes every NCR across the project — destructive, no undo. NcrReport.jsx confirms with the user first.
  clearNcrReport: () => apiClient.delete(`/villas/ncr-report`),

  // Multi-NCR tracker for one villa/item — independent of the main
  // activity status, so an item can have several NCRs open at once.
  getNcrs: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/ncrs`),
  addNcr: (villaID, tableItemId, { openedDate, note }) =>
    apiClient.post(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/ncrs`, { openedDate, note }),
  updateNcr: (villaID, tableItemId, ncrId, { closed, closedDate, closingNote, note, openedDate }) =>
    apiClient.patch(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/ncrs/${ncrId}`, {
      closed,
      closedDate,
      closingNote,
      note,
      openedDate,
    }),

  getInvoiceStatus: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/invoices/${encodeURIComponent(tableItemId)}`),
  getAllInvoiceStatuses: (villaID) => apiClient.get(`/villas/${villaID}/invoices`),
  updateInvoiceStatus: (villaID, tableItemId, status) =>
    apiClient.patch(`/villas/${villaID}/invoices/${encodeURIComponent(tableItemId)}`, { status }),
};
