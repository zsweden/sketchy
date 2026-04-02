import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '../diagram-store';

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((state) => ({ diagram: { ...state.diagram, nodes: [] } }));
}

describe('edge cycle guard', () => {
  beforeEach(() => {
    resetStore();
  });

  it('rejects addEdge when the tree graph is already cyclic', () => {
    const store = useDiagramStore.getState();
    const a = store.addNode({ x: 0, y: 0 });
    const b = store.addNode({ x: 0, y: 100 });
    const c = store.addNode({ x: 0, y: 200 });
    const d = store.addNode({ x: 0, y: 300 });
    const e = store.addNode({ x: 0, y: 400 });

    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        edges: [
          { id: 'e1', source: a, target: b },
          { id: 'e2', source: b, target: c },
          { id: 'e3', source: c, target: a },
        ],
      },
    }));

    const result = store.addEdge(d, e);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('cycle');
    expect(useDiagramStore.getState().diagram.edges).toHaveLength(3);
  });

  it('rejects batchApply edge additions when the tree graph is already cyclic', () => {
    const store = useDiagramStore.getState();
    const a = store.addNode({ x: 0, y: 0 });
    const b = store.addNode({ x: 0, y: 100 });
    const c = store.addNode({ x: 0, y: 200 });
    const d = store.addNode({ x: 0, y: 300 });
    const e = store.addNode({ x: 0, y: 400 });

    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        edges: [
          { id: 'e1', source: a, target: b },
          { id: 'e2', source: b, target: c },
          { id: 'e3', source: c, target: a },
        ],
      },
    }));

    store.batchApply({
      addEdges: [{ source: d, target: e }],
    });

    expect(useDiagramStore.getState().diagram.edges).toHaveLength(3);
  });
});
