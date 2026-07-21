/**
 * Same rule as frontend/src/utils/graphUtils.js's getCategory — kept as a
 * duplicate rather than a shared package since frontend/backend are
 * separate deployments here. If you introduce a shared package later,
 * this is the one place on the backend that would move.
 */
export function getCategory(tableItemId) {
  if (!tableItemId || typeof tableItemId !== "string") return "Default";
  return tableItemId.split("-")[0] || "Default";
}
