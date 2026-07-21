import { useState } from "react";
import { MapView } from "./components/map/MapView.jsx";
import { VillaDetailsPanel } from "./components/panels/VillaDetailsPanel.jsx";
import "./styles/app.css";

export default function App() {
  const [selectedVillaID, setSelectedVillaID] = useState(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Wajha</h1>
      </header>
      <main className="app-main">
        <MapView onVillaClick={setSelectedVillaID} />
        <VillaDetailsPanel
          villaID={selectedVillaID}
          onClose={() => setSelectedVillaID(null)}
        />
      </main>
    </div>
  );
}
