import { create } from 'zustand';
import type { ChatMessage, DiagramModification } from '../core/ai/openai-client';
import { streamChatMessage } from '../core/ai/openai-client';
import { useSettingsStore } from './settings-store';
import { useDiagramStore } from './diagram-store';
import { useUIStore } from './ui-store';
import { autoLayout, elkEngine } from '../core/layout';

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

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  streamingContent: '',
  aiModifiedNodeIds: new Set(),

  sendMessage: (text) => {
    const { openaiApiKey, baseUrl, model } = useSettingsStore.getState();
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
      framework.name,
      history,
      {
        onToken: (token) => {
          set((s) => ({ streamingContent: s.streamingContent + token }));
        },

        onDone: (result) => {
          activeController = null;
          const assistantMsg: DisplayMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.text,
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
  const store = useDiagramStore.getState();
  const chatStore = useChatStore.getState();

  // Commit current state to history so all AI changes can be undone as one batch
  store.commitToHistory();

  const modifiedIds = new Set(chatStore.aiModifiedNodeIds);

  // Map from AI-generated IDs (e.g. "new_1") to real UUIDs
  const idMap = new Map<string, string>();

  // 1. Add new nodes
  for (const node of mods.addNodes) {
    const realId = store.addNode({ x: 0, y: 0 });
    idMap.set(node.id, realId);
    modifiedIds.add(realId);

    if (node.label) {
      useDiagramStore.getState().updateNodeText(realId, node.label);
    }
    if (node.tags?.length) {
      useDiagramStore.getState().updateNodeTags(realId, node.tags);
    }
  }

  // 2. Update existing nodes
  for (const upd of mods.updateNodes) {
    const realId = idMap.get(upd.id) ?? upd.id;
    modifiedIds.add(realId);
    if (upd.label !== undefined) {
      useDiagramStore.getState().updateNodeText(realId, upd.label);
    }
    if (upd.tags !== undefined) {
      useDiagramStore.getState().updateNodeTags(realId, upd.tags);
    }
    if (upd.notes !== undefined) {
      useDiagramStore.getState().updateNodeNotes(realId, upd.notes);
    }
  }

  // 3. Remove nodes
  if (mods.removeNodeIds.length > 0) {
    const realIds = mods.removeNodeIds.map((id) => idMap.get(id) ?? id);
    useDiagramStore.getState().deleteNodes(realIds);
  }

  // 4. Add edges (resolving AI IDs to real UUIDs)
  for (const edge of mods.addEdges) {
    const source = idMap.get(edge.source) ?? edge.source;
    const target = idMap.get(edge.target) ?? edge.target;
    const result = useDiagramStore.getState().addEdge(source, target);
    if (result.success && edge.confidence && edge.confidence !== 'high') {
      // Find the newly added edge and set its confidence
      const diagram = useDiagramStore.getState().diagram;
      const newEdge = diagram.edges.find((e) => e.source === source && e.target === target);
      if (newEdge) {
        useDiagramStore.getState().setEdgeConfidence(newEdge.id, edge.confidence);
      }
    }
  }

  // 5. Update existing edges
  for (const upd of mods.updateEdges) {
    if (upd.confidence) {
      useDiagramStore.getState().setEdgeConfidence(upd.id, upd.confidence);
    }
  }

  // 6. Remove edges
  if (mods.removeEdgeIds.length > 0) {
    useDiagramStore.getState().deleteEdges(mods.removeEdgeIds);
  }

  useChatStore.setState({ aiModifiedNodeIds: modifiedIds });

  // Auto-layout after AI changes
  const updated = useDiagramStore.getState().diagram;
  autoLayout(updated.nodes, updated.edges, {
    direction: updated.settings.layoutDirection,
  }, elkEngine).then((updates) => {
    if (updates.length > 0) {
      useDiagramStore.getState().moveNodes(updates);
      useUIStore.getState().requestFitView();
    }
  });
}
