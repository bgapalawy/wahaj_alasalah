import { query } from "../config/postgres.js";
import { computeVillaStatus } from "./activityStatusService.js";
import { constructionItems } from "../data/constructionItems.js";
import { getCategory } from "../utils/categoryUtils.js";

/**
 * MIGRATED to Postgres. Same gap as allVillaStatusesService.js — missed
 * in the original migration pass, was still doing 7 separate DynamoDB
 * wide-table reads per call (1 scan + 6 batched reads) and merging them
 * in JS. Now one query, CROSS JOINing every villa against every
 * construction item (so all 82 items always appear per villa, matching
 * the original's guaranteed-fixed-shape behavior) then LEFT JOINing the
 * actual status/cost/date/invoice data on top.
 *
 * NOTE on `stage`: kept as null everywhere, same as the original —
 * villas never actually had a confirmed `stage` attribute (only `block`
 * was verified against real data).
 */
export async function getAllProjectsDashboardData() {
  const { rows } = await query(
    `SELECT
       v.villa_id                              AS "villaID",
       v.block                                 AS "blocknum",
       ci.table_item_id                        AS "TableItemID",
       COALESCE(s.status, 'NotStarted')        AS "actualStatus",
       s.planned_cost::float8                  AS "plannedCost",
       s.actual_cost::float8                   AS "actualCost",
       to_char(s.planned_start, 'YYYY-MM-DD')  AS "plannedStartDate",
       to_char(s.planned_finish, 'YYYY-MM-DD') AS "plannedFinishDate",
       to_char(s.actual_date, 'YYYY-MM-DD')    AS "actualCompletedDate",
       COALESCE(i.status, 'NotStarted')        AS "invoiceStatus"
     FROM villas v
     CROSS JOIN construction_items ci
     LEFT JOIN villa_item_status s
       ON s.villa_id = v.villa_id AND s.table_item_id = ci.table_item_id
     LEFT JOIN villa_item_invoice i
       ON i.villa_id = v.villa_id AND i.table_item_id = ci.table_item_id
     ORDER BY v.villa_id, ci.item_id`
  );

  const nameByTableItemId = new Map(constructionItems.map((item) => [item.TableItemID, item.name]));

  const categoryTotals = {};
  const records = [];
  const byVilla = new Map(); // villaID -> { blocknum, statusMapForVilla, plannedCost, actualCost }

  for (const r of rows) {
    const category = getCategory(r.TableItemID);
    const planned = r.plannedCost ?? 0;
    const actual = r.actualCost ?? 0;

    categoryTotals[category] ??= { planned: 0, actual: 0 };
    categoryTotals[category].planned += planned;
    categoryTotals[category].actual += actual;

    records.push({
      villaID: r.villaID,
      blocknum: r.blocknum,
      stage: null, // see NOTE above
      category,
      item: nameByTableItemId.get(r.TableItemID) ?? r.TableItemID,
      TableItemID: r.TableItemID,
      plannedCost: planned,
      actualCost: actual,
      plannedStartDate: r.plannedStartDate,
      plannedFinishDate: r.plannedFinishDate,
      actualStatus: r.actualStatus,
      actualCompletedDate: r.actualCompletedDate,
      invoiceStatus: r.invoiceStatus,
    });

    if (!byVilla.has(r.villaID)) {
      byVilla.set(r.villaID, { blocknum: r.blocknum, statusMapForVilla: {}, plannedCost: 0, actualCost: 0 });
    }
    const villaAcc = byVilla.get(r.villaID);
    villaAcc.statusMapForVilla[r.TableItemID] = { status: r.actualStatus };
    villaAcc.plannedCost += planned;
    villaAcc.actualCost += actual;
  }

  const villaSummaries = Array.from(byVilla.entries()).map(([villaID, acc]) => ({
    villaID,
    blocknum: acc.blocknum,
    status: computeVillaStatus(acc.statusMapForVilla),
    plannedCost: acc.plannedCost,
    actualCost: acc.actualCost,
    percentComplete: acc.plannedCost > 0 ? (acc.actualCost / acc.plannedCost) * 100 : 0,
  }));

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
