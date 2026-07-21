import { Suspense, lazy, useRef, useState } from "react";
import { MapView } from "./components/map/MapView.jsx";
import { VillaDetailsPanel } from "./components/panels/VillaDetailsPanel.jsx";
import "./styles/app.css";

// Chart.js + xlsx are heavy — only load when the project dashboard opens.
const AllProjectsDashboard = lazy(() =>
  import("./components/dashboard/AllProjectsDashboard.jsx").then((m) => ({ default: m.AllProjectsDashboard }))
);

export default function App() {
  const [selectedVillaID, setSelectedVillaID] = useState(null);
  const [showProjectDashboard, setShowProjectDashboard] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Lifted up from MapView so the villa panel can pre-select the same
  // construction item you're currently coloring the map by — no more
  // reselecting it every time you click a villa.
  const [colorByItem, setColorByItem] = useState(null);
  const mapAreaRef = useRef(null);

  async function handleDownloadPdf() {
    if (!mapAreaRef.current) return;
    setExportingPdf(true);
    try {
      const { downloadMapAsPDF } = await import("./utils/exportMapPdf.js");
      await downloadMapAsPDF(mapAreaRef.current, "wajha-map");
    } catch (err) {
      console.error("Could not export map to PDF:", err);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Wajha</h1>
        <div className="app-header-actions">
          <button type="button" className="header-dashboard-btn" onClick={handleDownloadPdf} disabled={exportingPdf}>
            {exportingPdf ? "Exporting…" : "Download PDF"}
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowProjectDashboard(true)}>
            Project Dashboard
          </button>
        </div>
      </header>
      <main className="app-main" ref={mapAreaRef}>
        <MapView onVillaClick={setSelectedVillaID} colorByItem={colorByItem} onColorByItemChange={setColorByItem} />
        <VillaDetailsPanel
          villaID={selectedVillaID}
          onClose={() => setSelectedVillaID(null)}
          initialConstructionItem={colorByItem}
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
    </div>
  );
}
