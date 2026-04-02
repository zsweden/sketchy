import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../chat-store';
import { useDiagramStore } from '../diagram-store';
import { useSettingsStore } from '../settings-store';
import { reportError } from '../../core/monitoring/error-logging';

// Mock the streaming function to avoid real API calls
const mockStreamChatMessage = vi.fn((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
  // Simulate immediate response
  setTimeout(() => {
    callbacks.onDone({ text: 'Mock response' });
  }, 0);
  return new AbortController();
});

vi.mock('../../core/ai/openai-client', () => ({
  streamChatMessage: (...args: Parameters<typeof mockStreamChatMessage>) => mockStreamChatMessage(...args),
}));

vi.mock('../../core/monitoring/error-logging', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}));

// Mock auto-layout to avoid ELK dependency
vi.mock('../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: vi.fn().mockResolvedValue([]),
}));

function resetStores() {
  window.sessionStorage?.removeItem?.('sketchy_chat');
  useChatStore.getState().clearMessages();
  useChatStore.getState().clearAiModified();
  useDiagramStore.getState().newDiagram();
}

describe('chat-store', () => {
  beforeEach(() => {
    resetStores();
    mockStreamChatMessage.mockImplementation((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
    // Simulate immediate response
      setTimeout(() => {
        callbacks.onDone({ text: 'Mock response' });
      }, 0);
      return new AbortController();
    });
    vi.mocked(reportError).mockClear();
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

    it('logs and replaces empty assistant responses', async () => {
      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        setTimeout(() => {
          callbacks.onDone({ text: '   ' });
        }, 0);
        return new AbortController();
      });

      useChatStore.getState().sendMessage('Hello');
      await new Promise((r) => setTimeout(r, 50));

      const msgs = useChatStore.getState().messages;
      const assistant = msgs.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('The AI returned an empty response. Please try again.');
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'AI chat returned empty assistant response',
        }),
        expect.objectContaining({
          source: 'chat.empty_response',
          fatal: false,
          metadata: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4o',
            endpointHost: 'api.test.com',
            userMessageLength: 5,
            resultTextLength: 3,
          }),
        }),
      );
    });

    it('stores canonical mention text unchanged', async () => {
      const diagram = useDiagramStore.getState().diagram;
      useDiagramStore.setState({
        diagram: {
          ...diagram,
          nodes: [
            { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Demand', tags: [], junctionType: 'or' } },
            { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'Growth', tags: [], junctionType: 'or' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        },
      });

      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        setTimeout(() => {
          callbacks.onDone({ text: '[Demand][node:n1] drives [Demand -> Growth][edge:e1].' });
        }, 0);
        return new AbortController();
      });

      useChatStore.getState().sendMessage('Hello');
      await new Promise((r) => setTimeout(r, 50));

      const msgs = useChatStore.getState().messages;
      const assistant = msgs.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('[Demand][node:n1] drives [Demand -> Growth][edge:e1].');
    });

    it('renders empty node mentions with a node fallback label', async () => {
      const diagram = useDiagramStore.getState().diagram;
      useDiagramStore.setState({
        diagram: {
          ...diagram,
          nodes: [
            { id: 'n3', type: 'entity', position: { x: 0, y: 0 }, data: { label: '', tags: [], junctionType: 'or' } },
          ],
          edges: [],
        },
      });

      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        setTimeout(() => {
          callbacks.onDone({ text: 'There is one [][node:n3].' });
        }, 0);
        return new AbortController();
      });

      useChatStore.getState().sendMessage('Hello');
      await new Promise((r) => setTimeout(r, 50));

      const assistant = useChatStore.getState().messages.find((message) => message.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('There is one [][node:n3].');
      expect(assistant!.displayText).toBe('There is one node.');
      expect(assistant!.segments).toEqual([
        { type: 'text', text: 'There is one ' },
        expect.objectContaining({
          type: 'mention',
          mention: expect.objectContaining({
            kind: 'node',
            id: 'n3',
            displayText: 'node',
          }),
        }),
        { type: 'text', text: '.' },
      ]);
    });

    it('renders empty edge mentions with an edge fallback label', async () => {
      const diagram = useDiagramStore.getState().diagram;
      useDiagramStore.setState({
        diagram: {
          ...diagram,
          nodes: [
            { id: 'n3', type: 'entity', position: { x: 0, y: 0 }, data: { label: '', tags: [], junctionType: 'or' } },
          ],
          edges: [
            { id: 'e2', source: 'n3', target: 'n3' },
          ],
        },
      });

      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        setTimeout(() => {
          callbacks.onDone({ text: 'There is one [ -> ][edge:e2].' });
        }, 0);
        return new AbortController();
      });

      useChatStore.getState().sendMessage('Hello');
      await new Promise((r) => setTimeout(r, 50));

      const assistant = useChatStore.getState().messages.find((message) => message.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('There is one [ -> ][edge:e2].');
      expect(assistant!.displayText).toBe('There is one edge.');
      expect(assistant!.segments).toEqual([
        { type: 'text', text: 'There is one ' },
        expect.objectContaining({
          type: 'mention',
          mention: expect.objectContaining({
            kind: 'edge',
            id: 'e2',
            displayText: 'edge',
          }),
        }),
        { type: 'text', text: '.' },
      ]);
    });

    it('remaps newly added node mentions to persisted node IDs', async () => {
      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        setTimeout(() => {
          callbacks.onDone({
            text: 'Added [Revenue][node:new_1].',
            modifications: {
              addNodes: [{ id: 'new_1', label: 'Revenue' }],
              updateNodes: [],
              removeNodeIds: [],
              addEdges: [],
              updateEdges: [],
              removeEdgeIds: [],
            },
          });
        }, 0);
        return new AbortController();
      });

      useChatStore.getState().sendMessage('Add revenue');
      await new Promise((r) => setTimeout(r, 50));

      const revenueNode = useDiagramStore.getState().diagram.nodes.find((node) => node.data.label === 'Revenue');
      const assistant = useChatStore.getState().messages.find((message) => message.role === 'assistant');

      expect(revenueNode).toBeDefined();
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe(`Added [Revenue][node:${revenueNode!.id}].`);
      expect(assistant!.displayText).toBe('Added Revenue.');
      expect(assistant!.segments).toEqual([
        { type: 'text', text: 'Added ' },
        expect.objectContaining({
          type: 'mention',
          mention: expect.objectContaining({
            kind: 'node',
            id: revenueNode!.id,
            displayText: 'Revenue',
          }),
        }),
        { type: 'text', text: '.' },
      ]);
    });

    it('leaves malformed canonical mentions as plain text and logs them', async () => {
      const diagram = useDiagramStore.getState().diagram;
      useDiagramStore.setState({
        diagram: {
          ...diagram,
          nodes: [
            { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Demand', tags: [], junctionType: 'or' } },
          ],
          edges: [],
        },
      });

      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        setTimeout(() => {
          callbacks.onDone({ text: '[Demand][node:missing] still shows up.' });
        }, 0);
        return new AbortController();
      });

      useChatStore.getState().sendMessage('Hello');
      await new Promise((r) => setTimeout(r, 50));

      const msgs = useChatStore.getState().messages;
      const assistant = msgs.find((m) => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('[Demand][node:missing] still shows up.');
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'AI chat returned malformed canonical mentions',
        }),
        expect.objectContaining({
          source: 'chat.malformed_mention',
          fatal: false,
          metadata: expect.objectContaining({
            malformedMentionCount: 1,
          }),
        }),
      );
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

    it('cancels in-flight responses and ignores late completions', async () => {
      mockStreamChatMessage.mockImplementationOnce((_key, _url, _model, _diagram, _fw, _msgs, callbacks) => {
        const controller = new AbortController();
        setTimeout(() => {
          callbacks.onDone({ text: 'Late response' });
        }, 10);
        return controller;
      });

      useChatStore.getState().sendMessage('Hello');
      useChatStore.getState().clearMessages();

      await new Promise((r) => setTimeout(r, 50));

      expect(useChatStore.getState().messages).toEqual([]);
      expect(useChatStore.getState().loading).toBe(false);
      expect(useChatStore.getState().streamingContent).toBe('');
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
