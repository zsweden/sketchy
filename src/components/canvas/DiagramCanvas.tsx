import { useCallback, useMemo, useRef } from 'react';
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
  type OnSelectionChangeParams,
  type Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';

const nodeTypes = { entity: EntityNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 2 },
};

export default function DiagramCanvas() {
  const { screenToFlowPosition } = useReactFlow();

  const diagram = useDiagramStore((s) => s.diagram);
  const addNode = useDiagramStore((s) => s.addNode);
  const addEdge = useDiagramStore((s) => s.addEdge);
  const moveNodes = useDiagramStore((s) => s.moveNodes);
  const pinNode = useDiagramStore((s) => s.pinNode);
  const commitToHistory = useDiagramStore((s) => s.commitToHistory);
  const deleteNodes = useDiagramStore((s) => s.deleteNodes);
  const deleteEdges = useDiagramStore((s) => s.deleteEdges);

  const setSelectedNodes = useUIStore((s) => s.setSelectedNodes);
  const openContextMenu = useUIStore((s) => s.openContextMenu);
  const closeContextMenu = useUIStore((s) => s.closeContextMenu);
  const addToast = useUIStore((s) => s.addToast);

  const isDragging = useRef(false);
  const lastPaneClickTime = useRef(0);

  // Map diagram nodes to React Flow nodes
  const rfNodes = useMemo(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        selected: false,
      })),
    [diagram.nodes],
  );

  // Map diagram edges to React Flow edges
  const rfEdges = useMemo(
    () =>
      diagram.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: 'source',
        targetHandle: 'target',
      })),
    [diagram.edges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Handle position changes for drag
      const posChanges = changes.filter(
        (c): c is NodeChange & { type: 'position'; position: { x: number; y: number }; dragging: boolean } =>
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

      // Handle remove changes
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        deleteNodes(removeChanges.map((c) => c.id));
      }
    },
    [moveNodes, deleteNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removeChanges = changes.filter((c) => c.type === 'remove');
      if (removeChanges.length > 0) {
        deleteEdges(removeChanges.map((c) => c.id));
      }
    },
    [deleteEdges],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isDragging.current) {
        isDragging.current = false;
        commitToHistory();
        pinNode(node.id, true);
      }
    },
    [commitToHistory, pinNode],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const result = addEdge(connection.source, connection.target);
      if (!result.success && result.reason) {
        addToast(result.reason, 'warning');
      }
    },
    [addEdge, addToast],
  );

  // React Flow doesn't have onPaneDoubleClick, so detect it via onPaneClick timing
  const onPaneClickHandler = useCallback(
    (event: React.MouseEvent) => {
      closeContextMenu();
      const now = Date.now();
      if (now - lastPaneClickTime.current < 300) {
        // Double click detected
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
    ({ nodes }: OnSelectionChangeParams) => {
      setSelectedNodes(nodes.map((n) => n.id));
    },
    [setSelectedNodes],
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

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      onSelectionChange={onSelectionChange}
      onPaneContextMenu={onPaneContextMenu}
      onNodeContextMenu={onNodeContextMenu}
      onPaneClick={onPaneClickHandler}
      fitView
      deleteKeyCode={['Backspace', 'Delete']}
      multiSelectionKeyCode="Shift"
      selectionOnDrag
      panOnDrag={[1, 2]}
      selectionMode={0}
      proOptions={{ hideAttribution: true }}
    >
      {diagram.settings.showGrid && (
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      )}
      <Controls />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) => {
          const data = node.data as { tags?: string[] };
          if (data?.tags?.includes('ude')) return '#E57373';
          return '#D4D0C6';
        }}
      />
    </ReactFlow>
  );
}
