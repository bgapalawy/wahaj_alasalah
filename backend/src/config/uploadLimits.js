// Mirrors the `validExtensions` / `imageSize` constants referenced in the
// old left_click.js. Adjust these to match your original values if they
// differed — these are reasonable defaults.
export const MAX_UPLOAD_SIZE_MB = 15;

export const VALID_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "gif", "webp"],
  pdf: ["pdf"],
  video: ["mp4", "mov", "webm"],
  other: ["doc", "docx", "xls", "xlsx"],
};

export const ALL_VALID_EXTENSIONS = Object.values(VALID_EXTENSIONS).flat();

export function isValidExtension(extension) {
  return ALL_VALID_EXTENSIONS.includes((extension || "").toLowerCase());
}
