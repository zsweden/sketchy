import type { DiagramNode } from '../core/types';
import { alignHorizontal, alignVertical, distributeHorizontal, distributeVertical } from '../utils/align-distribute';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

export function createDiagramNodeActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'addNode'
  | 'updateNodeText'
  | 'updateNodeTags'
  | 'updateNodeJunction'
  | 'updateNodeColor'
  | 'updateNodeTextColor'
  | 'updateNodeNotes'
  | 'commitNodeText'
  | 'commitNodeNotes'
  | 'toggleNodeLocked'
  | 'moveNodes'
  | 'dragNodes'
  | 'commitDraggedNodes'
  | 'deleteNodes'
  | 'alignNodesHorizontally'
  | 'alignNodesVertically'
  | 'distributeNodesHorizontally'
  | 'distributeNodesVertically'
> {
  const { applyDiagramChange, applyNodePositionTransform, moveNodes, dragNodes, commitDraggedNodes, updateNodes } = context;

  return {
    addNode: (position) => {
      const id = crypto.randomUUID();
      const node: DiagramNode = {
        id,
        type: 'entity',
        position,
        data: {
          label: '',
          tags: [],
          junctionType: 'or',
        },
      };

      applyDiagramChange(
        (diagram) => ({ ...diagram, nodes: [...diagram.nodes, node] }),
        { trackHistory: true },
      );

      return id;
    },

    updateNodeText: (id, label) => {
      updateNodes((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node,
      );
    },

    updateNodeTags: (id, tags) => {
      updateNodes(
        (node) => (node.id === id ? { ...node, data: { ...node.data, tags } } : node),
        { trackHistory: true },
      );
    },

    updateNodeJunction: (id, type) => {
      updateNodes(
        (node) => (
          node.id === id ? { ...node, data: { ...node.data, junctionType: type } } : node
        ),
        { trackHistory: true },
      );
    },

    updateNodeColor: (id, color) => {
      updateNodes(
        (node) => (node.id === id ? { ...node, data: { ...node.data, color } } : node),
        { trackHistory: true },
      );
    },

    updateNodeTextColor: (id, textColor) => {
      updateNodes(
        (node) => (
          node.id === id ? { ...node, data: { ...node.data, textColor } } : node
        ),
        { trackHistory: true },
      );
    },

    updateNodeNotes: (id, notes) => {
      updateNodes((node) => (
        node.id === id
          ? { ...node, data: { ...node.data, notes: notes || undefined } }
          : node
      ));
    },

    commitNodeText: (id, label) => {
      updateNodes(
        (node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node),
        { trackHistory: true },
      );
    },

    commitNodeNotes: (id, notes) => {
      updateNodes(
        (node) => (
          node.id === id
            ? { ...node, data: { ...node.data, notes: notes || undefined } }
            : node
        ),
        { trackHistory: true },
      );
    },

    toggleNodeLocked: (ids, locked) => {
      const idSet = new Set(ids);
      updateNodes(
        (node) => (
          idSet.has(node.id)
            ? { ...node, data: { ...node.data, locked: locked || undefined } }
            : node
        ),
        { trackHistory: true },
      );
    },

    moveNodes,
    dragNodes,
    commitDraggedNodes,

    deleteNodes: (ids) => {
      const idSet = new Set(ids);
      applyDiagramChange(
        (diagram) => ({
          ...diagram,
          nodes: diagram.nodes.filter((node) => !idSet.has(node.id)),
          edges: diagram.edges.filter((edge) => !idSet.has(edge.source) && !idSet.has(edge.target)),
        }),
        { trackHistory: true },
      );
    },

    alignNodesHorizontally: (ids) => {
      applyNodePositionTransform(ids, alignHorizontal);
    },

    alignNodesVertically: (ids) => {
      applyNodePositionTransform(ids, alignVertical);
    },

    distributeNodesHorizontally: (ids) => {
      applyNodePositionTransform(ids, distributeHorizontal);
    },

    distributeNodesVertically: (ids) => {
      applyNodePositionTransform(ids, distributeVertical);
    },
  };
}
