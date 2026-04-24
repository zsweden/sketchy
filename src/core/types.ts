export const SCHEMA_VERSION = 7;

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
  annotations: Annotation[];
}

export type AnnotationKind = 'text' | 'rect' | 'ellipse' | 'line';

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: {
    text?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fontSize?: number;
    textColor?: string;
    flipped?: boolean;
  };
}

export interface DiagramSettings {
  layoutDirection: 'TB' | 'BT' | 'LR' | 'RL';
  showGrid: boolean;
  snapToGrid: boolean;
  edgeRoutingMode: EdgeRoutingMode;
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
    value?: number;
    unit?: string;
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
  edgeTag?: string;
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
    },
    nodes: [],
    edges: [],
    annotations: [],
  };
}
