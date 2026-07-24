import { query } from "../config/postgres.js";
import { computeVillaStatus, getAllActivityStatuses, getManyActivityStatuses } from "./activityStatusService.js";

/**
 * MIGRATION NOTE: villa ATTRIBUTES (zone/block/villaType/villaNum/etc.)
 * are now read from and written to Postgres — that part of this file is
 * fully migrated. Villa STATUS is deliberately still computed via
 * activityStatusService.js, which is still DynamoDB-backed for now.
 *
 * Why not switch status to Postgres too, even though villa_item_status
 * already has all the migrated data sitting there? Because
 * activityStatusService.updateActivityStatus() (the "Save" button on
 * the villa panel) STILL WRITES to DynamoDB, not Postgres. If listVillas
 * here read status from Postgres while saves still went to DynamoDB,
 * every status edit would appear to succeed but never show up on the
 * map or villa list — a silent, confusing regression. Status read and
 * write need to move together. That's the next phase
 * (activityStatusService.js + invoiceService.js) — this file's status
 * calls stay exactly as they were until then.
 */

/**
 * Column mapping between this app's existing camelCase-ish field names
 * (villaID, zonenum, blocknum, villatype, villanum, TxtMemo, RefName —
 * the exact names used throughout the frontend and other services) and
 * the snake_case Postgres columns. Keeping the OUTWARD shape identical
 * to the old DynamoDB records means nothing downstream needs to change.
 */
function rowToVilla(row) {
  return {
    villaID: row.villa_id,
    zonenum: row.zone,
    blocknum: row.block,
    villatype: row.villa_type,
    villanum: row.villa_num,
    TxtMemo: row.txt_memo,
    RefName: row.ref_name,
  };
}

/**
 * Raw villa list, no status attached. Exported separately from
 * listVillas() so callers that are already about to fetch activity
 * statuses for their own purposes can compute status from that same
 * batch instead of listVillas() fetching it a second time.
 *
 * No isValidVillaID filtering needed anymore — unlike DynamoDB's villas
 * table (which also contained test/junk rows like villaID "id"), the
 * Postgres villas table was seeded directly from villa-parcels.geojson
 * and only ever contains real villas.
 */
export async function scanValidVillas() {
  const { rows } = await query(
    `SELECT villa_id, zone, block, villa_type, villa_num, txt_memo, ref_name
     FROM villas
     ORDER BY villa_id`
  );
  return rows.map(rowToVilla);
}

/**
 * Returns every villa's attribute record with `status` computed live
 * from activity data (see the migration note above for why status still
 * goes through activityStatusService rather than Postgres directly).
 */
export async function listVillas() {
  const villas = await scanValidVillas();

  const villaIDs = villas.map((v) => v.villaID).filter(Boolean);
  let statusMap = {};
  try {
    statusMap = await getManyActivityStatuses(villaIDs);
  } catch (err) {
    // Don't let a broken Actual_dates table take down the whole villa
    // list — fall back to "NotStarted" for everyone and log it.
    console.error("Could not load activity statuses for villa list, defaulting to NotStarted:", err.message);
  }

  return villas.map((villa) => ({
    ...villa,
    status: computeVillaStatus(statusMap[villa.villaID] ?? {}),
  }));
}

export async function getVillaById(villaID) {
  const { rows } = await query(
    `SELECT villa_id, zone, block, villa_type, villa_num, txt_memo, ref_name
     FROM villas WHERE villa_id = $1`,
    [villaID]
  );
  if (rows.length === 0) {
    const err = new Error(`Villa ${villaID} not found`);
    err.status = 404;
    throw err;
  }

  let activityStatuses = {};
  try {
    activityStatuses = await getAllActivityStatuses(villaID);
  } catch (err) {
    console.error(`Could not load activity statuses for ${villaID}, defaulting to NotStarted:`, err.message);
  }

  return { ...rowToVilla(rows[0]), status: computeVillaStatus(activityStatuses) };
}

// Maps the same external field names accepted in the request body to
// their Postgres column — any key not in this list is silently ignored
// rather than erroring, same tolerance the old DynamoDB UpdateCommand
// implicitly had for whatever attributes were passed.
const UPDATABLE_COLUMNS = {
  zonenum: "zone",
  blocknum: "block",
  villatype: "villa_type",
  villanum: "villa_num",
  TxtMemo: "txt_memo",
  RefName: "ref_name",
};

/**
 * Partial update of a villa record. NOTE (unchanged from the DynamoDB
 * version): `status` is not a settable field here — it's computed live
 * from activity data on every read, so passing a "status" key would be
 * silently ignored (it's not in UPDATABLE_COLUMNS).
 *
 * Not currently called from the frontend UI (villasApi.update exists in
 * api/villas.js but nothing invokes it yet) — migrated for completeness
 * and API-contract parity, but lower priority to test than the read
 * paths above.
 */
export async function updateVilla(villaID, updates) {
  const setClauses = [];
  const params = [villaID];
  for (const [key, value] of Object.entries(updates)) {
    const column = UPDATABLE_COLUMNS[key];
    if (!column) continue;
    params.push(value);
    setClauses.push(`${column} = $${params.length}`);
  }

  if (setClauses.length === 0) {
    const err = new Error("No recognized fields provided to update");
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `UPDATE villas SET ${setClauses.join(", ")} WHERE villa_id = $1
     RETURNING villa_id, zone, block, villa_type, villa_num, txt_memo, ref_name`,
    params
  );
  if (rows.length === 0) {
    const err = new Error(`Villa ${villaID} not found`);
    err.status = 404;
    throw err;
  }
  return rowToVilla(rows[0]);
}
