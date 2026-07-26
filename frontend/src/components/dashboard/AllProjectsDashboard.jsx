import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  LineController,
  BarController
} from "chart.js";
import { Pie, Bar, Chart as MixedChart } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { dashboardApi } from "../../api/dashboard.js";
import { aggregateByPeriod, formatPeriodLabel, formatCurrency, downloadChartAsImage } from "../../utils/dashboardUtils.js";
import { aggregateByCategory, aggregateTotalBudget, getTopItems, getFilteredDateSummary, formatSAR } from "../../utils/portfolioFilterUtils.js";
import { INVOICE_STATUS_ORDER, SCHEDULE_STATUS_ORDER } from "../../config/scheduleInvoiceColors.js";
import { computeScheduleStatusFast } from "../../utils/scheduleUtils.js";
import { useAllVillaStatuses } from "../../hooks/useAllVillaStatuses.js";
import { useAllVillaInvoiceStatuses } from "../../hooks/useAllVillaInvoiceStatuses.js";
import { useSpecialQueryData } from "../../hooks/useSpecialQueryData.js";
import { evaluateCustomQuery } from "../../utils/customQueryUtils.js";
import { CustomQueryBuilder } from "../shared/CustomQueryBuilder.jsx";
import { constructionItemsApi } from "../../api/constructionItems.js";
import { CATEGORY_COLOR_PALETTE } from "../../utils/graphUtils.js";
import { useColorPreferences } from "../../contexts/ColorPreferencesContext.jsx";
import { FilterBar } from "./FilterBar.jsx";

// Draws the percent value directly on each pie slice — applied to the
// Category Planned/Actual pies so their downloaded PNGs are readable on
// their own, without needing the on-screen legend/tooltips. A small
// custom Chart.js plugin rather than a new npm dependency.
// Percent-only label drawn on each pie slice — used for the Category
// Planned/Actual pies. (An earlier version also drew the SAR value here,
// but it overlapped badly with the percent text on smaller slices —
// moved the cost value into the legend instead, see legendWithValues.)
const percentLabelsPlugin = {
  id: "percentLabels",
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset) return;
    const meta = chart.getDatasetMeta(0);
    const total = dataset.data.reduce((sum, v) => sum + (v || 0), 0);
    if (total <= 0) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    meta.data.forEach((arc, i) => {
      const value = dataset.data[i];
      if (!value) return;
      const percent = (value / total) * 100;
      if (percent < 3) return; // skip slivers too small for the label to be readable anyway
      const pos = arc.tooltipPosition();
      ctx.fillText(`${percent.toFixed(0)}%`, pos.x, pos.y);
    });
    ctx.restore();
  },
};

// Raw count drawn on each slice — used for the Villas by Status pie,
// where a percent alone doesn't tell you how many actual villas that is.
const countLabelsPlugin = {
  id: "countLabels",
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    if (!dataset) return;
    const meta = chart.getDatasetMeta(0);
    const total = dataset.data.reduce((sum, v) => sum + (v || 0), 0);
    if (total <= 0) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    meta.data.forEach((arc, i) => {
      const value = dataset.data[i];
      if (!value) return;
      const pos = arc.tooltipPosition();
      ctx.fillText(String(value), pos.x, pos.y);
    });
    ctx.restore();
  },
};

// Legend entries with the cost value appended to each category name,
// e.g. "Architectural: 106.6M SAR" — moved here from on-slice labels
// (see percentLabelsPlugin) since the slice was getting cramped.
function legendWithValues(chart) {
  const { data } = chart;
  if (!data.labels?.length || !data.datasets?.length) return [];
  const dataset = data.datasets[0];
  return data.labels.map((label, i) => ({
    text: `${label}: ${formatSAR(dataset.data[i])}`,
    fillStyle: dataset.backgroundColor[i],
    strokeStyle: dataset.backgroundColor[i],
    hidden: false,
    index: i,
  }));
}
import { Tabs } from "./Tabs.jsx";
import { ConstructionItemDashboard } from "./ConstructionItemDashboard.jsx";
import { useVillaGeoMeta } from "../../hooks/useVillaGeoMeta.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend,
  LineController,
  BarController);

const PAGE_SIZE = 25;
const STATUS_ORDER = ["NotStarted", "InProgress", "Completed"];

