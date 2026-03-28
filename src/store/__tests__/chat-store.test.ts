import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../chat-store';
import { useDiagramStore } from '../diagram-store';
import { useSettingsStore } from '../settings-store';

// Mock the streaming function to avoid real API calls
vi.mock('../../core/ai/openai-client', () => ({
  streamChatMessage: vi.fn((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
    // Simulate immediate response
    setTimeout(() => {
      callbacks.onDone({ text: 'Mock response' });
    }, 0);
    return new AbortController();
  }),
}));

// Mock auto-layout to avoid ELK dependency
vi.mock('../../core/layout', () => ({
  autoLayout: vi.fn().mockResolvedValue([]),
  elkEngine: vi.fn(),
}));

function resetStores() {
  useChatStore.getState().clearMessages();
  useDiagramStore.getState().newDiagram();
}

describe('chat-store', () => {
  beforeEach(() => {
    resetStores();
    // Ensure settings are configured
    useSettingsStore.setState({
      openaiApiKey: 'test-key',
      baseUrl: 'https://api.test.com/v1',
      model: 'gpt-4o',
    });
  });

  describe('sendMessage', () => {
    it('adds user message to history', () => {
      useChatStore.getState().sendMessage('Hello');
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Hello');
    });

    it('sets loading state while streaming', () => {
      useChatStore.getState().sendMessage('Hello');
      expect(useChatStore.getState().loading).toBe(true);
    });

    it('adds assistant response when done', async () => {
      useChatStore.getState().clearMessages();
      useChatStore.getState().sendMessage('Hello');
      // Let the mock setTimeout(0) fire
      await new Promise((r) => setTimeout(r, 50));
      const msgs = useChatStore.getState().messages;
      const assistant = msgs.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('Mock response');
      expect(useChatStore.getState().loading).toBe(false);
    });

    it('shows config message when no baseUrl', () => {
      useSettingsStore.setState({ baseUrl: '', model: '' });
      useChatStore.getState().sendMessage('Hello');
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1].content).toContain('configure');
    });
  });

  describe('cancelStream', () => {
    it('stops loading and adds partial content', () => {
      useChatStore.setState({
        loading: true,
        streamingContent: 'Partial response...',
      });

      useChatStore.getState().cancelStream();

      expect(useChatStore.getState().loading).toBe(false);
      expect(useChatStore.getState().streamingContent).toBe('');
      const msgs = useChatStore.getState().messages;
      expect(msgs[msgs.length - 1].content).toBe('Partial response...');
    });

    it('clears loading with no partial content', () => {
      useChatStore.setState({ loading: true, streamingContent: '' });
      useChatStore.getState().cancelStream();
      expect(useChatStore.getState().loading).toBe(false);
    });
  });

  describe('clearMessages', () => {
    it('clears all messages', () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'Hello' },
          { id: '2', role: 'assistant', content: 'Hi' },
        ],
      });
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toEqual([]);
    });
  });

  describe('AI modification tracking', () => {
    it('tracks and clears modified node IDs', () => {
      useChatStore.setState({
        aiModifiedNodeIds: new Set(['n1', 'n2']),
      });
      expect(useChatStore.getState().aiModifiedNodeIds.has('n1')).toBe(true);

      useChatStore.getState().clearAiModified();
      expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(0);
    });

    it('removes individual modified node', () => {
      useChatStore.setState({
        aiModifiedNodeIds: new Set(['n1', 'n2', 'n3']),
      });
      useChatStore.getState().removeAiModified('n2');
      expect(useChatStore.getState().aiModifiedNodeIds.has('n2')).toBe(false);
      expect(useChatStore.getState().aiModifiedNodeIds.size).toBe(2);
    });
  });
});
