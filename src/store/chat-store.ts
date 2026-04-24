import { create } from 'zustand';
import type { ChatDocument, ChatImage, ChatMessage, DiagramModification } from '../core/ai/openai-client';
import type { FrameworkSuggestions } from '../core/ai/ai-types';
import { streamChatMessage } from '../core/ai/openai-client';
import { getFramework } from '../frameworks/registry';
import { useSettingsStore } from './settings-store';
import { useDiagramStore } from './diagram-store';
import { resolveFramework } from './diagram-helpers';
import { createAssistantMessage, processStreamDone, reportStreamError } from './chat-stream-handlers';
import type { ErrorMetadataContext } from './chat-stream-handlers';
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

interface ChatState {
  messages: DisplayMessage[];
  loading: boolean;
  streamingContent: string;
  aiModifiedNodeIds: Set<string>;
  pendingSuggestions: FrameworkSuggestions | null;

  sendMessage: (text: string, image?: ChatImage, displayText?: string, document?: ChatDocument) => void;
  cancelStream: () => void;
  clearMessages: () => void;
  clearAiModified: () => void;
  removeAiModified: (nodeId: string) => void;
  acceptSuggestion: (frameworkId: string) => void;
}

let activeController: AbortController | null = null;
let activeRequestId = 0;
const CHAT_STORAGE_KEY = 'sketchy_chat';

interface PersistedChatState {
  messages: DisplayMessage[];
  aiModifiedNodeIds: string[];
  pendingSuggestions?: FrameworkSuggestions | null;
}

function getInitialChatState(): Pick<ChatState, 'messages' | 'aiModifiedNodeIds' | 'pendingSuggestions'> {
  if (typeof window === 'undefined') {
    return { messages: [], aiModifiedNodeIds: new Set(), pendingSuggestions: null };
  }

  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      return { messages: [], aiModifiedNodeIds: new Set(), pendingSuggestions: null };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedChatState>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      aiModifiedNodeIds: new Set(
        Array.isArray(parsed.aiModifiedNodeIds)
          ? parsed.aiModifiedNodeIds.filter((id): id is string => typeof id === 'string')
          : [],
      ),
      pendingSuggestions: parsed.pendingSuggestions ?? null,
    };
  } catch {
    try {
      window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures
    }
    return { messages: [], aiModifiedNodeIds: new Set(), pendingSuggestions: null };
  }
}

function serializeChatState(state: Pick<ChatState, 'messages' | 'aiModifiedNodeIds' | 'pendingSuggestions'>): string {
  return JSON.stringify({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    messages: state.messages.map(({ images, documents, ...rest }) => rest),
    aiModifiedNodeIds: Array.from(state.aiModifiedNodeIds),
    pendingSuggestions: state.pendingSuggestions,
  } satisfies PersistedChatState);
}

function persistChatState(state: Pick<ChatState, 'messages' | 'aiModifiedNodeIds' | 'pendingSuggestions'>): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, serializeChatState(state));
  } catch {
    // Ignore storage quota / availability issues
  }
}

function buildConversationHistory(messages: DisplayMessage[]): ChatMessage[] {
  return messages
    .filter((message) => !(message.role === 'assistant' && message.retryText))
    .map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.images?.length ? { images: message.images } : {}),
      ...(message.documents?.length ? { documents: message.documents } : {}),
    }));
}

function invalidateActiveRequest(options: { abort?: boolean } = {}): void {
  activeRequestId += 1;

  if (options.abort && activeController) {
    activeController.abort();
  }

  activeController = null;
}

function isActiveRequest(requestId: number, diagramId: string): boolean {
  return activeRequestId === requestId && useDiagramStore.getState().diagram.id === diagramId;
}


