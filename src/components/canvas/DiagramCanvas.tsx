import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';
import { FIT_VIEW_OPTIONS } from '../../core/layout/fit-view-options';
import {
  findCausalLoops,
  getConnectedSubgraph,
  getLoopSubgraph,
  labelCausalLoops,
} from '../../core/graph/derived';
import {
  getEdgeHandlePlacement,
  getSourceHandleId,
  getTargetHandleId,
} from '../../core/graph/ports';

const nodeTypes = { entity: EntityNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
  style: { strokeWidth: 2 },
};

export default function DiagramCanvas() {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const diagram = useDiagramStore((s) => s.diagram);
  const addNode = useDiagramStore((s) => s.addNode);
  const addEdgeStore = useDiagramStore((s) => s.addEdge);
  const moveNodes = useDiagramStore((s) => s.moveNodes);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const deleteEdges = useDiagramStore((s) => s.deleteEdges);

  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedLoopId = useUIStore((s) => s.selectedLoopId);
  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const setSelectedEdges = useUIStore((s) => s.setSelectedEdges);
  const openContextMenu = useUIStore((s) => s.openContextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const addToast = useUIStore((s) => s.addToast);
  const interactionMode = useUIStore((s) => s.interactionMode);

  const framework = useDiagramStore((s) => s.framework);
  const direction = useDiagramStore((s) => s.diagram.settings.layoutDirection);
  const edgeRoutingMode = useDiagramStore((s) => s.diagram.settings.edgeRoutingMode);

  const isPanMode = interactionMode === 'pan';

  const isDragging = useRef(false);
  const lastPaneClickTime = useRef(0);

  const selectedLoop = useMemo(() => {
    if (!framework.allowsCycles || !selectedLoopId) return null;
    return labelCausalLoops(findCausalLoops(diagram.edges))
      .find((loop) => loop.id === selectedLoopId) ?? null;
  }, [diagram.edges, framework.allowsCycles, selectedLoopId]);

  // Loop focus overrides single-node neighborhood highlight.
  const highlightSets = useMemo(() => {
    if (selectedLoop) return getLoopSubgraph(selectedLoop);
    if (selectedNodeIds.length !== 1) return null;
    return getConnectedSubgraph(diagram.edges, selectedNodeIds[0]);
  }, [selectedLoop, selectedNodeIds, diagram.edges]);

  // Build React Flow nodes from diagram, letting RF manage selection
  const rfNodes: Node[] = useMemo(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          ...n.data,
          highlightState: highlightSets
            ? highlightSets.nodeIds.has(n.id) ? 'highlighted' : 'dimmed'
            : 'none',
          loopKind: selectedLoop && highlightSets?.nodeIds.has(n.id)
            ? selectedLoop.kind
            : undefined,
        },
      })),
    [diagram.nodes, highlightSets, selectedLoop],
  );

  // Build React Flow edges from diagram
  const rfEdges: Edge[] = useMemo(
    () => {
      const nodePositions = new Map(
        diagram.nodes.map((node) => [node.id, node.position]),
      );

      return diagram.edges.map((e) => {
        const placement = getEdgeHandlePlacement(
          nodePositions.get(e.source),
          nodePositions.get(e.target),
          direction,
        );
        const sourceSide = edgeRoutingMode === 'fixed'
          ? e.sourceSide ?? placement.sourceSide
          : placement.sourceSide;
        const targetSide = edgeRoutingMode === 'fixed'
          ? e.targetSide ?? placement.targetSide
          : placement.targetSide;

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: [
            framework.supportsEdgePolarity
              ? e.polarity === 'negative' ? '-' : '+'
              : null,
            framework.supportsEdgeDelay && e.delay ? 'D' : null,
          ].filter(Boolean).join(' '),
          labelShowBg: framework.supportsEdgePolarity || (framework.supportsEdgeDelay && e.delay),
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 999,
          labelBgStyle: {
            fill: 'rgba(255, 255, 255, 0.92)',
            stroke: 'var(--border)',
            strokeWidth: 1,
          },
          labelStyle: {
            fill: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 700,
          },
          sourceHandle: getSourceHandleId(sourceSide),
          targetHandle: getTargetHandleId(targetSide),
          pathOptions: { borderRadius: 100 },
          className: [
            `edge-confidence-${e.confidence ?? 'high'}`,
            highlightSets
              ? highlightSets.edgeIds.has(e.id) ? 'edge-highlighted' : 'edge-dimmed'
              : '',
            selectedLoop && highlightSets?.edgeIds.has(e.id)
              ? `edge-loop-${selectedLoop.kind}`
              : '',
          ].join(' '),
        };
      });
    },
    [diagram.edges, diagram.nodes, direction, edgeRoutingMode, framework, highlightSets, selectedLoop],
  );

  // Local state for React Flow selection/interaction
  const [localNodes, setLocalNodes] = useState<Node[]>(rfNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(rfEdges);

  // Sync store -> local when diagram data changes, preserving selection state
  useEffect(() => {
    // React Flow keeps transient selection/measurement state locally; syncing
    // new store data into that local model is intentional here.
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
    // React Flow keeps transient selection/measurement state locally; syncing
    // new store data into that local model is intentional here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalEdges((prev) => {
      const selectionMap = new Map(prev.map((e) => [e.id, e.selected]));
      return rfEdges.map((e) => ({
        ...e,
        selected: selectionMap.get(e.id) ?? false,
      }));
    });
  }, [rfEdges]);

  // Fit view when requested (load, import, new, tab switch, auto-layout)
  const fitViewTrigger = useUIStore((s) => s.fitViewTrigger);
  const pendingFitView = useRef(false);
  useEffect(() => {
    if (fitViewTrigger === 0) return;
    pendingFitView.current = true;
    // Fallback: for position-only changes (auto-layout), React Flow won't fire
    // 'dimensions' changes, so the onNodesChange handler won't catch it.
    // Wait two animation frames (render + paint) then fit if still pending.
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
      // Apply all changes to local state (selection, dimensions, etc.)
      setLocalNodes((nds) => applyNodeChanges(changes, nds));

      // Also sync position changes to our store
      const posChanges = changes.filter(
        (c): c is NodeChange & { type: 'position'; position: { x: number; y: number } } =>
          c.type === 'position' && 'position' in c && c.position != null,
      );
      if (posChanges.length > 0) {
        isDragging.current = true;
        moveNodes(
          posChanges.map((c) => ({
            id: c.id,
            position: c.position,
          })),
        );
      }

      // Handle removes via our store (for undo/redo)
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        deleteNodes(removeChanges.map((c) => c.id));
      }

      // Fit view after React Flow has measured/positioned nodes
      if (pendingFitView.current) {
        const hasDimensions = changes.some((c) => c.type === 'dimensions');
        if (hasDimensions) {
          pendingFitView.current = false;
          // Use rAF to run after this render cycle completes
          requestAnimationFrame(() => {
            fitView(FIT_VIEW_OPTIONS);
          });
        }
      }
    },
    [moveNodes, deleteNodes, fitView],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Apply all changes to local state (selection, etc.)
      setLocalEdges((eds) => applyEdgeChanges(changes, eds));

      // Handle removes via our store (for undo/redo)
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        deleteEdges(removeChanges.map((c) => c.id));
      }
    },
    [deleteEdges],
  );

  const onNodeDragStop = useCallback(
    () => {
      if (isDragging.current) {
        isDragging.current = false;
        commitToHistory();
      }
    },
    [commitToHistory],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const result = addEdgeStore(connection.source, connection.target, {
        sourceHandleId: connection.sourceHandle,
        targetHandleId: connection.targetHandle,
      });
      if (!result.success && result.reason) {
        addToast(result.reason, 'warning');
      }
    },
    [addEdgeStore, addToast],
  );

  const onPaneClickHandler = useCallback(
    (event: React.MouseEvent) => {
      closeContextMenu();
      const now = Date.now();
      if (now - lastPaneClickTime.current < 300) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addNode(position);
        lastPaneClickTime.current = 0;
      } else {
        lastPaneClickTime.current = now;
      }
    },
    [screenToFlowPosition, addNode, closeContextMenu],
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
      openContextMenu(event.clientX, event.clientY);
    },
    [openContextMenu],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      openContextMenu(event.clientX, event.clientY, node.id);
    },
    [openContextMenu],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      openContextMenu(event.clientX, event.clientY, undefined, edge.id);
    },
    [openContextMenu],
  );

  return (
    <ReactFlow
      data-testid="diagram-flow"
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
          const data = node.data as { tags?: string[] };
          // User-applied tags take priority
          const tagColor = data?.tags
            ?.map((t) => framework.nodeTags.find((nt) => nt.id === t))
            .find(Boolean)?.color;
          if (tagColor) return tagColor;
          // Then derived indicators (root-cause = blue, intermediate = grey)
          const degreesMap = computeNodeDegrees(diagram.edges);
          const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);
          if (derived.length > 0) return derived[0].color;
          return '#D4D0C6';
        }}
      />
    </ReactFlow>
  );
}
