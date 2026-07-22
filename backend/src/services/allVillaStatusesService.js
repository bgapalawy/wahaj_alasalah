import { tables } from "../config/aws.js";
import { getManyVillaWideItems } from "./wideTableService.js";
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
