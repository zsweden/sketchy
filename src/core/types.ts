export const SCHEMA_VERSION = 2;

export interface Diagram {
  schemaVersion: number;
  id: string;
  name: string;
  frameworkId: string;
  settings: DiagramSettings;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface DiagramSettings {
  layoutDirection: 'TB' | 'BT';
  showGrid: boolean;
}

export interface DiagramNode {
  id: string;
  type: 'entity';
  position: { x: number; y: number };
  data: {
    label: string;
    tags: string[];
    junctionType: 'and' | 'or';
    notes?: string;
    color?: string;
  };
}

export type EdgeConfidence = 'high' | 'medium' | 'low';

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  confidence?: EdgeConfidence;
}

export function createEmptyDiagram(frameworkId: string, id?: string): Diagram {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: id ?? crypto.randomUUID(),
    name: 'Untitled Diagram',
    frameworkId,
    settings: {
      layoutDirection: 'BT',
      showGrid: true,
    },
    nodes: [],
    edges: [],
  };
}
