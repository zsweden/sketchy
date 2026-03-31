import type { Diagram } from '../types';
import type { Framework } from '../framework-types';
import { validateGraph } from '../graph/validation';
import { getFramework } from '../../frameworks/registry';
import { migrate, validateDiagramShape } from './schema';

export function migrateDiagramShape(raw: unknown): Diagram | null {
  if (!validateDiagramShape(raw)) {
    return null;
  }

  return migrate(raw as unknown as Record<string, unknown>);
}

export interface NormalizedDiagramResult {
  diagram: Diagram;
  framework: Framework | null;
  warnings: string[];
}

export function normalizeLoadedDiagram(
  diagram: Diagram,
  invalidConnectionsWarning: (droppedCount: number) => string,
): NormalizedDiagramResult {
  const framework = getFramework(diagram.frameworkId) ?? null;
  const warnings: string[] = [];

  if (!framework) {
    warnings.push(`Unknown framework "${diagram.frameworkId}" — loading as generic diagram`);
  }

  const graphResult = validateGraph(diagram.nodes, diagram.edges, {
    allowCycles: framework?.allowsCycles,
  });

  if (graphResult.valid) {
    return { diagram, framework, warnings };
  }

  const droppedEdgeIds = new Set(graphResult.droppedEdges.map((edge) => edge.id));
  return {
    diagram: {
      ...diagram,
      edges: diagram.edges.filter((edge) => !droppedEdgeIds.has(edge.id)),
    },
    framework,
    warnings: [...warnings, invalidConnectionsWarning(graphResult.droppedEdges.length)],
  };
}
