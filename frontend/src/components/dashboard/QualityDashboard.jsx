import { useState } from "react";
import { NcrReport } from "./NcrReport.jsx";
import { OutOfSequenceReport } from "./OutOfSequenceReport.jsx";
import { VillaStatusReport } from "./VillaStatusReport.jsx";
import { LastItemReport } from "./LastItemReport.jsx";
import { SchedulingReport } from "./SchedulingReport.jsx";
import { HistoryReport } from "./HistoryReport.jsx";

const TABS = [
  { key: "ncrs", label: "NCRs" },
  { key: "outOfSequence", label: "Out of Sequence" },
  { key: "villaStatus", label: "Villa Status" },
  { key: "lastItem", label: "Last Item" },
  { key: "scheduling", label: "Scheduling" },
  { key: "history", label: "History" },
];

/**
 * Groups the quality-related reports (NCRs, Out of Sequence, Villa
 * Status, Last Item, Scheduling, History) under one modal with tabs,
 * instead of separate header buttons each opening its own modal. Each
 * tab renders its report in `embedded` mode (content only, no modal
 * chrome of its own) inside this shared shell — the reports themselves
 * are otherwise unchanged and still work standalone if opened directly.
 */
export function QualityDashboard({ onClose }) {
  const [activeTab, setActiveTab] = useState("ncrs");

  return (
    <div className="graph-modal-backdrop" onClick={onClose}>
      <div className="graph-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(1100px, 92vw)" }}>
        <div className="graph-modal-header">
          <h3>Quality</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="status-tabs" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "ncrs" && <NcrReport embedded />}
        {activeTab === "outOfSequence" && <OutOfSequenceReport embedded />}
        {activeTab === "villaStatus" && <VillaStatusReport embedded />}
        {activeTab === "lastItem" && <LastItemReport embedded />}
        {activeTab === "scheduling" && <SchedulingReport embedded />}
        {activeTab === "history" && <HistoryReport embedded />}
      </div>
    </div>
  );
}
