import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Registering the same elements VillaDashboard.jsx already registers is
// harmless (Chart.js dedupes), and this component needs to work
// standalone even if VillaDashboard's bundle hasn't loaded in this
// session — the Quality dashboard and the villa panel are separate lazy
// chunks, loaded independently.
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Draws the count above each bar. A hand-rolled plugin object rather
// than pulling in chartjs-plugin-datalabels as a new dependency — this
// component only needs one number per bar, not that plugin's full
// feature set, and passing it via react-chartjs-2's per-chart `plugins`
// prop below means it's scoped to just this chart, not registered
// globally for every Chart.js instance in the app.
const barCountLabelsPlugin = {
  id: "barCountLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value == null) return;
        ctx.save();
        ctx.fillStyle = "#1f2937";
        ctx.font = "600 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(value), bar.x, bar.y - 4);
        ctx.restore();
      });
    });
  },
};

// Same palette used for the status timeline's dots (StatusTimeline.jsx)
// — kept local for the same reason: this is the only place in this
// component that needs status-specific color, not worth a shared import.
// "Open"/"Closed" (NcrReport's own bucket labels, not real status
// values) reuse the same orange/green StatusTimeline already uses for
// NCR-opened/NCR-closed timeline entries, so the color means the same
// thing everywhere in the app, not just here.
const STATUS_COLORS = {
  NotStarted: "#9ca3af",
  InProgress: "#3b82f6",
  Notes: "#a855f7",
  NCR: "#ea580c",
  Rejected: "#dc2626",
  Completed: "#22c55e",
  Open: "#ea580c",
  Closed: "#16a34a",
};
const STATUS_ORDER = ["NotStarted", "InProgress", "Notes", "NCR", "Rejected", "Completed", "Open", "Closed"];

// Fallback categorical palette for labels StatusCountChart doesn't have
// a fixed meaning for — e.g. OutOfSequenceReport buckets by construction
// item NAME, which is open-ended, not a fixed enum like status. Chosen
// to read clearly on a white background and stay distinct from each
// other and from the fixed status colors above.
const CATEGORICAL_PALETTE = [
  "#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777",
  "#0891b2", "#65a30d", "#dc2626", "#4f46e5", "#0d9488",
  "#c026d3", "#ca8a04",
];

/**
 * Bar chart of how many rows fall into each status, from whatever list
 * is currently filtered/visible in the report above it — so the chart
 * always matches the table, not the whole unfiltered dataset. `items`
 * is any array with a `.status` (or `.closed` for boolean-only reports
 * — see `getLabel`) field; `getLabel` lets callers that don't have a
 * literal NCR/Rejected/etc. status string (e.g. NcrReport's
 * open/closed rows, OutOfSequenceReport's item-name rows) supply their
 * own bucket label per row.
 *
 * Coloring: known status/Open/Closed labels always get their fixed,
 * meaningful color (same one used elsewhere in the app for that same
 * concept); anything else (item names, etc.) gets a distinct color from
 * a rotating categorical palette instead of every bar rendering the
 * same flat gray.
 */
export function StatusCountChart({ items, getLabel = (item) => item.status, height = 180 }) {
  const counts = {};
  items.forEach((item) => {
    const label = getLabel(item) ?? "Unknown";
    counts[label] = (counts[label] ?? 0) + 1;
  });

  const labels = Object.keys(counts).sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a);
    const bi = STATUS_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Assign categorical colors only to the labels that actually need one
  // (not in STATUS_COLORS), in the order they appear, so the same set
  // of labels gets the same colors on every render/filter change.
  let nextPaletteIndex = 0;
  const colorForLabel = {};
  labels.forEach((l) => {
    if (STATUS_COLORS[l]) {
      colorForLabel[l] = STATUS_COLORS[l];
    } else {
      colorForLabel[l] = CATEGORICAL_PALETTE[nextPaletteIndex % CATEGORICAL_PALETTE.length];
      nextPaletteIndex += 1;
    }
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Count",
        data: labels.map((l) => counts[l]),
        backgroundColor: labels.map((l) => colorForLabel[l]),
        borderRadius: 4,
      },
    ],
  };

  if (items.length === 0) {
    return <p className="file-status-hint">Nothing to chart — no rows match the current filters.</p>;
  }

  return (
    <div style={{ height }}>
      <Bar
        data={data}
        plugins={[barCountLabelsPlugin]}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          layout: { padding: { top: 16 } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
              // A little headroom above the tallest bar so its count
              // label (drawn above the bar) doesn't get clipped by the
              // chart's own top edge.
              suggestedMax: Math.max(...labels.map((l) => counts[l]), 0) * 1.15 || 1,
            },
          },
        }}
      />
    </div>
  );
}
