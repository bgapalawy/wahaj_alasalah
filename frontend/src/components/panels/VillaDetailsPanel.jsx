import { useEffect, useState, Suspense, lazy } from "react";
import { villasApi } from "../../api/villas.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { ConstructionItemSelect } from "./ConstructionItemSelect.jsx";
import { ActivityStatusControl } from "./ActivityStatusControl.jsx";
import { PlannedDatesDisplay } from "./PlannedDatesDisplay.jsx";
import { FileStatusSection } from "./FileStatusSection.jsx";

// vis-network is a large dependency — only load it once someone actually
// opens the dependency graph, instead of on every page view.
// Chart.js + xlsx are heavy — only load the dashboard bundle when opened.
const DependencyGraph = lazy(() =>
  import("../graph/DependencyGraph.jsx").then((m) => ({ default: m.DependencyGraph }))
);
const VillaDashboard = lazy(() =>
  import("../dashboard/VillaDashboard.jsx").then((m) => ({ default: m.VillaDashboard }))
);

/**
 * Replaces the left-click popup from left_click.js: villa summary, a
 * construction-item picker, the file-status upload section, and (new) an
 * expandable dependency graph replacing the old right-click popup.
 */
export function VillaDetailsPanel({ villaID, onClose }) {
  const [villa, setVilla] = useState(null);
  const [status, setStatus] = useState("idle");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showGraph, setShowGraph] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [liveStatusMap, setLiveStatusMap] = useState({});

  useEffect(() => {
    if (!villaID) return;
    setStatus("loading");
    setSelectedItem(null);
    setShowGraph(false);
    setShowDashboard(false);
    villasApi
      .getById(villaID)
      .then((data) => {
        setVilla(data);
        setStatus("success");
      })
      .catch(() => setStatus("error"));

    villasApi
      .getAllActivityStatuses(villaID)
      .then(setLiveStatusMap)
      .catch(() => setLiveStatusMap({}));
  }, [villaID]);

  useEffect(() => {
    constructionItemsApi.list().then(setAllActivities).catch(() => setAllActivities([]));
  }, []);

  // The static constructionItems.js list has status hardcoded to
  // "NotStarted" for every item — real progress lives per-villa in
  // liveStatusMap. Merge the two so the dependency graph reflects what's
  // actually been marked Completed for *this* villa.
  const liveActivities = allActivities.map((activity) => ({
    ...activity,
    status: liveStatusMap[activity.TableItemID]?.status ?? activity.status,
  }));

  if (!villaID) return null;

  return (
    <aside className="villa-panel">
      <button className="villa-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      {status === "loading" && <p>Loading villa {villaID}…</p>}
      {status === "error" && <p>Couldn't load villa {villaID}.</p>}
      {status === "success" && villa && (
        <>
          <h2>Villa {villa.villaID}</h2>
          <p>Block: {villa.blocknum ?? "—"}</p>
          <p>Status: {villa.status ?? "NotStarted"}</p>

          <button type="button" className="graph-toggle-btn" onClick={() => setShowDashboard((v) => !v)}>
            {showDashboard ? "Hide villa dashboard" : "Show villa dashboard"}
          </button>

          {showDashboard && (
            <div className="graph-modal-backdrop" onClick={() => setShowDashboard(false)}>
              <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
                <div className="graph-modal-header">
                  <h3>Dashboard — Villa {villa.villaID}</h3>
                  <button type="button" onClick={() => setShowDashboard(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <Suspense fallback={<p className="graph-loading">Loading dashboard…</p>}>
                  <VillaDashboard villaID={villaID} />
                </Suspense>
              </div>
            </div>
          )}

          <hr />
          <ConstructionItemSelect value={selectedItem} onChange={setSelectedItem} />

          {selectedItem && (
            <PlannedDatesDisplay villaID={villaID} tableItemId={selectedItem.TableItemID} />
          )}

          {selectedItem && (
            <ActivityStatusControl
              villaID={villaID}
              tableItemId={selectedItem.TableItemID}
              onSaved={(tableItemId, updated) =>
                setLiveStatusMap((prev) => ({ ...prev, [tableItemId]: updated }))
              }
            />
          )}

          {selectedItem && (
            <button
              type="button"
              className="graph-toggle-btn"
              onClick={() => setShowGraph((v) => !v)}
            >
              {showGraph ? "Hide dependency graph" : "Show dependency graph"}
            </button>
          )}

          {showGraph && selectedItem && (
            <div className="graph-modal-backdrop" onClick={() => setShowGraph(false)}>
              <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
                <div className="graph-modal-header">
                  <h3>Dependency graph — {selectedItem.name}</h3>
                  <button type="button" onClick={() => setShowGraph(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <Suspense fallback={<p className="graph-loading">Loading graph…</p>}>
                  <DependencyGraph activities={liveActivities} currentActivityId={selectedItem.id} />
                </Suspense>
              </div>
            </div>
          )}

          <FileStatusSection
            constructionItemId={selectedItem?.TableItemID ?? null}
            villaID={villaID}
          />
        </>
      )}
    </aside>
  );
}
