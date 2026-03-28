import type { Diagram } from '../types';
import { getFramework } from '../../frameworks/registry';
import { validateGraph } from '../graph/validation';
import { migrate, validateDiagramShape } from './schema';

export function exportDiagram(diagram: Diagram): void {
  const json = JSON.stringify(diagram, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${diagram.name || 'diagram'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  diagram: Diagram;
  warnings: string[];
}

export async function importDiagram(file: File): Promise<ImportResult> {
  const text = await file.text();
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  if (!validateDiagramShape(parsed)) {
    throw new Error('File is missing required diagram fields');
  }

  const diagram = migrate(parsed as unknown as Record<string, unknown>);

  // Check framework
  if (!getFramework(diagram.frameworkId)) {
    warnings.push(
      `Unknown framework "${diagram.frameworkId}" — loading as generic diagram`,
    );
  }

  // Validate graph
  const graphResult = validateGraph(diagram.nodes, diagram.edges);
  if (!graphResult.valid) {
    diagram.edges = diagram.edges.filter(
      (e) => !graphResult.droppedEdges.some((d) => d.id === e.id),
    );
    warnings.push(
      `Dropped ${graphResult.droppedEdges.length} invalid edge(s): ${graphResult.reasons.join('; ')}`,
    );
  }

  return { diagram, warnings };
}