function downloadRowsAsExcel(rows, sheetName, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Replaces the full portfolio-wide dashboard from dashboardallproject.js:
 * cascading filters (date range + category/item/villa/block/stage),
 * category cost pies (planned, date-adjusted for working days, vs actual),
 * a monthly/weekly cost trend chart, a top-10-items chart, a villa status
 * pie, and a detailed sortable/paginated per-activity data table with
 * separate "current page" / "all data" Excel export.
 *
 * One deliberate simplification, flagged rather than silently guessed:
 * the original's cost-trend chart spread each activity's cost across
 * every month it spanned from start to finish. I couldn't fully verify
 * that logic (the source was cut off mid-function), so this reuses the
 * simpler "assign cost to the period containing planned finish date"
 * approach already built and tested for the villa dashboard instead of
 * risking a wrong port of unverified spreading logic.
 */
export function AllProjectsDashboard() {
  const { getColors } = useColorPreferences();
  const overallStatusColors = getColors("overallStatus");
  const resolvedInvoiceColors = getColors("invoice");
  const resolvedScheduleColors = getColors("schedule");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [filters, setFilters] = useState(null);
  const [viewType, setViewType] = useState("monthly");
  const [sortKey, setSortKey] = useState("villaID");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [tableSearch, setTableSearch] = useState("");
  const { villaMetaByID } = useVillaGeoMeta();

  const categoryPlannedRef = useRef(null);
  const categoryActualRef = useRef(null);
  const trendChartRef = useRef(null);
  const topItemsRef = useRef(null);

  useEffect(() => {
    dashboardApi
      .getAllProjects()
      .then((result) => {
        setData(result);
        setStatus("success");

        const dates = result.records.map((r) => r.plannedStartDate).filter(Boolean);
        const finishDates = result.records.map((r) => r.plannedFinishDate).filter(Boolean);
        const minDate = dates.length ? dates.reduce((min, d) => (d < min ? d : min)) : new Date().toISOString().slice(0, 10);
        const maxDate = finishDates.length
          ? finishDates.reduce((max, d) => (d > max ? d : max))
          : new Date().toISOString().slice(0, 10);
        setFilters({
          startDate: minDate,
          endDate: maxDate,
          categories: [],
          items: [],
          villas: [],
          blocks: [],
          zones: [],
          villaTypes: [],
        });
      })
      .catch(() => setStatus("error"));
  }, []);

  // Every real villa in the GeoJSON (~1,540), not just the ~590 the
  // backend currently has cost/status data for. Records for villas the
  // backend already knows about get zonenum/villatype merged in from the
  // GeoJSON; villas missing from the backend entirely get one synthesized
  // zero-cost/NotStarted row per construction item, using the first known
  // villa's records as a template for the 82 items' category/item/TableItemID.
  const enrichedRecords = useMemo(() => {
    if (!data) return [];

    const withGeoMeta = data.records.map((r) => ({
      ...r,
      // blocknum from the backend is sourced from the DynamoDB villas
      // table, which is mostly null (confirmed much earlier) — the
      // GeoJSON's blocknum is the real one, same source the map's Block
      // filter already uses. Without this override, only the synthesized
      // (missing-from-backend) villas got a real block, so most blocks
      // were massively under-represented in the filter's option list.
      blocknum: villaMetaByID[r.villaID]?.blocknum ?? r.blocknum ?? null,
      zonenum: villaMetaByID[r.villaID]?.zonenum ?? null,
      villatype: villaMetaByID[r.villaID]?.villatype ?? null,
    }));

    const knownVillaIDs = new Set(data.villas.map((v) => v.villaID));
    const missingVillaIDs = Object.keys(villaMetaByID).filter((id) => !knownVillaIDs.has(id));
    if (missingVillaIDs.length === 0) return withGeoMeta;

    const firstKnownVillaID = data.records[0]?.villaID;
    const itemTemplate = firstKnownVillaID
      ? data.records
          .filter((r) => r.villaID === firstKnownVillaID)
          .map((r) => ({ category: r.category, item: r.item, TableItemID: r.TableItemID }))
      : [];

    const synthesized = missingVillaIDs.flatMap((villaID) => {
      const meta = villaMetaByID[villaID] ?? {};
      return itemTemplate.map((t) => ({
        villaID,
        blocknum: meta.blocknum ?? null,
        stage: null,
        zonenum: meta.zonenum ?? null,
        villatype: meta.villatype ?? null,
        category: t.category,
        item: t.item,
        TableItemID: t.TableItemID,
        plannedCost: 0,
        actualCost: 0,
        plannedStartDate: null,
        plannedFinishDate: null,
        actualStatus: "NotStarted",
        invoiceStatus: "NotStarted",
        actualCompletedDate: null,
      }));
    });

    return [...withGeoMeta, ...synthesized];
  }, [data, villaMetaByID]);

  // Custom query needs every villa's full status maps (actual + invoice)
  // to evaluate conditions like "Civil-1 = Completed" — same data source
  // as the Schedule breakdown and the map's Schedule mode, fetched once
  // and shared. Moved before filteredRecords since the query result
  // feeds into it.
  const { data: allVillaStatuses } = useAllVillaStatuses(true);
  const [customQueryConditions, setCustomQueryConditions] = useState([]);
  const { data: allVillaInvoiceStatuses } = useAllVillaInvoiceStatuses(customQueryConditions.length > 0);
  const {
    columns: specialQueryColumns,
    valuesByColumn: specialQueryValuesByColumn,
    byVilla: specialQueryByVilla,
  } = useSpecialQueryData(true);

  const customQueryVillaIDs = useMemo(() => {
    if (customQueryConditions.length === 0) return null;
    if (!allVillaStatuses || !allVillaInvoiceStatuses) return null; // still loading
    return evaluateCustomQuery(customQueryConditions, {
      villaMetaByID,
      allVillaStatuses,
      allVillaInvoiceStatuses,
      specialQueryByVilla,
    });
  }, [customQueryConditions, allVillaStatuses, allVillaInvoiceStatuses, villaMetaByID, specialQueryByVilla]);

  const filteredRecords = useMemo(() => {
    if (!data || !filters) return [];
    return enrichedRecords.filter((r) => {
      if (filters.categories.length > 0 && !filters.categories.includes(r.category)) return false;
      if (filters.items.length > 0 && !filters.items.includes(r.item)) return false;
      if (filters.villas.length > 0 && !filters.villas.includes(r.villaID)) return false;
      if (filters.blocks.length > 0 && !filters.blocks.includes(r.blocknum)) return false;
      if (filters.zones && filters.zones.length > 0 && !filters.zones.includes(r.zonenum)) return false;
      if (filters.villaTypes && filters.villaTypes.length > 0 && !filters.villaTypes.includes(r.villatype)) return false;
      if (customQueryVillaIDs && !customQueryVillaIDs.has(r.villaID)) return false;
      return true;
    });
  }, [data, filters, enrichedRecords, customQueryVillaIDs]);

  // Portfolio-wide Schedule breakdown — needs the item template
  // (predecessor chains), same data sources as the map/By Item tab's
  // Schedule mode.
  const [constructionItemsTemplate, setConstructionItemsTemplate] = useState([]);
  useEffect(() => {
    constructionItemsApi.list().then(setConstructionItemsTemplate).catch(() => setConstructionItemsTemplate([]));
  }, []);
  const itemMaps = useMemo(() => {
    const itemById = new Map(constructionItemsTemplate.map((t) => [t.id, t]));
    const itemByTableId = new Map(constructionItemsTemplate.map((t) => [t.TableItemID, t]));
    return { itemById, itemByTableId };
  }, [constructionItemsTemplate]);

  // Uses the FAST classifier (see scheduleUtils.js) — verified equivalent
  // to the map/By Item tab's version, but this needs to run across every
  // filtered record (potentially ~126,000 for the whole project), where
  // the original recursive version would be far too slow.
  const scheduleCounts = useMemo(() => {
    if (!filters || !allVillaStatuses || constructionItemsTemplate.length === 0) return {};
    const cutoff = new Date(`${filters.endDate}T00:00:00`);
    const counts = {};
    filteredRecords.forEach((r) => {
      const s = computeScheduleStatusFast({
        targetTableItemId: r.TableItemID,
        targetActualStatus: r.actualStatus,
        targetPlannedStartDate: r.plannedStartDate,
        cutoffDate: cutoff,
        itemById: itemMaps.itemById,
        itemByTableId: itemMaps.itemByTableId,
        villaStatusMap: allVillaStatuses[r.villaID] ?? {},
      });
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [filters, filteredRecords, allVillaStatuses, constructionItemsTemplate.length, itemMaps]);

  const rangeEndDate = filters ? new Date(`${filters.endDate}T00:00:00`) : new Date();

  // "Up to [end date]": planned cost date-adjusted for elapsed working
  // days, actual cost only counting what was completed by that date.
  const categoryBreakdown = useMemo(
    () => aggregateByCategory(filteredRecords, rangeEndDate),
    [filteredRecords, filters?.endDate]
  );

  // "Total budget": the whole filtered scope (category/villa/block/stage
  // filters still apply), ignoring the date range entirely.
  const totalBudgetBreakdown = useMemo(() => aggregateTotalBudget(filteredRecords), [filteredRecords]);

  const dateSummary = useMemo(() => getFilteredDateSummary(filteredRecords), [filteredRecords]);

  // Elapsed = (selected date - planned start) / (planned finish - planned
  // start), using the filtered scope's own earliest start / latest finish
  // as the project window, and the FilterBar's end date as "the day
  // selected." Clamped to [0, 100]% / [0, totalDays] since a date outside
  // the project window (before start or after finish) shouldn't report a
  // negative or >100% elapsed figure.
  const elapsedDuration = useMemo(() => {
    if (!filters || !dateSummary.earliestPlannedStart || !dateSummary.latestPlannedFinish) return null;
    const start = new Date(`${dateSummary.earliestPlannedStart}T00:00:00`);
    const finish = new Date(`${dateSummary.latestPlannedFinish}T00:00:00`);
    const selected = new Date(`${filters.endDate}T00:00:00`);
    const totalDays = (finish - start) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) return null;
    const rawElapsedDays = (selected - start) / (1000 * 60 * 60 * 24);
    const elapsedDays = Math.max(0, Math.min(totalDays, rawElapsedDays));
    const elapsedPercent = (elapsedDays / totalDays) * 100;
    return { elapsedDays: Math.round(elapsedDays), totalDays: Math.round(totalDays), elapsedPercent };
  }, [filters, dateSummary]);

  const topItems = useMemo(() => getTopItems(filteredRecords, rangeEndDate, 10), [filteredRecords, filters?.endDate]);

  const { periods, sortedPeriods } = useMemo(
    () => aggregateByPeriod(filteredRecords, viewType),
    [filteredRecords, viewType]
  );

  const sortedFilteredTable = useMemo(() => {
    const searched = tableSearch
      ? filteredRecords.filter(
          (r) =>
            r.villaID.toLowerCase().includes(tableSearch.toLowerCase()) ||
            r.item.toLowerCase().includes(tableSearch.toLowerCase())
        )
      : filteredRecords;
    return [...searched].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [filteredRecords, tableSearch, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedFilteredTable.length / PAGE_SIZE));
  const pageRows = sortedFilteredTable.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function tableRowsForExport(rows) {
    return rows.map((r) => ({
      Villa: r.villaID,
      Block: r.blocknum ?? "—",
      Zone: r.zonenum ?? "—",
      "Villa Type": r.villatype ?? "—",
      Item: r.item,
      Category: r.category,
      "Planned Cost": r.plannedCost,
      "Actual Cost": r.actualCost,
      "Planned Finish": r.plannedFinishDate ?? "—",
      "Actual Completed": r.actualCompletedDate ?? "—",
      Status: r.actualStatus,
    }));
  }

  if (status === "loading" || !filters) return <p>Loading project dashboard…</p>;
  if (status === "error") return <p>Couldn't load the project dashboard.</p>;

  // Rolled up client-side from filteredRecords (all real GeoJSON villas,
  // not just the backend's ~590) instead of the backend's raw
  // data.statusCounts, which only ever covered the villas it has cost
  // data for. Same rule as the backend's computeVillaStatus: every item
  // Completed -> Completed, any item started -> InProgress, else NotStarted.
  const statusCounts = (() => {
    const byVilla = {};
    filteredRecords.forEach((r) => {
      if (!byVilla[r.villaID]) byVilla[r.villaID] = [];
      byVilla[r.villaID].push(r.actualStatus ?? "NotStarted");
    });
    const counts = { NotStarted: 0, InProgress: 0, Completed: 0 };
    Object.values(byVilla).forEach((statuses) => {
      const allCompleted = statuses.every((s) => s === "Completed");
      const anyStarted = statuses.some((s) => s !== "NotStarted");
      const villaStatus = allCompleted ? "Completed" : anyStarted ? "InProgress" : "NotStarted";
      counts[villaStatus] = (counts[villaStatus] ?? 0) + 1;
    });
    return counts;
  })();
  const totalPlannedFiltered = categoryBreakdown.plannedCosts.reduce((s, c) => s + c, 0);
  const totalActualFiltered = categoryBreakdown.actualCosts.reduce((s, c) => s + c, 0);

  const totalBudgetPlanned = totalBudgetBreakdown.plannedCosts.reduce((s, c) => s + c, 0);
  const totalBudgetActual = totalBudgetBreakdown.actualCosts.reduce((s, c) => s + c, 0);

  // Every percent below divides by the SAME denominator — total planned
  // budget for the whole filtered scope — so all four numbers are
  // directly comparable on one screen (same convention as the category
  // breakdown table).
  const totalBudgetPlannedPercent = totalBudgetPlanned > 0 ? (totalBudgetPlanned / totalBudgetPlanned) * 100 : 0;
  const totalBudgetActualPercent = totalBudgetPlanned > 0 ? (totalBudgetActual / totalBudgetPlanned) * 100 : 0;
  const upToDatePlannedPercent = totalBudgetPlanned > 0 ? (totalPlannedFiltered / totalBudgetPlanned) * 100 : 0;
  const upToDateActualPercent = totalBudgetPlanned > 0 ? (totalActualFiltered / totalBudgetPlanned) * 100 : 0;

  const statusTotal = STATUS_ORDER.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const statusTableRows = STATUS_ORDER.map((s) => ({
    status: s,
    count: statusCounts[s] ?? 0,
    percent: statusTotal > 0 ? ((statusCounts[s] ?? 0) / statusTotal) * 100 : 0,
  }));

  // Item-level tally (not rolled up per villa the way overall status is —
  // invoices are naturally per-activity, so "how many item-invoices are
  // ReadyToPay" is the more useful number here than a villa-level rollup).
  const invoiceCounts = {};
  filteredRecords.forEach((r) => {
    const inv = r.invoiceStatus ?? "NotStarted";
    invoiceCounts[inv] = (invoiceCounts[inv] ?? 0) + 1;
  });
  const invoiceTotal = INVOICE_STATUS_ORDER.reduce((sum, s) => sum + (invoiceCounts[s] ?? 0), 0);
  const invoiceTableRows = INVOICE_STATUS_ORDER.map((s) => ({
    status: s,
    count: invoiceCounts[s] ?? 0,
    percent: invoiceTotal > 0 ? ((invoiceCounts[s] ?? 0) / invoiceTotal) * 100 : 0,
  }));

  const scheduleTotal = SCHEDULE_STATUS_ORDER.reduce((sum, s) => sum + (scheduleCounts[s] ?? 0), 0);
  const scheduleTableRows = SCHEDULE_STATUS_ORDER.map((s) => ({
    status: s,
    count: scheduleCounts[s] ?? 0,
    percent: scheduleTotal > 0 ? ((scheduleCounts[s] ?? 0) / scheduleTotal) * 100 : 0,
  }));

  // Every category row now carries BOTH the Total (whole filtered scope,
  // any date) and the Up-to-date (date-adjusted) figures side by side,
  // matching the same Total/Up-to-date split already used for the
  // summary cards above. Plain calculation, not useMemo — this runs after
  // the loading/error early return above, so wrapping it in a hook here
  // would call that hook conditionally and violate the Rules of Hooks
  // (this is exactly what caused the "Rendered more hooks than during the
  // previous render" crash).
  const categoryTableRows = (() => {
    const allCategories = [
      ...new Set([...totalBudgetBreakdown.categories, ...categoryBreakdown.categories]),
    ].sort();
    return allCategories.map((category) => {
      const totalIdx = totalBudgetBreakdown.categories.indexOf(category);
      const toDateIdx = categoryBreakdown.categories.indexOf(category);
      const totalPlanned = totalIdx >= 0 ? totalBudgetBreakdown.plannedCosts[totalIdx] : 0;
      const totalActual = totalIdx >= 0 ? totalBudgetBreakdown.actualCosts[totalIdx] : 0;
      const toDatePlanned = toDateIdx >= 0 ? categoryBreakdown.plannedCosts[toDateIdx] : 0;
      const toDateActual = toDateIdx >= 0 ? categoryBreakdown.actualCosts[toDateIdx] : 0;
      return {
        category,
        totalPlanned,
        totalActual,
        // Same convention as the summary cards: every percent divides by
        // the same denominator (total planned budget) so all four numbers
        // are directly comparable on one row.
        totalPlannedPercent: totalBudgetPlanned > 0 ? (totalPlanned / totalBudgetPlanned) * 100 : 0,
        totalActualPercent: totalBudgetPlanned > 0 ? (totalActual / totalBudgetPlanned) * 100 : 0,
        toDatePlanned,
        toDateActual,
        toDatePlannedPercent: totalBudgetPlanned > 0 ? (toDatePlanned / totalBudgetPlanned) * 100 : 0,
        toDateActualPercent: totalBudgetPlanned > 0 ? (toDateActual / totalBudgetPlanned) * 100 : 0,
      };
    });
  })();

  return (
    <div className="villa-dashboard">
      <FilterBar
        records={enrichedRecords}
        minDate={filters.startDate}
        maxDate={filters.endDate}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />

      <details className="custom-query-section" style={{ marginBottom: "var(--space-3)" }}>
        <summary>
          Custom query{" "}
          {customQueryConditions.length > 0 && `(${customQueryConditions.length} condition${customQueryConditions.length === 1 ? "" : "s"})`}
        </summary>
        <p className="file-status-hint" style={{ marginTop: "0.4rem" }}>
          Combine conditions across item status, invoice status, and villa attributes — e.g. "Civil-1 = Completed AND
          Block = 5". Narrows every tab below on top of the filters above.
        </p>
        <CustomQueryBuilder
          conditions={customQueryConditions}
          onChange={setCustomQueryConditions}
          villaMetaByID={villaMetaByID}
          specialQueryColumns={specialQueryColumns}
          specialQueryValuesByColumn={specialQueryValuesByColumn}
        />
      </details>

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                <div className="dashboard-summary-cards">
                  <div className="summary-card">
                    <span>Villas (filtered)</span>
                    <strong>{new Set(filteredRecords.map((r) => r.villaID)).size}</strong>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                    Project Timeline — filtered scope, ignoring the date range
                  </h4>
                  <div className="dashboard-summary-cards">
                    <div className="summary-card">
                      <span>Planned Start</span>
                      <strong>{dateSummary.earliestPlannedStart ?? "—"}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Planned Finish</span>
                      <strong>{dateSummary.latestPlannedFinish ?? "—"}</strong>
                    </div>
                    <div className="summary-card">
                      <span>First Actual Date Recorded</span>
                      <strong>{dateSummary.firstActualDateRecorded ?? "—"}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Last Actual Date Recorded</span>
                      <strong>{dateSummary.lastActualDateRecorded ?? "—"}</strong>
                    </div>
                  </div>
                </div>

                {elapsedDuration && (
                  <div>
                    <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                      Elapsed Duration — as of {filters.endDate}
                    </h4>
                    <div className="dashboard-summary-cards">
                      <div className="summary-card">
                        <span>Elapsed Days</span>
                        <strong>
                          {elapsedDuration.elapsedDays} / {elapsedDuration.totalDays}
                        </strong>
                      </div>
                      <div className="summary-card">
                        <span>Elapsed %</span>
                        <strong>{elapsedDuration.elapsedPercent.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                    Total Budget — whole filtered scope, any date
                  </h4>
                  <div className="dashboard-summary-cards">
                    <div className="summary-card">
                      <span>Total Planned Cost</span>
                      <strong>{formatCurrency(totalBudgetPlanned)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Total Actual Cost</span>
                      <strong>{formatCurrency(totalBudgetActual)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Planned %</span>
                      <strong>{totalBudgetPlannedPercent.toFixed(1)}%</strong>
                    </div>
                    <div className="summary-card">
                      <span>Actual %</span>
                      <strong>{totalBudgetActualPercent.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                    Up to {filters.endDate} — date-adjusted
                  </h4>
                  <div className="dashboard-summary-cards">
                    <div className="summary-card">
                      <span>Planned Cost (adjusted, to date)</span>
                      <strong>{formatCurrency(totalPlannedFiltered)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Actual Cost (to date)</span>
                      <strong>{formatCurrency(totalActualFiltered)}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Planned %</span>
                      <strong>{upToDatePlannedPercent.toFixed(1)}%</strong>
                    </div>
                    <div className="summary-card">
                      <span>Actual %</span>
                      <strong>{upToDateActualPercent.toFixed(1)}%</strong>
                    </div>
                  </div>
                </div>

                <div className="dashboard-pies">
                  <div className="dashboard-pie" style={{ width: 200 }}>
                    <h4>Villas by Status</h4>
                    <Pie
                      plugins={[countLabelsPlugin]}
                      data={{
                        labels: STATUS_ORDER,
                        datasets: [
                          {
                            data: STATUS_ORDER.map((s) => statusCounts[s] ?? 0),
                            backgroundColor: STATUS_ORDER.map((s) => overallStatusColors[s]),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
                    />
                  </div>

                  <div style={{ width: 260 }}>
                    <div className="dashboard-chart-actions">
                      <h4 style={{ fontSize: "0.75rem", margin: "0", color: "var(--color-text-muted)" }}>Category — Planned</h4>
                      <button type="button" onClick={() => downloadChartAsImage(categoryPlannedRef, "category_planned")}>
                        PNG
                      </button>
                    </div>
                    <Pie
                      ref={categoryPlannedRef}
                      plugins={[percentLabelsPlugin]}
                      data={{
                        labels: categoryBreakdown.categories,
                        datasets: [
                          {
                            data: categoryBreakdown.plannedCosts,
                            backgroundColor: categoryBreakdown.categories.map(
                              (c) => CATEGORY_COLOR_PALETTE[c] ?? CATEGORY_COLOR_PALETTE.Default
                            ),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, generateLabels: legendWithValues } },
                          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatSAR(ctx.parsed)}` } },
                        },
                      }}
                    />
                  </div>

                  <div style={{ width: 260 }}>
                    <div className="dashboard-chart-actions">
                      <h4 style={{ fontSize: "0.75rem", margin: "0", color: "var(--color-text-muted)" }}>Category — Actual</h4>
                      <button type="button" onClick={() => downloadChartAsImage(categoryActualRef, "category_actual")}>
                        PNG
                      </button>
                    </div>
                    <Pie
                      ref={categoryActualRef}
                      plugins={[percentLabelsPlugin]}
                      data={{
                        // Includes an "Unspent" slice (total planned minus
                        // total actual) so every real category's percent
                        // divides by the SAME denominator as the Planned
                        // pie (total planned budget) instead of the
                        // smaller "total actual so far" — same fix already
                        // applied to the Category Breakdown table. Without
                        // this, a category progressing faster than others
                        // could show a bigger Actual % than Planned % even
                        // while its actual cost was still below its
                        // planned cost, which read as "inaccurate."
                        labels: [...categoryBreakdown.categories, "Unspent (of planned budget)"],
                        datasets: [
                          {
                            data: [
                              ...categoryBreakdown.actualCosts,
                              Math.max(
                                0,
                                categoryBreakdown.plannedCosts.reduce((a, b) => a + b, 0) -
                                  categoryBreakdown.actualCosts.reduce((a, b) => a + b, 0)
                              ),
                            ],
                            backgroundColor: [
                              ...categoryBreakdown.categories.map((c) => CATEGORY_COLOR_PALETTE[c] ?? CATEGORY_COLOR_PALETTE.Default),
                              "#e5e7eb",
                            ],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        plugins: {
                          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, generateLabels: legendWithValues } },
                          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatSAR(ctx.parsed)}` } },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="dashboard-chart-section">
                  <div className="dashboard-chart-actions">
                    <h4>Villas by Status — detail</h4>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRowsAsExcel(
                          statusTableRows.map((r) => ({ Status: r.status, Count: r.count, "% of Villas": r.percent.toFixed(1) })),
                          "Villas by Status",
                          "villas_by_status"
                        )
                      }
                    >
                      Download Table
                    </button>
                  </div>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>% of Villas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusTableRows.map((r) => (
                        <tr key={r.status}>
                          <td>{r.status}</td>
                          <td>{r.count}</td>
                          <td>{r.percent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dashboard-pies">
                  <div className="dashboard-pie" style={{ width: 200 }}>
                    <h4>Invoices by Status</h4>
                    <Pie
                      data={{
                        labels: INVOICE_STATUS_ORDER,
                        datasets: [
                          {
                            data: INVOICE_STATUS_ORDER.map((s) => invoiceCounts[s] ?? 0),
                            backgroundColor: INVOICE_STATUS_ORDER.map((s) => resolvedInvoiceColors[s]),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
                    />
                  </div>
                </div>

                <div className="dashboard-chart-section">
                  <div className="dashboard-chart-actions">
                    <h4>Invoices by Status — detail</h4>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRowsAsExcel(
                          invoiceTableRows.map((r) => ({ Status: r.status, Count: r.count, "% of Item-Invoices": r.percent.toFixed(1) })),
                          "Invoices by Status",
                          "invoices_by_status"
                        )
                      }
                    >
                      Download Table
                    </button>
                  </div>
                  <p className="file-status-hint" style={{ marginTop: "-0.25rem" }}>
                    Counted per activity (each item invoices separately), not rolled up per villa.
                  </p>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>% of Item-Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceTableRows.map((r) => (
                        <tr key={r.status}>
                          <td>{r.status}</td>
                          <td>{r.count}</td>
                          <td>{r.percent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dashboard-pies">
                  <div className="dashboard-pie" style={{ width: 200 }}>
                    <h4>Schedule by Status — as of {filters.endDate}</h4>
                    <Pie
                      data={{
                        labels: SCHEDULE_STATUS_ORDER,
                        datasets: [
                          {
                            data: SCHEDULE_STATUS_ORDER.map((s) => scheduleCounts[s] ?? 0),
                            backgroundColor: SCHEDULE_STATUS_ORDER.map((s) => resolvedScheduleColors[s]),
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }}
                    />
                  </div>
                </div>

                <div className="dashboard-chart-section">
                  <div className="dashboard-chart-actions">
                    <h4>Schedule by Status — detail</h4>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRowsAsExcel(
                          scheduleTableRows.map((r) => ({ Status: r.status, Count: r.count, "% of Item-Records": r.percent.toFixed(1) })),
                          "Schedule by Status",
                          "schedule_by_status"
                        )
                      }
                    >
                      Download Table
                    </button>
                  </div>
                  <p className="file-status-hint" style={{ marginTop: "-0.25rem" }}>
                    Is each activity on track given its planned date and dependencies, as of {filters.endDate} (your Date
                    Range's end date doubles as the schedule cutoff). "ready" means due and unblocked; "blocked" means due but
                    waiting on a predecessor.
                  </p>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>% of Item-Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleTableRows.map((r) => (
                        <tr key={r.status}>
                          <td>{r.status}</td>
                          <td>{r.count}</td>
                          <td>{r.percent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dashboard-chart-section">
                  <div className="dashboard-chart-actions">
                    <h4>Category Breakdown — detail</h4>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRowsAsExcel(
                          categoryTableRows.map((r) => ({
                            Category: r.category,
                            "Total Planned": r.totalPlanned,
                            "Total Planned %": r.totalPlannedPercent.toFixed(1),
                            "Total Actual": r.totalActual,
                            "Total Actual %": r.totalActualPercent.toFixed(1),
                            "To-Date Planned": r.toDatePlanned,
                            "To-Date Planned %": r.toDatePlannedPercent.toFixed(1),
                            "To-Date Actual": r.toDateActual,
                            "To-Date Actual %": r.toDateActualPercent.toFixed(1),
                          })),
                          "Category Breakdown",
                          "category_breakdown"
                        )
                      }
                    >
                      Download Table
                    </button>
                  </div>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th rowSpan={2}>Category</th>
                        <th colSpan={4}>Total Budget — whole filtered scope, any date</th>
                        <th colSpan={4}>Up to {filters.endDate} — date-adjusted</th>
                      </tr>
                      <tr>
                        <th>Planned</th>
                        <th>Planned %</th>
                        <th>Actual</th>
                        <th>Actual %</th>
                        <th>Planned</th>
                        <th>Planned %</th>
                        <th>Actual</th>
                        <th>Actual %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryTableRows.map((r) => (
                        <tr key={r.category}>
                          <td>{r.category}</td>
                          <td>{formatCurrency(r.totalPlanned)}</td>
                          <td>{r.totalPlannedPercent.toFixed(1)}%</td>
                          <td>{formatCurrency(r.totalActual)}</td>
                          <td>{r.totalActualPercent.toFixed(1)}%</td>
                          <td>{formatCurrency(r.toDatePlanned)}</td>
                          <td>{r.toDatePlannedPercent.toFixed(1)}%</td>
                          <td>{formatCurrency(r.toDateActual)}</td>
                          <td>{r.toDateActualPercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          },
          {
            id: "trend",
            label: "Cost Trend",
            content: (
              <div className="dashboard-chart-section">
                <div className="dashboard-chart-actions">
                  <h4>Cost Trend</h4>
                  <button type="button" onClick={() => setViewType((v) => (v === "monthly" ? "weekly" : "monthly"))}>
                    Switch to {viewType === "monthly" ? "Weekly" : "Monthly"} view
                  </button>
                  <button type="button" onClick={() => downloadChartAsImage(trendChartRef, "cost_trend_chart")}>
                    Download Chart
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadRowsAsExcel(
                        sortedPeriods.map((p) => ({
                          Period: formatPeriodLabel(p, viewType),
                          "Planned Cost": periods[p].totalCost,
                          "Actual Cost": periods[p].totalCostActual,
                          "Planned % (period)": periods[p].percentOfTotal.toFixed(2),
                          "Actual % (period)": periods[p].percentOfTotalActual.toFixed(2),
                          "Planned Cumulative": periods[p].cumulativeCost,
                          "Actual Cumulative": periods[p].cumulativeCostActual,
                          "Planned Cum %": periods[p].cumPercent.toFixed(2),
                          "Actual Cum %": periods[p].cumPercentActual.toFixed(2),
                        })),
                        "Cost Trend",
                        "cost_trend_data"
                      )
                    }
                  >
                    Download Data
                  </button>
                </div>
                <div className="dashboard-chart-container">
                  <MixedChart
                    ref={trendChartRef}
                    type="bar"
                    data={{
                      labels: sortedPeriods.map((p) => formatPeriodLabel(p, viewType)),
                      datasets: [
                        { type: "bar", label: "Planned Cost", data: sortedPeriods.map((p) => periods[p].totalCost), backgroundColor: "rgba(59,130,246,0.6)" },
                        { type: "bar", label: "Actual Cost", data: sortedPeriods.map((p) => periods[p].totalCostActual), backgroundColor: "rgba(34,197,94,0.6)" },
                        { type: "line", label: "Planned Cumulative", data: sortedPeriods.map((p) => periods[p].cumulativeCost), borderColor: "rgba(236,72,153,1)", backgroundColor: "rgba(236,72,153,0.3)", yAxisID: "y1" },
                        { type: "line", label: "Actual Cumulative", data: sortedPeriods.map((p) => periods[p].cumulativeCostActual), borderColor: "rgba(139,92,246,1)", backgroundColor: "rgba(139,92,246,0.3)", yAxisID: "y1" },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: { type: "linear", position: "left", title: { display: true, text: "Period Cost (SAR)" } },
                        y1: { type: "linear", position: "right", title: { display: true, text: "Cumulative (SAR)" }, grid: { drawOnChartArea: false } },
                      },
                    }}
                  />
                </div>

                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Planned Cost</th>
                      <th>Actual Cost</th>
                      <th>Planned % (period)</th>
                      <th>Actual % (period)</th>
                      <th>Planned Cum %</th>
                      <th>Actual Cum %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPeriods.map((p) => (
                      <tr key={p}>
                        <td>{formatPeriodLabel(p, viewType)}</td>
                        <td>{formatCurrency(periods[p].totalCost)}</td>
                        <td>{formatCurrency(periods[p].totalCostActual)}</td>
                        <td>{periods[p].percentOfTotal.toFixed(1)}%</td>
                        <td>{periods[p].percentOfTotalActual.toFixed(1)}%</td>
                        <td>{periods[p].cumPercent.toFixed(1)}%</td>
                        <td>{periods[p].cumPercentActual.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {sortedPeriods.length === 0 && (
                      <tr>
                        <td colSpan={7} className="dashboard-table-empty">
                          No periods to show for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "top-items",
            label: "Top Items",
            content: (
              <div className="dashboard-chart-section">
                <div className="dashboard-chart-actions">
                  <h4>Top 10 Items (by planned budget)</h4>
                  <button type="button" onClick={() => downloadChartAsImage(topItemsRef, "top_items_chart")}>
                    Download Chart
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadRowsAsExcel(
                        topItems.map((i) => ({
                          Item: i.item,
                          Category: i.category,
                          "Planned (adjusted)": i.planned,
                          Actual: i.actual,
                          "Planned % of Total Budget": totalPlannedFiltered > 0 ? ((i.totalBudget / totalPlannedFiltered) * 100).toFixed(2) : "0.00",
                          "Actual % of Total Budget": totalPlannedFiltered > 0 ? ((i.actual / totalPlannedFiltered) * 100).toFixed(2) : "0.00",
                        })),
                        "Top Items",
                        "top_items_data"
                      )
                    }
                  >
                    Download Data
                  </button>
                </div>
                <div className="dashboard-chart-container">
                  <Bar
                    ref={topItemsRef}
                    data={{
                      labels: topItems.map((i) => i.item),
                      datasets: [
                        { label: "Planned (adjusted)", data: topItems.map((i) => i.planned), backgroundColor: "rgba(59,130,246,0.7)" },
                        { label: "Actual", data: topItems.map((i) => i.actual), backgroundColor: "rgba(34,197,94,0.7)" },
                      ],
                    }}
                    options={{
                      indexAxis: "y",
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: "bottom" } },
                      scales: { x: { title: { display: true, text: "SAR" } } },
                    }}
                  />
                </div>

                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Planned (adjusted)</th>
                      <th>Planned % of Total Budget</th>
                      <th>Actual</th>
                      <th>Actual % of Total Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((i) => (
                      <tr key={i.item}>
                        <td>{i.item}</td>
                        <td>{i.category}</td>
                        <td>{formatCurrency(i.planned)}</td>
                        <td>{totalPlannedFiltered > 0 ? ((i.totalBudget / totalPlannedFiltered) * 100).toFixed(1) : "0.0"}%</td>
                        <td>{formatCurrency(i.actual)}</td>
                        <td>{totalPlannedFiltered > 0 ? ((i.actual / totalPlannedFiltered) * 100).toFixed(1) : "0.0"}%</td>
                      </tr>
                    ))}
                    {topItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="dashboard-table-empty">
                          No items to show for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "by-item",
            label: "By Item",
            content: <ConstructionItemDashboard />,
          },
          {
            id: "data",
            label: "Data Table",
            content: (
              <div className="dashboard-chart-section">
                <div className="dashboard-chart-actions">
                  <h4>Detailed Cost Data</h4>
                  <input
                    type="text"
                    placeholder="Search villa or item…"
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <button type="button" onClick={() => downloadRowsAsExcel(tableRowsForExport(pageRows), "Data", "Data_Current_Page")}>
                    Download Current Page
                  </button>
                  <button type="button" onClick={() => downloadRowsAsExcel(tableRowsForExport(sortedFilteredTable), "Data", "Data_All")}>
                    Download All Data
                  </button>
                </div>

                <table className="dashboard-table">
                  <thead>
                    <tr>
                      {[
                        ["villaID", "Villa"],
                        ["blocknum", "Block"],
                        ["item", "Item"],
                        ["category", "Category"],
                        ["plannedCost", "Planned Cost"],
                        ["actualCost", "Actual Cost"],
                        ["plannedFinishDate", "Planned Finish"],
                        ["actualStatus", "Status"],
                      ].map(([key, label]) => (
                        <th key={key} onClick={() => toggleSort(key)}>
                          {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={`${r.villaID}-${r.TableItemID}-${i}`}>
                        <td>{r.villaID}</td>
                        <td>{r.blocknum ?? "—"}</td>
                        <td>{r.item}</td>
                        <td>{r.category}</td>
                        <td>{formatCurrency(r.plannedCost)}</td>
                        <td>{formatCurrency(r.actualCost)}</td>
                        <td>{r.plannedFinishDate ?? "—"}</td>
                        <td>{r.actualStatus}</td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="dashboard-table-empty">
                          No records match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="dashboard-controls">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span style={{ fontSize: "0.8rem" }}>
                    Page {page} of {pageCount} ({sortedFilteredTable.length} records)
                  </span>
                  <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
