import type { Diagram } from '../types';
import { validateGraph } from '../graph/validation';
import { getFramework } from '../../frameworks/registry';
import { migrate, validateDiagramShape } from './schema';

const STORAGE_KEY = 'sketchy_diagram';

export function saveDiagram(diagram: Diagram): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export interface LoadResult {
  diagram: Diagram | null;
  error?: string;
  warnings?: string[];
}

export function loadDiagram(): LoadResult {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return { diagram: null };

  try {
    const parsed = JSON.parse(raw);

    if (!validateDiagramShape(parsed)) {
      backupCorrupted(raw);
      return {
        diagram: null,
        error: 'Saved data was corrupted and could not be loaded',
      };
    }

    const diagram = migrate(parsed as unknown as Record<string, unknown>);

    // Validate graph — sanitize dangling edges, cycles, duplicates
    const warnings: string[] = [];
    const graphResult = validateGraph(diagram.nodes, diagram.edges, {
      allowCycles: getFramework(diagram.frameworkId)?.allowsCycles,
    });
    if (!graphResult.valid) {
      diagram.edges = diagram.edges.filter(
        (e) => !graphResult.droppedEdges.some((d) => d.id === e.id),
      );
      warnings.push(
        `Recovered session contained errors and was sanitized: removed ${graphResult.droppedEdges.length} invalid connection(s).`,
      );
    }

    return { diagram, ...(warnings.length > 0 ? { warnings } : {}) };
  } catch {
    backupCorrupted(raw);
    return {
      diagram: null,
      error: 'Saved data was corrupted and could not be loaded',
    };
  }
}

export function clearDiagram(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

function backupCorrupted(raw: string): void {
  try {
    localStorage.setItem(`sketchy_backup_${Date.now()}`, raw);
  } catch {
    // If backup also fails (storage full), we can't do anything
  }
}
