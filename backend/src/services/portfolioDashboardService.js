import { tables } from "../config/aws.js";
import { getManyVillaWideItems } from "./wideTableService.js";
import { scanValidVillas } from "./villaService.js";
import { computeVillaStatus } from "./activityStatusService.js";
import { constructionItems } from "../data/constructionItems.js";
import { toCostNumber, toDateString } from "../utils/costDateNormalizers.js";
import { getCategory } from "../utils/categoryUtils.js";

/**
 * Portfolio-wide summary across every villa, PLUS a flat per-villa,
 * per-activity `records` array (one row per villa × construction item —
 * up to villaCount * 82 rows) that the frontend filters/aggregates for
 * the category pies, cost trend chart, top-items chart, and the detailed
 * data table. This mirrors the original dashboardallproject.js's
 * `constructionData` / `constructionDataActual` arrays, which did the
 * same "everything in the browser" approach.
 *
 * Cost: 1 villas scan, THEN 5 batched reads (plannedCosts, actualCosts,
 * plannedDates, plannedDatesFinish, actualDates/status) all in true
 * parallel — each chunked 100 villas at a time, so roughly
 * ~5 x ceil(villaCount/100) requests running concurrently, plus the one
 * scan. (Earlier version called listVillas(), which does its own
 * scan+status-batch internally, THEN separately re-batched Actual_dates
 * again here — the exact same table, fetched twice, and forced into two
 * sequential phases instead of one parallel one. Fixed by scanning once
 * and computing status from the same actualDates batch already needed
 * for the records array.)
 *
 * NOTE on `stage`: I'm including `villa.stage` in each record because the
 * original filtered by it, but I haven't confirmed your villas table
 * actually has a `stage` attribute (only `blocknum` was confirmed
 * earlier). If it's missing, stage will just show as null everywhere —
 * harmless, but worth checking your villas table schema if you want that
 * filter to actually do something.
 */
export async function getAllProjectsDashboardData() {
  const villas = await scanValidVillas();
  const villaIDs = villas.map((v) => v.villaID).filter(Boolean);

  const [plannedCostsByVilla, actualCostsByVilla, plannedStartByVilla, plannedFinishByVilla, statusByVilla, dateByVilla] =
    await Promise.all([
      getManyVillaWideItems(tables.plannedCosts, villaIDs),
      getManyVillaWideItems(tables.actualCosts, villaIDs),
      getManyVillaWideItems(tables.plannedDates, villaIDs),
      getManyVillaWideItems(tables.plannedDatesFinish, villaIDs),
      getManyVillaWideItems(tables.wajhaData, villaIDs), // real status, plain strings
      getManyVillaWideItems(tables.actualDates, villaIDs), // completedDate only now
    ]);

  const categoryTotals = {}; // { Civil: { planned, actual }, ... }
  const records = [];

  const villaSummaries = villas.map((villa) => {
    const plannedItem = plannedCostsByVilla[villa.villaID] ?? {};
    const actualItem = actualCostsByVilla[villa.villaID] ?? {};
    const plannedStartItem = plannedStartByVilla[villa.villaID] ?? {};
    const plannedFinishItem = plannedFinishByVilla[villa.villaID] ?? {};
    const statusItem = statusByVilla[villa.villaID] ?? {};
    const dateItem = dateByVilla[villa.villaID] ?? {};

    let plannedCost = 0;
    let actualCost = 0;
    const statusMapForVilla = {};

    constructionItems.forEach((item) => {
      const id = item.TableItemID;
      const category = getCategory(id);
      const planned = toCostNumber(plannedItem[id]);
      const actual = toCostNumber(actualItem[id]);
      const actualStatus = statusItem[id] ?? "NotStarted";
      const actualCompletedDate = dateItem[id]?.completedDate ?? null;

      plannedCost += planned;
      actualCost += actual;
      statusMapForVilla[id] = { status: actualStatus };

      if (!categoryTotals[category]) categoryTotals[category] = { planned: 0, actual: 0 };
      categoryTotals[category].planned += planned;
      categoryTotals[category].actual += actual;

      records.push({
        villaID: villa.villaID,
        blocknum: villa.blocknum ?? null,
        stage: villa.stage ?? null, // see NOTE above — unconfirmed field
        category,
        item: item.name,
        TableItemID: id,
        plannedCost: planned,
        actualCost: actual,
        plannedStartDate: toDateString(plannedStartItem[id]),
        plannedFinishDate: toDateString(plannedFinishItem[id]),
        actualStatus,
        actualCompletedDate,
      });
    });

    return {
      villaID: villa.villaID,
      blocknum: villa.blocknum ?? null,
      status: computeVillaStatus(statusMapForVilla),
      plannedCost,
      actualCost,
      percentComplete: plannedCost > 0 ? (actualCost / plannedCost) * 100 : 0,
    };
  });

  const portfolioTotals = villaSummaries.reduce(
    (acc, v) => {
      acc.plannedCost += v.plannedCost;
      acc.actualCost += v.actualCost;
      return acc;
    },
    { plannedCost: 0, actualCost: 0 }
  );

  const statusCounts = villaSummaries.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    portfolioTotals,
    statusCounts,
    categoryTotals: Object.entries(categoryTotals).map(([category, totals]) => ({ category, ...totals })),
    villas: villaSummaries,
    records,
  };
}
