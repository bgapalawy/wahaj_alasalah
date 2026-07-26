/**
 * Generic label-decluttering pass: nudges a set of rectangular label boxes
 * apart until none overlap, moving each one as little as possible.
 *
 * Coordinate-space agnostic on purpose — the same function runs on screen
 * pixel positions (the live Leaflet map, via HighlightLabelsOverlay) and on
 * static millimetre positions (the vector PDF export, buildVectorLayoutPdf),
 * so "spread out overlapping labels" behaves identically in both places
 * instead of drifting apart as two separate implementations over time.
 *
 * Each box is `{ x, y, w, h, ... }` where (x, y) is the box's CENTER.
 * Mutates and returns the same array (each box's x/y updated in place) —
 * cheap enough at the handful of labels this ever runs on (highlighted
 * blocks/zones, not the ~1,540 villa numbers) that a fresh array isn't
 * worth the allocation.
 *
 * Approach: repeated pairwise separation, like a tiny physics relaxation.
 * On each overlapping pair, push both boxes apart along whichever axis has
 * the SMALLER overlap (cheaper to resolve, and reads more naturally —
 * labels that are side-by-side spread horizontally, labels stacked on top
 * of each other spread vertically, rather than every collision always
 * resolving the same way regardless of layout). Runs until stable or a
 * fixed iteration cap, so a pathological cluster can't hang the export.
 */
export function declutterLabels(boxes, { padding = 2, maxIterations = 200 } = {}) {
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];

        const ax0 = a.x - a.w / 2 - padding, ax1 = a.x + a.w / 2 + padding;
        const ay0 = a.y - a.h / 2 - padding, ay1 = a.y + a.h / 2 + padding;
        const bx0 = b.x - b.w / 2 - padding, bx1 = b.x + b.w / 2 + padding;
        const by0 = b.y - b.h / 2 - padding, by1 = b.y + b.h / 2 + padding;

        const overlapX = Math.min(ax1, bx1) - Math.max(ax0, bx0);
        const overlapY = Math.min(ay1, by1) - Math.max(ay0, by0);
        if (overlapX <= 0 || overlapY <= 0) continue; // not overlapping

        moved = true;
        if (overlapX < overlapY) {
          const shift = overlapX / 2 + 0.25;
          if (a.x === b.x) { a.x -= shift; b.x += shift; } // exact tie — break it deterministically
          else if (a.x < b.x) { a.x -= shift; b.x += shift; }
          else { a.x += shift; b.x -= shift; }
        } else {
          const shift = overlapY / 2 + 0.25;
          if (a.y === b.y) { a.y -= shift; b.y += shift; }
          else if (a.y < b.y) { a.y -= shift; b.y += shift; }
          else { a.y += shift; b.y -= shift; }
        }
      }
    }

    if (!moved) break;
  }

  return boxes;
}
