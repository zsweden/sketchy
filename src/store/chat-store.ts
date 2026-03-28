import { create } from 'zustand';
import type { ChatMessage, DiagramModification } from '../core/ai/openai-client';
import { sendChatMessage } from '../core/ai/openai-client';
import { useSettingsStore } from './settings-store';
import { useDiagramStore } from './diagram-store';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modifications?: DiagramModification;
}

interface ChatState {
  messages: DisplayMessage[];
  loading: boolean;
  aiModifiedNodeIds: Set<string>;

  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  clearAiModified: () => void;
  removeAiModified: (nodeId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  aiModifiedNodeIds: new Set(),

  sendMessage: async (text) => {
    const apiKey = useSettingsStore.getState().openaiApiKey;
    if (!apiKey) {
      set((s) => ({
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: 'user', content: text },
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Please set your OpenAI API key in settings (cog icon in the toolbar).',
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

    set((s) => ({ messages: [...s.messages, userMsg], loading: true }));

    try {
      const diagramStore = useDiagramStore.getState();
      const { diagram, framework } = diagramStore;

      // Build conversation history for context
      const history: ChatMessage[] = get().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await sendChatMessage(apiKey, diagram, framework.name, history);

      const assistantMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.text,
        modifications: result.modifications,
      };

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        loading: false,
      }));

      // Apply modifications if any
      if (result.modifications) {
        applyModifications(result.modifications);
      }
    } catch (err) {
      const errorMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Something went wrong.'}`,
      };
      set((s) => ({
        messages: [...s.messages, errorMsg],
        loading: false,
      }));
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

    // Update the node's text and tags
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
    useDiagramStore.getState().addEdge(source, target);
  }

  // 5. Remove edges
  if (mods.removeEdgeIds.length > 0) {
    useDiagramStore.getState().deleteEdges(mods.removeEdgeIds);
  }

  useChatStore.setState({ aiModifiedNodeIds: modifiedIds });
}
