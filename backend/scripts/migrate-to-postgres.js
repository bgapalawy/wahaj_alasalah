/**
 * One-time DynamoDB -> Postgres (Neon) migration.
 *
 * Reuses your existing scanEntireTable() helper (already handles
 * DynamoDB's pagination correctly) and the same isValidVillaID() filter
 * listVillas() uses, so this reads through the exact same lens your app
 * already trusts.
 *
 * villas comes from frontend/public/data/villa-parcels.geojson, NOT a
 * DynamoDB scan — confirmed against the real file that it has all 1,540
 * villas with every field populated (zonenum/blocknum/villatype/villanum/
 * TxtMemo/RefName), while DynamoDB's own villas table only has rows for
 * villas that already have construction activity entered (590 today).
 * Seeding from the GeoJSON means every real parcel exists in Postgres
 * from day one, not just the ones DynamoDB happens to know about yet.
 *
 * SAFE BY DEFAULT: run with --dry-run first. It scans everything, prints
 * counts and a few sample rows, and writes NOTHING. Only add --write once
 * those numbers look right to you.
 *
 *   node scripts/migrate-to-postgres.js --dry-run
 *   node scripts/migrate-to-postgres.js --write
 *
 * Requires both backend/.env (existing DynamoDB config) AND
 * DATABASE_URL (your Neon connection string) to be set.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { tables } from "../src/config/aws.js";
import { pool } from "../src/config/postgres.js";
import { scanEntireTable } from "../src/services/wideTableService.js";
import { isValidVillaID } from "../src/utils/villaIdRange.js";
import { toDateString, toCostNumber } from "../src/utils/costDateNormalizers.js";
import { constructionItems } from "../src/data/constructionItems.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// backend/scripts/ -> backend/ -> repo root -> frontend/public/data/...
const GEOJSON_PATH = resolve(__dirname, "../../frontend/public/data/villa-parcels.geojson");

const WRITE = process.argv.includes("--write");
const BATCH_SIZE = 500;

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

// --- construction_items ---------------------------------------------
async function migrateConstructionItems() {
  console.log(`\n== construction_items (${constructionItems.length} rows, from data/constructionItems.js) ==`);
  if (!WRITE) return;
  for (const item of constructionItems) {
    await pool.query(
      `INSERT INTO construction_items (table_item_id, item_id, name, name_arabic, predecessors)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (table_item_id) DO UPDATE SET
         item_id = EXCLUDED.item_id, name = EXCLUDED.name,
         name_arabic = EXCLUDED.name_arabic, predecessors = EXCLUDED.predecessors`,
      [item.TableItemID, item.id, item.name, item.nameArabic ?? null, item.predecessors ?? []]
    );
  }
  console.log("  written.");
}

// --- villas (from the GeoJSON, not DynamoDB — see header note) ---------
async function migrateVillas() {
  console.log(`\n== villas (from ${GEOJSON_PATH}) ==`);
  const geojson = JSON.parse(readFileSync(GEOJSON_PATH, "utf8"));
  const valid = (geojson.features ?? [])
    .filter((f) => f.properties?.villaID && f.properties.villaID !== "NOT_VILLA")
    .map((f) => f.properties);
  console.log(`  ${geojson.features.length} total features, ${valid.length} real villas`);
  console.log("  sample:", JSON.stringify(valid[0], null, 2));

  if (!WRITE) return;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    chunk.forEach((v, idx) => {
      const base = idx * 7;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
      params.push(
        v.villaID,
        pick(v, ["villanum"]),
        pick(v, ["zonenum"]),
        pick(v, ["blocknum"]),
        pick(v, ["villatype"]),
        pick(v, ["TxtMemo"]),
        pick(v, ["RefName"])
      );
    });
    await pool.query(
      `INSERT INTO villas (villa_id, villa_num, zone, block, villa_type, txt_memo, ref_name)
       VALUES ${values.join(", ")}
       ON CONFLICT (villa_id) DO UPDATE SET
         villa_num = EXCLUDED.villa_num, zone = EXCLUDED.zone, block = EXCLUDED.block,
         villa_type = EXCLUDED.villa_type, txt_memo = EXCLUDED.txt_memo, ref_name = EXCLUDED.ref_name`,
      params
    );
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, valid.length)}/${valid.length}`);
  }
}

// --- villa_item_status (merges 5 wide DDB tables into one long table) --
async function migrateItemStatus() {
  console.log(`\n== villa_item_status (merging shams_elgroubData/plannedDates/plannedDatesFinish/actualDates/plannedCosts/actualCosts) ==`);
  const [statusRows, plannedStart, plannedFinish, actualDates, plannedCosts, actualCosts] = await Promise.all([
    scanEntireTable(tables.shams_elgroubData),
    scanEntireTable(tables.plannedDates),
    scanEntireTable(tables.plannedDatesFinish),
    scanEntireTable(tables.actualDates),
    scanEntireTable(tables.plannedCosts),
    scanEntireTable(tables.actualCosts),
  ]);

  // Index each wide table by villaID for O(1) lookup while merging.
  // Some tables (confirmed: at least one has "Civil-11_CompletionDate"
  // style keys alongside the plain "Civil-11" ones) carry extra
  // non-standard columns that aren't real TableItemIDs. Rather than
  // crash on the foreign key constraint partway through a write (as
  // happened the first time), skip anything that isn't a known item and
  // report exactly what got skipped so you can decide if that data
  // needs handling separately.
  const validItemIds = new Set(constructionItems.map((c) => c.TableItemID));
  const skipped = {};
  const byVilla = {};
  function indexInto(rows, mapper) {
    for (const row of rows) {
      const { villaID, ...rest } = row;
      if (!isValidVillaID(villaID)) continue;
      byVilla[villaID] ??= {};
      for (const [tableItemId, value] of Object.entries(rest)) {
        if (!validItemIds.has(tableItemId)) {
          skipped[tableItemId] = (skipped[tableItemId] ?? 0) + 1;
          continue;
        }
        byVilla[villaID][tableItemId] ??= {};
        mapper(byVilla[villaID][tableItemId], value);
      }
    }
  }
  indexInto(statusRows, (acc, v) => { acc.status = typeof v === "string" ? v : v?.status; });
  indexInto(plannedStart, (acc, v) => { acc.plannedStart = toDateString(v); });
  indexInto(plannedFinish, (acc, v) => { acc.plannedFinish = toDateString(v); });
  indexInto(actualDates, (acc, v) => { acc.actualDate = toDateString(typeof v === "object" ? v?.completedDate : v); });
  indexInto(plannedCosts, (acc, v) => { acc.plannedCost = toCostNumber(v); });
  indexInto(actualCosts, (acc, v) => { acc.actualCost = toCostNumber(v); });

  if (Object.keys(skipped).length > 0) {
    console.log(`  SKIPPED ${Object.keys(skipped).length} non-standard column name(s) (not in construction_items):`);
    console.log(" ", JSON.stringify(skipped, null, 2));
  }

  const flatRows = [];
  for (const [villaID, items] of Object.entries(byVilla)) {
    for (const [tableItemId, fields] of Object.entries(items)) {
      flatRows.push({ villaID, tableItemId, ...fields });
    }
  }
  console.log(`  merged into ${flatRows.length} (villa, item) rows`);
  console.log("  sample:", JSON.stringify(flatRows[0], null, 2));

  if (!WRITE) return;
  for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
    const chunk = flatRows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    chunk.forEach((r, idx) => {
      const base = idx * 8;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
      params.push(
        r.villaID, r.tableItemId, r.status ?? "NotStarted",
        r.plannedStart ?? null, r.plannedFinish ?? null, r.actualDate ?? null,
        r.plannedCost ?? null, r.actualCost ?? null
      );
    });
    await pool.query(
      `INSERT INTO villa_item_status (villa_id, table_item_id, status, planned_start, planned_finish, actual_date, planned_cost, actual_cost)
       VALUES ${values.join(", ")}
       ON CONFLICT (villa_id, table_item_id) DO UPDATE SET
         status = EXCLUDED.status, planned_start = EXCLUDED.planned_start,
         planned_finish = EXCLUDED.planned_finish, actual_date = EXCLUDED.actual_date,
         planned_cost = EXCLUDED.planned_cost, actual_cost = EXCLUDED.actual_cost`,
      params
    );
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, flatRows.length)}/${flatRows.length}`);
  }
}

// --- villa_item_invoice --------------------------------------------------
async function migrateInvoices() {
  console.log(`\n== villa_item_invoice (from DDB table "${tables.invoices}") ==`);
  const rows = await scanEntireTable(tables.invoices);
  const validItemIds = new Set(constructionItems.map((c) => c.TableItemID));
  const skipped = {};
  const flatRows = [];
  for (const row of rows) {
    const { villaID, ...items } = row;
    if (!isValidVillaID(villaID)) continue;
    for (const [tableItemId, status] of Object.entries(items)) {
      if (!validItemIds.has(tableItemId)) {
        skipped[tableItemId] = (skipped[tableItemId] ?? 0) + 1;
        continue;
      }
      flatRows.push({ villaID, tableItemId, status });
    }
  }
  if (Object.keys(skipped).length > 0) {
    console.log(`  SKIPPED ${Object.keys(skipped).length} non-standard column name(s) (not in construction_items):`);
    console.log(" ", JSON.stringify(skipped, null, 2));
  }
  console.log(`  ${flatRows.length} (villa, item) invoice rows`);

  if (!WRITE) return;
  for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
    const chunk = flatRows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    chunk.forEach((r, idx) => {
      const base = idx * 3;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      params.push(r.villaID, r.tableItemId, r.status ?? "NotStarted");
    });
    await pool.query(
      `INSERT INTO villa_item_invoice (villa_id, table_item_id, status)
       VALUES ${values.join(", ")}
       ON CONFLICT (villa_id, table_item_id) DO UPDATE SET status = EXCLUDED.status`,
      params
    );
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, flatRows.length)}/${flatRows.length}`);
  }
}

// --- villa_special_query_values -------------------------------------------
// This table was missed in the original migration pass entirely (caught
// when a Special Query export came back empty) — unlike the other six
// wide tables, nothing here ever populated villa_special_query_values.
// Columns are arbitrary/user-defined (not real construction items), so
// there's no fixed set to validate against — every column that isn't
// villaID becomes a row.
async function migrateSpecialQuery() {
  console.log(`\n== villa_special_query_values (from DDB table "${tables.specialQuery}") ==`);
  const rows = await scanEntireTable(tables.specialQuery);
  const flatRows = [];
  for (const row of rows) {
    const { villaID, ...columns } = row;
    if (!isValidVillaID(villaID)) continue;
    for (const [columnName, value] of Object.entries(columns)) {
      if (value === undefined || value === null || value === "") continue;
      flatRows.push({ villaID, columnName, value: String(value) });
    }
  }
  console.log(`  ${flatRows.length} (villa, column) special-query rows`);

  if (!WRITE) return;
  for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
    const chunk = flatRows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    chunk.forEach((r, idx) => {
      const base = idx * 3;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      params.push(r.villaID, r.columnName, r.value);
    });
    await pool.query(
      `INSERT INTO villa_special_query_values (villa_id, column_name, value)
       VALUES ${values.join(", ")}
       ON CONFLICT (villa_id, column_name) DO UPDATE SET value = EXCLUDED.value`,
      params
    );
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, flatRows.length)}/${flatRows.length}`);
  }
}

async function main() {
  console.log(WRITE ? "*** WRITE MODE — this will insert/update rows in Postgres ***" : "--- DRY RUN (pass --write to actually write) ---");
  await migrateConstructionItems();
  await migrateVillas();
  await migrateItemStatus();
  await migrateInvoices();
  await migrateSpecialQuery();
  console.log("\nDone.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
