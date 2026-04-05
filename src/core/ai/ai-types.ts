import type { EdgePolarity, JunctionType } from '../types';

export type ChatImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export interface ChatImage {
  mediaType: ChatImageMediaType;
  base64: string;
}

export interface ChatDocument {
  filename: string;
  mediaType: 'application/pdf';
  base64: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ChatImage[];
  documents?: ChatDocument[];
}

export interface DiagramModification {
  addNodes: {
    id: string;
    label: string;
    tags?: string[];
    notes?: string;
    color?: string | null;
    textColor?: string | null;
    junctionType?: JunctionType;
  }[];
  updateNodes: {
    id: string;
    label?: string;
    tags?: string[];
    notes?: string;
    color?: string | null;
    textColor?: string | null;
    junctionType?: JunctionType;
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

export interface FrameworkSuggestion {
  frameworkId: string;
  frameworkName: string;
  reason: string;
}

export type FrameworkSuggestions = FrameworkSuggestion[];

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (result: { text: string; modifications?: DiagramModification; suggestions?: FrameworkSuggestions }) => void;
  onError: (error: Error) => void;
}
