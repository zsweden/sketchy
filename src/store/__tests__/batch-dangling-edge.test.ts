import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';

describe('batchApply drops edges referencing non-existent nodes', () => {
  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
  });

  it('drops edge when target node does not exist', () => {
    const store = useDiagramStore.getState();
    const n1 = store.addNode({ x: 0, y: 0 });

    useDiagramStore.getState().batchApply({
      addEdges: [{ source: n1, target: 'nonexistent-id' }],
    });

    expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
  });

  it('drops edge when source node does not exist', () => {
    const store = useDiagramStore.getState();
    const n1 = store.addNode({ x: 0, y: 0 });

    useDiagramStore.getState().batchApply({
      addEdges: [{ source: 'nonexistent-id', target: n1 }],
    });

    expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
  });

  it('keeps valid edges and drops dangling ones in same batch', () => {
    const store = useDiagramStore.getState();
    const n1 = store.addNode({ x: 0, y: 0 });
    const n2 = store.addNode({ x: 100, y: 0 });

    useDiagramStore.getState().batchApply({
      addEdges: [
        { source: n1, target: n2 },
        { source: n1, target: 'ghost-node' },
        { source: 'ghost-node', target: n2 },
      ],
    });

    const edges = useDiagramStore.getState().diagram.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(n1);
    expect(edges[0].target).toBe(n2);
  });

  it('resolves new node IDs before checking existence', () => {
    // AI adds nodes and edges in a single batch — edges reference temp IDs
    useDiagramStore.getState().batchApply({
      addNodes: [
        { id: 'new_1', label: 'Cause' },
        { id: 'new_2', label: 'Effect' },
      ],
      addEdges: [
        { source: 'new_1', target: 'new_2' },
        { source: 'new_1', target: 'new_3' }, // new_3 was never added
      ],
    });

    const { nodes, edges } = useDiagramStore.getState().diagram;
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(nodes.find((n) => n.data.label === 'Cause')!.id);
    expect(edges[0].target).toBe(nodes.find((n) => n.data.label === 'Effect')!.id);
  });
});
