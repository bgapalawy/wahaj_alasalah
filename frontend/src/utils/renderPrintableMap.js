import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../config/itemStatusColors.js";

/**
 * Renders villa parcels + boundary directly onto a canvas from raw
 * GeoJSON coordinates, entirely independent of Leaflet's DOM. Two earlier
 * approaches both failed for different reasons:
 *   1. Native browser print of the live Leaflet map — blank, because
 *      Leaflet positions its panes with CSS transform, which browsers'
 *      print rendering frequently fails to render at all.
 *   2. html2canvas screenshot of the Leaflet container — still came back
 *      "not good," and DOM screenshot libraries have their own long list
 *      of known quirks (SVG/foreignObject support, timing, CORS).
 *
 * This sidesteps both failure modes: it's not a screenshot of anything,
 * just plain canvas drawing from data, which always produces a real
 * static image. It also means the title/legend/date can be drawn
 * directly onto the image, closer to a composed map layout (like ArcGIS's
 * print output) than a raw viewport capture.
 *
 * Coordinate projection: simple equirectangular with a cos(latitude)
 * correction for the site's mean latitude — accurate enough for a single
 * small site (not a world map), avoids pulling in a real map-projection
 * library for something this scoped.
 */
export function renderPrintableMap({
  geojson,
  boundaryGeojson,
  itemStatusLookup,
  filteredVillaIDs,
  highlightVillaIDs,
  titleText,
  subtitleText,
  width = 2200,
  height = 1500,
}) {
  if (!geojson) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  const allCoords = [];
  function collectCoords(feature) {
    const geom = feature.geometry;
    if (!geom) return;
    const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    polygons.forEach((rings) => rings.forEach((ring) => ring.forEach((pt) => allCoords.push(pt))));
  }
  (geojson.features ?? []).forEach(collectCoords);
  (boundaryGeojson?.features ?? []).forEach(collectCoords);
  if (allCoords.length === 0) return null;

  const lngs = allCoords.map((c) => c[0]);
  const lats = allCoords.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const midLat = (minLat + maxLat) / 2;
  const latCorrection = Math.cos((midLat * Math.PI) / 180) || 1;

  const marginTop = 90;
  const marginBottom = 30;
  const marginX = 40;
  const legendWidth = itemStatusLookup ? 200 : 0;
  const mapAreaWidth = width - marginX * 2 - legendWidth;
  const mapAreaHeight = height - marginTop - marginBottom;

  const lngRange = (maxLng - minLng) * latCorrection || 0.0001;
  const latRange = maxLat - minLat || 0.0001;
  const scale = Math.min(mapAreaWidth / lngRange, mapAreaHeight / latRange);

  const drawnWidth = lngRange * scale;
  const drawnHeight = latRange * scale;
  const offsetX = marginX + (mapAreaWidth - drawnWidth) / 2;
  const offsetY = marginTop + (mapAreaHeight - drawnHeight) / 2;

  function project([lng, lat]) {
    const x = offsetX + (lng - minLng) * latCorrection * scale;
    const y = offsetY + (maxLat - lat) * scale; // flip: canvas Y increases downward, latitude increases upward
    return [x, y];
  }

  function drawPolygon(geometry, { fill, stroke, lineWidth = 1 }) {
    const polygons =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    polygons.forEach((rings) => {
      ctx.beginPath();
      rings.forEach((ring) => {
        ring.forEach((pt, i) => {
          const [x, y] = project(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      });
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    });
  }

  function ringCentroid(geometry) {
    const ring = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
    if (!ring || ring.length === 0) return null;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return [cx, cy];
  }

  // Boundary drawn first, underneath everything else.
  if (boundaryGeojson) {
    (boundaryGeojson.features ?? []).forEach((f) => {
      if (f.geometry) drawPolygon(f.geometry, { stroke: "#c7cbd1", lineWidth: 1 });
    });
  }

  // Villa parcels, plus collecting label positions to draw after all
  // fills so text always sits on top of every polygon, not just its own.
  const labels = [];
  (geojson.features ?? []).forEach((f) => {
    const villaID = f.properties?.villaID;
    if (!f.geometry) return;

    if (!villaID || villaID === "NOT_VILLA") {
      drawPolygon(f.geometry, { fill: "#e5e7eb", stroke: "#c7cbd1", lineWidth: 0.5 });
      return;
    }

    const isHighlighted = highlightVillaIDs && highlightVillaIDs.has(villaID);
    let fill;
    if (itemStatusLookup && filteredVillaIDs && !filteredVillaIDs.has(villaID)) {
      fill = "rgba(0,0,0,0.3)";
    } else if (itemStatusLookup) {
      const itemStatus = itemStatusLookup[villaID] ?? "NotStarted";
      fill = ITEM_STATUS_COLORS[itemStatus] ?? ITEM_STATUS_COLORS.NotStarted;
    } else {
      fill = "#dbeafe";
    }
    drawPolygon(f.geometry, {
      fill,
      stroke: isHighlighted ? "#ea580c" : "#1f2937",
      lineWidth: isHighlighted ? 2.5 : 0.6,
    });

    const villanum = f.properties?.villanum;
    if (villanum && villanum !== "NOT_VILLA") {
      const centroid = ringCentroid(f.geometry);
      if (centroid) {
        const [x, y] = project(centroid);
        labels.push({ x, y, text: String(villanum) });
      }
    }
  });

  ctx.font = "bold 7px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  labels.forEach(({ x, y, text }) => {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#1f2937";
    ctx.fillText(text, x, y);
  });

  // Title block.
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(titleText ?? "Sahms ElGhroub — Site Map", marginX, 20);
  if (subtitleText) {
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(subtitleText, marginX, 56);
  }
  ctx.textAlign = "right";
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(new Date().toLocaleDateString(), width - marginX, 20);

  // Legend, only when coloring by a construction item (otherwise there's
  // no status breakdown to explain).
  if (itemStatusLookup) {
    const legendX = width - legendWidth - marginX + 20;
    let legendY = marginTop + 10;
    ctx.textAlign = "left";
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("Legend", legendX, legendY);
    legendY += 26;
    ITEM_STATUS_ORDER.forEach((s) => {
      ctx.fillStyle = ITEM_STATUS_COLORS[s];
      ctx.fillRect(legendX, legendY, 14, 14);
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(legendX, legendY, 14, 14);
      ctx.fillStyle = "#1f2937";
      ctx.font = "13px sans-serif";
      ctx.fillText(s, legendX + 20, legendY + 11);
      legendY += 22;
    });
  }

  return canvas.toDataURL("image/png");
}
