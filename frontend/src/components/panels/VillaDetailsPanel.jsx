import { useEffect, useState, Suspense, lazy } from "react";
import { villasApi } from "../../api/villas.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { ConstructionItemSelect } from "./ConstructionItemSelect.jsx";
import { ActivityStatusControl } from "./ActivityStatusControl.jsx";
import { ScheduleStatusPanel } from "./ScheduleStatusPanel.jsx";
import { InvoiceStatusControl } from "./InvoiceStatusControl.jsx";
import { PlannedDatesDisplay } from "./PlannedDatesDisplay.jsx";
import { FileStatusSection } from "./FileStatusSection.jsx";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";

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
 * A section of the per-item controls below, collapsed by default except
 * whichever one is most likely to be the first thing you actually need
 * (Status). Plain <details>/<summary> — same pattern
 * AllProjectsDashboard.jsx's custom-query section already uses, no new
 * component/CSS needed, and it stays keyboard/accessible for free.
 */
function PanelSection({ title, defaultOpen = false, children }) {
  return (
    <details
      className="villa-panel-section"
      open={defaultOpen}
      style={{ marginTop: "0.75rem", borderTop: "1px solid var(--color-border-strong)", paddingTop: "0.5rem" }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600, listStyle: "revert" }}>{title}</summary>
      <div style={{ marginTop: "0.5rem" }}>{children}</div>
    </details>
  );
}

/**
 * Replaces the left-click popup from left_click.js: villa summary, a
 * construction-item picker, and everything scoped to whichever item is
 * selected — grouped into collapsible sections (Status, Schedule,
 * Invoice, Dependencies, Files) instead of one long flat stack, so the
 * panel reads as "pick what you need" rather than "scroll past
 * everything every time." Status opens by default since it's the one
 * most commonly touched; the rest start collapsed.
 */
export function VillaDetailsPanel({ villaID, onClose, initialConstructionItem = null, onDataChanged }) {
  const [villa, setVilla] = useState(null);
  const [status, setStatus] = useState("idle");
  const [selectedItem, setSelectedItem] = useState(initialConstructionItem);
  const [showGraph, setShowGraph] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [liveStatusMap, setLiveStatusMap] = useState({});
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const { villaMetaByID } = useVillaGeoMeta();

  useEffect(() => {
    if (!villaID) return;
    setStatus("loading");
    // Pre-select whatever item the map is currently colored by, instead
    // of always resetting to nothing — you were already looking at that
    // item's status across the whole site, no reason to lose it on click.
    setSelectedItem(initialConstructionItem);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <p>Zone: {villaMetaByID[villa.villaID]?.zonenum ?? "—"}</p>
          <p>Block: {villaMetaByID[villa.villaID]?.blocknum ?? "—"}</p>
          <p>Villa Type: {villaMetaByID[villa.villaID]?.villatype ?? "—"}</p>
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

          {!selectedItem && (
            <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
              Select a construction item above to see its status, schedule, invoice, and files.
            </p>
          )}

          {selectedItem && (
            <>
              <PanelSection title="📋 Status" defaultOpen>
                <PlannedDatesDisplay villaID={villaID} tableItemId={selectedItem.TableItemID} refreshKey={panelRefreshKey} />
                <ActivityStatusControl
                  villaID={villaID}
                  tableItemId={selectedItem.TableItemID}
                  onStatusLoaded={(tableItemId, data) =>
                    setLiveStatusMap((prev) => ({ ...prev, [tableItemId]: data }))
                  }
                  onSaved={(tableItemId, updated) => {
                    setLiveStatusMap((prev) => ({ ...prev, [tableItemId]: updated }));
                    setPanelRefreshKey((k) => k + 1);
                    onDataChanged?.();
                  }}
                />
              </PanelSection>

              <PanelSection title="🗓️ Schedule">
                <ScheduleStatusPanel
                  villaID={villaID}
                  tableItemId={selectedItem.TableItemID}
                  constructionItemsTemplate={allActivities}
                  liveStatusMap={liveStatusMap}
                />
              </PanelSection>

              <PanelSection title="💰 Invoice">
                <InvoiceStatusControl
                  villaID={villaID}
                  tableItemId={selectedItem.TableItemID}
                  onSaved={() => onDataChanged?.()}
                  refreshKey={panelRefreshKey}
                />
              </PanelSection>

              <PanelSection title="🔗 Dependencies">
                <button type="button" className="graph-toggle-btn" onClick={() => setShowGraph((v) => !v)}>
                  {showGraph ? "Hide dependency graph" : "Show dependency graph"}
                </button>
              </PanelSection>

              {showGraph && (
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

              <PanelSection title="📁 Files">
                <FileStatusSection
                  constructionItemId={selectedItem.TableItemID}
                  constructionItemName={selectedItem.name}
                  villaID={villaID}
                  activityStatus={liveStatusMap[selectedItem.TableItemID]?.status ?? selectedItem.status}
                />
              </PanelSection>
            </>
          )}
        </>
      )}
    </aside>
  );
}
