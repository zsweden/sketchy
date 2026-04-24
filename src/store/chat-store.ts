import { create } from 'zustand';
import type { ChatDocument, ChatImage } from '../core/ai/openai-client';
import { streamChatMessage } from '../core/ai/openai-client';
import { getFramework } from '../frameworks/registry';
import { useSettingsStore } from './settings-store';
import { useDiagramStore } from './diagram-store';
import { resolveFramework } from './diagram-framework';
import {
  createAssistantMessage,
  processStreamDone,
  reportStreamError,
} from './chat-stream-handlers';
import type { ErrorMetadataContext } from './chat-stream-handlers';
import { buildConversationHistory } from './chat-conversation';
import {
  attachChatRequestController,
  beginChatRequest,
  cancelActiveChatRequest,
  isChatRequestActive,
  releaseChatRequestController,
} from './chat-request-controller';
import {
  getInitialChatState,
  installChatStorePersistence,
} from './chat-store-persistence';
import type {
  DisplayMessage,
  PersistableChatState,
} from './chat-store-types';

export type { DisplayMessage } from './chat-store-types';

interface ChatState extends PersistableChatState {
  loading: boolean;
  streamingContent: string;
  sendMessage: (
    text: string,
    image?: ChatImage,
    displayText?: string,
    document?: ChatDocument,
  ) => void;
  cancelStream: () => void;
  clearMessages: () => void;
  clearAiModified: () => void;
  removeAiModified: (nodeId: string) => void;
  acceptSuggestion: (frameworkId: string) => void;
}

function createMissingConfigMessages(text: string): DisplayMessage[] {
  return [
    { id: crypto.randomUUID(), role: 'user', content: text },
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        'Please configure your API endpoint and model in settings (cog icon in the toolbar).',
    },
  ];
}

function createUserMessage(
  text: string,
  image?: ChatImage,
  displayText?: string,
  document?: ChatDocument,
): DisplayMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    ...(displayText ? { displayText } : {}),
    ...(image ? { images: [image] } : {}),
    ...(document ? { documents: [document] } : {}),
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...getInitialChatState(),
  loading: false,
  streamingContent: '',

  sendMessage: (text, image, displayText, document) => {
    const { openaiApiKey, baseUrl, model, provider } = useSettingsStore.getState();
    if (!baseUrl || !model) {
      set((state) => ({
        messages: [...state.messages, ...createMissingConfigMessages(text)],
      }));
      return;
    }

    const { diagram } = useDiagramStore.getState();
    const framework = resolveFramework(diagram.frameworkId);
    const request = beginChatRequest(diagram.id, { abortPrevious: true });

    if (get().pendingSuggestions) {
      set({ pendingSuggestions: null });
    }

    const userMessage = createUserMessage(text, image, displayText, document);
    set((state) => ({
      messages: [...state.messages, userMessage],
      loading: true,
      streamingContent: '',
    }));

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
          if (!isChatRequestActive(request, useDiagramStore.getState().diagram.id)) return;
          set((state) => ({ streamingContent: state.streamingContent + token }));
        },

        onDone: (result) => {
          if (!isChatRequestActive(request, useDiagramStore.getState().diagram.id)) return;
          releaseChatRequestController(request, controller);

          try {
            const outcome = processStreamDone(
              result,
              diagram,
              framework,
              errorCtx,
              get().streamingContent.length,
            );
            set((state) => ({
              messages: [...state.messages, outcome.assistantMsg],
              loading: false,
              streamingContent: '',
              ...(outcome.pendingSuggestions
                ? { pendingSuggestions: outcome.pendingSuggestions }
                : {}),
            }));
          } catch (processingError) {
            const error = processingError instanceof Error
              ? processingError
              : new Error(String(processingError));
            reportStreamError(error, errorCtx);
            try {
              const fallback = createAssistantMessage(`Error: ${error.message}`, {
                retryText: text,
              });
              set((state) => ({
                messages: [...state.messages, fallback],
                loading: false,
                streamingContent: '',
              }));
            } catch {
              set({ loading: false, streamingContent: '' });
            }
          }
        },

        onError: (error) => {
          if (!isChatRequestActive(request, useDiagramStore.getState().diagram.id)) return;
          releaseChatRequestController(request, controller);

          reportStreamError(error, errorCtx);
          try {
            const errorMsg = createAssistantMessage(`Error: ${error.message}`, {
              retryText: text,
            });
            set((state) => ({
              messages: [...state.messages, errorMsg],
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

    attachChatRequestController(request, controller);
  },

  cancelStream: () => {
    cancelActiveChatRequest();

    const streaming = get().streamingContent;
    if (streaming) {
      const partialMsg = createAssistantMessage(streaming);
      set((state) => ({
        messages: [...state.messages, partialMsg],
        loading: false,
        streamingContent: '',
      }));
      return;
    }

    set({ loading: false, streamingContent: '' });
  },

  clearMessages: () => {
    cancelActiveChatRequest();
    set({
      messages: [],
      loading: false,
      streamingContent: '',
      pendingSuggestions: null,
    });
  },

  clearAiModified: () => set({ aiModifiedNodeIds: new Set() }),

  removeAiModified: (nodeId) =>
    set((state) => {
      const next = new Set(state.aiModifiedNodeIds);
      next.delete(nodeId);
      return { aiModifiedNodeIds: next };
    }),

  acceptSuggestion: (frameworkId) => {
    const { pendingSuggestions } = get();
    if (!pendingSuggestions) return;

    const chosen = pendingSuggestions.find((suggestion) => suggestion.frameworkId === frameworkId);
    if (!chosen) return;

    const framework = getFramework(frameworkId);
    if (!framework) return;

    const { diagram: prevDiagram } = useDiagramStore.getState();
    let priorContext = '';
    if (prevDiagram.nodes.length > 0 || prevDiagram.edges.length > 0) {
      const nodeLabels = prevDiagram.nodes
        .map((node) => node.data.label)
        .filter(Boolean);
      const edgeDescs = prevDiagram.edges.map((edge) => {
        const sourceLabel = prevDiagram.nodes.find((node) => node.id === edge.source)?.data.label
          ?? edge.source;
        const targetLabel = prevDiagram.nodes.find((node) => node.id === edge.target)?.data.label
          ?? edge.target;
        return `${sourceLabel} → ${targetLabel}`;
      });
      priorContext = `\n\nThe previous diagram "${prevDiagram.name}" (${prevDiagram.frameworkId}) had these elements:\nNodes: ${nodeLabels.join(', ')}\nEdges: ${edgeDescs.join(', ')}\n\nUse this content as the basis for the new diagram.`;
    }

    useDiagramStore.getState().setFramework(frameworkId);
    set({ pendingSuggestions: null });

    const cleanText = `Let's use ${framework.name}. Build the diagram based on what I've described, or ask me for more details if needed.`;
    get().sendMessage(
      cleanText + priorContext,
      undefined,
      priorContext ? cleanText : undefined,
    );
  },
}));

installChatStorePersistence(useChatStore);
