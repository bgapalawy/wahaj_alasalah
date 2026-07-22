import { Suspense, lazy, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
  const [printSnapshotUrl, setPrintSnapshotUrl] = useState(null);
  const mapViewRef = useRef(null);
  const printImgRef = useRef(null);

  // Native browser print dialog. Snapshot just the map into a static
  // image right before printing (see MapView's captureMapSnapshot — two
  // DOM-based approaches failed before this one, and two timing fixes on
  // top of THAT still didn't work). Two more specific bugs, found by
  // reasoning through what could still be wrong rather than guessing
  // blind a third time:
  //
  // 1. The captured image is a large base64 PNG (a 2200x1500 canvas with
  //    ~1,540 filled polygons). Setting it as an <img src> doesn't mean
  //    it's actually decoded and painted yet — a couple of
  //    requestAnimationFrame waits is nowhere near enough for a
  //    multi-megabyte image on a slower machine. Now explicitly awaits
  //    img.decode() so we KNOW the pixels are ready before printing,
  //    instead of hoping a fixed delay was long enough.
  // 2. setPrintSnapshotUrl() is a React state update — by default it
  //    doesn't guarantee the DOM has actually updated by the very next
  //    line of code. Wrapped in flushSync so the <img> element and its
  //    src are guaranteed to exist in the DOM before trying to reference
  //    it via printImgRef.
  //
  // Also simplified the CSS: the image no longer uses
  // position:absolute/inset:0 (which depended on .app-main having a
  // reliable, definite height during print — genuinely uncertain across
  // browsers/OS print pipelines). It's now a plain block image with
  // width:100%, sized by its own aspect ratio, positioned by normal
  // document flow instead of depending on an ancestor's box.
  async function handleDownloadPdf() {
    setExportingPdf(true);
    try {
      await mapViewRef.current?.prepareForExport();
      const snapshot = await mapViewRef.current?.captureMapSnapshot();

      flushSync(() => setPrintSnapshotUrl(snapshot ?? null));

      if (printImgRef.current) {
        try {
          await printImgRef.current.decode();
        } catch (err) {
          console.error("Print snapshot image failed to decode:", err);
        }
      }

      await new Promise((resolve) => {
        let done = false;
        function finish() {
          if (done) return;
          done = true;
          window.removeEventListener("afterprint", finish);
          resolve();
        }
        window.addEventListener("afterprint", finish);
        window.print();
        // Fallback: some browsers/printer drivers don't fire afterprint
        // reliably, especially for "print to file" style printers.
        setTimeout(finish, 20000);
      });
    } finally {
      setPrintSnapshotUrl(null);
      mapViewRef.current?.restoreAfterExport();
      setExportingPdf(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Sahms ElGhroub</h1>
        <div className="app-header-actions">
          <button type="button" className="header-dashboard-btn" onClick={handleDownloadPdf} disabled={exportingPdf}>
            {exportingPdf ? "Preparing…" : "Print / Save PDF"}
          </button>
          <button type="button" className="header-dashboard-btn" onClick={() => setShowProjectDashboard(true)}>
            Project Dashboard
          </button>
        </div>
      </header>
      <main className="app-main">
        <MapView
          ref={mapViewRef}
          onVillaClick={setSelectedVillaID}
          colorByItem={colorByItem}
          onColorByItemChange={setColorByItem}
        />
        {printSnapshotUrl && <img ref={printImgRef} src={printSnapshotUrl} alt="" className="print-map-snapshot" />}
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
