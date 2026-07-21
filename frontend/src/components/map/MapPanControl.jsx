import { useMap } from "react-leaflet";

const PAN_DISTANCE_PX = 150;

/**
 * Arrow-button pan control, same idea as vis-network's built-in
 * navigation buttons on the dependency graph — up/down/left/right arrows
 * that nudge the view instead of requiring a click-drag.
 */
export function MapPanControl() {
  const map = useMap();

  function pan(dx, dy) {
    map.panBy([dx, dy], { animate: true });
  }

  return (
    <div className="map-pan-control">
      <button type="button" className="map-pan-btn map-pan-up" onClick={() => pan(0, -PAN_DISTANCE_PX)} aria-label="Pan up">
        ↑
      </button>
      <div className="map-pan-row">
        <button type="button" className="map-pan-btn" onClick={() => pan(-PAN_DISTANCE_PX, 0)} aria-label="Pan left">
          ←
        </button>
        <button type="button" className="map-pan-btn" onClick={() => pan(0, PAN_DISTANCE_PX)} aria-label="Pan down">
          ↓
        </button>
        <button type="button" className="map-pan-btn" onClick={() => pan(PAN_DISTANCE_PX, 0)} aria-label="Pan right">
          →
        </button>
      </div>
    </div>
  );
}
