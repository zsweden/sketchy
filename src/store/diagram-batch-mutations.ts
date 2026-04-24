import { validateEdge } from '../core/graph/validation';
import { getDefaultJunctionType } from '../core/framework-types';
import type {
  DiagramEdge,
  DiagramNode,
  DiagramSettings,
  EdgePolarity,
  JunctionType,
} from '../core/types';
import type { Framework } from '../core/framework-types';
import type { BatchMutations } from './diagram-store-types';
import { resolveEdgeSides } from './diagram-edge-routing';

export function batchAddNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  framework: Framework,
): DiagramNode[] {
  for (const node of mutations.addNodes ?? []) {
    const realId = crypto.randomUUID();
    idMap.set(node.id, realId);
    nodes.push({
      id: realId,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        tags: node.tags ?? [],
        junctionType: (node.junctionType ?? getDefaultJunctionType(framework)) as JunctionType,
        ...(node.notes ? { notes: node.notes } : {}),
        ...(node.value != null ? { value: node.value } : {}),
        ...(node.unit ? { unit: node.unit } : {}),
        ...(node.color ? { color: node.color } : {}),
        ...(node.textColor ? { textColor: node.textColor } : {}),
      },
    });
  }
  return nodes;
}

export function batchUpdateNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
): DiagramNode[] {
  for (const update of mutations.updateNodes ?? []) {
    const realId = idMap.get(update.id) ?? update.id;
    nodes = nodes.map((node) => {
      if (node.id !== realId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...(update.label !== undefined ? { label: update.label } : {}),
          ...(update.tags !== undefined ? { tags: update.tags } : {}),
          ...(update.notes !== undefined ? { notes: update.notes || undefined } : {}),
          ...(update.value !== undefined ? { value: update.value ?? undefined } : {}),
          ...(update.unit !== undefined ? { unit: update.unit || undefined } : {}),
          ...(update.color !== undefined ? { color: update.color || undefined } : {}),
          ...(update.textColor !== undefined
            ? { textColor: update.textColor || undefined }
            : {}),
          ...(update.junctionType !== undefined ? { junctionType: update.junctionType } : {}),
        },
      };
    });
  }
  return nodes;
}

export function batchRemoveNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  if (!mutations.removeNodeIds?.length) return { nodes, edges };

  const removeSet = new Set(
    mutations.removeNodeIds.map((id) => idMap.get(id) ?? id),
  );
  return {
    nodes: nodes.filter((node) => !removeSet.has(node.id)),
    edges: edges.filter(
      (edge) => !removeSet.has(edge.source) && !removeSet.has(edge.target),
    ),
  };
}

export function batchAddEdges(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  framework: Framework,
  settings: DiagramSettings,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const edge of mutations.addEdges ?? []) {
    const source = idMap.get(edge.source) ?? edge.source;
    const target = idMap.get(edge.target) ?? edge.target;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;

    const result = validateEdge(edges, source, target, {
      allowCycles: framework.allowsCycles,
    });
    if (!result.valid) continue;

    const routingSides = settings.edgeRoutingMode === 'fixed'
      ? resolveEdgeSides(source, target, nodes, settings)
      : {};

    edges.push({
      id: crypto.randomUUID(),
      source,
      target,
      ...routingSides,
      ...(edge.confidence && edge.confidence !== 'high'
        ? { confidence: edge.confidence }
        : {}),
      ...(framework.supportsEdgePolarity
        ? { polarity: edge.polarity ?? ('positive' as EdgePolarity) }
        : {}),
      ...(framework.supportsEdgeDelay && edge.delay ? { delay: true } : {}),
      ...(edge.notes ? { notes: edge.notes } : {}),
    });

    const incomingCount = edges.filter((existing) => existing.target === target).length;
    if (framework.supportsJunctions && incomingCount === 2) {
      const defaultJunction = getDefaultJunctionType(framework) as JunctionType;
      nodes = nodes.map((node) =>
        node.id === target
          ? { ...node, data: { ...node.data, junctionType: defaultJunction } }
          : node,
      );
    }
  }

  return { nodes, edges };
}

export function batchUpdateEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
  framework: Framework,
): DiagramEdge[] {
  for (const update of mutations.updateEdges ?? []) {
    const updates: Partial<DiagramEdge> = {};
    if (update.confidence) updates.confidence = update.confidence;
    if (framework.supportsEdgePolarity && update.polarity) updates.polarity = update.polarity;
    if (framework.supportsEdgeDelay && update.delay !== undefined) updates.delay = update.delay;
    if (update.notes !== undefined) updates.notes = update.notes || undefined;
    if (Object.keys(updates).length === 0) continue;

    edges = edges.map((edge) =>
      edge.id === update.id ? { ...edge, ...updates } : edge,
    );
  }
  return edges;
}

export function batchRemoveEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
): DiagramEdge[] {
  if (!mutations.removeEdgeIds?.length) return edges;
  const removeSet = new Set(mutations.removeEdgeIds);
  return edges.filter((edge) => !removeSet.has(edge.id));
}
