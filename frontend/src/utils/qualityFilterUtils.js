/**
 * Zone/block options + matching, shared by NcrReport, OutOfSequenceReport,
 * and VillaStatusReport (the three Quality dashboard tabs) — all three
 * need the same "filter this villa-scoped list by zone/block" behavior,
 * derived from useVillaGeoMeta's villaMetaByID rather than a new backend
 * join (that data's already loaded once for the whole map).
 */

export function getZoneOptions(villaMetaByID) {
  const zones = new Set();
  Object.values(villaMetaByID ?? {}).forEach((m) => {
    if (m?.zonenum != null && m.zonenum !== "") zones.add(String(m.zonenum));
  });
  return [...zones].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function getBlockOptions(villaMetaByID, zone) {
  const blocks = new Set();
  Object.values(villaMetaByID ?? {}).forEach((m) => {
    if (m?.blocknum == null || m.blocknum === "") return;
    if (zone && String(m.zonenum ?? "") !== zone) return;
    blocks.add(String(m.blocknum));
  });
  return [...blocks].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function matchesZoneBlock(villaID, villaMetaByID, zone, block) {
  if (!zone && !block) return true;
  const meta = villaMetaByID?.[villaID];
  if (zone && String(meta?.zonenum ?? "") !== zone) return false;
  if (block && String(meta?.blocknum ?? "") !== block) return false;
  return true;
}

/** Plain string comparison works fine — every date here is normalized to YYYY-MM-DD server-side. */
export function matchesDateRange(dateStr, from, to) {
  if (!from && !to) return true;
  if (!dateStr) return false; // a range filter is active but this row has no date to compare
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}
