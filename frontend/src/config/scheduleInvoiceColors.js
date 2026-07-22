// Exact colors from the original app's statusColorMapsch / statusColorMapInvoice.

export const SCHEDULE_STATUS_COLORS = {
  Completed: "#4CAF50",
  InProgress: "#a094ed",
  ready: "#FFFF00",
  blocked: "#F44336",
  NotStarted: "#F2F2F2",
};
export const SCHEDULE_STATUS_ORDER = ["NotStarted", "ready", "blocked", "InProgress", "Completed"];

export const INVOICE_STATUS_COLORS = {
  Paid: "#4CAF50",
  InProgress: "#a094ed",
  ReadyToPay: "#FFFF00",
  NotStarted: "#F2F2F2",
};
export const INVOICE_STATUS_ORDER = ["NotStarted", "ReadyToPay", "InProgress", "Paid"];
