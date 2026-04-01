import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Edge,
  type OnSelectionChangeParams,
  type Node,
  applyNodeChanges,
  applyEdgeChanges,
  type Rect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { FIT_VIEW_OPTIONS } from '../../core/layout/fit-view-options';
import { findCausalLoops, getDerivedIndicators } from '../../core/graph/derived';
import { GRID_SIZE, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../../constants/layout';
import { useCanvasHighlighting } from '../../hooks/useCanvasHighlighting';
import { useRFNodeEdgeBuilder } from '../../hooks/useRFNodeEdgeBuilder';
import type { GraphObjectTarget } from '../../store/ui-store';

const nodeTypes = { entity: EntityNode };

function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
  );
}

function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
  );
}

export default function DiagramCanvas() {
  const TOUCH_DOUBLE_TAP_MS = 320;
  const TOUCH_LONG_PRESS_MS = 550;
  const TOUCH_MOVE_TOLERANCE_PX = 14;
  const { screenToFlowPosition, fitView, getViewport, getInternalNode, setCenter, viewportInitialized } = useReactFlow();

  const diagram = useDiagramStore((s) => s.diagram);
  const addNode = useDiagramStore((s) => s.addNode);
  const addEdgeStore = useDiagramStore((s) => s.addEdge);
  const dragNodes = useDiagramStore((s) => s.dragNodes);
  const commitDraggedNodes = useDiagramStore((s) => s.commitDraggedNodes);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const deleteEdges = useDiagramStore((s) => s.deleteEdges);
  const framework = useDiagramStore((s) => s.framework);
  const snapToGrid = useDiagramStore((s) => s.diagram.settings.snapToGrid);
  const updateSettings = useDiagramStore((s) => s.updateSettings);

  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const setSelectedEdges = useUIStore((s) => s.setSelectedEdges);
  const openContextMenu = useUIStore((s) => s.openContextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const addToast = useUIStore((s) => s.addToast);
  const interactionMode = useUIStore((s) => s.interactionMode);

  const isPanMode = interactionMode === 'pan';

  // Highlighting logic (extracted hook)
  const { selectedLoop, highlightSets, degreesMap } = useCanvasHighlighting();

  // Build RF nodes/edges (extracted hook)
  const { rfNodes, rfEdges, defaultEdgeOptions, activeTheme } = useRFNodeEdgeBuilder(
    highlightSets, selectedLoop, degreesMap,
  );

  // Local state for React Flow selection/interaction
  const [localNodes, setLocalNodes] = useState<Node[]>(rfNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(rfEdges);
  const canvasRef = useRef<HTMLDivElement>(null);
  const touchGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
    moved: boolean;
    longPressTriggered: boolean;
    nodeId?: string;
    onPane: boolean;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{
    timestamp: number;
    x: number;
    y: number;
    onPane: boolean;
  } | null>(null);
  const ignoreNextPaneClickRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

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

  const viewportFocusTrigger = useUIStore((s) => s.viewportFocusTrigger);
  useEffect(() => {
    if (viewportFocusTrigger === 0 || !viewportInitialized) return;

    const target = useUIStore.getState().viewportFocusTarget;
    if (!target) return;

    const currentDiagram = useDiagramStore.getState().diagram;
    const getNodeRect = (nodeId: string): Rect | null => {
      const node = currentDiagram.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return null;

      const internalNode = getInternalNode(nodeId);
      const width = internalNode?.measured?.width ?? internalNode?.width ?? DEFAULT_NODE_WIDTH;
      const height = internalNode?.measured?.height ?? internalNode?.height ?? DEFAULT_NODE_HEIGHT;

      return {
        x: node.position.x,
        y: node.position.y,
        width,
        height,
      };
    };

    const getObjectRect = (focusTarget: GraphObjectTarget): Rect | null => {
      if (focusTarget.kind === 'node') {
        return getNodeRect(focusTarget.id);
      }

      if (focusTarget.kind === 'edge') {
        const edge = currentDiagram.edges.find((candidate) => candidate.id === focusTarget.id);
        if (!edge) return null;

        const rects = [getNodeRect(edge.source), getNodeRect(edge.target)]
          .filter((rect): rect is Rect => rect != null);
        return unionRects(rects);
      }

      const loop = findCausalLoops(currentDiagram.edges)
        .find((candidate) => candidate.id === focusTarget.id);
      if (!loop) return null;

      const rects = loop.nodeIds
        .map((nodeId) => getNodeRect(nodeId))
        .filter((rect): rect is Rect => rect != null);
      return unionRects(rects);
    };

    const targetRect = getObjectRect(target);
    if (!targetRect) return;

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const viewportWidth = canvasBounds?.width || canvasRef.current?.clientWidth || window.innerWidth;
    const viewportHeight = canvasBounds?.height || canvasRef.current?.clientHeight || window.innerHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) return;

    const viewport = getViewport();
    const visibleRect: Rect = {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      width: viewportWidth / viewport.zoom,
      height: viewportHeight / viewport.zoom,
    };

    const isVisible = target.kind === 'loop'
      ? rectContains(visibleRect, targetRect)
      : rectsIntersect(targetRect, visibleRect);
    if (isVisible) return;

    const centerX = targetRect.x + targetRect.width / 2;
    const centerY = targetRect.y + targetRect.height / 2;
    void setCenter(centerX, centerY, { zoom: viewport.zoom });
  }, [getInternalNode, getViewport, setCenter, viewportFocusTrigger, viewportInitialized]);

  // Fit view when requested
  const fitViewTrigger = useUIStore((s) => s.fitViewTrigger);
  const pendingFitView = useRef(false);
  useEffect(() => {
    if (fitViewTrigger === 0) return;
    pendingFitView.current = true;
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        if (pendingFitView.current) {
          pendingFitView.current = false;
          fitView(FIT_VIEW_OPTIONS);
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [fitViewTrigger, fitView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (snapToGrid) {
        for (const c of changes) {
          if (c.type === 'position' && 'position' in c && c.position) {
            const node = localNodes.find((n) => n.id === c.id);
            const w = node?.measured?.width ?? DEFAULT_NODE_WIDTH;
            const h = node?.measured?.height ?? DEFAULT_NODE_HEIGHT;
            const cx = c.position.x + w / 2;
            const cy = c.position.y + h / 2;
            c.position = {
              x: Math.round(cx / GRID_SIZE) * GRID_SIZE - w / 2,
              y: Math.round(cy / GRID_SIZE) * GRID_SIZE - h / 2,
            };
          }
        }
      }

      setLocalNodes((nds) => applyNodeChanges(changes, nds));

      const posChanges = changes.filter(
        (c): c is NodeChange & { type: 'position'; position: { x: number; y: number } } =>
          c.type === 'position' && 'position' in c && c.position != null,
      );
      if (posChanges.length > 0) {
        dragNodes(posChanges.map((c) => ({ id: c.id, position: c.position })));
      }

      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        deleteNodes(removeChanges.map((c) => c.id));
      }

      if (pendingFitView.current) {
        const hasDimensions = changes.some((c) => c.type === 'dimensions');
        if (hasDimensions) {
          pendingFitView.current = false;
          requestAnimationFrame(() => fitView(FIT_VIEW_OPTIONS));
        }
      }
    },
    [dragNodes, deleteNodes, fitView, snapToGrid, localNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setLocalEdges((eds) => applyEdgeChanges(changes, eds));
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        deleteEdges(removeChanges.map((c) => c.id));
      }
    },
    [deleteEdges],
  );

  const onNodeDragStop = useCallback(() => {
    commitDraggedNodes();
  }, [commitDraggedNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const result = addEdgeStore(connection.source, connection.target, {
        sourceHandleId: connection.sourceHandle,
        targetHandleId: connection.targetHandle,
      });
      if (result.reason === 'dynamic-edge-move') {
        addToast(
          'Edge anchors can\'t be changed while routing is set to "Optimize Continuously".',
          'warning',
          { label: 'Switch to Fixed', onClick: () => updateSettings({ edgeRoutingMode: 'fixed' }) },
        );
      } else if (!result.success && result.reason) {
        addToast(result.reason, 'warning');
      } else if (result.success && result.reason) {
        addToast(result.reason, 'info');
      }
    },
    [addEdgeStore, addToast, updateSettings],
  );

  const onPaneClickHandler = useCallback(() => {
    if (ignoreNextPaneClickRef.current) {
      ignoreNextPaneClickRef.current = false;
      return;
    }
    closeContextMenu();
  }, [closeContextMenu]);

  const onCanvasDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.react-flow__node, .react-flow__edge')) return;
      if (!event.target.closest('.react-flow__pane')) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(position);
    },
    [screenToFlowPosition, addNode],
  );

  const onSelectionChange = useCallback(
    ({ nodes, edges }: OnSelectionChangeParams) => {
      setSelectedNodes(nodes.map((n) => n.id));
      setSelectedEdges(edges.map((e) => e.id));
    },
    [setSelectedNodes, setSelectedEdges],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      if (event.target instanceof Element
        && event.target.closest('.react-flow__node, .react-flow__edge')) {
        return;
      }
      openContextMenu(event.clientX, event.clientY);
    },
    [openContextMenu],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      openContextMenu(event.clientX, event.clientY, node.id);
    },
    [openContextMenu],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      openContextMenu(event.clientX, event.clientY, undefined, edge.id);
    },
    [openContextMenu],
  );

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
      addNode(screenToFlowPosition({ x: gesture.clientX, y: gesture.clientY }));
      return;
    }

    lastTapRef.current = {
      timestamp: now,
      x: gesture.clientX,
      y: gesture.clientY,
      onPane: true,
    };
  }, [addNode, clearLongPressTimer, screenToFlowPosition]);

  const onPointerCancelCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (touchGestureRef.current?.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    touchGestureRef.current = null;
  }, [clearLongPressTimer]);

  return (
    <div
      ref={canvasRef}
      data-testid="diagram-flow"
      onDoubleClickCapture={onCanvasDoubleClick}
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClickHandler}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        selectionOnDrag={!isPanMode}
        panOnDrag={isPanMode ? [0, 1, 2] : [1, 2]}
        nodesDraggable={!isPanMode}
        nodesConnectable={!isPanMode}
        elementsSelectable={!isPanMode}
        snapToGrid={false}
        snapGrid={[20, 20]}
        proOptions={{ hideAttribution: true }}
        className={isPanMode ? 'pan-mode' : ''}
      >
        {diagram.settings.showGrid && (
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
