import { Suspense, lazy, useState } from "react";
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Wajha</h1>
        <button type="button" className="header-dashboard-btn" onClick={() => setShowProjectDashboard(true)}>
          Project Dashboard
        </button>
      </header>
      <main className="app-main">
        <MapView onVillaClick={setSelectedVillaID} />
        <VillaDetailsPanel
          villaID={selectedVillaID}
          onClose={() => setSelectedVillaID(null)}
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
