import type { Diagram, DiagramNode, DiagramEdge, EdgeConfidence } from '../types';
import { SCHEMA_VERSION } from '../types';

// --- Unified .sky format types ---

interface SkyNode {
  id: string;
  label: string;
  tags?: string[];
  isUDE?: boolean;
  notes?: string;
  color?: string;
  x?: number;
  y?: number;
}

interface SkyEdge {
  source: string;
  target: string;
  confidence?: EdgeConfidence;
}

interface SkyJunction {
  target: string;
  type: 'and';
  sources: string[];
}

export interface SkyJson {
  name?: string;
  framework?: string;
  direction?: 'TB' | 'BT';
  showGrid?: boolean;
  version?: number;
  createdAt?: string;
  nodes: SkyNode[];
  edges: SkyEdge[];
  junctions?: SkyJunction[];
}

// --- Detection ---

export function isSkyJson(data: unknown): data is SkyJson {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;

  // Reject old .sky wrapper format and raw diagram format
  if ('format' in d || 'schemaVersion' in d) return false;

  if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) return false;

  // Must have at least one node with a `label` field (not `data.label`)
  if (d.nodes.length === 0) return false;
  const first = d.nodes[0] as Record<string, unknown>;
  return typeof first.label === 'string';
}

// --- Convert from SkyJson → internal Diagram ---

export function convertSkyJson(data: SkyJson): { diagram: Diagram; needsLayout: boolean } {
  const andTargets = new Set(
    (data.junctions ?? []).map((j) => j.target),
  );

  const allHavePositions = data.nodes.every(
    (n) => typeof n.x === 'number' && typeof n.y === 'number',
  );

  const nodes: DiagramNode[] = data.nodes.map((n) => ({
    // Preserve generic framework tags while keeping legacy isUDE compatibility.
    id: n.id,
    type: 'entity' as const,
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: {
      label: n.label,
      tags: Array.from(
        new Set([
          ...(Array.isArray(n.tags) ? n.tags.filter((tag): tag is string => typeof tag === 'string') : []),
          ...(n.isUDE ? ['ude'] : []),
        ]),
      ),
      junctionType: andTargets.has(n.id) ? ('and' as const) : ('or' as const),
      ...(n.notes ? { notes: n.notes } : {}),
      ...(n.color ? { color: n.color } : {}),
    },
  }));

  const edges: DiagramEdge[] = data.edges.map((e, i) => ({
    id: `e${i + 1}`,
    source: e.source,
    target: e.target,
    ...(e.confidence ? { confidence: e.confidence } : {}),
  }));

  const diagram: Diagram = {
    schemaVersion: data.version ?? SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: data.name ?? 'Untitled Diagram',
    frameworkId: data.framework ?? 'crt',
    settings: {
      layoutDirection: data.direction ?? 'BT',
      showGrid: data.showGrid ?? true,
    },
    nodes,
    edges,
  };

  return { diagram, needsLayout: !allHavePositions };
}

// --- Convert from internal Diagram → SkyJson for saving ---

export function diagramToSkyJson(diagram: Diagram): SkyJson {
  const andNodeIds = new Set<string>();
  const junctionSources = new Map<string, string[]>();

  // Build junction info from nodes with junctionType 'and' and 2+ incoming edges
  const incomingMap = new Map<string, string[]>();
  for (const e of diagram.edges) {
    const arr = incomingMap.get(e.target) ?? [];
    arr.push(e.source);
    incomingMap.set(e.target, arr);
  }

  for (const node of diagram.nodes) {
    const incoming = incomingMap.get(node.id) ?? [];
    if (node.data.junctionType === 'and' && incoming.length >= 2) {
      andNodeIds.add(node.id);
      junctionSources.set(node.id, incoming);
    }
  }

  const nodes: SkyNode[] = diagram.nodes.map((n) => ({
    id: n.id,
    label: n.data.label,
    ...(n.data.tags.length > 0 ? { tags: n.data.tags } : {}),
    ...(n.data.tags.includes('ude') ? { isUDE: true } : {}),
    ...(n.data.notes ? { notes: n.data.notes } : {}),
    ...(n.data.color ? { color: n.data.color } : {}),
    x: n.position.x,
    y: n.position.y,
  }));

  const edges: SkyEdge[] = diagram.edges.map((e) => ({
    source: e.source,
    target: e.target,
    ...(e.confidence && e.confidence !== 'high' ? { confidence: e.confidence } : {}),
  }));

  const junctions: SkyJunction[] = [];
  for (const [target, sources] of junctionSources) {
    junctions.push({ target, type: 'and', sources });
  }

  return {
    name: diagram.name,
    framework: diagram.frameworkId,
    direction: diagram.settings.layoutDirection,
    showGrid: diagram.settings.showGrid,
    version: diagram.schemaVersion,
    createdAt: new Date().toISOString(),
    nodes,
    edges,
    ...(junctions.length > 0 ? { junctions } : {}),
  };
}
