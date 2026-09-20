// scripts/seed-villas-from-geojson.js
//
// Populates the `villas` table straight from
// frontend/public/data/villa-parcels.geojson — no DynamoDB involved.
// This is the villas-only piece of migrate-to-postgres.js's
// migrateVillas() function, pulled out on its own because a brand-new
// project (like WAHJ) has no DynamoDB status/invoice history to carry
// over — only the villa parcel data itself needs seeding here.
// construction_items is seeded separately by reseed-construction-items.js.
//
//   node scripts/seed-villas-from-geojson.js --dry-run
//   node scripts/seed-villas-from-geojson.js --write
//
// Requires DATABASE_URL in backend/.env.

import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { pool } from "../src/config/postgres.js";

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

async function main() {
  console.log(WRITE ? "*** WRITE MODE ***" : "--- DRY RUN (pass --write to actually write) ---");
  console.log(`Reading ${GEOJSON_PATH}`);

  const geojson = JSON.parse(readFileSync(GEOJSON_PATH, "utf8"));
  const valid = (geojson.features ?? [])
    .filter((f) => f.properties?.villaID && f.properties.villaID !== "NOT_VILLA")
    .map((f) => f.properties);

  console.log(`${geojson.features.length} total features, ${valid.length} real villas (NOT_VILLA parcels excluded)`);
  console.log("Sample:", JSON.stringify(valid[0], null, 2));

  if (!WRITE) {
    console.log("\nDry run only — nothing written. Re-run with --write to apply.");
    await pool.end();
    return;
  }

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
    console.log(`wrote ${Math.min(i + BATCH_SIZE, valid.length)}/${valid.length}`);
  }

  console.log("\nDone.");
  await pool.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
