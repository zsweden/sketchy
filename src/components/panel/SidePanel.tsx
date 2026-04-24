import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import NodePanel from './NodePanel';
import MultiNodePanel from './MultiNodePanel';
import EdgePanel from './EdgePanel';
import SettingsPanel from './SettingsPanel';
import ChatPanel from './ChatPanel';

export default function SidePanel() {
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const sidePanelOpen = useUIStore((s) => s.sidePanelOpen);
  const chatPanelMode = useUIStore((s) => s.chatPanelMode);
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);

  const getPanelWidthBounds = useCallback(() => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
    return {
      min: 360,
      max: Math.max(360, Math.min(720, Math.round(viewportWidth * 0.45))),
    };
  }, []);

  const clampWidth = useCallback((nextWidth: number) => {
    const { min, max } = getPanelWidthBounds();
    return Math.min(max, Math.max(min, nextWidth));
  }, [getPanelWidthBounds]);

  const [width, setWidth] = useState(() => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
    const defaultWidth = viewportWidth <= 900 ? 420 : viewportWidth <= 1200 ? 450 : 480;
    const max = Math.max(360, Math.min(720, Math.round(viewportWidth * 0.45)));
    return Math.min(max, Math.max(360, defaultWidth));
  });
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Vertical split: percentage of panel height for the top section
  const [topPercent, setTopPercent] = useState(40);
  const [vDragging, setVDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dragPointerId = useRef<number | null>(null);
  const vDragPointerId = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragPointerId.current = e.pointerId;
    startX.current = e.clientX;
    startWidth.current = width;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      if (dragPointerId.current !== ev.pointerId) return;
      const delta = startX.current - ev.clientX;
      setWidth(clampWidth(startWidth.current + delta));
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (dragPointerId.current !== ev.pointerId) return;
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

  const onVPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    vDragPointerId.current = e.pointerId;
    setVDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      if (vDragPointerId.current !== ev.pointerId) return;
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setTopPercent(Math.min(80, Math.max(15, pct)));
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (vDragPointerId.current !== ev.pointerId) return;
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

  const syncWidthToViewport = useCallback(() => {
    setWidth((current) => clampWidth(current));
  }, [clampWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('resize', syncWidthToViewport);
    return () => window.removeEventListener('resize', syncWidthToViewport);
  }, [syncWidthToViewport]);

  if (!sidePanelOpen) return null;

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const selectedEdges = edges.filter((e) => selectedEdgeIds.includes(e.id));
  const isSharedLayout = chatPanelMode === 'shared';
  const isMaxChatLayout = chatPanelMode === 'max';

  const topSectionStyle = isSharedLayout
    ? { height: `${topPercent}%` }
    : isMaxChatLayout
      ? { display: 'none' as const }
      : { flex: 1, height: 'auto' };

  return (
    <div className="side-panel" style={{ width, minWidth: width }} ref={panelRef}>
      <div
        className={`side-panel-resize ${dragging ? 'dragging' : ''}`}
        onPointerDown={onPointerDown}
      />
      <div className="side-panel-top" style={topSectionStyle}>
        {selectedNodes.length === 1 ? (
          <NodePanel node={selectedNodes[0]} />
        ) : selectedNodes.length > 1 ? (
          <MultiNodePanel selectedNodes={selectedNodes} />
        ) : selectedEdges.length === 1 ? (
          <EdgePanel edge={selectedEdges[0]} />
        ) : (
          <SettingsPanel />
        )}
      </div>
      {isSharedLayout && (
        <div
          className={`side-panel-v-resize ${vDragging ? 'dragging' : ''}`}
          onPointerDown={onVPointerDown}
        />
      )}
      <ChatPanel />
    </div>
  );
}
