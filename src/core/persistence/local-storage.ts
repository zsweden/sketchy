import type { Diagram } from '../types';
import { migrate, validateDiagramShape } from './schema';

const STORAGE_KEY = 'sketchy_diagram';

export function saveDiagram(diagram: Diagram): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export interface LoadResult {
  diagram: Diagram | null;
  error?: string;
}

export function loadDiagram(): LoadResult {
  const raw = localStorage.getItem(STORAGE_KEY);
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

    const diagram = migrate(parsed);
    return { diagram };
  } catch {
    backupCorrupted(raw);
    return {
      diagram: null,
      error: 'Saved data was corrupted and could not be loaded',
    };
  }
}

export function clearDiagram(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function backupCorrupted(raw: string): void {
  try {
    localStorage.setItem(`sketchy_backup_${Date.now()}`, raw);
  } catch {
    // If backup also fails (storage full), we can't do anything
  }
}
