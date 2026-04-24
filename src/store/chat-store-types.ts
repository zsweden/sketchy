import type { FrameworkSuggestions } from '../core/ai/ai-types';
import type {
  ChatDocument,
  ChatImage,
  ChatMessage,
  DiagramModification,
} from '../core/ai/openai-client';
import type { ParsedChatSegment } from '../core/chat/mentions';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayText?: string;
  segments?: ParsedChatSegment[];
  images?: ChatImage[];
  documents?: ChatDocument[];
  modifications?: DiagramModification;
  suggestions?: FrameworkSuggestions;
  retryText?: string;
}

export interface PersistableChatState {
  messages: DisplayMessage[];
  aiModifiedNodeIds: Set<string>;
  pendingSuggestions: FrameworkSuggestions | null;
}

export interface PersistedChatState {
  messages: DisplayMessage[];
  aiModifiedNodeIds: string[];
  pendingSuggestions?: FrameworkSuggestions | null;
}

export type ConversationHistoryMessage = ChatMessage;
