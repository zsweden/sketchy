import { useCallback, useRef } from 'react';

const TOUCH_DOUBLE_TAP_MS = 320;
const TOUCH_LONG_PRESS_MS = 550;
const TOUCH_MOVE_TOLERANCE_PX = 14;

interface TouchGestureState {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  moved: boolean;
  longPressTriggered: boolean;
  nodeId?: string;
  onPane: boolean;
}

interface UseTouchGesturesParams {
  openContextMenu: (x: number, y: number, nodeId?: string) => void;
  addNode: (position: { x: number; y: number }) => string;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  clearCanvasSelection: () => void;
  closeContextMenu: () => void;
}

/**
 * Manages touch-specific gesture detection: long-press for context menu,
 * double-tap for node creation on pane.
 *
 * Returns pointer event handlers and the ignoreNextPaneClickRef
 * (set after long-press so the subsequent pane click is swallowed).
 */
export function useTouchGestures({
  openContextMenu,
  addNode,
  screenToFlowPosition,
  clearCanvasSelection,
  closeContextMenu,
}: UseTouchGesturesParams) {
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{
    timestamp: number;
    x: number;
    y: number;
    onPane: boolean;
  } | null>(null);
  const ignoreNextPaneClickRef = useRef(false);
  const suppressSelectionUntilRef = useRef(0);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onPointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;

    const target = event.target instanceof Element ? event.target : null;
    const nodeId = target?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
    const onPane = Boolean(
      target?.closest('.react-flow__pane') &&
      !target?.closest('.react-flow__node, .react-flow__edge'),
    );

    touchGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      longPressTriggered: false,
      nodeId,
      onPane,
    };

    clearLongPressTimer();

    if (!nodeId && !onPane) return;

    longPressTimerRef.current = window.setTimeout(() => {
      const gesture = touchGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved) return;
      gesture.longPressTriggered = true;
      ignoreNextPaneClickRef.current = true;
      openContextMenu(gesture.clientX, gesture.clientY, gesture.nodeId);
      lastTapRef.current = null;
    }, TOUCH_LONG_PRESS_MS);
  }, [clearLongPressTimer, openContextMenu]);

  const onPointerMoveCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current;
    if (event.pointerType !== 'touch' || !gesture || gesture.pointerId !== event.pointerId) return;

    gesture.clientX = event.clientX;
    gesture.clientY = event.clientY;

    if (
      !gesture.moved &&
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > TOUCH_MOVE_TOLERANCE_PX
    ) {
      gesture.moved = true;
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const onPointerUpCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current;
    if (event.pointerType !== 'touch' || !gesture || gesture.pointerId !== event.pointerId) return;

    clearLongPressTimer();
    touchGestureRef.current = null;

    if (gesture.moved || gesture.longPressTriggered || !gesture.onPane) return;

    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (
      lastTap &&
      lastTap.onPane &&
      now - lastTap.timestamp <= TOUCH_DOUBLE_TAP_MS &&
      Math.hypot(gesture.clientX - lastTap.x, gesture.clientY - lastTap.y) <= TOUCH_MOVE_TOLERANCE_PX
    ) {
      lastTapRef.current = null;
      suppressSelectionUntilRef.current = now + 250;
      clearCanvasSelection();
      closeContextMenu();
      addNode(screenToFlowPosition({ x: gesture.clientX, y: gesture.clientY }));
      return;
    }

    lastTapRef.current = {
      timestamp: now,
      x: gesture.clientX,
      y: gesture.clientY,
      onPane: true,
    };
  }, [addNode, clearCanvasSelection, clearLongPressTimer, closeContextMenu, screenToFlowPosition]);

  const onPointerCancelCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (touchGestureRef.current?.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    touchGestureRef.current = null;
  }, [clearLongPressTimer]);

  return {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    ignoreNextPaneClickRef,
    suppressSelectionUntilRef,
  };
}
