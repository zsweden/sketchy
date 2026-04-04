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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import EntityNode from './EntityNode';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { FIT_VIEW_OPTIONS } from '../../core/layout/fit-view-options';
import { getDerivedIndicators } from '../../core/graph/derived';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, snapNodePositionToGrid } from '../../constants/layout';
import { useCanvasHighlighting } from '../../hooks/useCanvasHighlighting';
import { useRFNodeEdgeBuilder } from '../../hooks/useRFNodeEdgeBuilder';
import { useViewportFocus } from '../../hooks/useViewportFocus';
import { useTouchGestures } from '../../hooks/useTouchGestures';

const nodeTypes = { entity: EntityNode };

export default function DiagramCanvas() {
  const { screenToFlowPosition } = useReactFlow();

  const showGrid = useDiagramStore((s) => s.diagram.settings.showGrid);
  const addNode = useDiagramStore((s) => s.addNode);
  const addEdgeStore = useDiagramStore((s) => s.addEdge);
  const batchApply = useDiagramStore((s) => s.batchApply);
  const dragNodes = useDiagramStore((s) => s.dragNodes);
  const commitDraggedNodes = useDiagramStore((s) => s.commitDraggedNodes);
  const framework = useFramework();
  const snapToGrid = useDiagramStore((s) => s.diagram.settings.snapToGrid);
  const updateSettings = useDiagramStore((s) => s.updateSettings);

  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const setSelectedEdges = useUIStore((s) => s.setSelectedEdges);
  const setSelectedLoop = useUIStore((s) => s.setSelectedLoop);
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
  const pendingRemovedNodeIdsRef = useRef<Set<string>>(new Set());
  const pendingRemovedEdgeIdsRef = useRef<Set<string>>(new Set());
  const removalFlushScheduledRef = useRef(false);

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

  const flushPendingRemovals = useCallback(() => {
    removalFlushScheduledRef.current = false;

    const nodeIds = [...pendingRemovedNodeIdsRef.current];
    const edgeIds = [...pendingRemovedEdgeIdsRef.current];
    pendingRemovedNodeIdsRef.current.clear();
    pendingRemovedEdgeIdsRef.current.clear();

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return;
    }

    batchApply({
      ...(nodeIds.length > 0 ? { removeNodeIds: nodeIds } : {}),
      ...(edgeIds.length > 0 ? { removeEdgeIds: edgeIds } : {}),
    });
  }, [batchApply]);

  const scheduleRemovalFlush = useCallback(() => {
    if (removalFlushScheduledRef.current) return;
    removalFlushScheduledRef.current = true;
    queueMicrotask(flushPendingRemovals);
  }, [flushPendingRemovals]);

  const clearCanvasSelection = useCallback(() => {
    setSelectedLoop(null);
    setSelectedNodes([]);
    setSelectedEdges([]);
    setLocalNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setLocalEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
  }, [setSelectedEdges, setSelectedLoop, setSelectedNodes]);

  // Touch gestures (extracted hook)
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
    clearCanvasSelection,
    closeContextMenu,
  });

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (snapToGrid) {
        for (const c of changes) {
          if (c.type === 'position' && 'position' in c && c.position) {
            const node = localNodes.find((n) => n.id === c.id);
            const w = node?.measured?.width ?? DEFAULT_NODE_WIDTH;
            const h = node?.measured?.height ?? DEFAULT_NODE_HEIGHT;
            c.position = snapNodePositionToGrid(c.position.x, c.position.y, w, h);
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
        for (const change of removeChanges) {
          pendingRemovedNodeIdsRef.current.add(change.id);
        }
        scheduleRemovalFlush();
      }

      if (changes.some((c) => c.type === 'dimensions')) {
        tryFitViewOnDimensions();
      }
    },
    [dragNodes, snapToGrid, localNodes, scheduleRemovalFlush, tryFitViewOnDimensions],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setLocalEdges((eds) => applyEdgeChanges(changes, eds));
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        for (const change of removeChanges) {
          pendingRemovedEdgeIdsRef.current.add(change.id);
        }
        scheduleRemovalFlush();
      }
    },
    [scheduleRemovalFlush],
  );

  const onNodeDragStart = useCallback(() => {}, []);

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
        toast.warning(
          'Edge anchors can\'t be changed while routing is set to "Optimize Continuously".',
          {
            duration: 6000,
            action: { label: 'Switch to Fixed', onClick: () => updateSettings({ edgeRoutingMode: 'fixed' }) },
          },
        );
      } else if (!result.success && result.reason) {
        toast.warning(result.reason);
      } else if (result.success && result.reason) {
        toast(result.reason);
      }
    },
    [addEdgeStore, updateSettings],
  );

  const onPaneClickHandler = useCallback(() => {
    if (ignoreNextPaneClickRef.current) {
      ignoreNextPaneClickRef.current = false;
      return;
    }
    clearCanvasSelection();
    closeContextMenu();
  }, [clearCanvasSelection, closeContextMenu, ignoreNextPaneClickRef]);

  const onCanvasDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.react-flow__node, .react-flow__edge')) return;
      if (!event.target.closest('.react-flow__pane')) return;
      suppressSelectionUntilRef.current = Date.now() + 250;
      clearCanvasSelection();
      closeContextMenu();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(position);
    },
    [addNode, clearCanvasSelection, closeContextMenu, screenToFlowPosition, suppressSelectionUntilRef],
  );

  const onSelectionChange = useCallback(
    ({ nodes, edges }: OnSelectionChangeParams) => {
      if (Date.now() < suppressSelectionUntilRef.current && (nodes.length > 0 || edges.length > 0)) {
        return;
      }
      setSelectedLoop(null);
      setSelectedNodes(nodes.map((n) => n.id));
      setSelectedEdges(edges.map((e) => e.id));
    },
    [setSelectedEdges, setSelectedLoop, setSelectedNodes, suppressSelectionUntilRef],
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
        onNodeDragStart={onNodeDragStart}
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
