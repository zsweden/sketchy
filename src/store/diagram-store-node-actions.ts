import type { DiagramNode, JunctionType } from '../core/types';
import { getDefaultJunctionType } from '../core/framework-types';
import {
  alignHorizontal,
  alignVertical,
  distributeHorizontal,
  distributeVertical,
  type SizedPositionedItem,
} from '../utils/align-distribute';
import { resolveFramework } from './diagram-helpers';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

export function createDiagramNodeActions(
  context: DiagramStoreContext,
): Pick<
  DiagramState,
  | 'addNode'
  | 'updateNodeText'
  | 'updateNodeTags'
  | 'updateNodeJunction'
  | 'previewNodeColor'
  | 'previewNodeTextColor'
  | 'updateNodeColor'
  | 'updateNodeTextColor'
  | 'updateNodeNotes'
  | 'commitNodeText'
  | 'commitNodeNotes'
  | 'commitNodeValue'
  | 'commitNodeUnit'
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
  const {
    applyDiagramChange,
    applyNodePositionChanges,
    applyNodePositionTransform,
    moveNodes,
    dragNodes,
    commitDraggedNodes,
    updateNodes,
  } = context;

  function setNodeDataField<V>(
    field: string,
    options: { trackHistory?: boolean; coerceEmpty?: boolean } = {},
  ) {
    return (id: string, value: V) => {
      const finalValue = options.coerceEmpty ? ((value as unknown) || undefined) : value;
      updateNodes(
        (node) => (node.id === id ? { ...node, data: { ...node.data, [field]: finalValue } } : node),
        options.trackHistory ? { trackHistory: true } : undefined,
      );
    };
  }

  return {
    addNode: (position) => {
      const id = crypto.randomUUID();
      const state = context.get();
      const framework = resolveFramework(state.diagram.frameworkId);
      const node: DiagramNode = {
        id,
        type: 'entity',
        position,
        data: {
          label: '',
          tags: [],
          junctionType: getDefaultJunctionType(framework) as JunctionType,
        },
      };

      applyDiagramChange(
        (diagram) => ({ ...diagram, nodes: [...diagram.nodes, node] }),
        { trackHistory: true },
      );

      return id;
    },

    updateNodeText: setNodeDataField<string>('label'),

    updateNodeTags: (id, tags) => {
      const state = context.get();
      const framework = resolveFramework(state.diagram.frameworkId);
      const exclusiveIds = new Set(
        framework.nodeTags.filter((t) => t.exclusive).map((t) => t.id),
      );

      let resolved = tags;
      if (exclusiveIds.size > 0) {
        // Find the newly added exclusive tag (last one wins)
        const node = state.diagram.nodes.find((n) => n.id === id);
        const prevTags = node?.data.tags ?? [];
        const newExclusive = tags.filter(
          (t) => exclusiveIds.has(t) && !prevTags.includes(t),
        );
        if (newExclusive.length > 0) {
          const keeper = newExclusive[newExclusive.length - 1];
          resolved = tags.filter((t) => !exclusiveIds.has(t) || t === keeper);
        }
      }

      updateNodes(
        (node) => (node.id === id ? { ...node, data: { ...node.data, tags: resolved } } : node),
        { trackHistory: true },
      );
    },

    updateNodeJunction: setNodeDataField<JunctionType>('junctionType', { trackHistory: true }),
    previewNodeColor: setNodeDataField<string | undefined>('color'),
    previewNodeTextColor: setNodeDataField<string | undefined>('textColor'),
    updateNodeColor: setNodeDataField<string | undefined>('color', { trackHistory: true }),
    updateNodeTextColor: setNodeDataField<string | undefined>('textColor', { trackHistory: true }),
    updateNodeNotes: setNodeDataField<string>('notes', { coerceEmpty: true }),
    commitNodeText: setNodeDataField<string>('label', { trackHistory: true }),
    commitNodeNotes: setNodeDataField<string>('notes', { trackHistory: true, coerceEmpty: true }),
    commitNodeValue: setNodeDataField<number | undefined>('value', { trackHistory: true }),
    commitNodeUnit: setNodeDataField<string>('unit', { trackHistory: true, coerceEmpty: true }),

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

    alignNodesHorizontally: (items: SizedPositionedItem[]) => {
      if (items.length < 2) return;
      applyNodePositionChanges(alignHorizontal(items), { trackHistory: true });
    },

    alignNodesVertically: (items: SizedPositionedItem[]) => {
      if (items.length < 2) return;
      applyNodePositionChanges(alignVertical(items), { trackHistory: true });
    },

    distributeNodesHorizontally: (ids) => {
      applyNodePositionTransform(ids, distributeHorizontal);
    },

    distributeNodesVertically: (ids) => {
      applyNodePositionTransform(ids, distributeVertical);
    },
  };
}
