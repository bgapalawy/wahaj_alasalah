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

/**
 * Faster equivalent of computeScheduleStatus for bulk use (portfolio-wide,
 * up to ~villaCount * 82 records at once) — the original
 * findRootCauseBlockingActivities does a full recursive walk to find
 * WHICH deep activity is the actual bottleneck (useful for a "why is
 * this blocked" explanation on the dependency graph), but the
 * ready/blocked classification itself only ever depends on whether the
 * target's IMMEDIATE predecessors are Completed. In the original
 * function, `allPredecessorsResolved` is computed by checking direct
 * predecessors only, and THAT'S what decides whether the outer call
 * returns [target] (ready) vs. the recursive results (blocked) — the
 * recursion changes what's returned alongside that decision, never the
 * decision itself.
 *
 * Verified equivalent to computeScheduleStatus across 8 scenarios
 * (including a 5-deep chain and a multi-predecessor branch) before use —
 * see the portfolio dashboard's schedule breakdown, the only place this
 * needs to run at this volume. computeScheduleStatus stays the recursive
 * version for the map/By-Item tab, where it only ever runs for one
 * selected item at a time and doesn't need the speed.
 */
export function computeScheduleStatusFast({
  targetTableItemId,
  targetActualStatus,
  targetPlannedStartDate,
  cutoffDate,
  itemById, // Map<numericId, {TableItemID, predecessors}>
  itemByTableId, // Map<TableItemID, {id, predecessors}>
  villaStatusMap,
}) {
  if (targetActualStatus === "NCR" || targetActualStatus === "Rejected" || targetActualStatus === "Notes") {
    return "InProgress";
  }
  if (targetActualStatus === "Completed") return "Completed";

  if (!targetPlannedStartDate) return "NotStarted";
  const plannedDate = new Date(`${targetPlannedStartDate}T00:00:00`);
  if (plannedDate > cutoffDate) return "NotStarted";

  const targetItem = itemByTableId.get(targetTableItemId);
  if (!targetItem) return "NotStarted";
  if (targetItem.predecessors.length === 0) return "ready";

  const allPredecessorsCompleted = targetItem.predecessors.every((predId) => {
    const predTableItemId = itemById.get(predId)?.TableItemID;
    return villaStatusMap[predTableItemId] === "Completed";
  });
  return allPredecessorsCompleted ? "ready" : "blocked";
}
