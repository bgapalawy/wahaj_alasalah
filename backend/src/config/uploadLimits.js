// Mirrors the `validExtensions` / `imageSize` constants referenced in the
// old left_click.js. Adjust these to match your original values if they
// differed — these are reasonable defaults.
export const MAX_UPLOAD_SIZE_MB = 25;

export const VALID_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "gif", "webp"],
  pdf: ["pdf"],
  video: ["mp4", "mov", "webm"],
  other: ["doc", "docx", "xls", "xlsx"],
  // Engineering/CAD/BIM/GIS + scheduling + BI file types — Primavera P6
  // schedules (.xer), generic data interchange (.xml, .csv), Power BI
  // reports (.pbix), AutoCAD drawings (.dwg, .dxf), BIM models (.ifc,
  // .rvt), SketchUp (.skp), and GIS formats (.kml, .kmz, .shp — .shp is
  // typically shipped zipped alongside .dbf/.shx/etc., but the lone
  // extension is still accepted here for whichever single file the user
  // actually selects).
  engineering: ["xer", "xml", "pbix", "dwg", "dxf", "ifc", "rvt", "skp", "kml", "kmz", "shp", "csv"],
};

export const ALL_VALID_EXTENSIONS = Object.values(VALID_EXTENSIONS).flat();

export function isValidExtension(extension) {
  return ALL_VALID_EXTENSIONS.includes((extension || "").toLowerCase());
}
