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
 *
 * Mobile-specific fixes (this used to feel slow and hard to grab on
 * touch):
 *  - `touch-action: none` + `user-select: none` (+ the -webkit prefixed
 *    versions Safari needs) are set directly on the handle node. Without
 *    them, a touch-and-drag on the handle fights the browser's own
 *    default gestures — page scroll and text selection — for the same
 *    touch input, which is what "moves slowly / can't catch it" actually
 *    was: two different things trying to interpret the same finger
 *    movement at once.
 *  - `setPointerCapture` on pointerdown keeps this same element
 *    receiving pointermove for that pointer even once the finger moves
 *    outside its original bounds mid-drag. Touch input on a fast swipe
 *    easily outruns a small handle's hit area; without capture, the
 *    browser can just stop delivering events to it partway through.
 *  - `pointercancel` is handled the same as pointerup — the OS can
 *    interrupt an in-progress touch (e.g. a notification pull-down), and
 *    without this the drag state gets stuck "active" forever after that.
 *  - Position updates are batched to one requestAnimationFrame per
 *    paint instead of one React state update per raw pointermove event.
 *    Touch input can sample well above the screen's own repaint rate,
 *    so committing a full state update (and re-render) synchronously
 *    for every single one was real, avoidable work sitting in the way
 *    of the next event — the actual cause of the sluggishness, not just
 *    a side effect of it.
 */
export function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragState = useRef(null);
  const rafIdRef = useRef(null);
  const pendingOffsetRef = useRef(null);

  const handleRef = useCallback((node) => {
    if (!node) return;

    node.style.touchAction = "none";
    node.style.userSelect = "none";
    node.style.webkitUserSelect = "none";
    node.style.webkitTouchCallout = "none";

    function flushPendingOffset() {
      rafIdRef.current = null;
      if (pendingOffsetRef.current) {
        setOffset(pendingOffsetRef.current);
      }
    }

    function onPointerDown(e) {
      // Don't start a drag from a button/select/input inside the handle.
      if (e.target.closest("button, select, input")) return;
      e.preventDefault();
      dragState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: offsetRef.current.x,
        startOffsetY: offsetRef.current.y,
      };
      try {
        node.setPointerCapture?.(e.pointerId);
      } catch {
        // Some browsers throw if the pointer's already gone by the time
        // this runs (e.g. a very fast tap) — not worth failing the drag
        // over, pointermove/pointerup still work without capture, just
        // slightly less robust against the finger leaving the handle.
      }
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragState.current || e.pointerId !== dragState.current.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      pendingOffsetRef.current = { x: dragState.current.startOffsetX + dx, y: dragState.current.startOffsetY + dy };
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(flushPendingOffset);
      }
    }

    function onPointerUp(e) {
      if (dragState.current && e.pointerId === dragState.current.pointerId) {
        try {
          node.releasePointerCapture?.(e.pointerId);
        } catch {
          // Already released/gone — nothing to clean up.
        }
      }
      dragState.current = null;
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingOffsetRef.current = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    node.addEventListener("pointerdown", onPointerDown);
  }, []);

  const style = { transform: `translate(${offset.x}px, ${offset.y}px)` };

  return { handleRef, style };
}
