import { useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import AnnotationRect from './annotations/AnnotationRect';
import AnnotationEllipse from './annotations/AnnotationEllipse';
import AnnotationLine from './annotations/AnnotationLine';
import AnnotationText from './annotations/AnnotationText';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { FIT_VIEW_OPTIONS } from '../../core/layout/fit-view-options';
import { getDerivedIndicators } from '../../core/graph/derived';
import { useCanvasHighlighting } from '../../hooks/useCanvasHighlighting';
import { useRFNodeEdgeBuilder } from '../../hooks/useRFNodeEdgeBuilder';
import { useViewportFocus } from '../../hooks/useViewportFocus';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers';
import { useAnnotationPlacement } from '../../hooks/useAnnotationPlacement';
import { useReactFlowLocalState } from './useReactFlowLocalState';
import { useDiagramCanvasEvents } from './useDiagramCanvasEvents';

const nodeTypes = {
  entity: EntityNode,
  'annotation-rect': AnnotationRect,
  'annotation-ellipse': AnnotationEllipse,
  'annotation-line': AnnotationLine,
  'annotation-text': AnnotationText,
};

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

  const canvasRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const {
    localNodes,
    setLocalNodes,
    localEdges,
    setLocalEdges,
    latestRFNodeIdsRef,
  } = useReactFlowLocalState({ rfNodes, rfEdges });

  // Viewport focus & fit-view (extracted hook)
  const { tryFitViewOnDimensions } = useViewportFocus(canvasRef);
  useDiagramCanvasEvents({
    latestRFNodeIdsRef,
    setLocalNodes,
    setLocalEdges,
    updateNodeInternals,
  });

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

  const placement = useAnnotationPlacement({ ignoreNextPaneClickRef });
  const isPlacing = placement.pendingTool != null;

  const onPointerDownAll = (event: React.PointerEvent<HTMLDivElement>) => {
    placement.onPointerDown(event);
    onPointerDownCapture(event);
  };
  const onPointerMoveAll = (event: React.PointerEvent<HTMLDivElement>) => {
    placement.onPointerMove(event);
    onPointerMoveCapture(event);
  };
  const onPointerUpAll = (event: React.PointerEvent<HTMLDivElement>) => {
    placement.onPointerUp(event);
    onPointerUpCapture(event);
  };
  const onPointerCancelAll = (event: React.PointerEvent<HTMLDivElement>) => {
    placement.onPointerCancel(event);
    onPointerCancelCapture(event);
  };
  const onMousePlacementCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacing) return;
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div
      ref={canvasRef}
      data-testid="diagram-flow"
      onDoubleClickCapture={handlers.onDoubleClick}
      onPointerDownCapture={onPointerDownAll}
      onPointerMoveCapture={onPointerMoveAll}
      onPointerUpCapture={onPointerUpAll}
      onPointerCancelCapture={onPointerCancelAll}
      onMouseDownCapture={onMousePlacementCapture}
      onMouseMoveCapture={onMousePlacementCapture}
      onMouseUpCapture={onMousePlacementCapture}
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
        selectionOnDrag={!isPanMode && !isPlacing}
        panOnDrag={isPlacing ? false : isPanMode ? [0, 1, 2] : [1, 2]}
        zoomOnDoubleClick={false}
        nodesDraggable={!isPanMode && !isPlacing}
        nodesConnectable={!isPanMode && !isPlacing}
        elementsSelectable={!isPanMode && !isPlacing}
        snapToGrid={false}
        snapGrid={[20, 20]}
        proOptions={{ hideAttribution: true }}
        className={`${isPanMode ? 'pan-mode' : ''} ${isPlacing ? 'placement-mode' : ''}`.trim()}
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
