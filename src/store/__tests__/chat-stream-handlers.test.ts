import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { createAssistantMessage, processStreamDone, reportStreamError } from '../chat-stream-handlers';
import { getFramework } from '../../frameworks/registry';
import type { Diagram } from '../../core/types';
import { reportError } from '../../core/monitoring/error-logging';

vi.mock('../../core/monitoring/error-logging', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: vi.fn().mockResolvedValue([]),
}));

const crtFramework = getFramework('crt')!;

function makeDiagram(overrides?: Partial<Diagram>): Diagram {
  return {
    ...useDiagramStore.getState().diagram,
    frameworkId: 'crt',
    nodes: [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Demand', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'Growth', tags: [], junctionType: 'or' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    ...overrides,
  };
}

const baseCtx = {
  provider: 'openai',
  model: 'gpt-4o',
  baseUrl: 'https://api.test.com/v1',
  frameworkId: 'crt',
  historyCount: 2,
  userMessageLength: 10,
};

describe('createAssistantMessage', () => {
  it('creates a plain text message without diagram context', () => {
    const msg = createAssistantMessage('Hello world');
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Hello world');
    expect(msg.displayText).toBe('Hello world');
    expect(msg.segments).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  it('parses canonical mentions when diagram is provided', () => {
    const diagram = makeDiagram();
    const msg = createAssistantMessage('[Demand][node:n1] is important.', {
      diagram,
      framework: crtFramework,
    });
    expect(msg.content).toContain('[node:n1]');
    expect(msg.displayText).toBe('Demand is important.');
    expect(msg.segments).toEqual([
      expect.objectContaining({ type: 'mention' }),
      { type: 'text', text: ' is important.' },
    ]);
  });

  it('includes modifications in the message', () => {
    const mods = {
      addNodes: [{ id: 'new_1', label: 'X' }],
      updateNodes: [],
      removeNodeIds: [],
      addEdges: [],
      updateEdges: [],
      removeEdgeIds: [],
    };
    const msg = createAssistantMessage('Done', { modifications: mods });
    expect(msg.modifications).toBe(mods);
  });

  it('includes retryText in the message', () => {
    const msg = createAssistantMessage('Error occurred', { retryText: 'original prompt' });
    expect(msg.retryText).toBe('original prompt');
  });
});

describe('processStreamDone', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear();
    useDiagramStore.getState().setFramework('crt');
    useDiagramStore.getState().newDiagram();
  });

  it('returns an assistant message for plain text', () => {
    const diagram = makeDiagram();
    const outcome = processStreamDone(
      { text: 'Analysis complete.' },
      diagram,
      crtFramework,
      baseCtx,
      20,
    );
    expect(outcome.assistantMsg.content).toBe('Analysis complete.');
    expect(outcome.pendingSuggestions).toBeUndefined();
  });

  it('handles framework suggestions', () => {
    const suggestions = [
      { frameworkId: 'crt', frameworkName: 'Current Reality Tree', reason: 'Root cause' },
    ];
    const diagram = makeDiagram();
    const outcome = processStreamDone(
      { text: 'Try CRT', suggestions },
      diagram,
      crtFramework,
      baseCtx,
      10,
    );
    expect(outcome.pendingSuggestions).toBe(suggestions);
    expect(outcome.assistantMsg.suggestions).toBe(suggestions);
  });

  it('replaces empty text with fallback and reports error', () => {
    const diagram = makeDiagram();
    const outcome = processStreamDone(
      { text: '   ' },
      diagram,
      crtFramework,
      baseCtx,
      5,
    );
    expect(outcome.assistantMsg.content).toBe('The AI returned an empty response. Please try again.');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'AI chat returned empty assistant response' }),
      expect.objectContaining({ source: 'chat.empty_response' }),
    );
  });

  it('reports malformed mentions', () => {
    const diagram = makeDiagram();
    processStreamDone(
      { text: '[Missing][node:nonexistent] text' },
      diagram,
      crtFramework,
      baseCtx,
      30,
    );
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'AI chat returned malformed canonical mentions' }),
      expect.objectContaining({
        source: 'chat.malformed_mention',
        metadata: expect.objectContaining({ malformedMentionCount: 1 }),
      }),
    );
  });

  it('applies diagram modifications and remaps mention IDs', () => {
    // Set up a real diagram in the store
    useDiagramStore.setState({
      diagram: makeDiagram({ nodes: [], edges: [] }),
    });

    const outcome = processStreamDone(
      {
        text: 'Added [Revenue][node:new_1].',
        modifications: {
          addNodes: [{ id: 'new_1', label: 'Revenue' }],
          updateNodes: [],
          removeNodeIds: [],
          addEdges: [],
          updateEdges: [],
          removeEdgeIds: [],
        },
      },
      makeDiagram({ nodes: [], edges: [] }),
      crtFramework,
      baseCtx,
      25,
    );

    // The node should have been added to the store with a real UUID
    const revenueNode = useDiagramStore.getState().diagram.nodes.find((n) => n.data.label === 'Revenue');
    expect(revenueNode).toBeDefined();
    // The mention should reference the real ID, not the temp one
    expect(outcome.assistantMsg.content).toContain(`[node:${revenueNode!.id}]`);
  });
});

describe('reportStreamError', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear();
  });

  it('reports error with correct source and metadata', () => {
    reportStreamError(new Error('Connection failed'), baseCtx);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Connection failed' }),
      expect.objectContaining({
        source: 'chat.stream_error',
        fatal: false,
        metadata: expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o',
          endpointHost: 'api.test.com',
          userMessageLength: 10,
        }),
      }),
    );
  });
});
