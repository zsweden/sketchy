import { UndoRedoManager } from '../core/history/undo-redo';
import { snapshot } from './diagram-snapshot';
import type { Diagram, DiagramNode } from '../core/types';
import type {
  DiagramSnapshot,
  DiagramStoreContext,
  DiagramStoreGet,
  DiagramStoreSet,
  NodePositionChange,
} from './diagram-store-types';

export function createDiagramStoreContext(
  set: DiagramStoreSet,
  get: DiagramStoreGet,
): DiagramStoreContext {
  const history = new UndoRedoManager<DiagramSnapshot>();
  const undoState = { canUndo: true, canRedo: false } as const;
  let pendingNodeMoveSnapshot: DiagramSnapshot | null = null;

  const clearPendingNodeMove = () => {
    pendingNodeMoveSnapshot = null;
  };

  const pushHistorySnapshot = (snapshotOverride?: DiagramSnapshot) => {
    clearPendingNodeMove();
    history.push(snapshotOverride ?? snapshot(get()));
  };

  const setDiagram = (updater: (diagram: Diagram) => Diagram) => {
    set((state) => ({ diagram: updater(state.diagram) }));
  };

  const applyDiagramChange = (
    updater: (diagram: Diagram) => Diagram,
    options: { trackHistory?: boolean } = {},
  ) => {
    if (options.trackHistory) {
      pushHistorySnapshot();
    }

    set((state) => ({
      diagram: updater(state.diagram),
      ...(options.trackHistory ? undoState : {}),
    }));
  };

  const updateNodes = (
    mapper: (node: DiagramNode) => DiagramNode,
    options: { trackHistory?: boolean } = {},
  ) => {
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map(mapper),
      }),
      options,
    );
  };

  const updateEdges: DiagramStoreContext['updateEdges'] = (
    mapper,
    options = {},
  ) => {
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        edges: diagram.edges.map(mapper),
      }),
      options,
    );
  };

  const getNodesByIds = (ids: string[]) => {
    const idSet = new Set(ids);
    return get().diagram.nodes.filter((node) => idSet.has(node.id));
  };

  const moveNodes = (changes: NodePositionChange[]) => {
    const positions = new Map(changes.map((change) => [change.id, change.position]));
    setDiagram((diagram) => ({
      ...diagram,
      nodes: diagram.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position } : node;
      }),
      annotations: diagram.annotations.map((ann) => {
        const position = positions.get(ann.id);
        return position ? { ...ann, position } : ann;
      }),
    }));
  };

  const dragNodes = (changes: NodePositionChange[]) => {
    if (changes.length === 0) return;
    if (!pendingNodeMoveSnapshot) {
      pendingNodeMoveSnapshot = snapshot(get());
    }
    moveNodes(changes);
  };

  const commitDraggedNodes = () => {
    if (!pendingNodeMoveSnapshot) return;
    history.push(pendingNodeMoveSnapshot);
    pendingNodeMoveSnapshot = null;
    set(undoState);
  };

  const applyNodePositionChanges: DiagramStoreContext['applyNodePositionChanges'] = (
    changes,
    options = {},
  ) => {
    if (changes.length === 0) return;
    const positions = new Map(changes.map((change) => [change.id, change.position]));
    applyDiagramChange(
      (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map((node) => {
          const position = positions.get(node.id);
          return position ? { ...node, position } : node;
        }),
      }),
      options,
    );
  };

  const applyNodePositionTransform = (
    ids: string[],
    transform: (nodes: DiagramNode[]) => NodePositionChange[],
  ) => {
    const selectedNodes = getNodesByIds(ids);
    if (selectedNodes.length < 2) return;
    applyNodePositionChanges(transform(selectedNodes), { trackHistory: true });
  };

  return {
    set,
    get,
    history,
    undoState,
    clearPendingNodeMove,
    pushHistorySnapshot,
    setDiagram,
    applyDiagramChange,
    updateNodes,
    updateEdges,
    getNodesByIds,
    applyNodePositionChanges,
    applyNodePositionTransform,
    moveNodes,
    dragNodes,
    commitDraggedNodes,
  };
}
