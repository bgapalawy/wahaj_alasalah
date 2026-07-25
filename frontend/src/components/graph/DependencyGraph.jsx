import { useEffect, useMemo, useRef } from "react";
import { DataSet, Network } from "vis-network/standalone";
import {
  CATEGORY_COLOR_PALETTE,
  ACTIVITY_STATUS_COLOR_MAP,
  DEFAULT_ACTIVITY_COLOR,
  PREDECESSOR_EDGE_COLOR,
  BLOCKING_NODE_ICON_COLOR,
  CURRENT_NODE_ICON_COLOR,
  OUT_OF_SEQUENCE_BORDER_COLOR,
  getCategory,
  findRootCauseBlockingActivities,
} from "../../utils/graphUtils.js";

const NETWORK_OPTIONS = {
  locale: "en",
  layout: {
    hierarchical: {
      enabled: true,
      direction: "LR",
      sortMethod: "directed",
      levelSeparation: 250,
      nodeSpacing: 150,
      treeSpacing: 200,
      blockShifting: true,
      edgeMinimization: true,
      parentCentralization: true,
    },
  },
  physics: { enabled: false },
  edges: {
    smooth: { enabled: true, type: "cubicBezier", forceDirection: "horizontal", roundness: 0.4 },
    arrows: { to: { enabled: true, scaleFactor: 0.7 } },
    color: { color: PREDECESSOR_EDGE_COLOR, highlight: "#000000", hover: "#2B7CE9" },
    width: 1.5,
  },
  interaction: {
    hover: true,
    tooltipDelay: 250,
    navigationButtons: true,
    keyboard: { enabled: true, bindToWindow: false },
    zoomView: true,
    dragView: true,
    selectConnectedEdges: false,
  },
};

/**
 * Replaces createActivityGraph() from rightclick.js. Renders the predecessor
 * dependency graph for a list of activities, highlighting the current
 * activity and any root-cause blockers with a star icon.
 */
export function DependencyGraph({ activities, currentActivityId = null }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const blockingActivities = useMemo(() => {
    if (!currentActivityId || activities.length === 0) return [];
    return findRootCauseBlockingActivities(currentActivityId, activities);
  }, [activities, currentActivityId]);

  const categoriesUsed = useMemo(() => {
    const set = new Set();
    activities.forEach((a) => set.add(getCategory(a.TableItemID)));
    return set;
  }, [activities]);

  // Same rule as outOfSequenceUtils.js (the project-wide report), scoped
  // to just this villa's already-live-merged activities array.
  const outOfSequenceIds = useMemo(() => {
    const byId = new Map(activities.map((a) => [a.id, a]));
    const flagged = new Set();
    activities.forEach((activity) => {
      if (activity.status !== "Completed") return;
      const hasIncompletePredecessor = (activity.predecessors ?? []).some((predId) => {
        const pred = byId.get(predId);
        return pred && pred.status !== "Completed";
      });
      if (hasIncompletePredecessor) flagged.add(activity.id);
    });
    return flagged;
  }, [activities]);

  useEffect(() => {
    if (!containerRef.current || activities.length === 0) return;

    const blockingIds = new Set(blockingActivities.map((b) => b.id));
    const nodes = new DataSet();
    const edges = new DataSet();

    activities.forEach((activity) => {
      const category = getCategory(activity.TableItemID);
      const nodeStatusColor = ACTIVITY_STATUS_COLOR_MAP[activity.status] ?? DEFAULT_ACTIVITY_COLOR;
      const nodeCategoryBorderColor = CATEGORY_COLOR_PALETTE[category] ?? CATEGORY_COLOR_PALETTE.Default;
      const isBlocking = blockingIds.has(activity.id);
      const isCurrent = activity.id === currentActivityId;
      const isOutOfSequence = outOfSequenceIds.has(activity.id);

      const nodeOptions = {
        id: activity.id,
        label: isOutOfSequence ? `⚠ ${activity.nameArabic}` : activity.nameArabic,
        shape: "box",
        font: { size: 12, face: "Tahoma", color: "#333333" },
        margin: { top: 10, right: 10, bottom: 10, left: 10 },
        widthConstraint: { minimum: 120, maximum: 250 },
        borderWidth: isOutOfSequence ? 4 : 2,
        borderWidthSelected: 4,
        color: {
          background: nodeStatusColor,
          border: isOutOfSequence ? OUT_OF_SEQUENCE_BORDER_COLOR : nodeCategoryBorderColor,
        },
        title: isOutOfSequence
          ? `Status: "${activity.status}" — OUT OF SEQUENCE (completed before its predecessor)`
          : `Status: "${activity.status}"`,
      };

      if (isCurrent) {
        nodeOptions.shape = "icon";
        nodeOptions.icon = {
          face: "FontAwesome",
          weight: "900",
          code: "\uf005", // fa-star
          size: 40,
          color: CURRENT_NODE_ICON_COLOR,
        };
        nodeOptions.label = `${activity.nameArabic}\nCurrent activity${isOutOfSequence ? "\n⚠ OUT OF SEQUENCE" : ""}`;
      } else if (isBlocking) {
        nodeOptions.shape = "icon";
        nodeOptions.icon = {
          face: "FontAwesome",
          weight: "900",
          code: "\uf005",
          size: 40,
          color: BLOCKING_NODE_ICON_COLOR,
        };
        nodeOptions.label = `${activity.nameArabic}\nRoot cause blocker${isOutOfSequence ? "\n⚠ OUT OF SEQUENCE" : ""}`;
      }

      nodes.add(nodeOptions);
    });

    activities.forEach((activity) => {
      (activity.predecessors ?? []).forEach((predecessorId) => {
        if (nodes.get(predecessorId)) {
          edges.add({
            from: predecessorId,
            to: activity.id,
            arrows: { to: { enabled: true, scaleFactor: 0.7, type: "arrow" } },
            color: { color: PREDECESSOR_EDGE_COLOR, highlight: "#000000", hover: "#2B7CE9" },
            smooth: { type: "cubicBezier", forceDirection: "horizontal", roundness: 0.4 },
          });
        }
      });
    });

    const network = new Network(containerRef.current, { nodes, edges }, NETWORK_OPTIONS);
    networkRef.current = network;

    network.once("stabilizationIterationsDone", () => {
      network.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
    });

    if (currentActivityId && nodes.get(currentActivityId)) {
      network.once("afterDrawing", () => {
        setTimeout(() => {
          network.focus(currentActivityId, {
            scale: 0.5,
            animation: { duration: 800, easingFunction: "easeOutQuad" },
          });
          network.selectNodes([currentActivityId], false);
        }, 100);
      });
    }

    return () => network.destroy();
  }, [activities, blockingActivities, currentActivityId]);

  return (
    <div className="dependency-graph">
      <div ref={containerRef} className="dependency-graph-canvas" />
      <GraphLegend
        categoriesUsed={categoriesUsed}
        showCurrent={currentActivityId !== null}
        showBlocking={blockingActivities.length > 0}
        showOutOfSequence={outOfSequenceIds.size > 0}
      />
      {currentActivityId && (
        <ReadinessNote
          activities={activities}
          currentActivityId={currentActivityId}
          blockingActivities={blockingActivities}
        />
      )}
    </div>
  );
}

