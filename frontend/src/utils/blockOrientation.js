/**
 * Computes the "long axis" rotation angle of a cluster of points — used
 * to orient a highlighted block/zone's label along the block itself,
 * the same way villa-number labels are rotated to follow their own
 * parcel in the printed PDF (buildVectorLayoutPdf.js has its own
 * convexHull/minBoundingRect for that). Duplicated here in a small,
 * reusable, coordinate-space-agnostic form since the live map needs the
 * IDENTICAL angle (not just a similar one) to rotate its on-screen label
 * to match what the PDF draws — computing it twice with two slightly
 * different algorithms would drift the two apart on some blocks.
 *
 * Input points must already be in a Cartesian, Y-DOWN coordinate space
 * (increasing y = further down/south) — e.g. `[lng * cos(midLat), -lat]`
 * for a lightweight local approximation, or a fully projected mm/pixel
 * space. Angle is returned in jsPDF's own `angle` option convention
 * (CCW-positive as viewed on the page), normalized to the upright band
 * (-90, 90] so a label is never drawn upside down. To use the same
 * angle as a CSS `transform: rotate()` value (which is clockwise-
 * positive — the opposite convention), negate it.
 */
function convexHull(pts) {
  const uniq = Array.from(new Map(pts.map((p) => [`${p[0].toFixed(6)},${p[1].toFixed(6)}`, p])).values());
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
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function minBoundingRect(pts) {
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const p0 = hull[i], p1 = hull[(i + 1) % hull.length];
    const edx = p1[0] - p0[0], edy = p1[1] - p0[1];
    const len = Math.hypot(edx, edy) || 1;
    const ux = edx / len, uy = edy / len; // edge direction
    const vx = -uy, vy = ux; // perpendicular
    let uLo = Infinity, uHi = -Infinity, vLo = Infinity, vHi = -Infinity;
    for (const [px, py] of hull) {
      const u = px * ux + py * uy;
      const v = px * vx + py * vy;
      if (u < uLo) uLo = u;
      if (u > uHi) uHi = u;
      if (v < vLo) vLo = v;
      if (v > vHi) vHi = v;
    }
    const w = uHi - uLo, h = vHi - vLo;
    const area = w * h;
    if (!best || area < best.area) best = { area, w, h, ux, uy };
  }
  // Report the LONGER side as "along" (the reading direction) — dx,dy is
  // its unit vector in the SAME cartesian space the input points were
  // given in (not the y-flipped "as viewed" space angleDeg uses below).
  const alongIsU = best.w >= best.h;
  const along = Math.max(best.w, best.h);
  const dx = alongIsU ? best.ux : -best.uy;
  const dy = alongIsU ? best.uy : best.ux;
  let angleDeg = (Math.atan2(-dy, dx) * 180) / Math.PI; // flip y: viewed CCW-positive
  while (angleDeg <= -90) angleDeg += 180;
  while (angleDeg > 90) angleDeg -= 180;
  return { angleDeg, along, dirX: dx, dirY: dy };
}

/**
 * @param {Array<[number, number]>} lngLatPoints - raw [lng, lat] points
 *   (e.g. every ring vertex of every parcel in a highlighted block).
 * @param {number} midLat - the group's own center latitude, for the
 *   longitude scale correction (degrees longitude cover less ground
 *   distance than degrees latitude away from the equator).
 */
export function computeLongAxisAngle(lngLatPoints, midLat) {
  if (!lngLatPoints || lngLatPoints.length < 3) return 0;
  const latCorr = Math.cos((midLat * Math.PI) / 180) || 1;
  const cartesian = lngLatPoints.map(([lng, lat]) => [lng * latCorr, -lat]);
  return minBoundingRect(cartesian)?.angleDeg ?? 0;
}

/**
 * Same rotation angle as computeLongAxisAngle, plus a geographic offset
 * (added to the group's own bounds-center lng/lat) that lands the label
 * near ONE END of the block along its own long axis, instead of the
 * dead-center of the whole cluster — still rotated to match the block,
 * just positioned toward its edge rather than its middle.
 *
 * `endFraction` is how far toward the true tip to land, as a fraction of
 * the half-length (0 = center, 1 = the exact tip). Kept a little under 1
 * on purpose — landing exactly on the tip risks the label's own width
 * hanging half off the block's actual edge once text is drawn.
 */
export function computeEdgeOrientation(lngLatPoints, midLat, endFraction = 0.72) {
  if (!lngLatPoints || lngLatPoints.length < 3) {
    return { angleDeg: 0, offsetLng: 0, offsetLat: 0 };
  }
  const latCorr = Math.cos((midLat * Math.PI) / 180) || 1;
  const cartesian = lngLatPoints.map(([lng, lat]) => [lng * latCorr, -lat]);
  const rect = minBoundingRect(cartesian);
  if (!rect) return { angleDeg: 0, offsetLng: 0, offsetLat: 0 };

  const dist = (rect.along / 2) * endFraction;
  const dx = rect.dirX * dist;
  const dy = rect.dirY * dist;
  // Invert the (lng * latCorr, -lat) transform on the OFFSET vector —
  // linear, so it transforms the same way the points themselves did.
  return { angleDeg: rect.angleDeg, offsetLng: dx / latCorr, offsetLat: -dy };
}
