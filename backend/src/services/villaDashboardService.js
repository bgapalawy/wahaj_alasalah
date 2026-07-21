import { tables } from "../config/aws.js";
import { getVillaWideItem } from "./wideTableService.js";
import { getAllActivityStatuses } from "./activityStatusService.js";
import { constructionItems } from "../data/constructionItems.js";
import { toCostNumber, toDateString } from "../utils/costDateNormalizers.js";

/**
 * Returns every construction item joined with this villa's planned/actual
 * cost and planned/actual dates — the raw material the villa dashboard
 * aggregates into charts on the frontend.
 */
export async function getVillaDashboardData(villaID) {
  const [plannedCosts, actualCosts, plannedStartDates, plannedFinishDates, actualStatuses] =
    await Promise.all([
      getVillaWideItem(tables.plannedCosts, villaID),
      getVillaWideItem(tables.actualCosts, villaID),
      getVillaWideItem(tables.plannedDates, villaID),
      getVillaWideItem(tables.plannedDatesFinish, villaID),
      getAllActivityStatuses(villaID),
    ]);

  return constructionItems.map((item) => {
    const id = item.TableItemID;
    const actual = actualStatuses[id] ?? {};
    return {
      TableItemID: id,
      name: item.name,
      plannedCost: toCostNumber(plannedCosts[id]),
      actualCost: toCostNumber(actualCosts[id]),
      plannedStartDate: toDateString(plannedStartDates[id]),
      plannedFinishDate: toDateString(plannedFinishDates[id]),
      actualStatus: actual.status ?? "NotStarted",
      actualCompletedDate: actual.completedDate ?? null,
    };
  });
}

/**
 * Planned/actual cost + planned start/finish date for one construction
 * item on one villa — used by the construction-item picker in the panel.
 * Lighter than the full 82-item dashboard join since it only reads the
 * one item this villa's panel actually needs.
 */
export async function getPlannedDatesForItem(villaID, tableItemId) {
  const [plannedStartDates, plannedFinishDates, plannedCosts, actualCosts] = await Promise.all([
    getVillaWideItem(tables.plannedDates, villaID),
    getVillaWideItem(tables.plannedDatesFinish, villaID),
    getVillaWideItem(tables.plannedCosts, villaID),
    getVillaWideItem(tables.actualCosts, villaID),
  ]);
  return {
    plannedStartDate: toDateString(plannedStartDates[tableItemId]),
    plannedFinishDate: toDateString(plannedFinishDates[tableItemId]),
    plannedCost: toCostNumber(plannedCosts[tableItemId]),
    actualCost: toCostNumber(actualCosts[tableItemId]),
  };
}
