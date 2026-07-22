/**
 * Captures a DOM node (the map plus whatever cards/panels are currently
 * open over it) as an image, then embeds that image in a downloadable
 * PDF. html2canvas + jsPDF are dynamically imported so their ~250KB
 * combined weight only loads when this is actually used, not on every
 * page view.
 *
 * scale: 3 (not 2) — the export view forces every villanum label visible
 * at a tiny fixed font size (see .pdf-export-mode in app.css) so ~1,540
 * labels fit without becoming a solid wall of text. A higher capture
 * resolution gives that small text enough real pixel data to still read
 * as text once zoomed into in a PDF viewer, instead of dissolving into a
 * blur.
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
    scale: 3, // Keeps the high resolution
    backgroundColor: "#f8fafc",
    ignoreElements: (element) => {
      // Prevents UI panels from rendering on top of the exported map
      if (element?.classList) {
        return (
          element.classList.contains("map-item-color-control") ||
          element.classList.contains("villa-panel") ||
          element.classList.contains("map-pan-control") ||
          element.classList.contains("leaflet-control-container") ||
          element.classList.contains("app-header")
        );
      }
      return false;
    }
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
