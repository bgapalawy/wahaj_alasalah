import { Suspense, lazy, useRef, useState } from "react";
import { downloadVectorLayoutPdf } from "./utils/buildVectorLayoutPdf.js";
import { settingsApi } from "./api/settings.js";
import { MapView } from "./components/map/MapView.jsx";
import { VillaDetailsPanel } from "./components/panels/VillaDetailsPanel.jsx";
import { useDraggable } from "./hooks/useDraggable.js";
import { useLoggedInUser, logout } from "./components/auth/AuthGate.jsx";
import "./styles/app.css";

// Chart.js + xlsx are heavy — only load when the project dashboard opens.
const AllProjectsDashboard = lazy(() =>
  import("./components/dashboard/AllProjectsDashboard.jsx").then((m) => ({ default: m.AllProjectsDashboard }))
);
const AdminImportExport = lazy(() =>
  import("./components/admin/AdminImportExport.jsx").then((m) => ({ default: m.AdminImportExport }))
);
const ColorSettingsPanel = lazy(() =>
  import("./components/settings/ColorSettingsPanel.jsx").then((m) => ({ default: m.ColorSettingsPanel }))
);
const OutOfSequenceReport = lazy(() =>
  import("./components/dashboard/OutOfSequenceReport.jsx").then((m) => ({ default: m.OutOfSequenceReport }))
);
const NcrReport = lazy(() =>
  import("./components/dashboard/NcrReport.jsx").then((m) => ({ default: m.NcrReport }))
);

export default function App() {
  const loggedInUser = useLoggedInUser();
  const [selectedVillaID, setSelectedVillaID] = useState(null);
  const [showProjectDashboard, setShowProjectDashboard] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const { handleRef: adminDragHandleRef, style: adminDragStyle } = useDraggable();
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [showOutOfSequence, setShowOutOfSequence] = useState(false);
  const [showNcrReport, setShowNcrReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectingArea, setSelectingArea] = useState(false);
  // Lifted up from MapView so the villa panel can pre-select the same
  // construction item you're currently coloring the map by — no more
  // reselecting it every time you click a villa.
  const [colorByItem, setColorByItem] = useState(null);
  // Plot sheet size — like AutoCAD's paper-size dropdown in the Plot
  // dialog. The layout engine scales the whole sheet (frames, title
  // block, scale bar, grid) to the chosen ISO size.
  const [paperSize, setPaperSize] = useState("a1");
  const mapViewRef = useRef(null);
  // Bumped whenever a save happens in the villa panel (activity status
  // or invoice status) — MapView's color-data hooks include this in
  // their fetch dependencies, so the map picks up the change immediately
  // instead of only reflecting it after a hard page reload.
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const bumpDataRefresh = () => setDataRefreshKey((k) => k + 1);

  // jsPDF's addImage() needs actual image data, not a remote URL, so
  // each logo (served from a presigned S3 URL) has to be fetched and
  // converted to a data URL before it can be drawn into the PDF.
  async function getBrandingForPdf() {
    let settings;
    try {
      settings = await settingsApi.getBranding();
    } catch {
      // Branding is a nice-to-have on the PDF, not a reason to fail the
      // whole export if even fetching the settings themselves fails.
      return {};
    }

    const logos = await Promise.all(
      (settings.logos ?? []).map(async (logo) => {
        if (!logo.logoUrl) return { caption: logo.caption, logoDataUrl: null };
        try {
          const response = await fetch(logo.logoUrl);
          const blob = await response.blob();
          const logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return { caption: logo.caption, logoDataUrl };
        } catch {
          // This one logo failed to fetch/convert — show its caption
          // (if any) without the image rather than losing every other
          // logo and the project name over one bad file.
          return { caption: logo.caption, logoDataUrl: null };
        }
      })
    );
    return { projectName: settings.projectName, logos };
  }

  // Direct PDF download — TRUE VECTOR. buildVectorLayoutPdf draws the
  // whole layout sheet (parcels, labels, frame, graticule, title block,
  // legend, scale bar) as PDF vector primitives via jsPDF. No canvas,
  // no raster embed — infinitely sharp at any zoom like an AutoCAD
  // "plot to PDF", with selectable text and ~1-2 MB files. The
  // on-screen Leaflet view is irrelevant (we draw from raw GeoJSON), so
  // no prepare/restore zoom dance is needed.
  async function handleExportPdfDirect() {
    setExportingPdf(true);
    try {
      const ctx = mapViewRef.current?.getPrintContext();
      const branding = await getBrandingForPdf();
      if (ctx) await downloadVectorLayoutPdf({ ...ctx, ...branding, paperSize, drawnBy: loggedInUser }, "ShamsElGhroub_SiteMap");
    } finally {
      setExportingPdf(false);
    }
  }

  // AutoCAD-style "Plot > Window": the user drags a rectangle on the
  // live map, and ONLY that area is plotted onto the layout sheet and
  // downloaded as a PDF. The selected geographic window alone defines
  // the plot — the on-screen zoom level doesn't matter.
  async function handlePrintArea() {
    setSelectingArea(true);
    let printWindow = null;
    try {
      printWindow = await mapViewRef.current?.selectPrintArea();
    } finally {
      setSelectingArea(false);
    }
    if (!printWindow) return; // cancelled

    setExportingPdf(true);
    try {
      const ctx = mapViewRef.current?.getPrintContext({ printWindow });
      const branding = await getBrandingForPdf();
      if (ctx) await downloadVectorLayoutPdf({ ...ctx, ...branding, paperSize, drawnBy: loggedInUser }, "ShamsElGhroub_SelectedArea");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Sahms ElGhroub</h1>
        <div className="app-header-actions">
          <select
            className="paper-size-select"
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            disabled={exportingPdf || selectingArea}
            aria-label="Plot paper size"
            title="Plot paper size"
          >
            <option value="a1">A1</option>
            <option value="a2">A2</option>
            <option value="a3">A3</option>
          </select>
          <button
            type="button"
            className="header-dashboard-btn"
            onClick={handlePrintArea}
            disabled={exportingPdf || selectingArea}
          >
            {selectingArea ? "Drag on map…" : "Print Area"}
          </button>
          <button type="button" className="header-dashboard-btn" onClick={handleExportPdfDirect} disabled={exportingPdf || selectingArea}>
            {exportingPdf ? "Preparing…" : "Download PDF"}
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowProjectDashboard(true)}>
            Project Dashboard
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowOutOfSequence(true)}>
            Out of Sequence
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowNcrReport(true)}>
  NCRs
