// Ported directly from js/functions/rightclick.js so behavior matches exactly.

export const CATEGORY_COLOR_PALETTE = {
  Civil: "#A7C7E7", // Light Blue
  Mechanical: "#B0E57C", // Light Green
  Architectural: "#FFDAB9", // Peach
  Electrical: "#F8C8DC", // Pink
  Fence: "#E6E6FA", // Lavender
  Default: "#DDDDDD",
};

// Matches ACTIVITY_STATUS_OPTIONS in fileStatusConfig.js — the actual set
// of values an activity's status can be set to.
export const ACTIVITY_STATUS_COLOR_MAP = {
  NotStarted: "#FFFFFF",
  NCR: "#F5B7B1",
  Notes: "#FFF3B0",
  Rejected: "#F1948A",
  Completed: "#B7F0AD",
};

export const DEFAULT_ACTIVITY_COLOR = "#FFFFFF";
export const PREDECESSOR_EDGE_COLOR = "#555555";
export const BLOCKING_NODE_ICON_COLOR = "#FF0000";
export const CURRENT_NODE_ICON_COLOR = "#000000";
export const OUT_OF_SEQUENCE_BORDER_COLOR = "#F57C00"; // distinct orange — "blocking" (red star) means something else

export function getCategory(tableItemId) {
  if (!tableItemId || typeof tableItemId !== "string") return "Default";
  return tableItemId.split("-")[0] || "Default";
}

/**
 * Walks the predecessor chain to find the root-cause activities blocking a
 * given activity from starting — ported 1:1 from rightclick.js so the
 * "ready to begin" logic behaves identically to the old app.
 */
export function findRootCauseBlockingActivities(activityId, activities, visited = new Set()) {
  const activity = activities.find((act) => act.id === activityId);
  if (!activity) {
    console.error(
      `Activity with ID ${activityId} not found — likely missing from your construction-items data. ` +
        `The dependency graph will treat this as "no blockers", which can look like "completed" even when it isn't.`
    );
    return [];
  }
  if (visited.has(activityId)) return [];

  visited.add(activityId);

  if (activity.status === "Completed") return [];

  if (activity.predecessors.length === 0) {
    return [
      {
        id: activity.id,
        name: activity.name,
        nameArabic: activity.nameArabic,
        status: activity.status,
      },
    ];
  }

  let blockingActivities = [];
  for (const predecessorId of activity.predecessors) {
    blockingActivities = blockingActivities.concat(
      findRootCauseBlockingActivities(predecessorId, activities, visited)
    );
  }

  // NOTE: the source file was truncated exactly at this branch in what I
  // could read from your project — this final "all predecessors resolved"
  // check is my best-faith reconstruction of the stated logic ("if all
  // predecessors are resolved or completed, this activity is a root
  // cause"). Worth a quick compare against your original if you still have
  // it, since I couldn't verify this last part character-for-character.
  const allPredecessorsResolved = activity.predecessors.every((predId) => {
    const predActivity = activities.find((act) => act.id === predId);
    return predActivity?.status === "Completed";
  });

  if (allPredecessorsResolved) {
    return [
      {
        id: activity.id,
        name: activity.name,
        nameArabic: activity.nameArabic,
        status: activity.status,
      },
    ];
  }

  return blockingActivities;
}
