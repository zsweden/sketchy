import type { Diagram } from '../types';
import { migrateDiagramShape, normalizeLoadedDiagram } from './load-helpers';
import { getWebStorage } from '../../utils/web-storage';

const STORAGE_KEY = 'sketchy_diagram';

export function saveDiagram(diagram: Diagram): void {
  const storage = getWebStorage('sessionStorage');
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(diagram));
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
  const storage = getWebStorage('sessionStorage');
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return { diagram: null };

  try {
    const parsed = JSON.parse(raw);

    const diagram = migrateDiagramShape(parsed);
    if (!diagram) {
      backupCorrupted(raw);
      return {
        diagram: null,
        error: 'Saved data was corrupted and could not be loaded',
      };
    }

    const normalized = normalizeLoadedDiagram(
      diagram,
      (droppedCount) =>
        `Recovered session contained errors and was sanitized: removed ${droppedCount} invalid connection(s).`,
    );

    return {
      diagram: normalized.diagram,
      ...(normalized.warnings.length > 0 ? { warnings: normalized.warnings } : {}),
    };
  } catch {
    backupCorrupted(raw);
    return {
      diagram: null,
      error: 'Saved data was corrupted and could not be loaded',
    };
  }
}

export function clearDiagram(): void {
  getWebStorage('sessionStorage')?.removeItem(STORAGE_KEY);
}

function backupCorrupted(raw: string): void {
  const storage = getWebStorage('localStorage');
  if (!storage) return;

  try {
    storage.setItem(`sketchy_backup_${Date.now()}`, raw);
  } catch {
    // If backup also fails (storage full), we can't do anything
  }
}
