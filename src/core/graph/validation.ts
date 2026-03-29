import type { DiagramEdge, DiagramNode } from '../types';

export interface GraphValidationOptions {
  allowCycles?: boolean;
}

export function isSelfLoop(source: string, target: string): boolean {
  return source === target;
}

export function isDuplicateEdge(
  edges: DiagramEdge[],
  source: string,
  target: string,
): boolean {
  return edges.some((e) => e.source === source && e.target === target);
}

export function wouldCreateCycle(
  edges: DiagramEdge[],
  source: string,
  target: string,
): boolean {
  // Check if there's already a path from target to source (BFS).
  // If so, adding source→target would create a cycle.
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
    } else {
      adjacency.set(edge.source, [edge.target]);
    }
  }

  const visited = new Set<string>();
  const queue = [target];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const n of neighbors) {
        queue.push(n);
      }
    }
  }

  return false;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateEdge(
  edges: DiagramEdge[],
  source: string,
  target: string,
  options: GraphValidationOptions = {},
): ValidationResult {
  if (isSelfLoop(source, target)) {
    return { valid: false, reason: 'Cannot connect a node to itself' };
  }
  if (isDuplicateEdge(edges, source, target)) {
    return { valid: false, reason: 'Connection already exists' };
  }
  if (!options.allowCycles && wouldCreateCycle(edges, source, target)) {
    return { valid: false, reason: 'Cannot connect: would create a cycle' };
  }
  return { valid: true };
}

export interface GraphValidationResult {
  valid: boolean;
  droppedEdges: DiagramEdge[];
  reasons: string[];
}

export function validateGraph(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: GraphValidationOptions = {},
): GraphValidationResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges: DiagramEdge[] = [];
  const droppedEdges: DiagramEdge[] = [];
  const reasons: string[] = [];

  for (const edge of edges) {
    // Check that both endpoints exist
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      droppedEdges.push(edge);
      reasons.push(
        `Edge ${edge.id}: references non-existent node`,
      );
      continue;
    }

    const result = validateEdge(validEdges, edge.source, edge.target, options);
    if (result.valid) {
      validEdges.push(edge);
    } else {
      droppedEdges.push(edge);
      reasons.push(`Edge ${edge.id}: ${result.reason}`);
    }
  }

  return {
    valid: droppedEdges.length === 0,
    droppedEdges,
    reasons,
  };
}
