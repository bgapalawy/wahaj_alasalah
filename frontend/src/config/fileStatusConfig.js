// Mirrors the `states` array + 11-slot loop from the old left_click.js:
// NotStarted/NCR/Notes/Rejected/Completed each got 2 upload slots,
// Approval got 1 (2*5 + 1 = 11).
export const FILE_STATUS_CATEGORIES = [
  { state: "NotStarted", label: "Not Started", slots: 2 },
  { state: "NCR", label: "NCR", slots: 2 },
  { state: "Notes", label: "Notes", slots: 2 },
  { state: "Rejected", label: "Rejected", slots: 2 },
  { state: "Completed", label: "Completed", slots: 2 },
  { state: "Approval", label: "Approval", slots: 1 },
];

// A construction item's own status (set via ActivityStatusControl) is a
// different concept from file-upload categories above — "Approval" only
// makes sense as a place to upload an approval document, not as something
// an activity's status can literally *be*. Kept as a separate list on
// purpose rather than reusing FILE_STATUS_CATEGORIES.
export const ACTIVITY_STATUS_OPTIONS = ["NotStarted", "NCR", "Notes", "Rejected", "Completed"];

/**
 * Builds the S3 key prefix for one upload slot, matching the old
 * objectKey logic:
 *   Approval -> `${item}-VillaID:${villaID}-Approval`
 *   others   -> `${item}-VillaID:${villaID}-${state}${slotNumber}`
 */
export function buildSlotPrefix({ constructionItemId, villaID, state, slotIndex }) {
  const suffix = state === "Approval" ? "Approval" : `${state}${slotIndex + 1}`;
  return `${constructionItemId}-VillaID:${villaID}-${suffix}`;
}

/**
 * Human-readable filename for display and download — NOT used for the
 * actual S3 key (that stays buildSlotPrefix's stable ID-based string, so
 * existing uploaded files remain findable; changing the storage key
 * itself would orphan every file already uploaded under the old naming).
 * This is purely what the user sees and what a downloaded file gets
 * named, via S3's ResponseContentDisposition (see uploadService.js).
 */
export function buildFriendlyFileName({ constructionItemName, villaID, state, slotIndex, extension }) {
  const suffix = state === "Approval" ? "Approval" : `${state}${slotIndex + 1}`;
  const safeName = (constructionItemName ?? "Item").replace(/[\\/:*?"<>|]/g, "-");
  const ext = extension ? `.${extension}` : "";
  return `${safeName} - Villa ${villaID} - ${suffix}${ext}`;
}
