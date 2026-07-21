import { tables } from "../config/aws.js";
import { getManyVillaWideItems } from "./wideTableService.js";
import { scanValidVillas } from "./villaService.js";
import { toCostNumber, toDateString } from "../utils/costDateNormalizers.js";

/**
 * One construction item's data across every villa — replaces the
 * "monitoring type 1" flow in dashboardconstructionitem.js /
 * constructionItemsContainer.js, which counted villas by status for a
 * single selected item and showed planned/actual value + timeline dates.
 *
 * Status comes from wajhaData (the real, original status source — plain
 * string values); completedDate still comes from Actual_dates.
 */
export async function getConstructionItemDashboardData(tableItemId) {
  const villas = await scanValidVillas();
  const villaIDs = villas.map((v) => v.villaID).filter(Boolean);

  const [plannedCostsByVilla, actualCostsByVilla, plannedStartByVilla, plannedFinishByVilla, statusByVilla, dateByVilla] =
    await Promise.all([
      getManyVillaWideItems(tables.plannedCosts, villaIDs),
      getManyVillaWideItems(tables.actualCosts, villaIDs),
      getManyVillaWideItems(tables.plannedDates, villaIDs),
      getManyVillaWideItems(tables.plannedDatesFinish, villaIDs),
      getManyVillaWideItems(tables.wajhaData, villaIDs),
      getManyVillaWideItems(tables.actualDates, villaIDs),
    ]);

  return villas.map((villa) => ({
    villaID: villa.villaID,
    blocknum: villa.blocknum ?? null,
    stage: villa.stage ?? null,
    plannedCost: toCostNumber(plannedCostsByVilla[villa.villaID]?.[tableItemId]),
    actualCost: toCostNumber(actualCostsByVilla[villa.villaID]?.[tableItemId]),
    plannedStartDate: toDateString(plannedStartByVilla[villa.villaID]?.[tableItemId]),
    plannedFinishDate: toDateString(plannedFinishByVilla[villa.villaID]?.[tableItemId]),
    actualStatus: statusByVilla[villa.villaID]?.[tableItemId] ?? "NotStarted",
    actualCompletedDate: dateByVilla[villa.villaID]?.[tableItemId]?.completedDate ?? null,
  }));
}
