import type { EdgePolarity } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DiagramModification {
  addNodes: {
    id: string;
    label: string;
    tags?: string[];
    notes?: string;
    color?: string | null;
    textColor?: string | null;
  }[];
  updateNodes: {
    id: string;
    label?: string;
    tags?: string[];
    notes?: string;
    color?: string | null;
    textColor?: string | null;
  }[];
  removeNodeIds: string[];
  addEdges: {
    source: string;
    target: string;
    confidence?: 'high' | 'medium' | 'low';
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  updateEdges: {
    id: string;
    confidence?: 'high' | 'medium' | 'low';
    polarity?: EdgePolarity;
    delay?: boolean;
    notes?: string;
  }[];
  removeEdgeIds: string[];
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (result: { text: string; modifications?: DiagramModification }) => void;
  onError: (error: Error) => void;
}
