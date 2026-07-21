// Exact colors from the original app's statusColorMap — used both by the
// "By Item" dashboard tab and the map's per-item coloring mode, so a villa
// colored on the map matches the same color in that dashboard's pie.
export const ITEM_STATUS_COLORS = {
  Completed: "#4CAF50",
  Notes: "#a094ed",
  NCR: "#FFFF00",
  Rejected: "#F44336",
  NotStarted: "#F2F2F2",
};

export const ITEM_STATUS_ORDER = ["NotStarted", "NCR", "Notes", "Rejected", "Completed"];
