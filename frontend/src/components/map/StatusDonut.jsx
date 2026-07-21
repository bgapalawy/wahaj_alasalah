/**
 * Pure-CSS donut chart via conic-gradient — deliberately not Chart.js.
 * This renders inside the map's always-loaded control (not a lazy dashboard
 * tab), so pulling in a charting library here would add real weight to
 * every page load just for one small chart.
 */
export function StatusDonut({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div className="status-donut status-donut-empty">No data</div>;
  }

  let cumulative = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (cumulative / total) * 360;
      cumulative += s.value;
      const end = (cumulative / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    });

  return (
    <div className="status-donut" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
      <div className="status-donut-hole">
        <strong>{total}</strong>
        <span>villas</span>
      </div>
    </div>
  );
}
