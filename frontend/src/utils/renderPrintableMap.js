import { ITEM_STATUS_COLORS, ITEM_STATUS_ORDER } from "../config/itemStatusColors.js";
import { projectConfig } from "../config/projectConfig.js";

/**
 * Renders villa parcels + boundary directly onto a canvas from raw
 * GeoJSON coordinates, entirely independent of Leaflet's DOM (see the
 * long history of why in git history / prior conversation — two DOM
 * screenshot approaches failed for different reasons before this one).
 *
 * TILED: the final image is built by rendering a grid of tiles, each at
 * FULL target resolution, then compositing them onto one final canvas —
 * not multiple pages, one final still-single image. This is the same
 * math as rendering one giant canvas directly, but sidesteps two real
 * problems with doing that in a single pass at very high resolution:
 *   - browsers cap a single <canvas>'s dimensions/total pixel area
 *     (varies, but a single huge canvas can silently fail or throw)
 *   - a single massive canvas.toDataURL() call can be slow/memory-heavy
 * Each tile is drawn independently at a manageable size, composited via
 * drawImage, and discarded — peak memory stays bounded by one tile
 * instead of the whole image, while the FINAL composited resolution can
 * go much higher than a single canvas would comfortably support.
 *
 * Every tile redraws the FULL feature set (not just villas that belong to
 * that tile) using the tile's own offset projection — the canvas simply
 * discards anything drawn outside its own bounds, so this is simpler and
 * more robust than trying to precompute which villa belongs in which
 * tile (which would also need special-casing polygons that straddle a
 * tile boundary). The redundant draw calls are cheap; this is a
 * manually-triggered export, not something running on every frame.
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
  colorPalette = ITEM_STATUS_COLORS,
  statusOrder = ITEM_STATUS_ORDER,
  filteredVillaIDs,
  highlightVillaIDs,
  customQueryVillaIDs,
  customQueryColors,
  titleText,
  subtitleText,
  // 6x the very first version's resolution. Went straight resolution
  // first (2200->6600), which helped but wasn't enough for the densest
  // villa clusters — numbers were still overlapping there, a genuine
  // space constraint, not a sharpness one. Tiling is what makes going
  // this much higher practical without a single oversized canvas.
  width = 13200,
  height = 9000,
  tileCols = 4,
  tileRows = 3,
}) {
  if (!geojson) return null;

  const SCALE = width / 2200; // keeps every fixed pixel value below proportional if width is ever tuned again

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

  const marginTop = 90 * SCALE;
  const marginBottom = 30 * SCALE;
  const marginX = 40 * SCALE;
  const legendWidth = itemStatusLookup || (customQueryVillaIDs && customQueryColors) ? 200 * SCALE : 0;
  const mapAreaWidth = width - marginX * 2 - legendWidth;
  const mapAreaHeight = height - marginTop - marginBottom;

  const lngRange = (maxLng - minLng) * latCorrection || 0.0001;
  const latRange = maxLat - minLat || 0.0001;
  const geoScale = Math.min(mapAreaWidth / lngRange, mapAreaHeight / latRange);

  const drawnWidth = lngRange * geoScale;
  const drawnHeight = latRange * geoScale;
  const globalOffsetX = marginX + (mapAreaWidth - drawnWidth) / 2;
  const globalOffsetY = marginTop + (mapAreaHeight - drawnHeight) / 2;

  // Global (full-resolution, whole-image) pixel position — every tile
  // uses this same math, just subtracting its own tile origin afterward.
  function projectGlobal([lng, lat]) {
    const x = globalOffsetX + (lng - minLng) * latCorrection * geoScale;
    const y = globalOffsetY + (maxLat - lat) * geoScale; // flip: canvas Y increases downward, latitude increases upward
    return [x, y];
  }

  function ringCentroid(geometry) {
    const ring = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
    if (!ring || ring.length === 0) return null;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return [cx, cy];
  }

  function drawPolygon(ctx, project, geometry, { fill, stroke, lineWidth = 1 }) {
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
        ctx.lineWidth = lineWidth * SCALE;
        ctx.stroke();
      }
    });
  }

  // Draws the map content (boundary, villas, labels) onto a tile's own
  // context, using a projection offset by that tile's pixel origin.
  function drawContentOnTile(ctx, tileOffsetX, tileOffsetY) {
    function project(pt) {
      const [x, y] = projectGlobal(pt);
      return [x - tileOffsetX, y - tileOffsetY];
    }

    if (boundaryGeojson) {
      (boundaryGeojson.features ?? []).forEach((f) => {
        if (f.geometry) drawPolygon(ctx, project, f.geometry, { stroke: "#c7cbd1", lineWidth: 1 });
      });
    }

    const labels = [];
    (geojson.features ?? []).forEach((f) => {
      const villaID = f.properties?.villaID;
      if (!f.geometry) return;

      if (!villaID || villaID === "NOT_VILLA") {
        drawPolygon(ctx, project, f.geometry, { fill: "#e5e7eb", stroke: "#c7cbd1", lineWidth: 0.5 });
        return;
      }

      const isHighlighted = highlightVillaIDs && highlightVillaIDs.has(villaID);
      let fill;
      if (customQueryVillaIDs && customQueryColors) {
        fill = customQueryVillaIDs.has(villaID) ? customQueryColors.match : customQueryColors.noMatch;
      } else if (itemStatusLookup && filteredVillaIDs && !filteredVillaIDs.has(villaID)) {
        fill = "rgba(0,0,0,0.3)";
      } else if (itemStatusLookup) {
        const itemStatus = itemStatusLookup[villaID] ?? "NotStarted";
        fill = colorPalette[itemStatus] ?? colorPalette.NotStarted;
      } else {
        fill = "#dbeafe";
      }
      drawPolygon(ctx, project, f.geometry, {
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

    ctx.font = `bold ${16 * SCALE}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    labels.forEach(({ x, y, text }) => {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3 * SCALE;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = "#1f2937";
      ctx.fillText(text, x, y);
    });
  }

  // Composite canvas — the final single image every tile gets drawn onto.
  const composite = document.createElement("canvas");
  composite.width = width;
  composite.height = height;
  const compositeCtx = composite.getContext("2d");
  compositeCtx.fillStyle = "#f8fafc";
  compositeCtx.fillRect(0, 0, width, height);

  const tileWidth = Math.ceil(width / tileCols);
  const tileHeight = Math.ceil(height / tileRows);

  for (let row = 0; row < tileRows; row++) {
    for (let col = 0; col < tileCols; col++) {
      const tileOffsetX = col * tileWidth;
      const tileOffsetY = row * tileHeight;

      const tileCanvas = document.createElement("canvas");
      tileCanvas.width = tileWidth;
      tileCanvas.height = tileHeight;
      const tileCtx = tileCanvas.getContext("2d");
      tileCtx.fillStyle = "#f8fafc";
      tileCtx.fillRect(0, 0, tileWidth, tileHeight);

      drawContentOnTile(tileCtx, tileOffsetX, tileOffsetY);

      compositeCtx.drawImage(tileCanvas, tileOffsetX, tileOffsetY);
    }
  }

  // Title/legend drawn once on the finished composite, not per tile.
  compositeCtx.textAlign = "left";
  compositeCtx.textBaseline = "top";
  compositeCtx.fillStyle = "#1e3a8a";
  compositeCtx.font = `bold ${28 * SCALE}px sans-serif`;
  compositeCtx.fillText(titleText ?? `${projectConfig.displayName}${projectConfig.pdfTitleSuffix}`, marginX, 20 * SCALE);
  if (subtitleText) {
    compositeCtx.font = `${16 * SCALE}px sans-serif`;
    compositeCtx.fillStyle = "#475569";
    compositeCtx.fillText(subtitleText, marginX, 56 * SCALE);
  }
  compositeCtx.textAlign = "right";
  compositeCtx.font = `${12 * SCALE}px sans-serif`;
  compositeCtx.fillStyle = "#94a3b8";
  compositeCtx.fillText(new Date().toLocaleDateString(), width - marginX, 20 * SCALE);

  if (customQueryVillaIDs && customQueryColors) {
    const legendX = width - legendWidth - marginX + 20 * SCALE;
    let legendY = marginTop + 10 * SCALE;
    compositeCtx.textAlign = "left";
    compositeCtx.font = `bold ${14 * SCALE}px sans-serif`;
    compositeCtx.fillStyle = "#1f2937";
    compositeCtx.fillText("Custom Query", legendX, legendY);
    legendY += 26 * SCALE;
    [
      { label: "Matches the query", color: customQueryColors.match },
      { label: "Doesn't match", color: customQueryColors.noMatch },
    ].forEach(({ label, color }) => {
      const swatch = 14 * SCALE;
      compositeCtx.fillStyle = color;
      compositeCtx.fillRect(legendX, legendY, swatch, swatch);
      compositeCtx.strokeStyle = "#94a3b8";
      compositeCtx.strokeRect(legendX, legendY, swatch, swatch);
      compositeCtx.fillStyle = "#1f2937";
      compositeCtx.font = `${13 * SCALE}px sans-serif`;
      compositeCtx.fillText(label, legendX + swatch + 6 * SCALE, legendY + swatch * 0.8);
      legendY += 22 * SCALE;
    });
  } else if (itemStatusLookup) {
    const legendX = width - legendWidth - marginX + 20 * SCALE;
    let legendY = marginTop + 10 * SCALE;
    compositeCtx.textAlign = "left";
    compositeCtx.font = `bold ${14 * SCALE}px sans-serif`;
    compositeCtx.fillStyle = "#1f2937";
    compositeCtx.fillText("Legend", legendX, legendY);
    legendY += 26 * SCALE;
    statusOrder.forEach((s) => {
      const swatch = 14 * SCALE;
      compositeCtx.fillStyle = colorPalette[s];
      compositeCtx.fillRect(legendX, legendY, swatch, swatch);
      compositeCtx.strokeStyle = "#94a3b8";
      compositeCtx.strokeRect(legendX, legendY, swatch, swatch);
      compositeCtx.fillStyle = "#1f2937";
      compositeCtx.font = `${13 * SCALE}px sans-serif`;
      compositeCtx.fillText(s, legendX + swatch + 6 * SCALE, legendY + swatch * 0.8);
      legendY += 22 * SCALE;
    });
  }

  return composite.toDataURL("image/png");
}
