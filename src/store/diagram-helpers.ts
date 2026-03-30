import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSettings,
  EdgePolarity,
} from '../core/types';
import { createEmptyDiagram } from '../core/types';
import type { Framework } from '../core/framework-types';
import { getFramework } from '../frameworks/registry';
import { validateEdge } from '../core/graph/validation';
import { getEdgeHandlePlacement, getSideFromHandleId } from '../core/graph/ports';
import type { EdgeHandlePlacement } from '../core/graph/ports';
import type { BatchMutations } from './diagram-store';

// --- Framework helpers ---

export function getDefaultFramework(): Framework {
  const fw = getFramework('crt');
  if (!fw) throw new Error('CRT framework not registered');
  return fw;
}

export function createDiagramForFramework(framework: Framework): Diagram {
  const diagram = createEmptyDiagram(framework.id);
  return {
    ...diagram,
    settings: {
      ...diagram.settings,
      layoutDirection: framework.defaultLayoutDirection,
    },
  };
}

export function getDefaultEdgeFields(framework: Framework): Pick<DiagramEdge, 'polarity' | 'delay'> {
  return {
    ...(framework.supportsEdgePolarity ? { polarity: 'positive' as EdgePolarity } : {}),
    ...(framework.supportsEdgeDelay ? { delay: false } : {}),
  };
}

// --- Edge routing helpers ---

function getNodePositionMap(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  return new Map(nodes.map((node) => [node.id, node.position]));
}

export function getAutomaticEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement {
  const positions = getNodePositionMap(nodes);
  return getEdgeHandlePlacement(
    positions.get(source),
    positions.get(target),
    settings.layoutDirection,
  );
}

export function resolveEdgeSides(
  source: string,
  target: string,
  nodes: DiagramNode[],
  settings: DiagramSettings,
  handles?: {
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  },
): EdgeHandlePlacement {
  const explicitSourceSide = getSideFromHandleId(handles?.sourceHandleId, 'source');
  const explicitTargetSide = getSideFromHandleId(handles?.targetHandleId, 'target');
  const automaticSides = getAutomaticEdgeSides(source, target, nodes, settings);

  if (explicitSourceSide && explicitTargetSide) {
    return { sourceSide: explicitSourceSide, targetSide: explicitTargetSide };
  }

  return {
    sourceSide: explicitSourceSide ?? automaticSides.sourceSide,
    targetSide: explicitTargetSide ?? automaticSides.targetSide,
  };
}

export function getStoredOrAutomaticEdgeSides(
  edge: Pick<DiagramEdge, 'source' | 'target' | 'sourceSide' | 'targetSide'>,
  nodes: DiagramNode[],
  settings: DiagramSettings,
): EdgeHandlePlacement {
  const automaticSides = getAutomaticEdgeSides(edge.source, edge.target, nodes, settings);
  return {
    sourceSide: edge.sourceSide ?? automaticSides.sourceSide,
    targetSide: edge.targetSide ?? automaticSides.targetSide,
  };
}

export function captureCurrentEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): DiagramEdge[] {
  return edges.map((edge) => ({
    ...edge,
    ...getAutomaticEdgeSides(edge.source, edge.target, nodes, settings),
  }));
}

export function ensureFixedEdgeSides(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
): DiagramEdge[] {
  return edges.map((edge) => ({
    ...edge,
    ...getStoredOrAutomaticEdgeSides(edge, nodes, settings),
  }));
}

// --- Snapshot ---

export function snapshot(state: { diagram: Diagram }): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  return { nodes: state.diagram.nodes, edges: state.diagram.edges };
}

// --- Batch mutation helpers ---

export function batchAddNodes(
  mutations: BatchMutations,
  idMap: Map<string, string>,
  nodes: DiagramNode[],
): DiagramNode[] {
  for (const n of mutations.addNodes ?? []) {
    const realId = crypto.randomUUID();
    idMap.set(n.id, realId);
    nodes.push({
      id: realId,
      type: 'entity',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        tags: n.tags ?? [],
        junctionType: 'or',
        ...(n.notes ? { notes: n.notes } : {}),
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
  for (const upd of mutations.updateNodes ?? []) {
    const realId = idMap.get(upd.id) ?? upd.id;
    nodes = nodes.map((node) => {
      if (node.id !== realId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...(upd.label !== undefined ? { label: upd.label } : {}),
          ...(upd.tags !== undefined ? { tags: upd.tags } : {}),
          ...(upd.notes !== undefined ? { notes: upd.notes || undefined } : {}),
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
  const removeSet = new Set(mutations.removeNodeIds.map((id) => idMap.get(id) ?? id));
  return {
    nodes: nodes.filter((n) => !removeSet.has(n.id)),
    edges: edges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target)),
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
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of mutations.addEdges ?? []) {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    const result = validateEdge(edges, source, target, {
      allowCycles: framework.allowsCycles,
    });
    if (result.valid) {
      const routingSides = settings.edgeRoutingMode === 'fixed'
        ? resolveEdgeSides(source, target, nodes, settings)
        : {};
      edges.push({
        id: crypto.randomUUID(),
        source,
        target,
        ...routingSides,
        ...(e.confidence && e.confidence !== 'high' ? { confidence: e.confidence } : {}),
        ...(framework.supportsEdgePolarity ? { polarity: e.polarity ?? 'positive' as EdgePolarity } : {}),
        ...(framework.supportsEdgeDelay && e.delay ? { delay: true } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
      });
      const incomingCount = edges.filter((ex) => ex.target === target).length;
      if (framework.supportsJunctions && incomingCount === 2) {
        nodes = nodes.map((n) =>
          n.id === target ? { ...n, data: { ...n.data, junctionType: 'or' as const } } : n,
        );
      }
    }
  }
  return { nodes, edges };
}

export function batchUpdateEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
  framework: Framework,
): DiagramEdge[] {
  for (const upd of mutations.updateEdges ?? []) {
    const updates: Partial<DiagramEdge> = {};
    if (upd.confidence) updates.confidence = upd.confidence;
    if (framework.supportsEdgePolarity && upd.polarity) updates.polarity = upd.polarity;
    if (framework.supportsEdgeDelay && upd.delay !== undefined) updates.delay = upd.delay;
    if (upd.notes !== undefined) updates.notes = upd.notes || undefined;
    if (Object.keys(updates).length > 0) {
      edges = edges.map((e) =>
        e.id === upd.id ? { ...e, ...updates } : e,
      );
    }
  }
  return edges;
}

export function batchRemoveEdges(
  mutations: BatchMutations,
  edges: DiagramEdge[],
): DiagramEdge[] {
  if (!mutations.removeEdgeIds?.length) return edges;
  const removeSet = new Set(mutations.removeEdgeIds);
  return edges.filter((e) => !removeSet.has(e.id));
}
