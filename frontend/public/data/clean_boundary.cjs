// clean_boundary.cjs
//
// Run entirely locally — no npm install needed, pure Node built-ins only.
// Built for files too large to upload anywhere (handles 200MB+ fine,
// just give Node enough heap — see the command at the bottom).
//
// What it does, in order:
//   1. Reprojects UTM meters -> WGS84 lat/lon, IF the coordinates look
//      projected (magnitude > 180). Auto-detected — pass --utm-zone if
//      you know it and want to force it (e.g. 38 for the Riyadh area).
//   2. Strips ALL feature properties by default — a boundary is only
//      ever used for its geometry (drawing the outline, computing map
//      bounds), the app never reads a property off it. Pass
//      --keep=fieldA,fieldB if you actually need specific fields kept.
//   3. Rounds coordinates to 7 decimal degrees (~1cm) after reprojection,
//      or 3 decimals (~1mm) if left in projected meters.
//   4. Optionally simplifies each line/ring with Douglas-Peucker
//      (--simplify=0.00001, in the same units as the coordinates AFTER
//      step 1 — so degrees if reprojected, meters if not). This is
//      usually where the real size win is for a boundary: a traced
//      outline commonly has 10-100x more vertices than needed for a
//      site-boundary line on a map.
//   5. Writes minified JSON (no indentation).
//
// Usage:
//   node --max-old-space-size=4096 clean_boundary.cjs project-boundary.geojson project-boundary.clean.geojson
//   node --max-old-space-size=4096 clean_boundary.cjs project-boundary.geojson project-boundary.clean.geojson --utm-zone=38 --simplify=0.00002
//
// The --max-old-space-size=4096 flag gives Node 4GB of heap — needed
// for parsing a 200MB+ JSON file, since JSON.parse holds the whole
// parsed structure (plus the raw string) in memory at once. Raise it
// further (e.g. 8192) if Node still runs out of memory on your machine.

const fs = require("fs");

// ---------- CLI args ----------
const args = process.argv.slice(2);
const [inputPath, outputPath] = args.filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? true];
  })
);

if (!inputPath || !outputPath) {
  console.error("Usage: node clean_boundary.cjs <input.geojson> <output.geojson> [--utm-zone=38] [--keep=field1,field2] [--simplify=0.00002] [--precision=7]");
  process.exit(1);
}

const forcedZone = flags["utm-zone"] ? parseInt(flags["utm-zone"], 10) : null;
const keepProps = flags.keep ? new Set(flags.keep.split(",")) : new Set(); // empty = strip all
const simplifyTolerance = flags.simplify ? parseFloat(flags.simplify) : null;
const precisionOverride = flags.precision ? parseInt(flags.precision, 10) : null;

