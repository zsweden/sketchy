import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { diagramToSkyJson, convertSkyJson } from '../../core/persistence/causal-json';

// Fixture: small CRT with 4 nodes, 3 edges — all high confidence (default)
function setupFixture() {
  const store = useDiagramStore.getState();
  store.newDiagram();

  const n1 = store.addNode({ x: 0, y: 0 });
  useDiagramStore.getState().updateNodeText(n1, 'Root cause A');

  const n2 = store.addNode({ x: 100, y: 0 });
  useDiagramStore.getState().updateNodeText(n2, 'Root cause B');

  const n3 = store.addNode({ x: 50, y: 100 });
  useDiagramStore.getState().updateNodeText(n3, 'Intermediate effect');

  const n4 = store.addNode({ x: 50, y: 200 });
  useDiagramStore.getState().updateNodeText(n4, 'Undesirable effect');
  useDiagramStore.getState().updateNodeTags(n4, ['ude']);

  useDiagramStore.getState().addEdge(n1, n3);
  useDiagramStore.getState().addEdge(n2, n3);
  useDiagramStore.getState().addEdge(n3, n4);

  return { n1, n2, n3, n4 };
}

describe('AI edge confidence end-to-end', () => {
  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
  });

  it('batchApply updateEdges sets all edges to medium confidence', () => {
    setupFixture();
    const edges = useDiagramStore.getState().diagram.edges;

    // All edges start without confidence (defaults to high)
    for (const e of edges) {
      expect(e.confidence).toBeUndefined();
    }

    // Simulate AI response: "change all edges to medium confidence"
    useDiagramStore.getState().batchApply({
      updateEdges: edges.map((e) => ({ id: e.id, confidence: 'medium' as const })),
    });

    // All edges should now be medium
    const updated = useDiagramStore.getState().diagram.edges;
    expect(updated).toHaveLength(3);
    for (const e of updated) {
      expect(e.confidence).toBe('medium');
    }
  });

  it('medium confidence survives .sky round-trip', () => {
    setupFixture();
    const edges = useDiagramStore.getState().diagram.edges;

    // Set all to medium
    useDiagramStore.getState().batchApply({
      updateEdges: edges.map((e) => ({ id: e.id, confidence: 'medium' as const })),
    });

    // Save to .sky format
    const diagram = useDiagramStore.getState().diagram;
    const skyJson = diagramToSkyJson(diagram);

    // All edges in .sky should have confidence: 'medium'
    for (const e of skyJson.edges) {
      expect(e.confidence).toBe('medium');
    }

    // Load back from .sky
    const { diagram: loaded } = convertSkyJson(skyJson);

    expect(loaded.edges).toHaveLength(3);
    for (const e of loaded.edges) {
      expect(e.confidence).toBe('medium');
    }
  });

  it('is undoable as a single operation', () => {
    setupFixture();
    const edges = useDiagramStore.getState().diagram.edges;

    useDiagramStore.getState().batchApply({
      updateEdges: edges.map((e) => ({ id: e.id, confidence: 'medium' as const })),
    });

    // Undo should revert all edges back to no confidence
    useDiagramStore.getState().undo();

    const reverted = useDiagramStore.getState().diagram.edges;
    for (const e of reverted) {
      expect(e.confidence).toBeUndefined();
    }
  });
});
