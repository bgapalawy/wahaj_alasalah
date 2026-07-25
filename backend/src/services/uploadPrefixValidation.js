import { query } from "../config/postgres.js";
import { constructionItems } from "../data/constructionItems.js";

// Mirrors frontend/src/config/fileStatusConfig.js's FILE_STATUS_CATEGORIES
// state list — kept as a plain constant here rather than importing across
// the frontend/backend boundary (separate packages/deployments).
const VALID_STATES = new Set(["NotStarted", "NCR", "Notes", "Rejected", "Completed", "Approval"]);
const VALID_ITEM_IDS = new Set(constructionItems.map((i) => i.TableItemID));

// Matches buildSlotPrefix()'s output exactly: "<TableItemID>-VillaID:<villaID>-<state><slotIndex>"
// or "...-Approval" (no trailing index for that one category).
const PREFIX_PATTERN = /^(.+)-VillaID:([^-]+)-(NotStarted\d+|NCR\d+|Notes\d+|Rejected\d+|Completed\d+|Approval)$/;

/**
 * Without this, the upload/download/delete endpoints accepted any
 * client-supplied prefix string with no check it corresponds to real
 * data — meaning anyone could read, overwrite, or delete files anywhere
 * in the S3 bucket by guessing/enumerating prefixes. This confirms the
 * prefix matches the expected shape AND that both the villa and
 * construction item it names are real.
 */
export async function isValidUploadPrefix(prefix) {
  if (typeof prefix !== "string") return false;
  const match = prefix.match(PREFIX_PATTERN);
  if (!match) return false;

  const [, tableItemId, villaID, stateWithIndex] = match;
  const state = stateWithIndex.replace(/\d+$/, "");
  if (!VALID_STATES.has(state)) return false;
  if (!VALID_ITEM_IDS.has(tableItemId)) return false;

  const { rows } = await query("SELECT 1 FROM villas WHERE villa_id = $1", [villaID]);
  return rows.length > 0;
}
