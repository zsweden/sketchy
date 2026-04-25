import { useCallback, useRef } from 'react';
import {
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Edge,
  type OnSelectionChangeParams,
  type Node,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { toast } from 'sonner';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, snapNodePositionToGrid } from '../constants/layout';

interface UseCanvasHandlersOptions {
  localNodes: Node[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setLocalEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  ignoreNextPaneClickRef: React.RefObject<boolean>;
  suppressSelectionUntilRef: React.RefObject<number>;
  tryFitViewOnDimensions: () => void;
}

export function useCanvasHandlers({
  localNodes,
  setLocalNodes,
  setLocalEdges,
  screenToFlowPosition,
  ignoreNextPaneClickRef,
  suppressSelectionUntilRef,
  tryFitViewOnDimensions,
}: UseCanvasHandlersOptions) {
  const addNode = useDiagramStore((s) => s.addNode);
  const addEdgeStore = useDiagramStore((s) => s.addEdge);
  const batchApply = useDiagramStore((s) => s.batchApply);
  const dragNodes = useDiagramStore((s) => s.dragNodes);
  const commitDraggedNodes = useDiagramStore((s) => s.commitDraggedNodes);
  const updateNodeDimensions = useDiagramStore((s) => s.updateNodeDimensions);
  const snapToGrid = useDiagramStore((s) => s.diagram.settings.snapToGrid);
  const updateSettings = useDiagramStore((s) => s.updateSettings);

  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const setSelectedEdges = useUIStore((s) => s.setSelectedEdges);
  const setSelectedLoop = useUIStore((s) => s.setSelectedLoop);
  const openContextMenu = useUIStore((s) => s.openContextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);

  const pendingRemovedNodeIdsRef = useRef<Set<string>>(new Set());
  const pendingRemovedEdgeIdsRef = useRef<Set<string>>(new Set());
  const removalFlushScheduledRef = useRef(false);

  const flushPendingRemovals = useCallback(() => {
    removalFlushScheduledRef.current = false;

    const allRemovedNodeIds = [...pendingRemovedNodeIdsRef.current];
    const edgeIds = [...pendingRemovedEdgeIdsRef.current];
    pendingRemovedNodeIdsRef.current.clear();
    pendingRemovedEdgeIdsRef.current.clear();

    if (allRemovedNodeIds.length === 0 && edgeIds.length === 0) {
      return;
    }

    // RF emits `remove` NodeChange events for both entity nodes and annotations
    // (they share the RF node id space). Split by looking up the id in the
    // annotations array so each goes through the right removal path.
    const annotationIds = new Set(
      useDiagramStore.getState().diagram.annotations.map((a) => a.id),
    );
    const removeNodeIds: string[] = [];
    const removeAnnotationIds: string[] = [];
    for (const id of allRemovedNodeIds) {
      if (annotationIds.has(id)) removeAnnotationIds.push(id);
      else removeNodeIds.push(id);
    }

    batchApply({
      ...(removeNodeIds.length > 0 ? { removeNodeIds } : {}),
      ...(edgeIds.length > 0 ? { removeEdgeIds: edgeIds } : {}),
      ...(removeAnnotationIds.length > 0 ? { removeAnnotationIds } : {}),
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
  }, [setSelectedEdges, setSelectedLoop, setSelectedNodes, setLocalNodes, setLocalEdges]);

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
        const nodeIds = new Set(useDiagramStore.getState().diagram.nodes.map((node) => node.id));
        for (const c of changes) {
          if (c.type !== 'dimensions' || !nodeIds.has(c.id)) continue;
          const dimensions = 'dimensions' in c ? c.dimensions : undefined;
          if (!dimensions) continue;
          updateNodeDimensions(c.id, dimensions);
        }
        tryFitViewOnDimensions();
      }
    },
    [dragNodes, updateNodeDimensions, snapToGrid, localNodes, scheduleRemovalFlush, tryFitViewOnDimensions, setLocalNodes],
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
    [scheduleRemovalFlush, setLocalEdges],
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

  const onPaneClick = useCallback(() => {
    if (ignoreNextPaneClickRef.current) {
      ignoreNextPaneClickRef.current = false;
      return;
    }
    clearCanvasSelection();
    closeContextMenu();
  }, [clearCanvasSelection, closeContextMenu, ignoreNextPaneClickRef]);

  const onDoubleClick = useCallback(
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

  return {
    clearCanvasSelection,
    onNodesChange,
    onEdgesChange,
    onNodeDragStart,
    onNodeDragStop,
    onConnect,
    onPaneClick,
    onDoubleClick,
    onSelectionChange,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
  };
}
