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
  // Every audit log entry, most recent first — feeds the "History" tab
  // of the Quality dashboard.
  getAuditLog: () => apiClient.get(`/villas/audit-log`),
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

  // Dated remarks against one villa/item's computed schedule status
  // (e.g. "procurement issue") — independent of NCRs and the main
  // activity status.
  getScheduleNotes: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/schedule-notes`),
  addScheduleNote: (villaID, tableItemId, { noteDate, note }) =>
    apiClient.post(`/villas/${villaID}/activities/${encodeURIComponent(tableItemId)}/schedule-notes`, { noteDate, note }),
  // Every schedule note across the project, joined with each row's
  // planned start + current actual status — feeds the "Scheduling" tab
  // of the Quality dashboard.
  getScheduleNotesReport: () => apiClient.get(`/villas/schedule-notes-report`),

  getInvoiceStatus: (villaID, tableItemId) =>
    apiClient.get(`/villas/${villaID}/invoices/${encodeURIComponent(tableItemId)}`),
  getAllInvoiceStatuses: (villaID) => apiClient.get(`/villas/${villaID}/invoices`),
  updateInvoiceStatus: (villaID, tableItemId, status) =>
    apiClient.patch(`/villas/${villaID}/invoices/${encodeURIComponent(tableItemId)}`, { status }),
};
