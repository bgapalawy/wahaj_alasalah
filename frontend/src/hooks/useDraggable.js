import { useCallback, useRef, useState } from "react";

/**
 * Makes an element draggable by a handle. Returns a ref to put on the
 * handle (e.g. a panel's header) and a style object to spread onto the
 * element being moved. Position is a translate offset from wherever the
 * element started (its normal CSS position), not absolute page
 * coordinates — so it still respects whatever top/left the CSS gave it.
 *
 * Uses a ref (not just state) to track the offset during a drag — the
 * pointerdown handler is attached once via a callback ref, so anything it
 * closes over would otherwise go stale after the first render.
 */
export function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragState = useRef(null);

  const handleRef = useCallback((node) => {
    if (!node) return;

    function onPointerDown(e) {
      // Don't start a drag from a button/select/input inside the handle.
      if (e.target.closest("button, select, input")) return;
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: offsetRef.current.x,
        startOffsetY: offsetRef.current.y,
      };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setOffset({ x: dragState.current.startOffsetX + dx, y: dragState.current.startOffsetY + dy });
    }

    function onPointerUp() {
      dragState.current = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    }

    node.addEventListener("pointerdown", onPointerDown);
  }, []);

  const style = { transform: `translate(${offset.x}px, ${offset.y}px)` };

  return { handleRef, style };
}
