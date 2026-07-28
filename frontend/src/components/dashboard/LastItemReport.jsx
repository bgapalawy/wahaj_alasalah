import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";
import { getZoneOptions, getBlockOptions, getVillaTypeOptions, getVillaOptions, matchesGeoFilters, matchesMultiSelect, getRootCauseBlockers } from "../../utils/qualityFilterUtils.js";
import { getVillaNumber } from "../../utils/dashboardUtils.js";
import { StatusCountChart } from "./StatusCountChart.jsx";
import { MultiSelectFilter } from "./MultiSelectFilter.jsx";

const STATUS_OPTIONS = [
  { value: "Completed", label: "Completed" },
  { value: "InProgress", label: "In Progress" },
  { value: "NotStarted", label: "Not Started" },
];

/** Same one-liner graphUtils.js's own getCategory uses ("Civil-15" -> "Civil") — not imported since that file lives on the backend, this is trivial enough to duplicate. */
function getCategory(tableItemId) {
  if (!tableItemId || typeof tableItemId !== "string") return "—";
  return tableItemId.split("-")[0] || "—";
}

/**
 * For every real villa, finds its "current frontier" by running the
 * SAME recursive root-cause walk used everywhere else in this app for
 * "why is this blocked" (getRootCauseBlockers, ported from
 * findRootCauseBlockingActivities in graphUtils.js — see
 * ScheduleStatusPanel.jsx and SchedulingReport.jsx) against the villa's
 * own LAST construction item (the final one in item_id order — item 82
 * of 82). That one call handles every case correctly on its own:
 *   - the last item's own predecessor chain has real unresolved work
 *     somewhere -> the root-cause walk returns those exact blocking
 *     items, which ARE the frontier(s) — one per independent path
 *     (Civil, Mechanical, Architectural, etc.), no separate
 *     "successors" graph of our own needed.
 *   - nothing is blocking the last item (every predecessor already
 *     Completed) -> the walk returns nothing to block on, so the last
 *     item ITSELF — whatever its own actual status is (ready to start,
 *     in progress, or genuinely Completed if the whole villa is done)
 *     — is "the last remaining item."
 * Both cases fall out of one function call; no special-casing needed
 * for "fully done" vs. "just this one task left."
 *
 * `embedded`, when true, renders just the content (no modal backdrop/
 * header) — used by QualityDashboard.jsx.
 */
