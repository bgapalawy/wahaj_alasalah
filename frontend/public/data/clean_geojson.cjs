// clean_geojson.cjs
//
// Run after exporting from ArcGIS Pro's "Features To JSON" tool
// (with "Project to WGS84" checked). Cuts file size by:
//   1. Stripping every property the app doesn't read — it only ever
//      looks at villaID, zonenum, blocknum, villatype (plus villaID's
//      special "NOT_VILLA" value for non-villa parcels). OBJECTID,
//      RefName, Text, TxtMemo, villanum, Shape_Length, Shape_Area are
//      pure overhead for this app.
//   2. Rounding coordinates to 7 decimal degrees (~1cm precision) —
//      ArcGIS writes 11-15 significant digits by default, most of
//      which is noise well below GPS/mapping accuracy.
//   3. Writing minified JSON (no indentation) — always uncheck
//      "Formatted JSON" in the ArcGIS export tool too.
//
// Usage: node clean_geojson.cjs villa-parcels.geojson villa-parcels.clean.geojson

const fs = require("fs");

const KEEP_PROPS = new Set(["villaID", "zonenum", "blocknum", "villatype"]);
const DECIMALS = 7;

function roundCoords(coords) {
  if (typeof coords[0] === "number") {
    return coords.map((v) => Math.round(v * 10 ** DECIMALS) / 10 ** DECIMALS);
  }
  return coords.map(roundCoords);
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("Usage: node clean_geojson.cjs <input.geojson> <output.geojson>");
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);
  const originalSize = Buffer.byteLength(raw);

  for (const feature of data.features) {
    const props = {};
    for (const key of Object.keys(feature.properties)) {
      if (KEEP_PROPS.has(key)) props[key] = feature.properties[key];
    }
    feature.properties = props;
    feature.geometry.coordinates = roundCoords(feature.geometry.coordinates);
    delete feature.id;
  }

  const output = JSON.stringify(data); // minified — no indentation
  fs.writeFileSync(outputPath, output);

  const newSize = Buffer.byteLength(output);
  console.log(`Original: ${(originalSize / 1024).toFixed(0)} KB`);
  console.log(`Cleaned:  ${(newSize / 1024).toFixed(0)} KB`);
  console.log(`Reduction: ${(100 * (1 - newSize / originalSize)).toFixed(0)}%`);
}

main();
