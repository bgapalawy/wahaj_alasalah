/**
 * Captures a DOM node (the map plus whatever cards/panels are currently
 * open over it) as an image, then embeds that image in a downloadable
 * PDF. html2canvas + jsPDF are dynamically imported so their ~250KB
 * combined weight only loads when this is actually used, not on every
 * page view.
 *
 * HONEST CAVEAT: I can't run a real browser in this environment to verify
 * how faithfully html2canvas reproduces the Leaflet map's tiles and SVG
 * overlay layers — it generally handles both, but cross-origin map tiles
 * sometimes render blank depending on the tile server's CORS headers and
 * the browser. Worth checking the first real export closely; if the map
 * tiles are missing from the PDF but the villa shapes/colors are there,
 * that's the CORS case and the fix is different from a code bug.
 */
export async function downloadMapAsPDF(targetElement, filename = "wajha-map") {
  if (!targetElement) return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(targetElement, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    backgroundColor: "#f8fafc",
  });

  const imgData = canvas.toDataURL("image/png");

  // Landscape, sized to match the capture's aspect ratio rather than a
  // fixed page size, so the map doesn't get cropped or heavily letterboxed.
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