</button>
          <button type="button" className="header-admin-btn" onClick={() => setShowAdmin(true)}>
            Admin
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowColorSettings(true)}>
            Colors
          </button>
          <span className="app-header-user">
            {loggedInUser && <span>{loggedInUser}</span>}
            <button type="button" className="app-header-logout-btn" onClick={logout}>
              Log out
            </button>
          </span>
        </div>
      </header>
      <main className="app-main">
        {selectingArea && (
          <div className="print-area-hint">
            Drag a rectangle over the area you want to print — press Esc to cancel
          </div>
        )}
        <MapView
          ref={mapViewRef}
          onVillaClick={setSelectedVillaID}
          colorByItem={colorByItem}
          onColorByItemChange={setColorByItem}
          refreshKey={dataRefreshKey}
          labelsEnabled={labelsEnabled}
          onLabelsEnabledChange={setLabelsEnabled}
        />
        <VillaDetailsPanel
          villaID={selectedVillaID}
          onClose={() => setSelectedVillaID(null)}
          initialConstructionItem={colorByItem}
          onDataChanged={bumpDataRefresh}
        />
      </main>

      {showProjectDashboard && (
        <div className="graph-modal-backdrop" onClick={() => setShowProjectDashboard(false)}>
          <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
            <div className="graph-modal-header">
              <h3>Project Dashboard</h3>
              <button type="button" onClick={() => setShowProjectDashboard(false)} aria-label="Close">
                ×
              </button>
            </div>
            <Suspense fallback={<p className="graph-loading">Loading dashboard…</p>}>
              <AllProjectsDashboard />
            </Suspense>
          </div>
        </div>
      )}

      {showOutOfSequence && (
        <Suspense fallback={null}>
          <OutOfSequenceReport onClose={() => setShowOutOfSequence(false)} />
        </Suspense>
      )}
      {showNcrReport && (
  <Suspense fallback={null}>
    <NcrReport onClose={() => setShowNcrReport(false)} />
  </Suspense>
)}

      {showAdmin && (
        <div className="graph-modal-backdrop" onClick={() => setShowAdmin(false)}>
          <div className="graph-modal" style={adminDragStyle} onClick={(e) => e.stopPropagation()}>
            <div className="graph-modal-header is-draggable" ref={adminDragHandleRef}>
              <h3>Admin — Import / Export</h3>
              <button type="button" onClick={() => setShowAdmin(false)} aria-label="Close">
                ×
              </button>
            </div>
            <Suspense fallback={<p className="graph-loading">Loading admin panel…</p>}>
              <AdminImportExport />
            </Suspense>
          </div>
        </div>
      )}

      {showColorSettings && (
        <div className="graph-modal-backdrop" onClick={() => setShowColorSettings(false)}>
          <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
            <div className="graph-modal-header">
              <h3>Legend Colors</h3>
              <button type="button" onClick={() => setShowColorSettings(false)} aria-label="Close">
                ×
              </button>
            </div>
            <Suspense fallback={<p className="graph-loading">Loading…</p>}>
              <ColorSettingsPanel />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
