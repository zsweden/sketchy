import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { useChatStore } from '../chat-store';
import { applyAiModifications } from '../apply-ai-modifications';
import type { DiagramModification } from '../../core/ai/ai-types';

// ELK WASM binary doesn't load in jsdom — this is the only required mock.
// openai-client and error-logging are side-effect-free and env-guarded,
// so they load fine with production code.
vi.mock('../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: vi.fn().mockResolvedValue([]),
}));

function emptyModification(overrides: Partial<DiagramModification> = {}): DiagramModification {
  return {
    addNodes: [],
    updateNodes: [],
    removeNodeIds: [],
    addEdges: [],
    updateEdges: [],
    removeEdgeIds: [],
    ...overrides,
  };
}

describe('applyAiModifications', () => {
  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
    useChatStore.setState({ aiModifiedNodeIds: new Set() });
  });

  it('adds nodes via batchApply and returns id map', () => {
    const mods = emptyModification({
      addNodes: [{ id: 'ai-1', label: 'Test Node' }],
    });

    const idMap = applyAiModifications(mods);

    expect(idMap.size).toBe(1);
    expect(idMap.has('ai-1')).toBe(true);
    const realId = idMap.get('ai-1')!;
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === realId)).toBeDefined();
  });

  it('tracks added nodes in chat store aiModifiedNodeIds', () => {
    const mods = emptyModification({
      addNodes: [{ id: 'ai-1', label: 'Node A' }, { id: 'ai-2', label: 'Node B' }],
    });

    const idMap = applyAiModifications(mods);

    const modified = useChatStore.getState().aiModifiedNodeIds;
    expect(modified.has(idMap.get('ai-1')!)).toBe(true);
    expect(modified.has(idMap.get('ai-2')!)).toBe(true);
  });

  it('tracks updated nodes in chat store aiModifiedNodeIds', () => {
    // Pre-populate a node
    useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const existingId = useDiagramStore.getState().diagram.nodes[0].id;

    const mods = emptyModification({
      updateNodes: [{ id: existingId, label: 'Updated' }],
    });

    applyAiModifications(mods);

    expect(useChatStore.getState().aiModifiedNodeIds.has(existingId)).toBe(true);
  });

  it('triggers auto-layout for structural changes', async () => {
    const { runElkAutoLayout } = await import('../../core/layout/run-elk-auto-layout');

    const mods = emptyModification({
      addNodes: [{ id: 'ai-1', label: 'New' }],
    });

    applyAiModifications(mods);

    // runAutoLayout is async, give it a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(runElkAutoLayout).toHaveBeenCalled();
  });

  it('skips auto-layout for attribute-only changes', async () => {
    const { runElkAutoLayout } = await import('../../core/layout/run-elk-auto-layout');
    vi.mocked(runElkAutoLayout).mockClear();

    useDiagramStore.getState().addNode({ x: 0, y: 0 });
    const existingId = useDiagramStore.getState().diagram.nodes[0].id;

    const mods = emptyModification({
      updateNodes: [{ id: existingId, label: 'Renamed' }],
    });

    applyAiModifications(mods);

    await new Promise((r) => setTimeout(r, 0));
    expect(runElkAutoLayout).not.toHaveBeenCalled();
  });

  it('drops malformed AI mutations and sanitizes unsupported fields', () => {
    useDiagramStore.getState().setFramework('crt');

    applyAiModifications({
      addNodes: [
        { id: 'good', label: 'Good', tags: ['ude', 'not-a-tag'], color: '#ff00aa', textColor: 'url(bad)', junctionType: 'multiply' },
        { id: '', label: 'Missing id' },
        { id: 'bad-label', label: 7 },
      ],
      updateNodes: 'not-array',
      removeNodeIds: ['missing', 7],
      addEdges: [
        { source: 'good', target: 'missing', confidence: 'certain', polarity: 'negative', delay: true },
        { source: '', target: 'good' },
      ],
      updateEdges: [{ id: '', confidence: 'low' }],
      removeEdgeIds: [false, 'edge-1'],
    } as unknown as DiagramModification);

    const node = useDiagramStore.getState().diagram.nodes[0];
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    expect(node.data.tags).toEqual(['ude']);
    expect(node.data.junctionType).toBe('or');
    expect(node.data.color).toBe('#ff00aa');
    expect(node.data.textColor).toBeUndefined();
    expect(node.data.value).toBeUndefined();
    expect(useChatStore.getState().aiModifiedNodeIds.has(node.id)).toBe(true);
  });
});
