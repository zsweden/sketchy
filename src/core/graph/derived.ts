import type { DerivedCondition, DerivedIndicator } from '../framework-types';
import type { DiagramEdge } from '../types';

export interface NodeDegrees {
  indegree: number;
  outdegree: number;
}

export function computeNodeDegrees(
  edges: DiagramEdge[],
): Map<string, NodeDegrees> {
  const degrees = new Map<string, NodeDegrees>();

  const getOrCreate = (id: string): NodeDegrees => {
    let d = degrees.get(id);
    if (!d) {
      d = { indegree: 0, outdegree: 0 };
      degrees.set(id, d);
    }
    return d;
  };

  for (const edge of edges) {
    getOrCreate(edge.source).outdegree++;
    getOrCreate(edge.target).indegree++;
  }

  return degrees;
}

function matchesCondition(
  condition: DerivedCondition,
  degrees: NodeDegrees,
): boolean {
  switch (condition) {
    case 'indegree-zero':
      return degrees.indegree === 0;
    case 'leaf':
      return degrees.outdegree === 0;
    case 'indegree-and-outdegree':
      return degrees.indegree > 0 && degrees.outdegree > 0;
  }
}

export function getDerivedIndicators(
  nodeId: string,
  degreesMap: Map<string, NodeDegrees>,
  indicators: DerivedIndicator[],
): DerivedIndicator[] {
  const degrees = degreesMap.get(nodeId) ?? { indegree: 0, outdegree: 0 };
  return indicators.filter((ind) => matchesCondition(ind.condition, degrees));
}