// ---------- UTM -> WGS84 (WGS84 ellipsoid, no external deps) ----------
// Standard Snyder inverse-Mercator formulas. Northern hemisphere only
// (fine for Saudi Arabia). Accurate to well under a meter — plenty for
// map display.
const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
function utmToWgs84(easting, northing, zone) {
  const a = WGS84_A;
  const f = WGS84_F;
  const e = Math.sqrt(f * (2 - f));
  const e1sq = (e * e) / (1 - e * e);
  const k0 = 0.9996;
  const arc = northing / k0;
  const mu = arc / (a * (1 - e * e / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256));
  const ei = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const ca = (3 * ei) / 2 - (27 * ei ** 3) / 32;
  const cb = (21 * ei ** 2) / 16 - (55 * ei ** 4) / 32;
  const cc = (151 * ei ** 3) / 96;
  const cd = (1097 * ei ** 4) / 512;
  const phi1 = mu + ca * Math.sin(2 * mu) + cb * Math.sin(4 * mu) + cc * Math.sin(6 * mu) + cd * Math.sin(8 * mu);

  const n0 = a / Math.sqrt(1 - (e * Math.sin(phi1)) ** 2);
  const t0 = Math.tan(phi1) ** 2;
  const c0 = e1sq * Math.cos(phi1) ** 2;
  const r0 = (a * (1 - e * e)) / Math.pow(1 - (e * Math.sin(phi1)) ** 2, 1.5);
  const d = (easting - 500000) / (n0 * k0);

  const lat =
    phi1 -
    (n0 * Math.tan(phi1) / r0) *
      ((d * d) / 2 -
        ((5 + 3 * t0 + 10 * c0 - 4 * c0 * c0 - 9 * e1sq) * d ** 4) / 24 +
        ((61 + 90 * t0 + 298 * c0 + 45 * t0 * t0 - 252 * e1sq - 3 * c0 * c0) * d ** 6) / 720);

  const lon =
    (d -
      ((1 + 2 * t0 + c0) * d ** 3) / 6 +
      ((5 - 2 * c0 + 28 * t0 - 3 * c0 * c0 + 8 * e1sq + 24 * t0 * t0) * d ** 5) / 120) /
    Math.cos(phi1);

  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  return [centralMeridian + (lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

// Guess the UTM zone from an easting/northing pair by trying a plausible
// Saudi-Arabia range (36N-40N) and picking the one whose resulting
// longitude falls inside Saudi Arabia's bounds. Falls back to 38 (Riyadh
// area) if nothing matches cleanly — override with --utm-zone if wrong.
function guessZone(easting, northing) {
  for (let zone = 36; zone <= 40; zone++) {
    const [lon, lat] = utmToWgs84(easting, northing, zone);
    if (lon > 34 && lon < 56 && lat > 16 && lat < 33) return zone;
  }
  return 38;
}

// ---------- Douglas-Peucker line simplification ----------
function perpendicularDistance(pt, lineStart, lineEnd) {
  const [x, y] = pt;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
  const tt = Math.max(0, Math.min(1, t));
  const projX = x1 + tt * dx;
  const projY = y1 + tt * dy;
  return Math.hypot(x - projX, y - projY);
}

function douglasPeucker(points, tolerance) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [start, end];
}

function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points; // don't collapse tiny rings
  const simplified = douglasPeucker(points, tolerance);
  // keep rings closed
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
  return simplified;
}

// ---------- Geometry processing ----------
function isProjected(coords) {
  function flat(c) {
    if (typeof c[0] === "number") return c;
    return flat(c[0]);
  }
  const pt = flat(coords);
  return Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90;
}

function processCoords(coords, zone, decimals) {
  // coords is either a raw position [x,y] or a nested array of positions
  if (typeof coords[0] === "number") {
    const [x, y] = coords;
    const [lon, lat] = zone ? utmToWgs84(x, y, zone) : [x, y];
    return [round(lon, decimals), round(lat, decimals)];
  }
  const mapped = coords.map((c) => processCoords(c, zone, decimals));
  // Structural check (works for any geometry type: Polygon, MultiPolygon,
  // LineString, MultiLineString) — this level is a ring/line exactly when
  // its own children are raw [lon,lat] positions, not further-nested arrays.
  const isRingLevel = Array.isArray(mapped[0]) && typeof mapped[0][0] === "number";
  if (simplifyTolerance !== null && isRingLevel && mapped.length > 4) {
    return simplifyRing(mapped, simplifyTolerance);
  }
  return mapped;
}

function round(v, decimals) {
  const m = 10 ** decimals;
  return Math.round(v * m) / m;
}

// ---------- Main ----------
function main() {
  console.log("Reading input (this can take a while for 200MB+ files)...");
  const raw = fs.readFileSync(inputPath, "utf8");
  const originalSize = Buffer.byteLength(raw);
  const data = JSON.parse(raw);

  const features = data.type === "FeatureCollection" ? data.features : [data];
  let zone = forcedZone;
  let decimals = precisionOverride;

  // Detect projection + set default precision from the first feature
  const sampleCoords = features[0]?.geometry?.coordinates;
  if (sampleCoords) {
    const projected = isProjected(sampleCoords);
    if (projected && !zone) {
      function flat(c) {
        if (typeof c[0] === "number") return c;
        return flat(c[0]);
      }
      const [ex, ny] = flat(sampleCoords);
      zone = guessZone(ex, ny);
      console.log(`Detected projected (UTM) coordinates — using zone ${zone}N. Pass --utm-zone=N to override.`);
    } else if (!projected) {
      console.log("Coordinates already look like lat/lon (WGS84) — no reprojection needed.");
    }
    // 7 decimal degrees (~1cm) whenever the OUTPUT will be lat/lon — that's
    // true both when we just reprojected (zone set) and when the input was
    // already WGS84 to begin with (projected === false). Only fall back to
    // 3 decimals (~1mm) in the one case where coordinates stay in meters:
    // projected input with no zone available to reproject it.
    if (decimals === null) decimals = projected && !zone ? 3 : 7;
  }

  let processed = 0;
  for (const feature of features) {
    const props = {};
    for (const key of Object.keys(feature.properties || {})) {
      if (keepProps.has(key)) props[key] = feature.properties[key];
    }
    feature.properties = props;
    delete feature.id;

    feature.geometry.coordinates = processCoords(feature.geometry.coordinates, zone, decimals);

    processed++;
    if (processed % 500 === 0) console.log(`  processed ${processed} features...`);
  }

  if (data.crs) delete data.crs;
  if (!zone) {
    // still tag as WGS84 for downstream tools even if no reprojection happened
    data.crs = { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } };
  } else {
    data.crs = { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } };
  }

  console.log("Writing output...");
  const output = JSON.stringify(data);
  fs.writeFileSync(outputPath, output);
  const newSize = Buffer.byteLength(output);

  console.log("");
  console.log(`Original:  ${(originalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Cleaned:   ${(newSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Reduction: ${(100 * (1 - newSize / originalSize)).toFixed(0)}%`);
  if (!simplifyTolerance) {
    console.log("");
    console.log("Tip: if it's still large, most of the remaining size is likely vertex");
    console.log("count, not precision. Try adding --simplify=0.00002 (degrees) and");
    console.log("compare the outline visually — raise the tolerance until it's");
    console.log("noticeably smaller but the shape still looks right.");
  }
}

main();
