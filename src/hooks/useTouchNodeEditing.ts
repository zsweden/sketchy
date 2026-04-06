import { useCallback, useRef } from 'react';

const TOUCH_DOUBLE_TAP_MS = 320;
const TOUCH_MOVE_TOLERANCE_PX = 14;

interface UseTouchNodeEditingOptions {
  editing: boolean;
  onStartEditing: () => void;
  onTouchStart?: () => void;
}

/**
 * Handles touch-specific pointer gestures on entity nodes:
 * - Reveals handles on touch
 * - Detects double-tap to enter edit mode
 * - Tracks pointer movement to distinguish taps from drags
 *
 * Returns pointer event handlers to attach to the node element.
 */
export function useTouchNodeEditing({ editing, onStartEditing, onTouchStart }: UseTouchNodeEditingOptions) {
  const touchPointerId = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTouchTap = useRef<{ timestamp: number; x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      onTouchStart?.();
    }
    if (e.pointerType !== 'touch' || editing) return;
    touchPointerId.current = e.pointerId;
    touchStart.current = { x: e.clientX, y: e.clientY, moved: false };
  }, [editing, onTouchStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' || touchPointerId.current !== e.pointerId || !touchStart.current) return;
    const movedX = e.clientX - touchStart.current.x;
    const movedY = e.clientY - touchStart.current.y;
    if (Math.hypot(movedX, movedY) > TOUCH_MOVE_TOLERANCE_PX) {
      touchStart.current.moved = true;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' || touchPointerId.current !== e.pointerId) return;
    touchPointerId.current = null;

    const touch = touchStart.current;
    touchStart.current = null;
    if (!touch || touch.moved || editing) return;

    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.react-flow__handle, textarea, button')) {
      lastTouchTap.current = null;
      return;
    }

    const now = Date.now();
    const lastTap = lastTouchTap.current;
    if (
      lastTap &&
      now - lastTap.timestamp <= TOUCH_DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= TOUCH_MOVE_TOLERANCE_PX
    ) {
      lastTouchTap.current = null;
      onStartEditing();
      return;
    }

    lastTouchTap.current = { timestamp: now, x: e.clientX, y: e.clientY };
  }, [editing, onStartEditing]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (touchPointerId.current !== e.pointerId) return;
    touchPointerId.current = null;
    touchStart.current = null;
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