export function LastItemReport({ onClose, embedded = false }) {
  const { data: allVillaStatuses, status } = useAllVillaStatuses(true);
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  const { villaMetaByID } = useVillaGeoMeta();

  const [villaFilters, setVillaFilters] = useState([]);
  const [zoneFilters, setZoneFilters] = useState([]);
  const [blockFilters, setBlockFilters] = useState([]);
  const [villaTypeFilters, setVillaTypeFilters] = useState([]);
  const [itemFilter, setItemFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);

  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);

  const zoneOptions = useMemo(() => getZoneOptions(villaMetaByID).map((z) => ({ value: z, label: `Zone ${z}` })), [villaMetaByID]);
  const blockOptions = useMemo(
    () => getBlockOptions(villaMetaByID, zoneFilters).map((b) => ({ value: b, label: `Block ${b}` })),
    [villaMetaByID, zoneFilters]
  );
  const villaTypeOptions = useMemo(
    () => getVillaTypeOptions(villaMetaByID, zoneFilters, blockFilters).map((t) => ({ value: t, label: t })),
    [villaMetaByID, zoneFilters, blockFilters]
  );
  const villaOptions = useMemo(
    () => getVillaOptions(villaMetaByID, zoneFilters, blockFilters, villaTypeFilters).map((v) => ({ value: v, label: v })),
    [villaMetaByID, zoneFilters, blockFilters, villaTypeFilters]
  );

  // The villa's actual final item — item_id 82 of 82 (or however many
  // exist), the last one in constructionItemsApi.list()'s own order,
  // which is already sorted by item_id server-side (same order the
  // dependency chain and every other item list already use).
  const lastItemOverall = constructionItemsTemplate[constructionItemsTemplate.length - 1] ?? null;

  const findings = useMemo(() => {
    if (!allVillaStatuses || !lastItemOverall) return [];
    const results = [];
    Object.keys(villaMetaByID).forEach((villaID) => {
      const statusMap = allVillaStatuses[villaID] ?? {};
      const blockers = getRootCauseBlockers(lastItemOverall, constructionItemsTemplate, statusMap);

      if (blockers.length === 0) {
        // Nothing blocking the last item — either it's genuinely
        // Completed (whole villa done) or it's the one remaining task
        // itself (ready/in progress) — either way, IT is the answer.
        results.push({
          villaID,
          item: lastItemOverall,
          itemStatus: statusMap[lastItemOverall.TableItemID] ?? "NotStarted",
        });
      } else {
        blockers.forEach((b) => {
          results.push({
            villaID,
            item: { TableItemID: b.TableItemID, name: b.name },
            itemStatus: b.status ?? "NotStarted",
          });
        });
      }
    });
    return results;
  }, [allVillaStatuses, constructionItemsTemplate, lastItemOverall, villaMetaByID]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (!matchesMultiSelect(f.villaID, villaFilters)) return false;
      if (!matchesGeoFilters(f.villaID, villaMetaByID, zoneFilters, blockFilters, villaTypeFilters)) return false;
      if (itemFilter && f.item?.TableItemID !== itemFilter) return false;
      if (!matchesMultiSelect(f.itemStatus, statusFilters)) return false;
      return true;
    });
  }, [findings, villaFilters, zoneFilters, blockFilters, villaTypeFilters, itemFilter, statusFilters, villaMetaByID]);

  function handleExport() {
    const exportRows = filtered.map((f) => ({
      Villa: f.villaID,
      "Villa Number": getVillaNumber(f.villaID),
      Zone: villaMetaByID[f.villaID]?.zonenum ?? "",
      Block: villaMetaByID[f.villaID]?.blocknum ?? "",
      "Villa Type": villaMetaByID[f.villaID]?.villatype ?? "",
      "Last Item": f.item?.name ?? "— (Not Started)",
      "Item ID": f.item?.TableItemID ?? "",
      Category: f.item ? getCategory(f.item.TableItemID) : "",
      Status: f.itemStatus,
    }));
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Last Item");
    XLSX.writeFile(wb, "last_item_report.xlsx");
  }

  const isLoading = status === "loading" || constructionItemsTemplate.length === 0;

  const content = (
    <>
      <p className="file-status-hint">
        Every villa's current frontier along EACH of its independent construction paths (Civil, Mechanical,
        Architectural, etc.) — a villa with several trades progressing in parallel shows one row per path, not just
        one overall "last" item.
      </p>

      {isLoading ? (
        <p className="file-status-hint">Loading…</p>
      ) : (
        <>
          <div className="admin-actions" style={{ marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <MultiSelectFilter
              label="Zones"
              options={zoneOptions}
              selected={zoneFilters}
              onChange={(next) => {
                setZoneFilters(next);
                setBlockFilters([]);
                setVillaTypeFilters([]);
              }}
            />
            <MultiSelectFilter
              label="Blocks"
              options={blockOptions}
              selected={blockFilters}
              onChange={(next) => {
                setBlockFilters(next);
                setVillaTypeFilters([]);
              }}
            />
            <MultiSelectFilter label="Villa Types" options={villaTypeOptions} selected={villaTypeFilters} onChange={setVillaTypeFilters} />
            <MultiSelectFilter label="Villas" options={villaOptions} selected={villaFilters} onChange={setVillaFilters} searchable />
            <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="">All last items</option>
              {constructionItemsTemplate.map((item) => (
                <option key={item.TableItemID} value={item.TableItemID}>{item.name}</option>
              ))}
            </select>
            <MultiSelectFilter label="Status" options={STATUS_OPTIONS} selected={statusFilters} onChange={setStatusFilters} />
            <button type="button" className="admin-btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              Export to Excel
            </button>
          </div>

          <StatusCountChart items={filtered} getLabel={(f) => f.itemStatus} />

          <p className="file-status-hint" style={{ marginTop: "0.5rem" }}>
            {filtered.length} row{filtered.length === 1 ? "" : "s"} found ({new Set(filtered.map((f) => f.villaID)).size} villa
            {new Set(filtered.map((f) => f.villaID)).size === 1 ? "" : "s"}).
          </p>

          {filtered.length === 0 ? (
            <p className="file-status-hint">No villas match the current filters.</p>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Villa</th>
                    <th>Zone</th>
                    <th>Block</th>
                    <th>Last Item</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={`${f.villaID}-${f.item?.TableItemID ?? "none"}`}>
                      <td>{f.villaID}</td>
                      <td>{villaMetaByID[f.villaID]?.zonenum ?? "—"}</td>
                      <td>{villaMetaByID[f.villaID]?.blocknum ?? "—"}</td>
                      <td>
                        {f.item ? (
                          <>
                            {f.item.name}
                            <br />
                            <span className="file-status-hint">{f.item.TableItemID}</span>
                          </>
                        ) : (
                          "— (Not Started)"
                        )}
                      </td>
                      <td>{f.item ? getCategory(f.item.TableItemID) : "—"}</td>
                      <td>{f.itemStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graph-modal-header">
          <h3>Last Item</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
