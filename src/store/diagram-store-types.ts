import type { StoreApi } from 'zustand';
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
} from '../core/types';
import type { UndoRedoManager } from '../core/history/undo-redo';
import type { SizedPositionedItem } from '../utils/align-distribute';

export interface BatchMutations {
  addNodes?: {
    id: string;
    label: string;
    tags?: string[];
    notes?: string;
    value?: number | null;
    unit?: string | null;
    color?: string | null;
    textColor?: string | null;
    junctionType?: JunctionType;
  }[];
  updateNodes?: {
    id: string;
    label?: string;
    tags?: string[];
    notes?: string;
    value?: number | null;
    unit?: string | null;
    color?: string | null;
    textColor?: string | null;
    junctionType?: JunctionType;
  }[];
  removeNodeIds?: string[];
  addEdges?: {
    source: string;
    target: string;
    confidence?: EdgeConfidence;
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  updateEdges?: {
    id: string;
    confidence?: EdgeConfidence;
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  removeEdgeIds?: string[];
  removeAnnotationIds?: string[];
}

export interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  annotations: Annotation[];
}

export interface NodePositionChange {
  id: string;
  position: { x: number; y: number };
}

export interface DiagramState {
  diagram: Diagram;

  addNode: (position: { x: number; y: number }) => string;
  updateNodeText: (id: string, label: string) => void;
  updateNodeTags: (id: string, tags: string[]) => void;
  updateNodeJunction: (id: string, type: JunctionType) => void;
  previewNodeColor: (id: string, color: string | undefined) => void;
  previewNodeTextColor: (id: string, textColor: string | undefined) => void;
  updateNodeColor: (id: string, color: string | undefined) => void;
  updateNodeTextColor: (id: string, textColor: string | undefined) => void;
  updateNodeNotes: (id: string, notes: string) => void;
  commitNodeText: (id: string, label: string) => void;
  commitNodeNotes: (id: string, notes: string) => void;
  commitNodeValue: (id: string, value: number | undefined) => void;
  commitNodeUnit: (id: string, unit: string) => void;
  toggleNodeLocked: (ids: string[], locked: boolean) => void;
  previewNodesColor: (ids: string[], color: string | undefined) => void;
  previewNodesTextColor: (ids: string[], color: string | undefined) => void;
  updateNodesColor: (ids: string[], color: string | undefined) => void;
  updateNodesTextColor: (ids: string[], color: string | undefined) => void;
  updateNodesJunction: (ids: string[], type: JunctionType) => void;
  addNodesTag: (ids: string[], tagId: string) => void;
  removeNodesTag: (ids: string[], tagId: string) => void;
  moveNodes: (changes: NodePositionChange[]) => void;
  dragNodes: (changes: NodePositionChange[]) => void;
  commitDraggedNodes: () => void;
  deleteNodes: (ids: string[]) => void;
  alignNodesHorizontally: (items: SizedPositionedItem[]) => void;
  alignNodesVertically: (items: SizedPositionedItem[]) => void;
  distributeNodesHorizontally: (ids: string[]) => void;
  distributeNodesVertically: (ids: string[]) => void;

  addEdge: (
    source: string,
    target: string,
    handles?: {
      sourceHandleId?: string | null;
      targetHandleId?: string | null;
    },
  ) => { success: boolean; reason?: string };
  deleteEdges: (ids: string[]) => void;
  setEdgeConfidence: (id: string, confidence: EdgeConfidence) => void;
  setEdgePolarity: (id: string, polarity: EdgePolarity) => void;
  setEdgeDelay: (id: string, delay: boolean) => void;
  setEdgeTag: (id: string, edgeTag: string | undefined) => void;
  updateEdgeNotes: (id: string, notes: string) => void;
  commitEdgeNotes: (id: string, notes: string) => void;
  optimizeEdges: () => boolean;
  optimizeEdgesAfterLayout: () => void;
  runAutoLayout: (options?: { commitHistory?: boolean; fitView?: boolean }) => Promise<boolean>;

  addAnnotation: (kind: AnnotationKind, position: { x: number; y: number }) => string;
  updateAnnotationData: (id: string, data: Partial<Annotation['data']>) => void;
  commitAnnotationData: (id: string, data: Partial<Annotation['data']>) => void;
  resizeAnnotation: (
    id: string,
    patch: { size: Annotation['size']; position?: Annotation['position'] },
  ) => void;
  deleteAnnotations: (ids: string[]) => void;

  setFramework: (frameworkId: string) => void;
  updateSettings: (settings: Partial<DiagramSettings>) => void;
  loadDiagram: (diagram: Diagram) => void;
  newDiagram: () => void;
  setDiagramName: (name: string) => void;

  batchApply: (mutations: BatchMutations) => Map<string, string>;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  commitToHistory: () => void;
  /**
   * Push a specific snapshot to the undo stack. Used by interactive flows
   * (e.g., the multi-node color picker) that mutate state via preview actions
   * before the user commits, so the snapshot must capture the pre-preview state.
   */
  pushHistoryEntry: (snapshot: DiagramSnapshot) => void;
}

export type DiagramStoreSet = StoreApi<DiagramState>['setState'];
export type DiagramStoreGet = StoreApi<DiagramState>['getState'];

export interface DiagramStoreContext {
  set: DiagramStoreSet;
  get: DiagramStoreGet;
  history: UndoRedoManager<DiagramSnapshot>;
  undoState: {
    readonly canUndo: true;
    readonly canRedo: false;
  };
  clearPendingNodeMove: () => void;
  pushHistorySnapshot: (snapshotOverride?: DiagramSnapshot) => void;
  setDiagram: (updater: (diagram: Diagram) => Diagram) => void;
  applyDiagramChange: (
    updater: (diagram: Diagram) => Diagram,
    options?: { trackHistory?: boolean },
  ) => void;
  updateNodes: (
    mapper: (node: DiagramNode) => DiagramNode,
    options?: { trackHistory?: boolean },
  ) => void;
  updateEdges: (
    mapper: (edge: DiagramEdge) => DiagramEdge,
    options?: { trackHistory?: boolean },
  ) => void;
  getNodesByIds: (ids: string[]) => DiagramNode[];
  applyNodePositionChanges: (
    changes: NodePositionChange[],
    options?: { trackHistory?: boolean },
  ) => void;
  applyNodePositionTransform: (
    ids: string[],
    transform: (nodes: DiagramNode[]) => NodePositionChange[],
  ) => void;
  moveNodes: (changes: NodePositionChange[]) => void;
  dragNodes: (changes: NodePositionChange[]) => void;
  commitDraggedNodes: () => void;
}
