import { Suspense, lazy, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { downloadVectorLayoutPdf } from "./utils/buildVectorLayoutPdf.js";
import { settingsApi } from "./api/settings.js";
import { MapView } from "./components/map/MapView.jsx";
import { VillaDetailsPanel } from "./components/panels/VillaDetailsPanel.jsx";
import { useDraggable } from "./hooks/useDraggable.js";
import { useLoggedInUser, logout } from "./components/auth/AuthGate.jsx";
import { ContactDeveloperModal } from "./components/header/ContactDeveloperModal.jsx";
import { projectConfig } from "./config/projectConfig.js";
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
const QualityDashboard = lazy(() =>
  import("./components/dashboard/QualityDashboard.jsx").then((m) => ({ default: m.QualityDashboard }))
);

export default function App() {
  const loggedInUser = useLoggedInUser();
  const [selectedVillaID, setSelectedVillaID] = useState(null);
  const [showProjectDashboard, setShowProjectDashboard] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const { handleRef: adminDragHandleRef, style: adminDragStyle } = useDraggable();
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showContactDeveloper, setShowContactDeveloper] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printMenuPos, setPrintMenuPos] = useState(null);
  const printButtonRef = useRef(null);

  function togglePrintMenu() {
    if (!showPrintMenu && printButtonRef.current) {
      const rect = printButtonRef.current.getBoundingClientRect();
      setPrintMenuPos({ top: rect.bottom + 6, left: rect.left });
    }
    setShowPrintMenu((v) => !v);
  }
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
      if (ctx) await downloadVectorLayoutPdf({ ...ctx, ...branding, paperSize, drawnBy: loggedInUser }, `${projectConfig.fileNamePrefix}_SiteMap`);
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
      if (ctx) await downloadVectorLayoutPdf({ ...ctx, ...branding, paperSize, drawnBy: loggedInUser }, `${projectConfig.fileNamePrefix}_SelectedArea`);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{projectConfig.displayName}</h1>
        <div className="app-header-actions">
          {/* Single icon groups all three printing controls (paper size,
              Print Area, Download PDF) behind one button instead of
              showing them inline — clicking it pops up the options. */}
          <div style={{ position: "relative" }}>
            <button
              ref={printButtonRef}
              type="button"
              className="header-dashboard-btn"
              onClick={togglePrintMenu}
              disabled={exportingPdf || selectingArea}
              aria-label="Printing options"
              title="Printing options"
            >
              🖶 Print ▾
            </button>

            {showPrintMenu && printMenuPos && createPortal(
              <>
                {/* Invisible full-screen click-catcher — closes the popover
                    on any outside click without needing a document-level
                    event listener. */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 9998 }}
                  onClick={() => setShowPrintMenu(false)}
                />
                {/* Rendered via createPortal straight into document.body,
                    not nested inside the header — position: fixed only
                    anchors to the real viewport when NONE of its
                    ancestors have a transform/filter/etc. that creates a
                    new containing block. The header (or anything between
                    it and here) very plausibly has one for its own
                    styling, which would silently break both this panel's
                    positioning AND its ability to receive taps/clicks —
                    exactly "renders in the right place but nothing in it
                    responds to touch." A portal sidesteps the question
                    entirely instead of needing to know what's in that
                    CSS. */}
                <div
                  style={{
                    position: "fixed",
                    top: printMenuPos.top,
                    left: printMenuPos.left,
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "0.6rem",
                    minWidth: "220px",
                    color: "#1f2937",
                    backgroundColor: "#ffffff",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <span style={{ fontSize: "0.8em", color: "#6b7280" }}>Plot paper size</span>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value)}
                      disabled={exportingPdf || selectingArea}
                      style={{ color: "#1f2937", backgroundColor: "#ffffff", padding: "0.35rem", borderRadius: "6px", border: "1px solid #d1d5db" }}
                    >
                      <option value="a1">A1</option>
                      <option value="a2">A2</option>
                      <option value="a3">A3</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrintArea();
                    }}
                    disabled={exportingPdf || selectingArea}
                    style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #d1d5db", backgroundColor: "#f3f4f6", color: "#1f2937", cursor: "pointer" }}
                  >
                    {selectingArea ? "Drag on map…" : "Print Area"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handleExportPdfDirect();
                    }}
                    disabled={exportingPdf || selectingArea}
                    style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #d1d5db", backgroundColor: "#f3f4f6", color: "#1f2937", cursor: "pointer" }}
                  >
                    {exportingPdf ? "Preparing…" : "Download PDF"}
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowProjectDashboard(true)}>
            Project Dashboard
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowQuality(true)}>
            Quality
          </button>
          <button type="button" className="header-admin-btn" onClick={() => setShowAdmin(true)}>
            Admin
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowColorSettings(true)}>
            Colors
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowContactDeveloper(true)}>
            Contact Developer
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

      {showQuality && (
        <Suspense fallback={null}>
          <QualityDashboard onClose={() => setShowQuality(false)} />
        </Suspense>
      )}

      {showContactDeveloper && <ContactDeveloperModal onClose={() => setShowContactDeveloper(false)} />}

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
