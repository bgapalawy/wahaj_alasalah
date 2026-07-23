import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../config/itemStatusColors.js";

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
  customQueryVillaIDs = null,
  customQueryColors = null,
  titleText,
  subtitleText,
  projectName = "SHAMS EL GHROUB",
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

    const villanum = f.properties?.villanum;
    if (!villanum || villanum === "NOT_VILLA") return;

    // Parcel centroid + projected long-axis metrics for the label fit.
    const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0]?.[0];
    if (!ring || ring.length === 0) return;
    let sx = 0, sy = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const pts = ring.map((pt) => {
      const p = project(pt);
      sx += p[0]; sy += p[1];
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
      return p;
    });
    const cx = sx / pts.length, cy = sy / pts.length;

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

  // Normalize any angle to the upright/readable band (-90, 90].
  function uprightAngle(a) {
    a = ((a % 360) + 360) % 360;
    if (a > 90 && a <= 270) a -= 180;
    if (a > 270) a -= 360;
    return a;
  }

  doc.setFont("helvetica", "bold");
  const inkText = [17, 24, 39];

  const MIN_LEGIBLE_MM = 1.3;  // ~3.7 pt — engineering-drawing small text
  const MAX_LABEL_MM = 3.2;    // never dominate the parcel
  const PT_PER_MM = 72 / 25.4;

  labels.forEach((L) => {
    // 1) Label angle. The CAD `Angle` is CCW-from-east in WORLD
    //    coordinates; our projection flips y (north-up paper), so the
    //    angle as viewed on the sheet is the NEGATION. (This was the
    //    "left side villas not rotated well" bug: +60° world text was
    //    plotted at +60° paper, mirrored against its -60° parcel.)
    //    Cross-check against the parcel's own long axis; if the CAD
    //    angle still disagrees wildly (bad attribute), snap to the
    //    parcel axis — ArcGIS "align label to polygon" behavior.
    const axis = uprightAngle(longAxisAngle(L.ring));
    let ang;
    if (L.cadAngle !== null) {
      ang = uprightAngle(-L.cadAngle);
      let diff = Math.abs(ang - axis);
      if (diff > 90) diff = 180 - diff;
      if (diff > 25) ang = axis;
    } else {
      ang = axis;
    }

    // 2) Room along the text direction and across it.
    const along = spanAlong(L.ring, ang);
    const across = spanAlong(L.ring, ang + 90);

    // 3) Scale-true CAD height, clamped to legibility band.
    let fontMm = L.cadHeightM ? L.cadHeightM * 1000 / scaleDen : MIN_LEGIBLE_MM * 1.15;
    fontMm = Math.max(fontMm, MIN_LEGIBLE_MM);
    fontMm = Math.min(fontMm, MAX_LABEL_MM);

    // 4) Hard fit inside the parcel: Helvetica-bold digits are ~0.56 em
    //    wide; keep 12% breathing room on the long axis, and the cap
    //    height must fit across the parcel too. STRICT: the label may
    //    never exceed its own parcel's room in either direction, so
    //    neighboring labels can never overlap (parcels don't overlap).
    const fitAlong = (along * 0.88) / (L.text.length * 0.56);
    const fitAcross = across * 0.65;
    fontMm = Math.min(fontMm, fitAlong, fitAcross);

    // 5) Cull what can't be printed legibly — no tolerance below the
    //    legibility floor (ArcGIS-style: unplaceable labels are dropped).
    if (fontMm < MIN_LEGIBLE_MM) return;

    doc.setFontSize(fontMm * PT_PER_MM);
    doc.setTextColor(inkText[0], inkText[1], inkText[2]);
    doc.text(L.text, L.cx, L.cy, { align: "center", baseline: "middle", angle: ang });
  });

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

  // Cell 1 — project identity
  cellLabel(colX[0], tbY, "Project");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15 * K);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(projectName, colX[0] + cellPad, tbY + tbH * 0.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8 * K);
  doc.setTextColor(68, 68, 68);
  doc.text("Residential Development \u2014 Site Plan", colX[0] + cellPad, tbY + tbH * 0.75);

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
   * 11. Legend
   * ---------------------------------------------------------------- */
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

    const lgPad = 4 * K, swatch = 5 * K, rowH = 8 * K, headerH = 10 * K;
    const lgW = 68 * K;
    const lgH = headerH + entries.length * rowH + lgPad * 1.4;
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

    entries.forEach((e, i) => {
      const ry = lgY + headerH + lgPad * 0.5 + rowH * i;
      doc.setFillColor(e.color[0], e.color[1], e.color[2]);
      doc.setDrawColor(75, 85, 99);
      doc.setLineWidth(0.2);
      doc.rect(lgX + lgPad, ry, swatch, swatch, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8 * K);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(e.status, lgX + lgPad + swatch + 2.5 * K, ry + swatch / 2 + 1.1 * K);
      if (e.count !== null) {
        doc.setFont("helvetica", "bold");
        doc.text(e.count.toLocaleString(), lgX + lgW - lgPad, ry + swatch / 2 + 1.1 * K, { align: "right" });
      }
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
