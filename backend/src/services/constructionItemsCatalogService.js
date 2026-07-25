import { query } from "../config/postgres.js";

/**
 * Construction items catalog, now read from Postgres's construction_items
 * table instead of the static data/constructionItems.js file — so a name
 * or predecessor edit takes effect immediately without a backend
 * redeploy, and the Admin export's English/Arabic name rows are always
 * reading the same authoritative source the rest of the app uses.
 *
 * data/constructionItems.js is kept as-is and still used by
 * migrate-to-postgres.js (the one-time migration script) and as a
 * fallback here if the table is ever empty — but for live reads, this
 * is now the real source of truth.
 *
 * Return shape is unchanged from the static file (id, TableItemID, name,
 * nameArabic, predecessors, status) so nothing downstream — the
 * dependency graph, ConstructionItemSelect, the Admin export's name
 * rows, CustomQueryBuilder — needs to change.
 */
export async function getConstructionItemsCatalog() {
  const { rows } = await query(
    `SELECT item_id, table_item_id, name, name_arabic, predecessors
     FROM construction_items
     ORDER BY item_id`
  );
  return rows.map((r) => ({
    id: r.item_id,
    TableItemID: r.table_item_id,
    name: r.name,
    nameArabic: r.name_arabic,
    predecessors: r.predecessors ?? [],
    status: "NotStarted", // static placeholder, matches the old file — never read live-status through this endpoint
  }));
}
