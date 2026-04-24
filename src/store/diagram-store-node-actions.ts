import type { DiagramNode, JunctionType } from '../core/types';
import {
  type Framework,
  getDefaultJunctionType,
  getJunctionOptions,
} from '../core/framework-types';
import { computeNodeDegrees } from '../core/graph/derived';
import {
  alignHorizontal,
  alignVertical,
  distributeHorizontal,
  distributeVertical,
  type SizedPositionedItem,
} from '../utils/align-distribute';
import { resolveFramework } from './diagram-helpers';
import type { DiagramState, DiagramStoreContext } from './diagram-store-types';

/**
 * Enforce per-node tag exclusivity: when a newly added exclusive tag conflicts
 * with another exclusive tag the node already has, the latest one wins.
 */
function applyExclusivity(
  framework: Framework,
  prevTags: string[],
  nextTags: string[],
): string[] {
  const exclusiveIds = new Set(
    framework.nodeTags.filter((t) => t.exclusive).map((t) => t.id),
  );
  if (exclusiveIds.size === 0) return nextTags;

  const newExclusive = nextTags.filter(
    (t) => exclusiveIds.has(t) && !prevTags.includes(t),
  );
  if (newExclusive.length === 0) return nextTags;

  const keeper = newExclusive[newExclusive.length - 1];
  return nextTags.filter((t) => !exclusiveIds.has(t) || t === keeper);
}

function isJunctionEligible(
  framework: Framework,
  indegree: number,
): boolean {
  const options = getJunctionOptions(framework);
  if (options.length === 0) return false;
  const isMath = options.some((o) => o.id === 'add' || o.id === 'multiply');
  return isMath ? indegree >= 1 : indegree >= 2;
}

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
  | 'previewNodesColor'
  | 'previewNodesTextColor'
  | 'updateNodesColor'
  | 'updateNodesTextColor'
  | 'updateNodesJunction'
  | 'addNodesTag'
  | 'removeNodesTag'
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
      const node = state.diagram.nodes.find((n) => n.id === id);
      const resolved = applyExclusivity(framework, node?.data.tags ?? [], tags);

      updateNodes(
        (n) => (n.id === id ? { ...n, data: { ...n.data, tags: resolved } } : n),
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

    previewNodesColor: (ids, color) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updateNodes(
        (node) => (idSet.has(node.id) ? { ...node, data: { ...node.data, color } } : node),
      );
    },

    previewNodesTextColor: (ids, color) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updateNodes(
        (node) => (
          idSet.has(node.id) ? { ...node, data: { ...node.data, textColor: color } } : node
        ),
      );
    },

    updateNodesColor: (ids, color) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updateNodes(
        (node) => (idSet.has(node.id) ? { ...node, data: { ...node.data, color } } : node),
        { trackHistory: true },
      );
    },

    updateNodesTextColor: (ids, color) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updateNodes(
        (node) => (
          idSet.has(node.id) ? { ...node, data: { ...node.data, textColor: color } } : node
        ),
        { trackHistory: true },
      );
    },

    updateNodesJunction: (ids, type) => {
      if (ids.length === 0) return;
      const state = context.get();
      const framework = resolveFramework(state.diagram.frameworkId);
      const degrees = computeNodeDegrees(state.diagram.edges);
      const eligible = new Set(
        ids.filter((id) => isJunctionEligible(framework, degrees.get(id)?.indegree ?? 0)),
      );
      if (eligible.size === 0) return;
      updateNodes(
        (node) => (
          eligible.has(node.id)
            ? { ...node, data: { ...node.data, junctionType: type } }
            : node
        ),
        { trackHistory: true },
      );
    },

    addNodesTag: (ids, tagId) => {
      if (ids.length === 0) return;
      const state = context.get();
      const framework = resolveFramework(state.diagram.frameworkId);
      const idSet = new Set(ids);
      // Per-node exclusivity: each node may end up with a different "other exclusive
      // tag" displaced, depending on what it had before. That's intentional.
      updateNodes(
        (node) => {
          if (!idSet.has(node.id)) return node;
          if (node.data.tags.includes(tagId)) return node;
          const next = applyExclusivity(framework, node.data.tags, [...node.data.tags, tagId]);
          return { ...node, data: { ...node.data, tags: next } };
        },
        { trackHistory: true },
      );
    },

    removeNodesTag: (ids, tagId) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updateNodes(
        (node) => {
          if (!idSet.has(node.id)) return node;
          if (!node.data.tags.includes(tagId)) return node;
          return {
            ...node,
            data: { ...node.data, tags: node.data.tags.filter((t) => t !== tagId) },
          };
        },
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
