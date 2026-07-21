// Central place for map defaults — replaces the hardcoded setView() call
// that used to point at Null Island (0,0) with a high min zoom, which is
// what caused the original blank-map bug.
export const MAP_DEFAULTS = {
  // Placeholder center — swap for the project site's real centroid once
  // available; fitBounds() below will override this as soon as geometry loads.
  center: [24.7136, 46.6753], // Riyadh
  zoom: 13,
  minZoom: 10,
  maxZoom: 22,
};

export const GEOJSON_URL = "/data/villa-parcels.geojson";

// Place your outer project boundary GeoJSON at this path
// (frontend/public/data/project-boundary.geojson) to enable the map's
// "Show project boundary" toggle. Optional — the toggle just won't do
// anything useful until the file exists.
export const BOUNDARY_GEOJSON_URL = "/data/project-boundary.geojson";

// Colors for the parcel map, keyed by the *computed* villa-level status
// (see backend computeVillaStatus): NotStarted / InProgress / Completed.
export const VILLA_STATUS_COLORS = {
  NotStarted: "#9ca3af",
  InProgress: "#3b82f6",
  Completed: "#22c55e",
};

// Colors for the file-status upload categories (left-click panel tabs) —
// a different vocabulary from villa-level status, kept separate on purpose.
export const FILE_STATUS_COLORS = {
  NotStarted: "#9ca3af",
  NCR: "#ef4444",
  Notes: "#f59e0b",
  Rejected: "#dc2626",
  Completed: "#22c55e",
  Approval: "#3b82f6",
};
