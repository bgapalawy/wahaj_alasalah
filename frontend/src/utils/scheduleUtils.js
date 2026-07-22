import { findRootCauseBlockingActivities } from "./graphUtils.js";

/**
 * Ports the original app's "Schedule" monitoring mode: combines a
 * planned date, actual status, and the dependency graph to answer "is
 * this villa/item actually on track" rather than just "what's its raw
 * status."
 *
 *   - NCR / Rejected / Notes  -> "InProgress"
 *   - Completed               -> "Completed"
 *   - NotStarted, not yet due (planned start is after the cutoff date)
 *                              -> "NotStarted"
 *   - NotStarted, due already:
 *       - no incomplete predecessors -> "ready" (should be started)
 *       - blocked by a predecessor   -> "blocked"
 */
export function computeScheduleStatus({
  targetTableItemId,
  targetActualStatus,
  targetPlannedStartDate,
  cutoffDate,
  allActivitiesTemplate,
  villaStatusMap,
}) {
  if (targetActualStatus === "NCR" || targetActualStatus === "Rejected" || targetActualStatus === "Notes") {
    return "InProgress";
  }
  if (targetActualStatus === "Completed") return "Completed";

  // NotStarted from here on.
  if (!targetPlannedStartDate) return "NotStarted"; // no date to judge "due" against
  const plannedDate = new Date(`${targetPlannedStartDate}T00:00:00`);
  if (plannedDate > cutoffDate) return "NotStarted";

  const targetItem = allActivitiesTemplate.find((a) => a.TableItemID === targetTableItemId);
  if (!targetItem) return "NotStarted";

  const activitiesWithStatus = allActivitiesTemplate.map((a) => ({
    ...a,
    status: villaStatusMap[a.TableItemID] ?? "NotStarted",
  }));

  const blocking = findRootCauseBlockingActivities(targetItem.id, activitiesWithStatus);
  if (blocking.length === 0) return "Completed"; // no blockers left means it should already be done
  return blocking[0]?.id === targetItem.id ? "ready" : "blocked";
}