function GraphLegend({ categoriesUsed, showCurrent, showBlocking, showOutOfSequence }) {
  return (
    <div className="graph-legend">
      <strong>Legend</strong>
      <hr />
      <div>
        <strong>Status (fill):</strong>
        {Object.entries(ACTIVITY_STATUS_COLOR_MAP).map(([status, color]) => (
          <div key={status} className="legend-row">
            <span className="legend-swatch" style={{ backgroundColor: color }} />
            {status}
          </div>
        ))}
      </div>
      <hr />
      <div>
        <strong>Category (border):</strong>
        {[...categoriesUsed].map((category) => (
          <div key={category} className="legend-row">
            <span
              className="legend-swatch legend-swatch-outline"
              style={{ borderColor: CATEGORY_COLOR_PALETTE[category] ?? CATEGORY_COLOR_PALETTE.Default }}
            />
            {category}
          </div>
        ))}
      </div>
      {(showCurrent || showBlocking || showOutOfSequence) && (
        <>
          <hr />
          <strong>Indicators:</strong>
          {showCurrent && (
            <div className="legend-row">
              <span className="legend-star" style={{ color: CURRENT_NODE_ICON_COLOR }}>★</span>
              Current activity
            </div>
          )}
          {showBlocking && (
            <div className="legend-row">
              <span className="legend-star" style={{ color: BLOCKING_NODE_ICON_COLOR }}>★</span>
              Root cause blocker
            </div>
          )}
          {showOutOfSequence && (
            <div className="legend-row">
              <span className="legend-swatch legend-swatch-outline" style={{ borderColor: OUT_OF_SEQUENCE_BORDER_COLOR, borderWidth: "3px" }} />
              ⚠ Out of sequence (completed before its predecessor)
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Replaces the readiness-check text block from rightclick.js
 * ("is NOT ready to begin due to blocking activities...").
 */
function ReadinessNote({ activities, currentActivityId, blockingActivities }) {
  const current = activities.find((a) => a.id === currentActivityId);
  if (!current) return null;

  if (blockingActivities.length === 0) {
    return <p className="readiness-note readiness-completed">"{current.name}" is completed.</p>;
  }

  if (blockingActivities.length === 1 && blockingActivities[0].id === currentActivityId) {
    return <p className="readiness-note readiness-ready">"{current.name}" is ready to begin.</p>;
  }

  return (
    <div className="readiness-note readiness-blocked">
      <p>"{current.name}" is NOT ready to begin due to blocking activities:</p>
      <ol>
        {blockingActivities.map((b) => (
          <li key={b.id}>
            {b.nameArabic} — Status: {b.status}
          </li>
        ))}
      </ol>
    </div>
  );
}
