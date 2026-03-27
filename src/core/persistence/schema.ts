import { SCHEMA_VERSION } from '../types';
import type { Diagram } from '../types';
import { migrations } from './migrations';

export function migrate(data: Record<string, unknown>): Diagram {
  let version = (data.schemaVersion as number) ?? 0;

  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Schema version ${version} is newer than supported (${SCHEMA_VERSION})`,
    );
  }

  let result = data;
  while (version < SCHEMA_VERSION) {
    const migrator = migrations[version];
    if (!migrator) {
      throw new Error(`No migration from version ${version}`);
    }
    result = migrator(result);
    version++;
  }

  return result as unknown as Diagram;
}

export function validateDiagramShape(data: unknown): data is Diagram {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.schemaVersion === 'number' &&
    typeof d.id === 'string' &&
    typeof d.frameworkId === 'string' &&
    Array.isArray(d.nodes) &&
    Array.isArray(d.edges)
  );
}
