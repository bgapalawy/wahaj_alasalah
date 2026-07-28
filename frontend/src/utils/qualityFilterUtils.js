/**
 * Filter/matching helpers shared by every Quality dashboard tab
 * (NcrReport, OutOfSequenceReport, VillaStatusReport, LastItemReport,
 * SchedulingReport). Zone/block/villaType/villa/status filters are all
 * multi-select arrays here — `[]` means "no filter, everything
 * matches," consistent across every function below.
 *
 * Hierarchy: Zone > Block > Villa Type > Villa — the same cascade
 * MapView.jsx's own filter bar already uses. Each level's option list
 * narrows based on whatever's selected above it (getBlockOptions only
 * needs zones; getVillaTypeOptions needs zones+blocks; getVillaOptions
 * needs all three), and each report clears every filter BELOW whichever
 * level just changed, so a stale selection from before a zone change
 * can't silently keep filtering on something no longer in scope.
 */

export function getZoneOptions(villaMetaByID) {
  const zones = new Set();
  Object.values(villaMetaByID ?? {}).forEach((m) => {
    if (m?.zonenum != null && m.zonenum !== "") zones.add(String(m.zonenum));
  });
  return [...zones].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** `zones` — array of selected zone strings ([] = all zones) — narrows which blocks are offered. */
export function getBlockOptions(villaMetaByID, zones = []) {
  const blocks = new Set();
  Object.values(villaMetaByID ?? {}).forEach((m) => {
    if (m?.blocknum == null || m.blocknum === "") return;
    if (zones.length > 0 && !zones.includes(String(m.zonenum ?? ""))) return;
    blocks.add(String(m.blocknum));
  });
  return [...blocks].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** `zones`/`blocks` — selected so far — narrows which villa types are offered. */
export function getVillaTypeOptions(villaMetaByID, zones = [], blocks = []) {
  const types = new Set();
  Object.values(villaMetaByID ?? {}).forEach((m) => {
    if (m?.villatype == null || m.villatype === "") return;
    if (zones.length > 0 && !zones.includes(String(m.zonenum ?? ""))) return;
    if (blocks.length > 0 && !blocks.includes(String(m.blocknum ?? ""))) return;
    types.add(String(m.villatype));
  });
  return [...types].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Villa ID options for the villa multi-select, narrowed by zone/block/villaType so far and sorted numerically (V_2 before V_10). */
export function getVillaOptions(villaMetaByID, zones = [], blocks = [], villaTypes = []) {
  return Object.entries(villaMetaByID ?? {})
    .filter(([, m]) => {
      if (zones.length > 0 && !zones.includes(String(m?.zonenum ?? ""))) return false;
      if (blocks.length > 0 && !blocks.includes(String(m?.blocknum ?? ""))) return false;
      if (villaTypes.length > 0 && !villaTypes.includes(String(m?.villatype ?? ""))) return false;
      return true;
    })
    .map(([villaID]) => villaID)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** The actual row-matching test — same zones/blocks/villaTypes arrays as the option-list functions above, so a row passes exactly when it belongs to the currently-visible option lists. */
export function matchesGeoFilters(villaID, villaMetaByID, zones = [], blocks = [], villaTypes = []) {
  if (zones.length === 0 && blocks.length === 0 && villaTypes.length === 0) return true;
  const meta = villaMetaByID?.[villaID];
  if (zones.length > 0 && !zones.includes(String(meta?.zonenum ?? ""))) return false;
  if (blocks.length > 0 && !blocks.includes(String(meta?.blocknum ?? ""))) return false;
  if (villaTypes.length > 0 && !villaTypes.includes(String(meta?.villatype ?? ""))) return false;
  return true;
}

/** Generic multi-select match — `selected` empty means "no filter." */
export function matchesMultiSelect(value, selected = []) {
  return selected.length === 0 || selected.includes(value);
}

/** Plain string comparison works fine — every date here is normalized to YYYY-MM-DD server-side. */
export function matchesDateRange(dateStr, from, to) {
  if (!from && !to) return true;
  if (!dateStr) return false; // a range filter is active but this row has no date to compare
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

/**
 * Ported directly from graphUtils.js's findRootCauseBlockingActivities —
 * the SAME recursive walk the dependency graph itself uses to find the
 * true deep bottleneck(s), not just an item's immediate predecessors
 * (which is what this file used to approximate here — wrong whenever
 * the real blocker is further back in the chain than one hop). Kept as
 * an internal (non-exported) helper; getRootCauseBlockers below is the
 * public entry point both ScheduleStatusPanel.jsx and
 * SchedulingReport.jsx use.
 */
function findRootCauseBlockingActivities(activityId, activities, visited = new Set()) {
  const activity = activities.find((act) => act.id === activityId);
  if (!activity) return [];
  if (visited.has(activityId)) return [];
  visited.add(activityId);

  if (activity.status === "Completed") return [];

  if (activity.predecessors.length === 0) {
    return [{ id: activity.id, TableItemID: activity.TableItemID, name: activity.name, status: activity.status }];
  }

  let blockingActivities = [];
  for (const predecessorId of activity.predecessors) {
    blockingActivities = blockingActivities.concat(
      findRootCauseBlockingActivities(predecessorId, activities, visited)
    );
  }

  const allPredecessorsResolved = activity.predecessors.every((predId) => {
    const predActivity = activities.find((act) => act.id === predId);
    return predActivity?.status === "Completed";
  });

  if (allPredecessorsResolved) {
    return [{ id: activity.id, TableItemID: activity.TableItemID, name: activity.name, status: activity.status }];
  }

  return blockingActivities;
}

/**
 * The true root-cause blocker(s) for `targetItem` — same function
 * computeScheduleStatus (the non-fast, single-item classifier) and the
 * dependency graph already use to decide ready vs. blocked, applied
 * here purely for its "which activities" answer rather than its
 * ready/blocked verdict. When the target itself comes back as its own
 * root cause, that means "ready" (nothing else is blocking it) — filtered
 * out here, since that's not a blocker to display, it's the item itself.
 *
 * `constructionItemsTemplate` — the raw array (needs `.id`,
 * `.predecessors`, `.name`, `.TableItemID` per item — exactly what
 * constructionItemsApi.list() already returns), not the id/TableItemID
 * Maps used elsewhere in this codebase, since the ported function does
 * its own `.find()` lookups by numeric id the same way the original
 * does. `flatStatusMap` — {TableItemID: "StatusString"} for this villa.
 */
export function getRootCauseBlockers(targetItem, constructionItemsTemplate, flatStatusMap) {
  if (!targetItem) return [];
  const activitiesWithStatus = constructionItemsTemplate.map((a) => ({
    ...a,
    status: flatStatusMap[a.TableItemID] ?? "NotStarted",
  }));
  const blocking = findRootCauseBlockingActivities(targetItem.id, activitiesWithStatus);
  return blocking.filter((b) => b.id !== targetItem.id);
}
