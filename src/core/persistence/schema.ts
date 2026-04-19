import { SCHEMA_VERSION } from '../types';
import type { Diagram, DiagramSettings } from '../types';
import { migrations } from './migrations';

const LAYOUT_DIRECTIONS = ['TB', 'BT', 'LR', 'RL'] as const;
const EDGE_ROUTING_MODES = ['dynamic', 'fixed'] as const;

function normalizeSettings(raw: unknown): DiagramSettings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const layoutDirection = (LAYOUT_DIRECTIONS as readonly string[]).includes(s.layoutDirection as string)
    ? (s.layoutDirection as DiagramSettings['layoutDirection'])
    : 'BT';
  const edgeRoutingMode = (EDGE_ROUTING_MODES as readonly string[]).includes(s.edgeRoutingMode as string)
    ? (s.edgeRoutingMode as DiagramSettings['edgeRoutingMode'])
    : 'dynamic';
  return {
    layoutDirection,
    showGrid: typeof s.showGrid === 'boolean' ? s.showGrid : true,
    snapToGrid: typeof s.snapToGrid === 'boolean' ? s.snapToGrid : false,
    edgeRoutingMode,
  };
}

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

  const migrated = result as unknown as Diagram;
  return { ...migrated, settings: normalizeSettings(migrated.settings) };
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
