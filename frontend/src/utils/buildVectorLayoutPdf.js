import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../config/itemStatusColors.js";
import { NOTO_SANS_ARABIC_REGULAR_BASE64 } from "./notoSansArabicFont.js";
import { shapeArabicForPdf } from "./arabicShaper.js";

/**
 * TRUE-VECTOR A1 layout sheet — the AutoCAD/ArcGIS "plot to PDF" answer.
 *
 * The previous pipeline rendered the sheet to a canvas and embedded a
 * 150-dpi JPEG in the PDF. That's why zooming into the PDF showed
 * pixels: raster is raster, no dpi is "AutoCAD sharp". This module
 * instead draws every element as PDF vector primitives via jsPDF:
 * parcel polygons are real paths, villa numbers are real text, the
 * frame/graticule/title block/legend/scale bar are lines and text.
 * Result: infinitely crisp at any zoom, selectable text, and files
 * around 1-2 MB for 7k+ features.
 *
 * Label engine v3 — the fix for "text so big / colliding":
 * The source GeoJSON came from a DWG and carries the ORIGINAL CAD text
 * placement per parcel: `Angle` (text rotation, CAD degrees CCW from
 * east) and `Height` (text height in ground metres). We reproduce
 * AutoCAD's own labeling exactly:
 *   fontMm = Height[m] * 1000 / scaleDenominator
 * so at 1:2,000 a 1.68 m CAD text plots at 0.84 mm... which is below
 * legibility, so we clamp to a minimum legible size but ALSO hard-fit
 * the label inside its parcel's projected long-axis length — rotated
 * along the parcel like the source drawing, never bleeding into the
 * neighbors. Labels that cannot fit legibly are culled (ArcGIS
 * behavior: an empty parcel reads better than a smudge).
 *
 * All geometry work is in A1 millimetres (841 x 594 landscape).
 */

const INK = [26, 26, 26];
const PAPER = [255, 255, 255];

