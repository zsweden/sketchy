import { useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { FIT_VIEW_OPTIONS } from '../../core/layout/fit-view-options';
import { getDerivedIndicators } from '../../core/graph/derived';
import { useCanvasHighlighting } from '../../hooks/useCanvasHighlighting';
import { useRFNodeEdgeBuilder } from '../../hooks/useRFNodeEdgeBuilder';
import { useViewportFocus } from '../../hooks/useViewportFocus';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers';

const nodeTypes = { entity: EntityNode };

export default function DiagramCanvas() {
  const { screenToFlowPosition } = useReactFlow();

  const showGrid = useDiagramStore((s) => s.diagram.settings.showGrid);
  const addNode = useDiagramStore((s) => s.addNode);
  const framework = useFramework();
  const openContextMenu = useUIStore((s) => s.openContextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const interactionMode = useUIStore((s) => s.interactionMode);
  const isPanMode = interactionMode === 'pan';

  // Highlighting logic (extracted hook)
  const { selectedLoop, highlightSets, degreesMap } = useCanvasHighlighting();

  // Build RF nodes/edges (extracted hook)
  const { rfNodes, rfEdges, defaultEdgeOptions, activeTheme } = useRFNodeEdgeBuilder(
    highlightSets, selectedLoop, degreesMap,
  );

  const [localNodes, setLocalNodes] = useState<Node[]>(rfNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(rfEdges);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Viewport focus & fit-view (extracted hook)
  const { tryFitViewOnDimensions } = useViewportFocus(canvasRef);

  // Sync store -> local when diagram DATA changes (preserving RF selection)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalNodes((prev) => {
      const selectionMap = new Map(prev.map((n) => [n.id, n.selected]));
      return rfNodes.map((n) => ({
        ...n,
        selected: selectionMap.get(n.id) ?? false,
      }));
    });
  }, [rfNodes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalEdges((prev) => {
      const selectionMap = new Map(prev.map((e) => [e.id, e.selected]));
      return rfEdges.map((e) => ({
        ...e,
        selected: selectionMap.get(e.id) ?? false,
      }));
    });
  }, [rfEdges]);

  // After bulk node repositioning (layout, load, framework switch), React Flow
  // may render edges before it has measured the new handle DOM positions. Force
  // a deferred edge re-render so RF picks up fresh measurements — mirrors what
  // "click background" does manually via clearCanvasSelection.
  const edgeRefreshTrigger = useUIStore((s) => s.edgeRefreshTrigger);
  useEffect(() => {
    if (edgeRefreshTrigger === 0) return;
    const handle = requestAnimationFrame(() => {
      setLocalEdges((prev) => prev.map((e) => ({ ...e })));
    });
    return () => cancelAnimationFrame(handle);
  }, [edgeRefreshTrigger]);

  // Sync programmatic selection from store -> RF (selectGraphObject)
  const selectionSyncTrigger = useUIStore((s) => s.selectionSyncTrigger);
  useEffect(() => {
    if (selectionSyncTrigger === 0) return;
    const { selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds } = useUIStore.getState();
    const nodeSet = new Set(nodeIds);
    const edgeSet = new Set(edgeIds);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: nodeSet.has(n.id) })));
    setLocalEdges((eds) => eds.map((e) => ({ ...e, selected: edgeSet.has(e.id) })));
  }, [selectionSyncTrigger]);

  // Touch gestures — owns ignoreNextPaneClickRef and suppressSelectionUntilRef
  const {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    ignoreNextPaneClickRef,
    suppressSelectionUntilRef,
  } = useTouchGestures({
    openContextMenu,
    addNode,
    screenToFlowPosition,
    clearCanvasSelection: () => handlers.clearCanvasSelection(),
    closeContextMenu,
  });

  // Canvas event handlers (extracted hook)
  const handlers = useCanvasHandlers({
    localNodes,
    setLocalNodes,
    setLocalEdges,
    screenToFlowPosition,
    ignoreNextPaneClickRef,
    suppressSelectionUntilRef,
    tryFitViewOnDimensions,
  });

  return (
    <div
      ref={canvasRef}
      data-testid="diagram-flow"
      onDoubleClickCapture={handlers.onDoubleClick}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancelCapture={onPointerCancelCapture}
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={handlers.onNodesChange}
        onEdgesChange={handlers.onEdgesChange}
        onNodeDragStart={handlers.onNodeDragStart}
        onNodeDragStop={handlers.onNodeDragStop}
        onConnect={handlers.onConnect}
        onSelectionChange={handlers.onSelectionChange}
        onPaneContextMenu={handlers.onPaneContextMenu}
        onNodeContextMenu={handlers.onNodeContextMenu}
        onEdgeContextMenu={handlers.onEdgeContextMenu}
        onPaneClick={handlers.onPaneClick}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        selectionOnDrag={!isPanMode}
        panOnDrag={isPanMode ? [0, 1, 2] : [1, 2]}
        zoomOnDoubleClick={false}
        nodesDraggable={!isPanMode}
        nodesConnectable={!isPanMode}
        elementsSelectable={!isPanMode}
        snapToGrid={false}
        snapGrid={[20, 20]}
        proOptions={{ hideAttribution: true }}
        className={isPanMode ? 'pan-mode' : ''}
      >
        {showGrid && (
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        )}
        <Controls fitViewOptions={FIT_VIEW_OPTIONS} showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as { tags?: string[]; color?: string };
            if (data?.color) return data.color;
            const tagColor = data?.tags
              ?.map((t) => framework.nodeTags.find((nt) => nt.id === t))
              .find(Boolean)?.color;
            if (tagColor) return tagColor;
            const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);
            if (derived.length > 0) return derived[0].color;
            return activeTheme.js.minimapFallback;
          }}
        />
      </ReactFlow>
    </div>
  );
}
