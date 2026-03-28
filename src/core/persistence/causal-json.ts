import type { Diagram, DiagramNode, DiagramEdge } from '../types';
import { SCHEMA_VERSION } from '../types';

interface CausalNode {
  id: string;
  label: string;
  isUDE?: boolean;
  notes?: string;
}

interface CausalEdge {
  source: string;
  target: string;
}

interface CausalJunction {
  target: string;
  type: 'and';
  sources: string[];
}

interface CausalJson {
  nodes: CausalNode[];
  edges: CausalEdge[];
  junctions?: CausalJunction[];
}

export function isCausalJson(data: unknown): data is CausalJson {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;

  // Reject full diagram format
  if ('schemaVersion' in d) return false;

  if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) return false;

  // Must have at least one node with a `label` field (not `data.label`)
  if (d.nodes.length === 0) return false;
  const first = d.nodes[0] as Record<string, unknown>;
  return typeof first.label === 'string';
}

export function convertCausalJson(data: CausalJson): Diagram {
  const andTargets = new Set(
    (data.junctions ?? []).map((j) => j.target),
  );

  const nodes: DiagramNode[] = data.nodes.map((n) => ({
    id: n.id,
    type: 'entity' as const,
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      tags: n.isUDE ? ['ude'] : [],
      junctionType: andTargets.has(n.id) ? ('and' as const) : ('or' as const),
      ...(n.notes ? { notes: n.notes } : {}),
    },
  }));

  const edges: DiagramEdge[] = data.edges.map((e, i) => ({
    id: `e${i + 1}`,
    source: e.source,
    target: e.target,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: 'Imported Diagram',
    frameworkId: 'crt',
    settings: {
      layoutDirection: 'BT',
      showGrid: true,
    },
    nodes,
    edges,
  };
}
