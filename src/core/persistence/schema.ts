import { SCHEMA_VERSION } from '../types';
import type {
  Annotation,
  AnnotationKind,
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSettings,
  EdgeConfidence,
  EdgePolarity,
  JunctionType,
} from '../types';
import { migrations } from './migrations';
import { isHandleSide } from '../graph/ports';

const LAYOUT_DIRECTIONS = ['TB', 'BT', 'LR', 'RL'] as const;
const EDGE_ROUTING_MODES = ['dynamic', 'fixed'] as const;
const JUNCTION_TYPES = ['and', 'or', 'add', 'multiply'] as const;
const EDGE_CONFIDENCE = ['high', 'medium', 'low'] as const;
const EDGE_POLARITY = ['positive', 'negative'] as const;
const ANNOTATION_KINDS = ['text', 'rect', 'ellipse', 'line'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePosition(raw: unknown): { x: number; y: number } {
  const position = isRecord(raw) ? raw : {};
  return {
    x: isFiniteNumber(position.x) ? position.x : 0,
    y: isFiniteNumber(position.y) ? position.y : 0,
  };
}

function normalizeSize(raw: unknown): { width: number; height: number } | undefined {
  if (!isRecord(raw)) return undefined;
  if (!isFiniteNumber(raw.width) || !isFiniteNumber(raw.height)) return undefined;
  if (raw.width <= 0 || raw.height <= 0) return undefined;
  return { width: raw.width, height: raw.height };
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value
    : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string')));
}

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

function normalizeNodes(raw: unknown): DiagramNode[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): DiagramNode[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) {
      return [];
    }
    const data = isRecord(entry.data) ? entry.data : {};
    const size = normalizeSize(entry.size);
    const node: DiagramNode = {
      id: entry.id,
      type: 'entity',
      position: normalizePosition(entry.position),
      ...(size ? { size } : {}),
      data: {
        label: typeof data.label === 'string' ? data.label : '',
        tags: normalizeStringArray(data.tags),
        junctionType: enumValue(data.junctionType, JUNCTION_TYPES, 'or') as JunctionType,
        ...(optionalString(data.notes) ? { notes: optionalString(data.notes) } : {}),
        ...(isFiniteNumber(data.value) ? { value: data.value } : {}),
        ...(optionalString(data.unit) ? { unit: optionalString(data.unit) } : {}),
        ...(optionalString(data.color) ? { color: optionalString(data.color) } : {}),
        ...(optionalString(data.textColor) ? { textColor: optionalString(data.textColor) } : {}),
        ...(data.locked === true ? { locked: true } : {}),
      },
    };
    return [node];
  });
}

function normalizeEdges(raw: unknown): DiagramEdge[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry, index): DiagramEdge[] => {
    if (!isRecord(entry) || typeof entry.source !== 'string' || typeof entry.target !== 'string') {
      return [];
    }
    const sourceSide = typeof entry.sourceSide === 'string' && isHandleSide(entry.sourceSide)
      ? entry.sourceSide
      : undefined;
    const targetSide = typeof entry.targetSide === 'string' && isHandleSide(entry.targetSide)
      ? entry.targetSide
      : undefined;
    const edge: DiagramEdge = {
      id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : `edge-${index + 1}`,
      source: entry.source,
      target: entry.target,
      ...(sourceSide ? { sourceSide } : {}),
      ...(targetSide ? { targetSide } : {}),
      ...(typeof entry.confidence === 'string' && (EDGE_CONFIDENCE as readonly string[]).includes(entry.confidence)
        ? { confidence: entry.confidence as EdgeConfidence }
        : {}),
      ...(typeof entry.polarity === 'string' && (EDGE_POLARITY as readonly string[]).includes(entry.polarity)
        ? { polarity: entry.polarity as EdgePolarity }
        : {}),
      ...(entry.delay === true ? { delay: true } : {}),
      ...(optionalString(entry.edgeTag) ? { edgeTag: optionalString(entry.edgeTag) } : {}),
      ...(optionalString(entry.notes) ? { notes: optionalString(entry.notes) } : {}),
    };
    return [edge];
  });
}

function normalizeAnnotationData(raw: unknown): Annotation['data'] {
  const data = isRecord(raw) ? raw : {};
  return {
    ...(optionalString(data.text) ? { text: optionalString(data.text) } : {}),
    ...(optionalString(data.fill) ? { fill: optionalString(data.fill) } : {}),
    ...(optionalString(data.stroke) ? { stroke: optionalString(data.stroke) } : {}),
    ...(isFiniteNumber(data.strokeWidth) && data.strokeWidth >= 0 ? { strokeWidth: data.strokeWidth } : {}),
    ...(isFiniteNumber(data.fontSize) && data.fontSize > 0 ? { fontSize: data.fontSize } : {}),
    ...(optionalString(data.textColor) ? { textColor: optionalString(data.textColor) } : {}),
    ...(data.flipped === true ? { flipped: true } : {}),
  };
}

function normalizeAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry, index): Annotation[] => {
    if (!isRecord(entry)) return [];
    const kind = enumValue(entry.kind, ANNOTATION_KINDS, 'rect') as AnnotationKind;
    const data = normalizeAnnotationData(entry.data);
    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : `annotation-${index + 1}`;

    if (kind === 'line') {
      const legacyPosition = normalizePosition(entry.position);
      const legacySize = normalizeSize(entry.size) ?? { width: 200, height: 120 };
      const start = isRecord(entry.start)
        ? normalizePosition(entry.start)
        : legacyPosition;
      const end = isRecord(entry.end)
        ? normalizePosition(entry.end)
        : data.flipped
          ? { x: legacyPosition.x + legacySize.width, y: legacyPosition.y }
          : { x: legacyPosition.x + legacySize.width, y: legacyPosition.y + legacySize.height };

      return [{
        id,
        kind,
        start,
        end,
        data,
      }];
    }

    const size = normalizeSize(entry.size);
    if (!size) return [];
    return [{
      id,
      kind,
      position: normalizePosition(entry.position),
      size,
      data,
    }];
  });
}

function normalizeDiagramShape(diagram: Diagram): Diagram {
  return {
    ...diagram,
    name: typeof diagram.name === 'string' && diagram.name.length > 0 ? diagram.name : 'Untitled Diagram',
    settings: normalizeSettings(diagram.settings),
    nodes: normalizeNodes(diagram.nodes),
    edges: normalizeEdges(diagram.edges),
    annotations: normalizeAnnotations(diagram.annotations),
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
  return normalizeDiagramShape({ ...migrated, settings: normalizeSettings(migrated.settings) });
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
