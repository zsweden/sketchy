import {
  isHandleSide,
  isLegacyCornerHandleSide,
  normalizeLegacyHandleSide,
} from '../graph/ports';

function getPosition(node: Record<string, unknown>): { x: number; y: number } {
  const position = typeof node.position === 'object' && node.position !== null
    ? node.position as Record<string, unknown>
    : null;

  return {
    x: typeof position?.x === 'number' ? position.x : 0,
    y: typeof position?.y === 'number' ? position.y : 0,
  };
}

function getMigratableHandleSide(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return isHandleSide(value) || isLegacyCornerHandleSide(value) ? value : undefined;
}

// Each key is a source version; the function migrates to version + 1.
export const migrations: Record<
  number,
  (data: Record<string, unknown>) => Record<string, unknown>
> = {
  1: (data) => {
    const edges = (data.edges as Array<Record<string, unknown>>) ?? [];
    return {
      ...data,
      schemaVersion: 2,
      edges: edges.map((e) => ({ ...e, confidence: e.confidence ?? 'high' })),
    };
  },
  2: (data) => {
    const settings = (data.settings as Record<string, unknown> | undefined) ?? {};
    return {
      ...data,
      schemaVersion: 3,
      settings: {
        ...settings,
        edgeRoutingMode: settings.edgeRoutingMode ?? 'dynamic',
      },
    };
  },
  3: (data) => {
    // Migration 3→4 adds handle side normalization for edges
    const nodes = (data.nodes as Array<Record<string, unknown>>) ?? [];
    const edges = (data.edges as Array<Record<string, unknown>>) ?? [];
    const positions = new Map(nodes.map((node) => [String(node.id ?? ''), getPosition(node)]));

    return {
      ...data,
      schemaVersion: 4,
      edges: edges.map((edge) => {
        const sourceId = String(edge.source ?? '');
        const targetId = String(edge.target ?? '');
        const sourcePosition = positions.get(sourceId) ?? { x: 0, y: 0 };
        const targetPosition = positions.get(targetId) ?? { x: 0, y: 0 };
        const sourceSide = normalizeLegacyHandleSide(
          getMigratableHandleSide(edge.sourceSide),
          targetPosition.x - sourcePosition.x,
          targetPosition.y - sourcePosition.y,
        );
        const targetSide = normalizeLegacyHandleSide(
          getMigratableHandleSide(edge.targetSide),
          sourcePosition.x - targetPosition.x,
          sourcePosition.y - targetPosition.y,
        );

        return {
          ...edge,
          ...(sourceSide ? { sourceSide } : {}),
          ...(targetSide ? { targetSide } : {}),
        };
      }),
    };
  },
  4: (data) => {
    return {
      ...data,
      schemaVersion: 5,
    };
  },
  5: (data) => {
    // Migration 5→6: node value/unit fields are optional, no data transform needed.
    return { ...data, schemaVersion: 6 };
  },
  6: (data) => {
    // Migration 6→7: introduces the annotation layer (decorative shapes).
    return {
      ...data,
      schemaVersion: 7,
      annotations: Array.isArray(data.annotations) ? data.annotations : [],
    };
  },
};
