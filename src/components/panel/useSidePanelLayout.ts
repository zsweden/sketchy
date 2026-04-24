import { useCallback, useEffect, useRef, useState } from 'react';

function getPanelWidthBounds() {
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  return {
    min: 360,
    max: Math.max(360, Math.min(720, Math.round(viewportWidth * 0.45))),
  };
}

function getDefaultWidth() {
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const defaultWidth = viewportWidth <= 900 ? 420 : viewportWidth <= 1200 ? 450 : 480;
  const { min, max } = getPanelWidthBounds();
  return Math.min(max, Math.max(min, defaultWidth));
}

export function useSidePanelLayout(chatPanelMode: 'min' | 'max' | 'shared') {
  const clampWidth = useCallback((nextWidth: number) => {
    const { min, max } = getPanelWidthBounds();
    return Math.min(max, Math.max(min, nextWidth));
  }, []);

  const [width, setWidth] = useState(getDefaultWidth);
  const [dragging, setDragging] = useState(false);
  const [topPercent, setTopPercent] = useState(40);
  const [vDragging, setVDragging] = useState(false);

  const startX = useRef(0);
  const startWidth = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragPointerId = useRef<number | null>(null);
  const vDragPointerId = useRef<number | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragPointerId.current = event.pointerId;
    startX.current = event.clientX;
    startWidth.current = width;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (dragPointerId.current !== moveEvent.pointerId) return;
      const delta = startX.current - moveEvent.clientX;
      setWidth(clampWidth(startWidth.current + delta));
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (dragPointerId.current !== upEvent.pointerId) return;
      dragPointerId.current = null;
      setDragging(false);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }, [clampWidth, width]);

  const onVPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    vDragPointerId.current = event.pointerId;
    setVDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (vDragPointerId.current !== moveEvent.pointerId) return;
      if (!panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      const nextPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setTopPercent(Math.min(80, Math.max(15, nextPercent)));
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (vDragPointerId.current !== upEvent.pointerId) return;
      vDragPointerId.current = null;
      setVDragging(false);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }, []);

  useEffect(() => {
    const syncWidthToViewport = () => {
      setWidth((current) => clampWidth(current));
    };

    if (typeof window === 'undefined') return undefined;
    window.addEventListener('resize', syncWidthToViewport);
    return () => window.removeEventListener('resize', syncWidthToViewport);
  }, [clampWidth]);

  const topSectionStyle = chatPanelMode === 'shared'
    ? { height: `${topPercent}%` }
    : chatPanelMode === 'max'
      ? { display: 'none' as const }
      : { flex: 1, height: 'auto' };

  return {
    panelRef,
    width,
    dragging,
    topSectionStyle,
    vDragging,
    onPointerDown,
    onVPointerDown,
  };
}
