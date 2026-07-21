import { useState } from "react";

/**
 * Simple controlled tab strip. `tabs` is [{ id, label, content }]. Keeps
 * each panel mounted-on-demand (only the active one renders) so charts
 * don't all initialize at once behind the scenes.
 */
export function Tabs({ tabs, defaultTabId }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div className="dashboard-tabs-nav" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            className={tab.id === activeId ? "active" : ""}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="dashboard-tabs-panel" role="tabpanel">
        {active?.content}
      </div>
    </div>
  );
}
