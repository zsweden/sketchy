export const SCHEMA_VERSION = 5;

export type EdgeRoutingMode = 'dynamic' | 'fixed';
export type CardinalHandleSide = 'top' | 'right' | 'bottom' | 'left';
export type EdgeHandleSide =
  | CardinalHandleSide
  | 'topleft-top'
  | 'topleft-left'
  | 'topright-top'
  | 'topright-right'
  | 'bottomleft-bottom'
  | 'bottomleft-left'
  | 'bottomright-bottom'
  | 'bottomright-right';

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
  layoutDirection: 'TB' | 'BT' | 'LR' | 'RL';
  showGrid: boolean;
  snapToGrid: boolean;
  edgeRoutingMode: EdgeRoutingMode;
  showActiveAttachments: boolean;
}

export type JunctionType = 'and' | 'or' | 'add' | 'multiply';

export interface DiagramNode {
  id: string;
  type: 'entity';
  position: { x: number; y: number };
  data: {
    label: string;
    tags: string[];
    junctionType: JunctionType;
    notes?: string;
    color?: string;
    textColor?: string;
    locked?: boolean;
  };
}

export type EdgeConfidence = 'high' | 'medium' | 'low';
export type EdgePolarity = 'positive' | 'negative';

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceSide?: EdgeHandleSide;
  targetSide?: EdgeHandleSide;
  confidence?: EdgeConfidence;
  polarity?: EdgePolarity;
  delay?: boolean;
  notes?: string;
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
      snapToGrid: false,
      edgeRoutingMode: 'fixed',
      showActiveAttachments: true,
    },
    nodes: [],
    edges: [],
  };
}
