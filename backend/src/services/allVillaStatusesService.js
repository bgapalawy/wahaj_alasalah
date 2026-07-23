import { tables } from "../config/aws.js";
import { getManyVillaWideItems, scanEntireTable } from "./wideTableService.js";
import { scanValidVillas } from "./villaService.js";

/**
 * Every real villa's full status map (all ~82 construction items), from
 * wajhaData only — no costs, no dates. Used by the frontend's Schedule
 * coloring mode, which needs to check whether an item's PREDECESSORS are
 * Completed (via the same dependency-graph logic already used for the
 * per-villa dependency graph) across every villa at once, not just the
 * one item currently selected.
 */
export async function getAllVillaStatuses() {
  const villas = await scanValidVillas();
  const villaIDs = villas.map((v) => v.villaID).filter(Boolean);
  const statusByVilla = await getManyVillaWideItems(tables.wajhaData, villaIDs);

  const result = {};
  villaIDs.forEach((villaID) => {
    result[villaID] = statusByVilla[villaID] ?? {};
  });
  return result;
}

/**
 * Same shape as getAllVillaStatuses, but from the invoices table —
 * needed by the Custom Query builder, which can filter on either an
 * item's actual status OR its invoice status.
 */
export async function getAllVillaInvoiceStatuses() {
  const villas = await scanValidVillas();
  const villaIDs = villas.map((v) => v.villaID).filter(Boolean);
  const invoiceByVilla = await getManyVillaWideItems(tables.invoices, villaIDs);

  const result = {};
  villaIDs.forEach((villaID) => {
    result[villaID] = invoiceByVilla[villaID] ?? {};
  });
  return result;
}

/**
 * The original app's actual custom-query data source: a full scan of
 * wajha_special_query, returned as-is. Unlike the other wide tables,
 * this one isn't assumed to have any particular fixed set of columns —
 * the original app discovered its columns at runtime (getdynamoDBClientColumns)
 * rather than hardcoding them, and this does the same by just handing
 * back whatever's actually in the table for the frontend to introspect.
 */
export async function getSpecialQueryData() {
  return scanEntireTable(tables.specialQuery);
}
