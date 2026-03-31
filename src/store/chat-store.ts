import { create } from 'zustand';
import type { ChatMessage, DiagramModification } from '../core/ai/openai-client';
import { streamChatMessage } from '../core/ai/openai-client';
import { useSettingsStore } from './settings-store';
import { useDiagramStore } from './diagram-store';
import { useUIStore } from './ui-store';
import { autoLayout, elkEngine } from '../core/layout';
import { reportError } from '../core/monitoring/error-logging';
import { findCausalLoops, labelCausalLoops } from '../core/graph/derived';
import { countMalformedCanonicalMentions, normalizeChatMessageMentions } from '../components/panel/chat-mentions';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modifications?: DiagramModification;
}

interface ChatState {
  messages: DisplayMessage[];
  loading: boolean;
  streamingContent: string;
  aiModifiedNodeIds: Set<string>;

  sendMessage: (text: string) => void;
  cancelStream: () => void;
  clearMessages: () => void;
  clearAiModified: () => void;
  removeAiModified: (nodeId: string) => void;
}

let activeController: AbortController | null = null;
const EMPTY_RESPONSE_FALLBACK = 'The AI returned an empty response. Please try again.';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  streamingContent: '',
  aiModifiedNodeIds: new Set(),

  sendMessage: (text) => {
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

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      loading: true,
      streamingContent: '',
    }));

    const { diagram, framework } = useDiagramStore.getState();

    // Build conversation history
    const history: ChatMessage[] = get().messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    activeController = streamChatMessage(
      openaiApiKey,
      baseUrl,
      model,
      diagram,
      framework,
      history,
      {

        onToken: (token) => {
          set((s) => ({ streamingContent: s.streamingContent + token }));
        },

        onDone: (result) => {
          activeController = null;
          const loops = framework.allowsCycles ? labelCausalLoops(findCausalLoops(diagram.edges)) : [];
          const normalizedText = normalizeChatMessageMentions(
            result.text,
            diagram.nodes,
            diagram.edges,
            loops,
          );
          const malformedMentionCount = countMalformedCanonicalMentions(
            result.text,
            diagram.nodes,
            diagram.edges,
            loops,
          );
          const trimmedText = normalizedText.trim();
          const content = trimmedText || EMPTY_RESPONSE_FALLBACK;

          if (malformedMentionCount > 0) {
            void reportError(new Error('AI chat returned malformed canonical mentions'), {
              source: 'chat.malformed_mention',
              fatal: false,
              metadata: {
                provider,
                model,
                baseUrl,
                frameworkId: framework.id,
                diagramId: diagram.id,
                historyCount: history.length,
                malformedMentionCount,
                resultTextLength: result.text.length,
                normalizedTextLength: normalizedText.length,
              },
            });
          }

          if (!trimmedText) {
            void reportError(new Error('AI chat returned empty assistant response'), {
              source: 'chat.empty_response',
              fatal: false,
              metadata: {
                provider,
                model,
                baseUrl,
                frameworkId: framework.id,
                diagramId: diagram.id,
                historyCount: history.length,
                userMessageLength: text.length,
                streamingLength: get().streamingContent.length,
                resultTextLength: result.text.length,
                normalizedTextLength: normalizedText.length,
                hasModifications: Boolean(result.modifications),
                addedNodes: result.modifications?.addNodes.length ?? 0,
                updatedNodes: result.modifications?.updateNodes.length ?? 0,
                removedNodes: result.modifications?.removeNodeIds.length ?? 0,
                addedEdges: result.modifications?.addEdges.length ?? 0,
                updatedEdges: result.modifications?.updateEdges.length ?? 0,
                removedEdges: result.modifications?.removeEdgeIds.length ?? 0,
              },
            });
          }

          const assistantMsg: DisplayMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            modifications: result.modifications,
          };

          set((s) => ({
            messages: [...s.messages, assistantMsg],
            loading: false,
            streamingContent: '',
          }));

          if (result.modifications) {
            applyModifications(result.modifications);
          }
        },

        onError: (error) => {
          activeController = null;
          const errorMsg: DisplayMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${error.message}`,
          };
          set((s) => ({
            messages: [...s.messages, errorMsg],
            loading: false,
            streamingContent: '',
          }));
        },
      },
      provider,
    );
  },

  cancelStream: () => {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
    const streaming = get().streamingContent;
    if (streaming) {
      const partialMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: streaming,
      };
      set((s) => ({
        messages: [...s.messages, partialMsg],
        loading: false,
        streamingContent: '',
      }));
    } else {
      set({ loading: false, streamingContent: '' });
    }
  },

  clearMessages: () => set({ messages: [] }),
  clearAiModified: () => set({ aiModifiedNodeIds: new Set() }),
  removeAiModified: (nodeId) =>
    set((s) => {
      const next = new Set(s.aiModifiedNodeIds);
      next.delete(nodeId);
      return { aiModifiedNodeIds: next };
    }),
}));

// --- Apply AI modifications to the diagram ---

function applyModifications(mods: DiagramModification) {
  // Single batched store update — one render instead of many
  const idMap = useDiagramStore.getState().batchApply({
    addNodes: mods.addNodes,
    updateNodes: mods.updateNodes,
    removeNodeIds: mods.removeNodeIds,
    addEdges: mods.addEdges,
    updateEdges: mods.updateEdges,
    removeEdgeIds: mods.removeEdgeIds,
  });

  // Track AI-modified node IDs (resolved to real UUIDs)
  const prev = useChatStore.getState().aiModifiedNodeIds;
  const modifiedIds = new Set(prev);
  for (const node of mods.addNodes) {
    const realId = idMap.get(node.id);
    if (realId) modifiedIds.add(realId);
  }
  for (const upd of mods.updateNodes) {
    modifiedIds.add(idMap.get(upd.id) ?? upd.id);
  }
  useChatStore.setState({ aiModifiedNodeIds: modifiedIds });

  // Auto-layout after AI changes
  const updated = useDiagramStore.getState().diagram;
  const framework = useDiagramStore.getState().framework;
  autoLayout(updated.nodes, updated.edges, {
    direction: updated.settings.layoutDirection,
    cyclic: framework.allowsCycles,
  }, elkEngine).then((updates) => {
    if (updates.length > 0) {
      useDiagramStore.getState().moveNodes(updates);
      useDiagramStore.getState().optimizeEdgesAfterLayout();
      useUIStore.getState().requestFitView();
    }
  });
}