export const useChatStore = create<ChatState>((set, get) => ({
  ...getInitialChatState(),
  loading: false,
  streamingContent: '',

  sendMessage: (text, image, displayText, document) => {
    const { openaiApiKey, baseUrl, model, provider } = useSettingsStore.getState();
    if (!baseUrl || !model) {
      set((s) => ({
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: 'user', content: text },
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Please configure your API endpoint and model in settings (cog icon in the toolbar).',
          },
        ],
      }));
      return;
    }

    invalidateActiveRequest({ abort: true });

    // If user types while a suggestion is pending, they're responding conversationally
    if (get().pendingSuggestions) {
      set({ pendingSuggestions: null });
    }

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      ...(displayText ? { displayText } : {}),
      ...(image ? { images: [image] } : {}),
      ...(document ? { documents: [document] } : {}),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      loading: true,
      streamingContent: '',
    }));

    const { diagram } = useDiagramStore.getState();
    const framework = resolveFramework(diagram.frameworkId);
    const requestId = activeRequestId + 1;
    const requestDiagramId = diagram.id;
    activeRequestId = requestId;

    // Build conversation history
    const history = buildConversationHistory(get().messages);

    const errorCtx: ErrorMetadataContext = {
      provider,
      model,
      baseUrl,
      frameworkId: framework.id,
      historyCount: history.length,
      userMessageLength: text.length,
    };

    const controller = streamChatMessage(
      openaiApiKey,
      baseUrl,
      model,
      diagram,
      framework,
      history,
      {
        onToken: (token) => {
          if (!isActiveRequest(requestId, requestDiagramId)) return;
          set((s) => ({ streamingContent: s.streamingContent + token }));
        },

        onDone: (result) => {
          if (!isActiveRequest(requestId, requestDiagramId)) return;
          if (activeController === controller) {
            activeController = null;
          }

          try {
            const outcome = processStreamDone(result, diagram, framework, errorCtx, get().streamingContent.length);
            set((s) => ({
              messages: [...s.messages, outcome.assistantMsg],
              loading: false,
              streamingContent: '',
              ...(outcome.pendingSuggestions ? { pendingSuggestions: outcome.pendingSuggestions } : {}),
            }));
          } catch (processingError) {
            const err = processingError instanceof Error ? processingError : new Error(String(processingError));
            reportStreamError(err, errorCtx);
            try {
              const fallback = createAssistantMessage(`Error: ${err.message}`, { retryText: text });
              set((s) => ({
                messages: [...s.messages, fallback],
                loading: false,
                streamingContent: '',
              }));
            } catch {
              set({ loading: false, streamingContent: '' });
            }
          }
        },

        onError: (error) => {
          if (!isActiveRequest(requestId, requestDiagramId)) return;
          if (activeController === controller) {
            activeController = null;
          }
          reportStreamError(error, errorCtx);
          try {
            const errorMsg = createAssistantMessage(`Error: ${error.message}`, { retryText: text });
            set((s) => ({
              messages: [...s.messages, errorMsg],
              loading: false,
              streamingContent: '',
            }));
          } catch {
            set({ loading: false, streamingContent: '' });
          }
        },
      },
      provider,
      true,
    );
    activeController = controller;
  },

  cancelStream: () => {
    const requestId = activeRequestId;
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
    if (activeRequestId === requestId) {
      activeRequestId += 1;
    }
    const streaming = get().streamingContent;
    if (streaming) {
      const partialMsg = createAssistantMessage(streaming);
      set((s) => ({
        messages: [...s.messages, partialMsg],
        loading: false,
        streamingContent: '',
      }));
    } else {
      set({ loading: false, streamingContent: '' });
    }
  },

  clearMessages: () => {
    invalidateActiveRequest({ abort: true });
    set({ messages: [], loading: false, streamingContent: '', pendingSuggestions: null });
  },
  clearAiModified: () => set({ aiModifiedNodeIds: new Set() }),
  removeAiModified: (nodeId) =>
    set((s) => {
      const next = new Set(s.aiModifiedNodeIds);
      next.delete(nodeId);
      return { aiModifiedNodeIds: next };
    }),

  acceptSuggestion: (frameworkId) => {
    const { pendingSuggestions } = get();
    if (!pendingSuggestions) return;

    const chosen = pendingSuggestions.find((s) => s.frameworkId === frameworkId);
    if (!chosen) return;

    const fw = getFramework(frameworkId);
    if (!fw) return;

    // Capture diagram content before setFramework resets it
    const { diagram: prevDiagram } = useDiagramStore.getState();
    let priorContext = '';
    if (prevDiagram.nodes.length > 0 || prevDiagram.edges.length > 0) {
      const nodeLabels = prevDiagram.nodes
        .map((n) => n.data.label)
        .filter(Boolean);
      const edgeDescs = prevDiagram.edges.map((e) => {
        const src = prevDiagram.nodes.find((n) => n.id === e.source)?.data.label ?? e.source;
        const tgt = prevDiagram.nodes.find((n) => n.id === e.target)?.data.label ?? e.target;
        return `${src} → ${tgt}`;
      });
      priorContext = `\n\nThe previous diagram "${prevDiagram.name}" (${prevDiagram.frameworkId}) had these elements:\nNodes: ${nodeLabels.join(', ')}\nEdges: ${edgeDescs.join(', ')}\n\nUse this content as the basis for the new diagram.`;
    }

    useDiagramStore.getState().setFramework(frameworkId);
    set({ pendingSuggestions: null });

    const cleanText = `Let's use ${fw.name}. Build the diagram based on what I've described, or ask me for more details if needed.`;
    get().sendMessage(
      cleanText + priorContext,
      undefined,
      priorContext ? cleanText : undefined,
    );
  },
}));

let lastPersistedChatState = serializeChatState(useChatStore.getState());

if (typeof window !== 'undefined') {
  useChatStore.subscribe((state) => {
    const nextSerialized = serializeChatState(state);
    if (nextSerialized === lastPersistedChatState) return;
    lastPersistedChatState = nextSerialized;
    persistChatState(state);
  });
}

