// scripts/reseed-construction-items.js
//
// Replaces every row in the `construction_items` table with whatever is
// currently in data/constructionItems.js. Needed because
// constructionItemsCatalogService.js reads live from this table, not
// from the static file directly — editing the file alone does nothing
// until this is run.
//
// Run from the backend/ folder, with DATABASE_URL available (either via
// a local .env that dotenv picks up, or by running this through Render's
// Shell tab on the backend service so it uses the same DATABASE_URL the
// live app uses):
//
//   node scripts/reseed-construction-items.js --dry-run   (preview only, no writes)
//   node scripts/reseed-construction-items.js --write     (actually replaces the table)
//
// Mirrors the --dry-run / --write pattern already used by
// migrate-to-postgres.js in this same scripts/ folder, so it's
// consistent with how this project already does one-off data scripts.

import "dotenv/config";
import { query } from "../src/config/postgres.js";
import { constructionItems } from "../src/data/constructionItems.js";

const write = process.argv.includes("--write");
const dryRun = process.argv.includes("--dry-run") || !write;

async function main() {
  console.log(`Loaded ${constructionItems.length} items from data/constructionItems.js`);

  // Sanity checks before touching the database — catch a typo'd
  // predecessor id or a duplicate TableItemID now, not as a broken
  // dependency graph in the app later.
  const validIds = new Set(constructionItems.map((i) => i.id));
  const seenTableIds = new Set();
  let hadError = false;

  for (const item of constructionItems) {
    if (seenTableIds.has(item.TableItemID)) {
      console.error(`Duplicate TableItemID: ${item.TableItemID}`);
      hadError = true;
    }
    seenTableIds.add(item.TableItemID);

    for (const pred of item.predecessors ?? []) {
      if (!validIds.has(pred)) {
        console.error(`Item ${item.id} (${item.TableItemID}) has an unknown predecessor id: ${pred}`);
        hadError = true;
      }
    }
  }

  if (hadError) {
    console.error("\nFix the errors above before reseeding — aborting.");
    process.exit(1);
  }

  console.log("Validation passed: no duplicate TableItemIDs, all predecessor ids resolve.\n");

  if (dryRun) {
    console.log("--- DRY RUN (no changes made) ---");
    console.log("Would DELETE all rows from construction_items, then INSERT:");
    for (const item of constructionItems) {
      console.log(`  ${item.id}\t${item.TableItemID}\t${item.name}\tpredecessors=[${item.predecessors.join(",")}]`);
    }
    console.log(`\nRun with --write to actually apply this.`);
    return;
  }

  console.log("--- WRITE MODE ---");
  await query("BEGIN");
  try {
    const before = await query("SELECT count(*) FROM construction_items");
    console.log(`Existing rows: ${before.rows[0].count}`);

    await query("DELETE FROM construction_items");

    for (const item of constructionItems) {
      await query(
        `INSERT INTO construction_items (item_id, table_item_id, name, name_arabic, predecessors)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.id, item.TableItemID, item.name, item.nameArabic, item.predecessors]
      );
    }

    await query("COMMIT");
    console.log(`Done — construction_items now has ${constructionItems.length} rows.`);
  } catch (err) {
    await query("ROLLBACK");
    console.error("Failed, rolled back. Table left unchanged.");
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