// ISO A-series landscape sheet dimensions in millimetres.
const PAPER_SIZES = {
  a0: { w: 1189, h: 841 },
  a1: { w: 841, h: 594 },
  a2: { w: 594, h: 420 },
  a3: { w: 420, h: 297 },
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export async function buildVectorLayoutPdf({
  geojson,
  boundaryGeojson,
  itemStatusLookup,
  colorPalette = ITEM_STATUS_COLORS,
  statusOrder = ITEM_STATUS_ORDER,
  statusCounts = null,
  filteredVillaIDs,
  highlightVillaIDs,
  highlightGroupLabels = [],
  customQueryVillaIDs = null,
  customQueryColors = null,
  titleText,
  subtitleText,
  filterSummaryLines = [],
  itemNameArabic = null,
  projectName = "SHAMS EL GHROUB",
  logos = [],
  drawingNumber = "SITE-001",
  drawnBy = "",
  checkedBy = "",
  printWindow = null,
  paperSize = "a1",
}) {
  if (!geojson) return null;
  const paper = PAPER_SIZES[String(paperSize).toLowerCase()] ?? PAPER_SIZES.a1;
  const PAGE_W = paper.w;
  const PAGE_H = paper.h;
  const paperName = (String(paperSize).toLowerCase() in PAPER_SIZES) ? String(paperSize).toUpperCase() : "A1";
  // Marginalia scale factor: layout constants below are tuned for A1;
  // shrink them proportionally on smaller sheets (A3 is exactly half
  // the linear size of A1, factor 0.5 — like plotting an A1 layout
  // "fit to A3" in AutoCAD, but with text kept slightly larger for
  // legibility, hence the sqrt easing).
  const K = Math.sqrt(PAGE_W / 841);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [PAGE_W, PAGE_H], compress: true });

  // Embed the Arabic-capable font once up front — needed to draw
  // itemNameArabic (the selected construction item's nameArabic) in the
  // title block below. jsPDF's default fonts (Helvetica etc.) have no
  // Arabic glyphs at all, so without this the text would silently vanish.
  doc.addFileToVFS("NotoSansArabic-Regular.ttf", NOTO_SANS_ARABIC_REGULAR_BASE64);
  doc.addFont("NotoSansArabic-Regular.ttf", "NotoSansArabic", "normal");

  /* ----------------------------------------------------------------
   * 1. Geographic extent
   * ---------------------------------------------------------------- */
  let minLng, maxLng, minLat, maxLat;
  if (printWindow) {
    ({ minLng, maxLng, minLat, maxLat } = printWindow);
  } else {
    minLng = Infinity; maxLng = -Infinity; minLat = Infinity; maxLat = -Infinity;
    (geojson.features ?? []).forEach((f) => {
      const geom = f.geometry;
      if (!geom) return;
      const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
      polys.forEach((rings) => rings.forEach((ring) => ring.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      })));
    });
    if (!isFinite(minLng)) return null;
    const padLng = (maxLng - minLng) * 0.04 || 0.0001;
    const padLat = (maxLat - minLat) * 0.04 || 0.0001;
    minLng -= padLng; maxLng += padLng;
    minLat -= padLat; maxLat += padLat;
  }
  const midLat = (minLat + maxLat) / 2;
  const latCorr = Math.cos((midLat * Math.PI) / 180) || 1;

  /* ----------------------------------------------------------------
   * 2. Sheet layout geometry (all mm)
   * ---------------------------------------------------------------- */
  const sheetMargin = 5 * K;
  const outerFrameW = 1.2 * K;
  const frameGap = 2.2 * K;
  const gridLabelBand = 10 * K;
  const titleBlockH = 42 * K;

  const outerX = sheetMargin, outerY = sheetMargin;
  const outerW = PAGE_W - sheetMargin * 2, outerH = PAGE_H - sheetMargin * 2;

  const frameX = outerX + outerFrameW + frameGap + gridLabelBand;
  const frameY = outerY + outerFrameW + frameGap + gridLabelBand;
  const frameW = outerX + outerW - outerFrameW - frameGap - gridLabelBand - frameX;
  const frameH = outerY + outerH - outerFrameW - frameGap - titleBlockH - gridLabelBand * 0.6 - frameY;

  const mapPad = 5 * K;
  const mapAreaX = frameX + mapPad, mapAreaY = frameY + mapPad;
  const mapAreaW = frameW - mapPad * 2, mapAreaH = frameH - mapPad * 2;

  const lngRange = (maxLng - minLng) * latCorr || 0.0001;
  const latRange = maxLat - minLat || 0.0001;
  const geoScale = Math.min(mapAreaW / lngRange, mapAreaH / latRange); // mm per degree

  const drawnW = lngRange * geoScale;
  const drawnH = latRange * geoScale;
  const offX = mapAreaX + (mapAreaW - drawnW) / 2;
  const offY = mapAreaY + (mapAreaH - drawnH) / 2;

  const project = ([lng, lat]) => [
    offX + (lng - minLng) * latCorr * geoScale,
    offY + (maxLat - lat) * geoScale,
  ];
  const pxToLng = (x) => minLng + (x - offX) / (latCorr * geoScale);
  const pxToLat = (y) => maxLat - (y - offY) / geoScale;

  // True plot scale: ground metres per paper mm.
  const metersPerDegLat = 111320;
  const groundWidthM = lngRange * metersPerDegLat;
  const scaleDenRaw = (groundWidthM * 1000) / drawnW;
  const stdScales = [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000];
  const scaleDen = stdScales.reduce((b, s) => (Math.abs(s - scaleDenRaw) < Math.abs(b - scaleDenRaw) ? s : b), stdScales[0]);
  const mmPerGroundMeter = geoScale / (metersPerDegLat); // mm per ground metre (lat)

  /* ----------------------------------------------------------------
   * 3. Culling + clipping helpers
   * ---------------------------------------------------------------- */
  const cullTolLng = (maxLng - minLng) * 0.05;
  const cullTolLat = (maxLat - minLat) * 0.05;
  function featureVisible(geometry) {
    const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const rings of polys) for (const ring of rings) for (const [lng, lat] of ring) {
      if (lng >= minLng - cullTolLng && lng <= maxLng + cullTolLng &&
          lat >= minLat - cullTolLat && lat <= maxLat + cullTolLat) return true;
    }
    return false;
  }

  // Clip all map content to the neatline. jsPDF has a low-level clip API:
  // build a rect path then call clip() + discardPath(). Wrapped in
  // saveGraphicsState/restoreGraphicsState so marginalia stays unclipped.
  function beginMapClip() {
    doc.saveGraphicsState();
    doc.rect(frameX, frameY, frameW, frameH, null); // path only, no paint
    doc.clip();
    doc.discardPath();
  }
  function endMapClip() {
    doc.restoreGraphicsState();
  }

  function drawPolyFeature(geometry, { fill, stroke, lineWidth = 0.12 }) {
    const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const rings of polys) {
      for (const ring of rings) {
        if (ring.length < 3) continue;
        const pts = ring.map(project);
        // jsPDF `lines` uses relative segment deltas from the start point.
        const segs = [];
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
        }
        if (fill) doc.setFillColor(fill[0], fill[1], fill[2]);
        if (stroke) {
          doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
          doc.setLineWidth(lineWidth);
        }
        const style = fill && stroke ? "FD" : fill ? "F" : "S";
        doc.lines(segs, pts[0][0], pts[0][1], [1, 1], style, true);
      }
    }
  }

  /* ----------------------------------------------------------------
   * 4. Map content — boundary linework, parcels, labels
   * ---------------------------------------------------------------- */
  beginMapClip();

  if (boundaryGeojson) {
    const grey = [154, 160, 166];
    (boundaryGeojson.features ?? []).forEach((f) => {
      if (f.geometry && featureVisible(f.geometry)) {
        drawPolyFeature(f.geometry, { stroke: grey, lineWidth: 0.09 });
      }
    });
  }

  const labels = [];
  const nonVillaFill = hexToRgb("#eef0f2");
  const nonVillaStroke = hexToRgb("#c3c8cd");
  const parcelStroke = hexToRgb("#2b2f33");
  const hlStroke = hexToRgb("#ea580c");

  (geojson.features ?? []).forEach((f) => {
    if (!f.geometry || !featureVisible(f.geometry)) return;
    const villaID = f.properties?.villaID;

    if (!villaID || villaID === "NOT_VILLA") {
      drawPolyFeature(f.geometry, { fill: nonVillaFill, stroke: nonVillaStroke, lineWidth: 0.07 });
      return;
    }

    const isHl = highlightVillaIDs && highlightVillaIDs.has(villaID);
    let fillHex;
    if (customQueryVillaIDs && customQueryColors) {
      // Custom query mode (shams2): binary match / no-match coloring,
      // same precedence VillaLayer uses on screen.
      fillHex = customQueryVillaIDs.has(villaID) ? customQueryColors.match : customQueryColors.noMatch;
    } else if (itemStatusLookup && filteredVillaIDs && !filteredVillaIDs.has(villaID)) {
      fillHex = "#b9bcc0"; // muted, outside current filter
    } else if (itemStatusLookup) {
      fillHex = colorPalette[itemStatusLookup[villaID] ?? "NotStarted"] ?? colorPalette.NotStarted;
    } else {
      fillHex = "#dbeafe";
    }
    drawPolyFeature(f.geometry, {
      fill: hexToRgb(fillHex),
      stroke: isHl ? hlStroke : parcelStroke,
      lineWidth: isHl ? 0.5 : 0.08,
    });

    // Normally villanum ("40") mirrors villaID ("V_40") exactly, but a
    // handful of real villas have a missing/inconsistent villanum
    // despite a valid villaID — same issue found on the live map
    // (VillaLayer.jsx), where those villas were clickable with full
    // data but never got a label. Fall back to villaID here too so a
    // parcel that's clearly a real villa doesn't silently lose its
    // number over a secondary field.
    const rawVillanum = f.properties?.villanum;
    const derivedFromID = String(villaID).replace(/^\D+/, "");
    const villanum = rawVillanum && rawVillanum !== "NOT_VILLA" ? rawVillanum : derivedFromID;
    if (!villanum) return;

    // Parcel centroid + projected long-axis metrics for the label fit.
    // Area-weighted centroid (shoelace formula), NOT a plain average of
    // the ring's vertices. A vertex average drifts toward whichever
    // side of the parcel happens to have more points on it — for the
    // curved-street lots (extra vertices along the arc frontage) that
    // pulled the label noticeably off the shape's actual visual middle,
    // which is exactly the "text not exact in its villa boundary" bug.
    const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0]?.[0];
    if (!ring || ring.length === 0) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const pts = ring.map((pt) => {
      const p = project(pt);
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
      return p;
    });
    let areaAcc = 0, cxAcc = 0, cyAcc = 0;
    for (let i = 0; i < pts.length; i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[(i + 1) % pts.length];
      const cross = xi * yj - xj * yi;
      areaAcc += cross;
      cxAcc += (xi + xj) * cross;
      cyAcc += (yi + yj) * cross;
    }
    const area2 = areaAcc; // = 2 * signed area
    let cx, cy;
    if (Math.abs(area2) < 1e-9) {
      // Degenerate/zero-area ring (shouldn't happen for a real parcel) —
      // fall back to the vertex average rather than dividing by zero.
      cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    } else {
      cx = cxAcc / (3 * area2);
      cy = cyAcc / (3 * area2);
    }

    // CAD text placement metadata from the source DWG.
    const cadAngle = Number(f.properties?.Angle);
    const cadHeightM = Number(f.properties?.Height); // ground metres

    labels.push({
      text: String(villanum),
      cx, cy,
      bboxW: x1 - x0,
      bboxH: y1 - y0,
      cadAngle: isFinite(cadAngle) ? cadAngle : null,
      cadHeightM: isFinite(cadHeightM) && cadHeightM > 0 ? cadHeightM : null,
      ring: pts,
    });
  });

  /* ----------------------------------------------------------------
   * 5. Label engine v3: CAD angle + scale-true height + hard parcel fit
   * ---------------------------------------------------------------- */
  // Parcel long-axis length along a PAPER-space angle: project ring
  // points onto the direction and take the span. This is the REAL room
  // the text has, far more accurate than the bbox of a rotated sliver.
  // `angleDeg` is the jsPDF text angle (CCW-positive as viewed), so in
  // the paper frame (y grows downward) the direction is (cos a, -sin a).
  function spanAlong(pts, angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a), dy = -Math.sin(a);
    let lo = Infinity, hi = -Infinity;
    for (const [px, py] of pts) {
      const t = px * dx + py * dy;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    return hi - lo;
  }

  // Parcel long-axis angle in jsPDF text convention, from the longest
  // ring edge. Projected pts have y growing downward, so the viewed
  // (CCW-positive) angle needs the dy sign flipped.
  // Kept only as a last-resort fallback (degenerate rings); the primary
  // axis source is minBoundingRect below.
  function longAxisAngle(pts) {
    let best = 0, bestLen = -1;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = -(pts[i][1] - pts[i - 1][1]);
      const L = dx * dx + dy * dy;
      if (L > bestLen) { bestLen = L; best = (Math.atan2(dy, dx) * 180) / Math.PI; }
    }
    return best;
  }

  // Convex hull (Andrew's monotone chain) — needed because picking "the
  // longest single edge" as the label axis (old behavior) is wrong for
  // any parcel that isn't a clean rectangle: corner lots, cul-de-sac
  // wedges, and curved-frontage parcels (207 of the 1,540 real villa
  // parcels have 6-8 ring vertices, i.e. are not simple rectangles) can
  // have their longest edge running ACROSS the lot rather than along
  // it, which both mis-rotates the label and starves it of room, so it
  // gets culled by the legibility floor even though the parcel has
  // plenty of space in its true long direction.
  function convexHull(pts) {
    const uniq = Array.from(new Map(pts.map((p) => [`${p[0].toFixed(4)},${p[1].toFixed(4)}`, p])).values());
    if (uniq.length < 3) return uniq;
    const sorted = uniq.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  // Minimum-area bounding rectangle via rotating calipers on the hull.
  // This is the ArcGIS/AutoCAD-equivalent way to find a polygon's true
  // "long axis" regardless of vertex count, and it hands back the
  // along/across room at that best angle so the downstream fit step
  // isn't guessing off a different axis than the one used to orient
  // the text.
  function minBoundingRect(pts) {
    const hull = convexHull(pts);
    if (hull.length < 3) return null;
    let best = null;
    for (let i = 0; i < hull.length; i++) {
      const p0 = hull[i], p1 = hull[(i + 1) % hull.length];
      const edx = p1[0] - p0[0], edy = p1[1] - p0[1];
      const len = Math.hypot(edx, edy) || 1;
      const ux = edx / len, uy = edy / len; // edge direction, paper space
      const vx = -uy, vy = ux;              // perpendicular, paper space
      let uLo = Infinity, uHi = -Infinity, vLo = Infinity, vHi = -Infinity;
      for (const [px, py] of hull) {
        const u = px * ux + py * uy;
        const v = px * vx + py * vy;
        if (u < uLo) uLo = u; if (u > uHi) uHi = u;
        if (v < vLo) vLo = v; if (v > vHi) vHi = v;
      }
      const w = uHi - uLo, h = vHi - vLo;
      const area = w * h;
      if (!best || area < best.area) best = { area, w, h, ux, uy };
    }
    // Report the LONGER side as "along" (the reading direction).
    const alongIsU = best.w >= best.h;
    const dx = alongIsU ? best.ux : -best.uy;
    const dy = alongIsU ? best.uy : best.ux;
    const angleDeg = (Math.atan2(-dy, dx) * 180) / Math.PI; // flip y: viewed CCW-positive
    return { angleDeg, along: Math.max(best.w, best.h), across: Math.min(best.w, best.h) };
  }

  // Normalize any angle to the upright/readable band (-90, 90].
  function uprightAngle(a) {
    a = ((a % 360) + 360) % 360;
    if (a > 90 && a <= 270) a -= 180;
    if (a > 270) a -= 360;
    return a;
  }

  // Local width at a POINT, along a given direction — cast a ray both
  // ways from (px, py) and find where it exits the ring. This is the
  // fix for tapered/skewed parcels (curve-transition wedges, cul-de-sac
  // corners): spanAlong/spanAcross above measure room across the WHOLE
  // polygon via its bounding rectangle, which is exact for a rectangle
  // but can overstate the room actually available right at the
  // parcel's own centroid — where the label is drawn — for a
  // non-rectangular shape (e.g. a parallelogram-like wedge that's wide
  // at one end and narrow at the other: the bounding-rect "across"
  // reflects the wide end, but the centroid can sit on the narrow
  // side). A label sized off that overstated width pokes out through
  // the near edge. This measures the real local cross-section instead.
  function rayWidthAt(ring, px, py, dirX, dirY) {
    let tPos = Infinity, tNeg = -Infinity;
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      const ex = bx - ax, ey = by - ay;
      const denom = dirX * (-ey) - dirY * (-ex);
      if (Math.abs(denom) < 1e-9) continue; // parallel to this edge
      const t = ((ax - px) * (-ey) - (ay - py) * (-ex)) / denom;
      const u = (dirX * (ay - py) - dirY * (ax - px)) / denom;
      if (u < 0 || u > 1) continue; // outside the segment
      if (t >= 0 && t < tPos) tPos = t;
      if (t <= 0 && t > tNeg) tNeg = t;
    }
    if (!isFinite(tPos) || !isFinite(tNeg)) return Infinity; // no exit found, don't constrain
    return tPos - tNeg;
  }

  doc.setFont("helvetica", "bold");
  const inkText = [17, 24, 39];

  // This dataset carries NO CAD `Angle`/`Height` attributes (checked
  // directly against villa-parcels.geojson — 0 of 1,540 villa features
  // have either field), so every label falls back to the geometry-fit
  // path below 100% of the time.
  //
  // TWO-PASS sizing. The previous version let each label grow all the
  // way up to MAX_LABEL_MM independently, which does use each parcel's
  // own room well, but produces a visually inconsistent sheet: a few
  // generously-sized corner/detached lots print noticeably bigger than
  // their neighbors, right next to the narrow lots that still get
  // culled — the "some text so big" complaint. Real engineering site
  // maps use ONE label size for the whole sheet. So: pass 1 measures
  // what every parcel *could* fit; we take the median of that as a
  // single target size for the whole sheet; pass 2 draws every label
  // at that same size (only shrinking further for the rare parcel that
  // can't even fit the target, and culling only what's still under the
  // legibility floor at that point). Result: a uniform, professional
  // look instead of a size free-for-all, and the target adapts itself
  // per scale/paper run instead of needing to be hand-tuned each time.
  // Loosened further after checking against real villatype geometry:
  // the portfolio has three villa types (B, A-END, A-MID), and A-MID —
  // mid-terrace units, sharing a wall on both sides — run noticeably
  // narrower (median ~7.8m across) than A-END/B (median ~9.8-10m). At
  // 1:7,500 that's the difference between clearing the old 0.85mm /
  // 0.65-margin floor and not: virtually the entire A-MID group (476 of
  // 1,540 villas) was being silently dropped, which is exactly the
  // "not all villas' text appear" pattern reported. Checked against
  // the real per-type geometry: MIN_LEGIBLE_MM 0.7 + a 0.95 across
  // margin (using nearly the full parcel width instead of leaving 35%
  // spare) clears every type at both 1:4,000 and 1:7,500.
  // Font sizing gets its OWN linear scale factor — separate from K
  // above. K uses sqrt easing on purpose for marginalia (margins,
  // legend, scale bar, north arrow) so those stay readable even on
  // small sheets. But the real room inside each parcel (fitAlong /
  // fitAcross below) shrinks close to LINEARLY with paper size, since
  // it comes straight from projected geometry. Using the sqrt-eased K
  // for the label floor/ceiling made the ceiling shrink slower (71% at
  // A3) than the parcels actually did (~50% at A3), so labels kept
  // landing near a ceiling that was still oversized relative to the
  // smaller parcels — the "A3 shows labels now but they're still too
  // big" report. Kfont tracks the real shrink instead.
  const Kfont = PAGE_W / 841;
  // Scaled by Kfont so the floor/ceiling shrink in step with how much
  // smaller the parcels themselves actually got on this paper size.
  // These two used to be fixed in absolute mm regardless of paper
  // size, which is why A3 first differed from A1: at A3 the whole
  // frame — and every parcel in it — is physically ~50% smaller, but
  // labels were being floored/capped against A1-sized numbers. That
  // produced both halves of the original "A3 printing" report at
  // once: labels that DID render looked oversized relative to their
  // now-smaller parcels (fixed 1.3mm ceiling), and narrower parcels
  // (A-MID terraces especially) couldn't clear a fixed 0.7mm floor
  // once everything shrank, so they got culled instead of drawn.
  const MIN_LEGIBLE_MM = 0.7 * Kfont;  // ~2 pt at A1 — fine on a zoomable vector PDF
  // MAX_LABEL_MM is an ABSOLUTE ceiling with respect to PLOT scale
  // (1:3,000 vs 1:7,500 etc.) — this is what was still producing
  // "text so big" at closer plot scales like 1:3,000: with plenty of
  // room per parcel, the sheet-wide median target climbed to ~3.1mm
  // (right up against the old 3.2 cap), which reads as oversized even
  // though every label is now the same size. Lowered so a run at any
  // plot scale — 1:3,000, 1:4,000, 1:7,500 — tops out at a size that's
  // comfortably legible without dominating the parcel. Re-checked
  // against real geometry: still 0% culled everywhere from 1:3,000
  // through 1:7,500 at this cap. It IS, however, scaled by Kfont
  // (linear paper-size factor) — see the note above MIN_LEGIBLE_MM.
  const MAX_LABEL_MM = 1.3 * Kfont;  // sheet-wide target is capped here too, scaled per-paper like MIN_LEGIBLE_MM above
  const PT_PER_MM = 72 / 25.4;

  // Pass 1: initial angle per label (CAD angle if trustworthy, else the
  // parcel's own long-axis fit).
  const angled = labels.map((L) => {
    const rect = minBoundingRect(L.ring);
    const axis = uprightAngle(rect ? rect.angleDeg : longAxisAngle(L.ring));
    let ang;
    if (L.cadAngle !== null) {
      ang = uprightAngle(-L.cadAngle);
      let diff = Math.abs(ang - axis);
      if (diff > 90) diff = 180 - diff;
      if (diff > 25) ang = axis;
    } else {
      ang = axis;
    }
    return { L, ang };
  });

  // Pass 1b: neighbor-consistency correction. uprightAngle folds every
  // axis into a fixed (-90, 90] band, which has a real discontinuity at
  // the ±90° seam: two parcels whose TRUE long-axis angle differs by
  // only a couple of degrees (e.g. 89° vs 91°) can land on opposite
  // sides of that seam (89° vs -89°) and come out ~180° apart even
  // though they're nearly the same line. Rotating text by ang vs
  // ang+180 keeps the same baseline but reverses which way it reads —
  // that's the "villa 44/45 need to be mirrored" report: they're the
  // near-vertical end-of-row parcels sitting right at that seam, so a
  // tiny wobble flips them relative to their neighbors even though
  // 28-43 (comfortably clear of ±90°) stay consistent with each other.
  //
  // A first version fixed each label by comparing it to whichever
  // OTHER label happened to be nearest, independently per label. That
  // cascades: 44 got corrected fine, but 45 and 46 each compared
  // against a neighbor that might not have been corrected yet (or
  // wasn't itself the right reference), so the fix propagated in the
  // wrong direction and broke labels that were already fine. The
  // correct version of this is a flood-fill: build a minimum spanning
  // tree over every label's centroid, then walk the tree from one root
  // so each label is corrected against a PARENT that has already been
  // settled — never against an as-yet-unvisited or already-wrong peer.
  // This is the standard technique for propagating a consistent
  // orientation across a mesh (the same idea as phase unwrapping).
  if (angled.length > 1) {
    const n = angled.length;
    const inTree = new Array(n).fill(false);
    const parent = new Array(n).fill(-1);
    const minDist = new Array(n).fill(Infinity);
    minDist[0] = 0;
    const children = Array.from({ length: n }, () => []);
    for (let count = 0; count < n; count++) {
      let u = -1, best = Infinity;
      for (let v = 0; v < n; v++) {
        if (!inTree[v] && minDist[v] < best) { best = minDist[v]; u = v; }
      }
      if (u === -1) break;
      inTree[u] = true;
      if (parent[u] !== -1) children[parent[u]].push(u);
      const pu = angled[u].L;
      for (let v = 0; v < n; v++) {
        if (inTree[v]) continue;
        const pv = angled[v].L;
        const d = (pv.cx - pu.cx) ** 2 + (pv.cy - pu.cy) ** 2;
        if (d < minDist[v]) { minDist[v] = d; parent[v] = u; }
      }
    }
    // Walk the tree from the root (index 0): each node is only visited
    // after its parent, so `angled[parent[u]].ang` is always already
    // settled by the time we use it to correct `angled[u].ang`.
    // Track original angles so we can sanity-check the result below —
    // this propagation only enforces RELATIVE consistency across the
    // tree, it has no absolute reference for which direction is
    // "correct". If the arbitrary root (index 0) happened to be one of
    // the small number of originally-wrong labels, the whole tree
    // would faithfully propagate ITS wrong direction to everyone else
    // — flipping the ~99% that were already fine instead of fixing the
    // ~1% that weren't (exactly what happened: "all villas need to be
    // mirrored" after the previous version, because labels[0] was
    // apparently one of the boundary-crossing ones).
    const originalAng = angled.map((a) => a.ang);
    const stack = [0];
    const visited = new Array(n).fill(false);
    visited[0] = true;
    while (stack.length) {
      const u = stack.pop();
      const p = parent[u];
      if (p !== -1) {
        let diff = angled[u].ang - angled[p].ang;
        diff = ((diff + 180) % 360 + 360) % 360 - 180; // normalize to (-180, 180]
        if (Math.abs(diff) > 90) angled[u].ang += diff > 0 ? -180 : 180;
      }
      for (const c of children[u]) {
        if (!visited[c]) { visited[c] = true; stack.push(c); }
      }
    }
    // Majority-vote anchor: count how many labels actually got flipped
    // from their original angle. The true bug only ever affects a small
    // minority (the parcels sitting right at the ±90° fold boundary);
    // if propagation flipped MORE than half the sheet, that means the
    // whole tree converged on the wrong branch relative to the
    // already-correct majority, so undo it in one shot — flip every
    // label back. Net effect either way: only the genuine minority ends
    // up different from where it started.
    let flippedCount = 0;
    for (let i = 0; i < n; i++) {
      let d = angled[i].ang - originalAng[i];
      d = ((d + 180) % 360 + 360) % 360 - 180;
      if (Math.abs(d) > 90) flippedCount++;
    }
    if (flippedCount > n / 2) {
      for (let i = 0; i < n; i++) angled[i].ang += 180;
    }
  }

  // Pass 2: fit metrics using the (now neighbor-consistent) angle.
  const measured = angled.map(({ L, ang }) => {
    const along = spanAlong(L.ring, ang);
    const across = spanAlong(L.ring, ang + 90);
    // Local cross-section through the label's OWN centroid, in the
    // same along/across directions. For a rectangle this matches
    // `along`/`across` almost exactly (cheap to check, no downside);
    // for a tapered/skewed parcel it's the real, possibly-narrower,
    // room right where the label actually sits.
    const angRad = (ang * Math.PI) / 180;
    const alongDx = Math.cos(angRad), alongDy = -Math.sin(angRad);
    const acrossDx = -alongDy, acrossDy = alongDx;
    const localAlong = rayWidthAt(L.ring, L.cx, L.cy, alongDx, alongDy);
    const localAcross = rayWidthAt(L.ring, L.cx, L.cy, acrossDx, acrossDy);
    const safeAlong = Math.min(along, localAlong);
    const safeAcross = Math.min(across, localAcross);
    // Hard fit inside the parcel: Helvetica-bold digits are ~0.56 em
    // wide; keep breathing room on the long axis. STRICT: a label may
    // never exceed its own parcel's room, so neighboring labels can
    // never overlap (parcels don't overlap).
    const fitAlong = (safeAlong * 0.85) / (L.text.length * 0.56);
    const fitAcross = safeAcross * 0.75;
    const fitSize = L.cadHeightM ? (L.cadHeightM * 1000) / scaleDen : Math.min(fitAlong, fitAcross, MAX_LABEL_MM);
    return { L, ang, fitAlong, fitAcross, fitSize };
  });

  const hasCadHeight = measured.some((m) => m.L.cadHeightM);
  let targetMm = MAX_LABEL_MM;
  if (!hasCadHeight) {
    const sizes = measured.map((m) => m.fitSize).sort((a, b) => a - b);
    targetMm = sizes.length ? Math.min(sizes[Math.floor(sizes.length * 0.5)], MAX_LABEL_MM) : MIN_LEGIBLE_MM;
  }

  measured.forEach(({ L, ang, fitAlong, fitAcross, fitSize }) => {
    const fontMm = L.cadHeightM ? fitSize : Math.min(targetMm, fitAlong, fitAcross, MAX_LABEL_MM);
    // Cull what can't be printed legibly even at the shared target size
    // — no tolerance below the legibility floor (ArcGIS-style:
    // unplaceable labels are dropped rather than smudged).
    if (fontMm < MIN_LEGIBLE_MM) return;

    doc.setFontSize(fontMm * PT_PER_MM);
    doc.setTextColor(inkText[0], inkText[1], inkText[2]);
    // NOT doc.text(..., { align: "center", baseline: "middle", angle: ang })
    // — jsPDF has a real bug there: it computes the center/middle offset
    // (half text width, half cap height) in PAGE space and only THEN
    // applies the rotation matrix, instead of rotating that offset
    // together with the glyph. The result is a real positional drift
    // that grows with the rotation angle (measured up to ~5pt / 1.8mm
    // at angles near 150-180°, confirmed by rendering test cases and
    // reading jsPDF's own source around the `align === "center"` branch
    // of its text-placement code) — exactly the "villa text not in its
    // position" symptom: centroid math was correct, but the drawn
    // glyph visibly drifted off it, enough to spill outside small
    // parcels even though there was room on paper.
    //
    // Fix: compute our own centering offset (half text width, and a
    // fixed -0.3815 * fontSize vertical offset — the empirically
    // measured, fontSize-independent ratio from baseline-left anchor
    // to a Helvetica-Bold digit's visual center), rotate THAT offset
    // by the label's own angle ourselves, and hand jsPDF a pre-rotated
    // anchor point with the default left-align / alphabetic-baseline
    // (angle-only, no jsPDF-side offset math, which IS accurate).
    const textW = doc.getTextWidth(L.text);
    const dx0 = textW / 2;
    const dy0 = -0.3815 * fontMm; // both dx0 and dy0 must be in doc units (mm), matching L.cx/L.cy — NOT the point-converted font size
    const rad = (-ang * Math.PI) / 180;
    const rx = dx0 * Math.cos(rad) - dy0 * Math.sin(rad);
    const ry = dx0 * Math.sin(rad) + dy0 * Math.cos(rad);
    doc.text(L.text, L.cx - rx, L.cy - ry, { angle: ang });
  });

  // On-screen a highlighted block/zone gets a plain bold label sized to
  // fit within its own block's width and rotated to follow the block's
  // own long axis (MapView.jsx, highlightGroupLabels +
  // HighlightLabelsOverlay / computeLongAxisAngle) — reproduced here so
  // a highlighted selection survives into the printed sheet instead of
  // only being visible live in the browser. Drawn in geo space via the
  // same `project()` used for parcels, so it lands in the right spot
  // and at the right size regardless of paper size/scale.
  //
  // No pill/background — just colored bold text at the block's own
  // center, sized (via westLng/eastLng, the block's own bounding-box
  // width) to fit within that block rather than a fixed size that can
  // spill into a neighbor. A thin white halo (several offset white
  // copies drawn under the colored text — jsPDF has no native text
  // stroke/shadow) keeps it legible over the darker villa-status fills
  // without needing a solid box.
  if (highlightGroupLabels.length > 0) {
    const labelColor = hexToRgb("#ea580c");
    const MIN_FONT_MM = 0.8 * Kfont;
    const MAX_FONT_MM = 1.3 * Kfont; // caps zone labels too — their own bounding box is far too wide to fit-to-width sensibly
    const haloStep = 0.12 * K;
    const haloOffsets = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];

    doc.setFont("helvetica", "normal");

    highlightGroupLabels.forEach((g) => {
      if (g.lng == null || g.lat == null) return;
      const [cx, cy] = project([g.lng, g.lat]); // block/zone centroid

      const widthSampleLat = g.widthSampleLat ?? g.lat;
      let blockWidthMm = MAX_FONT_MM * 20; // no bounds given — fall back to the size cap only
      if (g.westLng != null && g.eastLng != null) {
        const [wx] = project([g.westLng, widthSampleLat]);
        const [ex] = project([g.eastLng, widthSampleLat]);
        blockWidthMm = Math.abs(ex - wx);
      }
      // Solve for the font size whose estimated text width just fits
      // 85% of the block's own width, leaving a small margin before
      // the label would reach a neighboring block.
      const fontMm = Math.min(
        Math.max((blockWidthMm * 0.85) / (g.label.length * 0.56), MIN_FONT_MM),
        MAX_FONT_MM
      );
      doc.setFontSize(fontMm * PT_PER_MM);

      const ang = g.rotationDeg ?? 0;
      // Same fix as the villa-number labels above: jsPDF's
      // align:"center" + angle combo has a real positional-drift bug,
      // so center manually — compute the anchor offset (half text
      // width, empirically-measured baseline-to-visual-center
      // vertical offset), rotate THAT offset by the label's own
      // angle, and hand jsPDF a pre-rotated anchor with default
      // left-align/alphabetic-baseline (angle-only IS accurate).
      const textW = doc.getTextWidth(g.label);
      const dx0 = textW / 2;
      const dy0 = -0.3815 * fontMm;
      const rad = (-ang * Math.PI) / 180;
      const rx = dx0 * Math.cos(rad) - dy0 * Math.sin(rad);
      const ry = dx0 * Math.sin(rad) + dy0 * Math.cos(rad);

      doc.setTextColor(255, 255, 255);
      haloOffsets.forEach(([hdx, hdy]) => {
        const tx = cx + hdx * haloStep;
        const ty = cy + hdy * haloStep;
        doc.text(g.label, tx - rx, ty - ry, { angle: ang });
      });
      doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
      doc.text(g.label, cx - rx, cy - ry, { angle: ang });
    });
    doc.setTextColor(inkText[0], inkText[1], inkText[2]);
  }

  endMapClip();

  /* ----------------------------------------------------------------
   * 6. Graticule — dashed interior grid + ticks + DMS labels
   * ---------------------------------------------------------------- */
  function niceStep(range, target) {
    const raw = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n >= 5 ? 5 : n >= 2.5 ? 2.5 : n >= 2 ? 2 : 1) * mag;
  }
  function fmtCoord(v) {
    const deg = Math.floor(Math.abs(v));
    const mf = (Math.abs(v) - deg) * 60;
    const min = Math.floor(mf);
    const sec = (mf - min) * 60;
    return `${v < 0 ? "-" : ""}${deg}\u00B0${String(min).padStart(2, "0")}'${sec.toFixed(1)}"`;
  }

  const lngStep = niceStep(pxToLng(frameX + frameW) - pxToLng(frameX), 6);
  const latStep = niceStep(pxToLat(frameY) - pxToLat(frameY + frameH), 5);
  const lngStart = Math.ceil(pxToLng(frameX) / lngStep) * lngStep;
  const latStart = Math.ceil(pxToLat(frameY + frameH) / latStep) * latStep;

  const vLines = [], hLines = [];
  for (let lng = lngStart; lng <= pxToLng(frameX + frameW); lng += lngStep) {
    const [x] = project([lng, midLat]);
    if (x > frameX + 2 && x < frameX + frameW - 2) vLines.push({ x, lng });
  }
  for (let lat = latStart; lat <= pxToLat(frameY); lat += latStep) {
    const y = project([minLng, lat])[1];
    if (y > frameY + 2 && y < frameY + frameH - 2) hLines.push({ y, lat });
  }

  doc.saveGraphicsState();
  doc.setDrawColor(70, 90, 120);
  doc.setLineWidth(0.08);
  doc.setLineDashPattern([2, 2], 0);
  vLines.forEach(({ x }) => doc.line(x, frameY, x, frameY + frameH));
  hLines.forEach(({ y }) => doc.line(frameX, y, frameX + frameW, y));
  doc.setLineDashPattern([], 0);
  doc.restoreGraphicsState();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * Math.max(K, 0.78));
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.25);
  const tick = 2.4 * K;
  vLines.forEach(({ x, lng }) => {
    doc.line(x, frameY, x, frameY - tick);
    doc.text(fmtCoord(lng), x, frameY - tick - 1 * K, { align: "center" });
    doc.line(x, frameY + frameH, x, frameY + frameH + tick);
    doc.text(fmtCoord(lng), x, frameY + frameH + tick + 3 * K, { align: "center" });
  });
  hLines.forEach(({ y, lat }) => {
    doc.line(frameX, y, frameX - tick, y);
    doc.text(fmtCoord(lat), frameX - tick - 1.2 * K, y, { align: "center", angle: 90 });
    doc.line(frameX + frameW, y, frameX + frameW + tick, y);
    doc.text(fmtCoord(lat), frameX + frameW + tick + 1.2 * K, y, { align: "center", angle: -90 });
  });

  /* ----------------------------------------------------------------
   * 7. Frames
   * ---------------------------------------------------------------- */
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(outerFrameW);
  doc.rect(outerX + outerFrameW / 2, outerY + outerFrameW / 2, outerW - outerFrameW, outerH - outerFrameW);
  doc.setLineWidth(0.45);
  doc.rect(frameX, frameY, frameW, frameH);
  doc.setLineWidth(0.15);
  doc.rect(frameX + 1, frameY + 1, frameW - 2, frameH - 2);

  /* ----------------------------------------------------------------
   * 8. Title block
   * ---------------------------------------------------------------- */
  const tbX = outerX + outerFrameW;
  const tbW = outerW - outerFrameW * 2;
  const tbH = titleBlockH;
  const tbY = outerY + outerH - outerFrameW - tbH;

  doc.setFillColor(PAPER[0], PAPER[1], PAPER[2]);
  doc.rect(tbX, tbY, tbW, tbH, "F");
  doc.setLineWidth(0.5);
  doc.rect(tbX, tbY, tbW, tbH);

  const colW = [0.22, 0.34, 0.2, 0.14, 0.1].map((f) => f * tbW);
  const colX = [tbX];
  for (let i = 0; i < colW.length - 1; i++) colX.push(colX[i] + colW[i]);
  doc.setLineWidth(0.35);
  colX.slice(1).forEach((x) => doc.line(x, tbY, x, tbY + tbH));

  const cellPad = 3 * K;
  function cellLabel(x, y, text) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5 * K);
    doc.setTextColor(85, 85, 85);
    doc.text(text.toUpperCase(), x + cellPad, y + cellPad + 1.2 * K);
  }

  // Cell 1 — project identity + logos side by side
  cellLabel(colX[0], tbY, "Project");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13 * K);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(projectName, colX[0] + cellPad, tbY + cellPad + 5 * K);

  // Only logos that actually have an image or caption take up space — an
  // empty slot (no logo uploaded for it) is skipped entirely rather than
  // reserving a blank column.
  const activeLogos = (logos ?? []).filter((l) => l?.logoDataUrl || l?.caption);
  if (activeLogos.length > 0) {
    const logosTop = tbY + cellPad + 7 * K;
    const availH = tbH - (logosTop - tbY) - cellPad;
    const captionH = 4 * K;
    const logoH = Math.max(availH - captionH, availH * 0.6); // logo gets most of the remaining height, not divided among captions
    const colWidth = (colW[0] - cellPad * 2) / activeLogos.length;

    activeLogos.forEach((logo, i) => {
      const cellCenterX = colX[0] + cellPad + colWidth * i + colWidth / 2;

      if (logo.logoDataUrl) {
        try {
          const props = doc.getImageProperties(logo.logoDataUrl);
          const maxLogoW = colWidth * 0.88; // small gutter between adjacent logos
          let logoW = logoH * (props.width / props.height);
          let drawH = logoH;
          if (logoW > maxLogoW) {
            // Width-constrained instead — keep aspect ratio, just shorter
            drawH = maxLogoW / (props.width / props.height);
            logoW = maxLogoW;
          }
          doc.addImage(logo.logoDataUrl, props.fileType, cellCenterX - logoW / 2, logosTop, logoW, drawH);
        } catch {
          // Bad/unsupported image data — fall back to caption-only for
          // this one logo rather than failing the whole export.
        }
      }

      if (logo.caption) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5 * K);
        doc.setTextColor(68, 68, 68);
        doc.text(logo.caption, cellCenterX, tbY + tbH - cellPad, { align: "center" });
      }
    });
  }

  // Cell 2 — drawing title
  cellLabel(colX[1], tbY, "Drawing Title");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13 * K);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(titleText ?? "Site Map \u2014 Villa Status", colX[1] + cellPad, tbY + tbH * 0.48);
  if (subtitleText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5 * K);
    doc.setTextColor(68, 68, 68);
    doc.text(subtitleText, colX[1] + cellPad, tbY + tbH * 0.72);
  }
  // Arabic name of the selected construction item (construction_items
  // .name_arabic), shaped + reversed via shapeArabicForPdf so jsPDF's
  // dumb per-codepoint cmap lookup renders it correctly joined and
  // right-to-left instead of as disconnected isolated letters.
  if (itemNameArabic) {
    doc.setFont("NotoSansArabic", "normal");
    doc.setFontSize(8.5 * K);
    doc.setTextColor(68, 68, 68);
    doc.text(shapeArabicForPdf(itemNameArabic), colX[1] + cellPad, tbY + tbH * 0.9, { align: "left" });
  }

  // Cell 3 — drawn / checked / date
  {
    const x = colX[2], w = colW[2], rowH = tbH / 3;
    doc.setLineWidth(0.25);
    for (let i = 1; i < 3; i++) doc.line(x, tbY + rowH * i, x + w, tbY + rowH * i);
    const rows = [
      ["Drawn By", drawnBy || "\u2014"],
      ["Checked By", checkedBy || "\u2014"],
      ["Date", new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })],
    ];
    rows.forEach(([label, value], i) => {
      const ry = tbY + rowH * i;
      cellLabel(x, ry, label);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9 * K);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(value, x + cellPad, ry + rowH - 2.2 * K);
    });
  }

  // Cell 4 — scale + CRS
  {
    const x = colX[3], w = colW[3], rowH = tbH / 2;
    doc.setLineWidth(0.25);
    doc.line(x, tbY + rowH, x + w, tbY + rowH);
    cellLabel(x, tbY, `Scale (${paperName})`);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(`1 : ${scaleDen.toLocaleString()}`, x + cellPad, tbY + rowH - 2.5 * K);
    cellLabel(x, tbY + rowH, "Coordinate System");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5 * K);
    doc.text("WGS 84 / Geographic", x + cellPad, tbY + tbH - 2.5 * K);
  }

  // Cell 5 — drawing no. / sheet
  {
    const x = colX[4], w = colW[4], rowH = tbH / 2;
    doc.setLineWidth(0.25);
    doc.line(x, tbY + rowH, x + w, tbY + rowH);
    cellLabel(x, tbY, "Drawing No.");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(drawingNumber, x + cellPad, tbY + rowH - 2.5 * K);
    cellLabel(x, tbY + rowH, "Sheet");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11 * K);
    doc.text("1 / 1", x + cellPad, tbY + tbH - 2.5 * K);
  }

  /* ----------------------------------------------------------------
   * 9. North arrow
   * ---------------------------------------------------------------- */
  {
    const nx = frameX + frameW - 20 * K, ny = frameY + 22 * K, r = 11 * K;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.45);
    doc.circle(nx, ny, r, "FD");
    const tipY = ny - r * 0.62, baseY = ny + r * 0.5, halfW = r * 0.3;
    doc.setFillColor(INK[0], INK[1], INK[2]);
    doc.triangle(nx, tipY, nx + halfW, baseY, nx, ny + r * 0.18, "F");
    doc.setLineWidth(0.35);
    doc.triangle(nx, tipY, nx - halfW, baseY, nx, ny + r * 0.18, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("N", nx, tipY - 1.2 * K, { align: "center" });
  }

  /* ----------------------------------------------------------------
   * 10. Graphic scale bar
   * ---------------------------------------------------------------- */
  {
    const metersPerMm = scaleDen / 1000;
    const targetM = metersPerMm * 90 * K; // ~90 mm bar on A1, smaller on A3
    const niceM = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].reduce(
      (b, m) => (Math.abs(m - targetM) < Math.abs(b - targetM) ? m : b), 50);
    const barMm = niceM / metersPerMm;
    const segments = 4, segMm = barMm / segments;
    const bx = frameX + 10 * K, bh = 3.2 * K, by = frameY + frameH - 13 * K;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(195, 200, 205);
    doc.setLineWidth(0.2);
    doc.rect(bx - 4 * K, by - 9 * K, barMm + 8 * K, bh + 17 * K, "FD");

    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) doc.setFillColor(INK[0], INK[1], INK[2]);
      else doc.setFillColor(255, 255, 255);
      doc.rect(bx + segMm * i, by, segMm, bh, "F");
    }
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.3);
    doc.rect(bx, by, barMm, bh);

    const useKm = niceM >= 1000;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    for (let i = 0; i <= segments; i++) {
      const m = (niceM / segments) * i;
      const val = useKm ? m / 1000 : Math.round(m);
      const lbl = i === segments ? `${val.toLocaleString()} ${useKm ? "km" : "m"}` : `${val.toLocaleString()}`;
      doc.text(lbl, bx + segMm * i, by + bh + 3.2 * K, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5 * K);
    doc.text(`SCALE 1 : ${scaleDen.toLocaleString()} (${paperName})`, bx, by - 2.2 * K);
  }

  /* ----------------------------------------------------------------
   * 11. Legend — now with a donut chart beside the rows, mirroring the
   * on-screen "Color map by item" panel (StatusDonut.jsx) instead of a
   * plain text-only list. Drawn as true vector pie wedges (a fan of
   * thin triangles from the center out to the arc, in 3° steps) with a
   * white circle punched out of the middle for the hole — jsPDF has no
   * native arc/donut primitive, so this is the standard way to fake
   * one with straight-line fills that still look smooth at any zoom.
   * ---------------------------------------------------------------- */
  function drawDonutChart(cx, cy, outerR, innerR, segments) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total <= 0) return;
    let cum = 0;
    const stepDeg = 3;
    segments.forEach((seg) => {
      if (seg.value <= 0) return;
      const startDeg = (cum / total) * 360;
      cum += seg.value;
      const endDeg = (cum / total) * 360;
      const pts = [[cx, cy]];
      for (let d = startDeg; d < endDeg; d += stepDeg) {
        const a = (d * Math.PI) / 180;
        pts.push([cx + outerR * Math.sin(a), cy - outerR * Math.cos(a)]);
      }
      const aEnd = (endDeg * Math.PI) / 180;
      pts.push([cx + outerR * Math.sin(aEnd), cy - outerR * Math.cos(aEnd)]);
      pts.push([cx, cy]);
      const segs = [];
      for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
      doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
      doc.lines(segs, pts[0][0], pts[0][1], [1, 1], "F", true);
    });
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, innerR, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(total.toLocaleString(), cx, cy - 0.6 * K, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.6 * K);
    doc.setTextColor(120, 128, 138);
    doc.text("villas", cx, cy + 2.6 * K, { align: "center" });
  }

  // Tracks where the legend box (if drawn at all) actually ends, so the
  // Active Filters box below stacks under it instead of overlapping —
  // stays at its default (just inside the frame corner) when no legend
  // is drawn this run.
  let afterLegendY = frameY + 7 * K;

  const legendEntries = (customQueryVillaIDs && customQueryColors)
    ? [
        { status: "Matches query", color: hexToRgb(customQueryColors.match), count: customQueryVillaIDs.size },
        { status: "Doesn't match", color: hexToRgb(customQueryColors.noMatch), count: null },
      ]
    : null;
  if (itemStatusLookup || legendEntries) {
    const entries = legendEntries ?? statusOrder.map((s) => ({
      status: s,
      color: hexToRgb(colorPalette[s] ?? "#9ca3af"),
      count: statusCounts ? statusCounts[s] ?? 0 : null,
    }));

    // Donut only makes sense with 2+ real counted segments — the custom
    // query legend's second row ("Doesn't match") has no count, so it
    // naturally falls back to the plain list, same as it would inherit
    // no meaningful chart on screen either.
    const countedEntries = entries.filter((e) => e.count !== null && e.count !== undefined);
    const donutTotal = countedEntries.reduce((s, e) => s + e.count, 0);
    const showDonut = countedEntries.length >= 2 && donutTotal > 0;

    const lgPad = 4 * K, swatch = 5 * K, rowH = 8 * K, headerH = 10 * K;
    const donutOuterR = 11 * K, donutInnerR = 6.3 * K;
    const donutColW = showDonut ? donutOuterR * 2 + lgPad * 2.5 : 0;
    const rowsW = 68 * K;
    const lgW = rowsW + donutColW;
    const bodyH = entries.length * rowH + lgPad * 1.4;
    const lgH = headerH + Math.max(bodyH, showDonut ? donutOuterR * 2 + lgPad * 2 : 0);
    const lgX = frameX + 7 * K, lgY = frameY + 7 * K;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.35);
    doc.rect(lgX, lgY, lgW, lgH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("LEGEND", lgX + lgPad, lgY + headerH / 2 + 1.6 * K);
    doc.setDrawColor(195, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(lgX, lgY + headerH, lgX + lgW, lgY + headerH);

    let rowsX = lgX;
    if (showDonut) {
      doc.setDrawColor(195, 200, 205);
      doc.setLineWidth(0.2);
      doc.line(lgX + donutColW, lgY + headerH, lgX + donutColW, lgY + lgH);
      const donutCx = lgX + donutColW / 2, donutCy = lgY + headerH + (lgH - headerH) / 2;
      drawDonutChart(donutCx, donutCy, donutOuterR, donutInnerR, countedEntries.map((e) => ({ value: e.count, color: e.color })));
      rowsX = lgX + donutColW;
    }

    entries.forEach((e, i) => {
      const ry = lgY + headerH + lgPad * 0.5 + rowH * i;
      doc.setFillColor(e.color[0], e.color[1], e.color[2]);
      doc.setDrawColor(75, 85, 99);
      doc.setLineWidth(0.2);
      doc.rect(rowsX + lgPad, ry, swatch, swatch, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8 * K);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(e.status, rowsX + lgPad + swatch + 2.5 * K, ry + swatch / 2 + 1.1 * K);
      if (e.count !== null) {
        doc.setFont("helvetica", "bold");
        doc.text(e.count.toLocaleString(), rowsX + rowsW - lgPad, ry + swatch / 2 + 1.1 * K, { align: "right" });
      }
    });

    afterLegendY = lgY + lgH;
  }

  /* ----------------------------------------------------------------
   * 12. Active Filters — every currently-applied Zone/Block/Villa
   * Type/Villa filter plus every custom-query condition, in the same
   * readable phrasing CustomQueryBuilder uses on screen (see
   * describeCustomQueryConditions in customQueryUtils.js). Drawn the
   * same boxed style as the Legend, stacked directly beneath it.
   * ---------------------------------------------------------------- */
  if (filterSummaryLines.length > 0) {
    const fPad = 4 * K, fRowH = 5.4 * K, fHeaderH = 8 * K, fW = 78 * K;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6 * K);
    const wrapped = filterSummaryLines.flatMap((line) => doc.splitTextToSize(line, fW - fPad * 2));
    const fH = fHeaderH + wrapped.length * fRowH + fPad;
    const fX = frameX + 7 * K, fY = afterLegendY + 5 * K;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.35);
    doc.rect(fX, fY, fW, fH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9 * K);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("ACTIVE FILTERS", fX + fPad, fY + fHeaderH / 2 + 1.6 * K);
    doc.setDrawColor(195, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(fX, fY + fHeaderH, fX + fW, fY + fHeaderH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6 * K);
    doc.setTextColor(68, 68, 68);
    wrapped.forEach((line, i) => {
      doc.text(line, fX + fPad, fY + fHeaderH + fPad + fRowH * i + 3 * K);
    });
  }

  return doc;
}

/** Download the vector layout sheet as a PDF file. */
export async function downloadVectorLayoutPdf(params, filename = "site-map") {
  const doc = await buildVectorLayoutPdf(params);
  if (!doc) return false;
  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
}

/** Open the vector layout sheet in a new tab for printing (replaces the
 *  fragile window.print() CSS flow that could leak app UI onto paper). */
export async function openVectorLayoutPdfForPrint(params) {
  const doc = await buildVectorLayoutPdf(params);
  if (!doc) return false;
  const url = doc.output("bloburl");
  window.open(url, "_blank");
  return true;
}
