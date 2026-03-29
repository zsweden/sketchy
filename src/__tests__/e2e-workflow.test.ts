/**
 * End-to-end workflow tests that exercise the full stack:
 * store operations → persistence → AI modifications → undo
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../store/diagram-store';
import { diagramToSkyJson, convertSkyJson } from '../core/persistence/causal-json';
import { getFramework, listFrameworks } from '../frameworks/registry';

function resetStore() {
  const store = useDiagramStore.getState();
  if (store.framework.id !== 'crt') {
    store.setFramework('crt');
  } else {
    store.newDiagram();
  }
}

describe('end-to-end: CRT workflow', () => {
  beforeEach(resetStore);

  it('create → tag → connect → save → load round-trip', () => {
    const store = useDiagramStore.getState;

    // Create nodes
    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Poor management');
    const n2 = store().addNode({ x: 100, y: 0 });
    store().updateNodeText(n2, 'Low morale');
    store().updateNodeTags(n2, ['ude']);
    const n3 = store().addNode({ x: 200, y: 0 });
    store().updateNodeText(n3, 'High turnover');
    store().updateNodeTags(n3, ['ude']);

    // Connect: poor management → low morale → high turnover
    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    // Verify structure
    expect(store().diagram.nodes).toHaveLength(3);
    expect(store().diagram.edges).toHaveLength(2);
    expect(store().diagram.nodes.find((n) => n.id === n2)?.data.tags).toEqual(['ude']);

    // Save to .sky format
    const sky = diagramToSkyJson(store().diagram);
    expect(sky.nodes).toHaveLength(3);
    expect(sky.nodes.find((n) => n.label === 'Low morale')?.isUDE).toBe(true);
    expect(sky.edges).toHaveLength(2);

    // Load back
    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.nodes).toHaveLength(3);
    expect(loaded.edges).toHaveLength(2);
    expect(loaded.nodes.find((n) => n.data.label === 'High turnover')?.data.tags).toEqual(['ude']);
  });

  it('AI batchApply adds nodes and edges with ID mapping', () => {
    const store = useDiagramStore.getState;

    // Start with one existing node
    const existing = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(existing, 'Existing problem');

    // Simulate AI adding nodes and connecting to existing
    const idMap = store().batchApply({
      addNodes: [
        { id: 'new_1', label: 'Root cause', tags: ['ude'] },
        { id: 'new_2', label: 'Intermediate' },
      ],
      addEdges: [
        { source: 'new_1', target: 'new_2' },
        { source: 'new_2', target: existing },
      ],
    });

    // Should have 3 nodes total
    expect(store().diagram.nodes).toHaveLength(3);
    expect(store().diagram.edges).toHaveLength(2);

    // ID mapping should resolve AI IDs to real UUIDs
    const realId1 = idMap.get('new_1')!;
    const realId2 = idMap.get('new_2')!;
    expect(realId1).toBeTruthy();
    expect(realId2).toBeTruthy();

    // Edges should use real IDs
    const edges = store().diagram.edges;
    expect(edges.some((e) => e.source === realId1 && e.target === realId2)).toBe(true);
    expect(edges.some((e) => e.source === realId2 && e.target === existing)).toBe(true);

    // Tags should be applied
    expect(store().diagram.nodes.find((n) => n.id === realId1)?.data.tags).toEqual(['ude']);

    // Undo should revert entire batch
    store().undo();
    expect(store().diagram.nodes).toHaveLength(1);
    expect(store().diagram.edges).toHaveLength(0);
  });

  it('AI batchApply with edge confidence persists through .sky round-trip', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    const n2 = store().addNode({ x: 0, y: 100 });
    store().addEdge(n1, n2);

    // AI sets confidence to low
    const edges = store().diagram.edges;
    store().batchApply({
      updateEdges: [{ id: edges[0].id, confidence: 'low' }],
    });

    // Save and load
    const sky = diagramToSkyJson(store().diagram);
    expect(sky.edges[0].confidence).toBe('low');

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.edges[0].confidence).toBe('low');
  });
});

describe('end-to-end: FRT workflow', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('frt');
  });

  it('FRT framework is registered and has correct tags', () => {
    const frt = getFramework('frt');
    expect(frt).toBeDefined();
    expect(frt!.nodeTags.map((t) => t.id)).toEqual(['injection', 'de']);
    expect(frt!.edgeLabel).toBe('leads to');
  });

  it('create FRT diagram with injections and desirable effects', () => {
    const store = useDiagramStore.getState;

    expect(store().framework.id).toBe('frt');

    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Implement daily standups');
    store().updateNodeTags(n1, ['injection']);

    const n2 = store().addNode({ x: 0, y: 100 });
    store().updateNodeText(n2, 'Better team communication');

    const n3 = store().addNode({ x: 0, y: 200 });
    store().updateNodeText(n3, 'Higher productivity');
    store().updateNodeTags(n3, ['de']);

    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    // Verify tags
    expect(store().diagram.nodes.find((n) => n.id === n1)?.data.tags).toEqual(['injection']);
    expect(store().diagram.nodes.find((n) => n.id === n3)?.data.tags).toEqual(['de']);

    // Save and verify .sky format
    const sky = diagramToSkyJson(store().diagram);
    expect(sky.framework).toBe('frt');
    expect(sky.nodes.find((n) => n.id === n1)?.tags).toEqual(['injection']);
  });
});

describe('end-to-end: PRT workflow', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('prt');
  });

  it('PRT framework is registered and supports prerequisite tags', () => {
    const prt = getFramework('prt');
    expect(prt).toBeDefined();
    expect(prt!.nodeTags.map((t) => t.id)).toEqual(['obstacle', 'io', 'goal']);
    expect(prt!.edgeLabel).toBe('enables');
  });

  it('create PRT diagram and preserve tags through .sky round-trip', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Lack of onboarding');
    store().updateNodeTags(n1, ['obstacle']);

    const n2 = store().addNode({ x: 0, y: 100 });
    store().updateNodeText(n2, 'Create onboarding checklist');
    store().updateNodeTags(n2, ['io']);

    const n3 = store().addNode({ x: 0, y: 200 });
    store().updateNodeText(n3, 'New hires productive faster');
    store().updateNodeTags(n3, ['goal']);

    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.framework).toBe('prt');
    expect(sky.nodes.find((n) => n.id === n1)?.tags).toEqual(['obstacle']);

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.frameworkId).toBe('prt');
    expect(loaded.nodes.find((n) => n.id === n2)?.data.tags).toEqual(['io']);
    expect(loaded.nodes.find((n) => n.id === n3)?.data.tags).toEqual(['goal']);
  });
});

describe('end-to-end: STT workflow', () => {
  beforeEach(() => {
    useDiagramStore.getState().setFramework('stt');
  });

  it('STT framework is registered and uses top-down default layout', () => {
    const store = useDiagramStore.getState();
    const stt = getFramework('stt');
    expect(stt).toBeDefined();
    expect(stt!.nodeTags.map((t) => t.id)).toEqual(['objective', 'strategy', 'tactic']);
    expect(store.diagram.settings.layoutDirection).toBe('TB');
  });

  it('create STT diagram and preserve tags through .sky round-trip', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Improve retention');
    store().updateNodeTags(n1, ['objective']);

    const n2 = store().addNode({ x: 0, y: 100 });
    store().updateNodeText(n2, 'Improve manager quality');
    store().updateNodeTags(n2, ['strategy']);

    const n3 = store().addNode({ x: 0, y: 200 });
    store().updateNodeText(n3, 'Run monthly coaching sessions');
    store().updateNodeTags(n3, ['tactic']);

    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.framework).toBe('stt');
    expect(sky.nodes.find((n) => n.id === n2)?.tags).toEqual(['strategy']);

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.frameworkId).toBe('stt');
    expect(loaded.nodes.find((n) => n.id === n1)?.data.tags).toEqual(['objective']);
    expect(loaded.nodes.find((n) => n.id === n3)?.data.tags).toEqual(['tactic']);
  });
});

describe('end-to-end: framework switching', () => {
  beforeEach(resetStore);

  it('all registered frameworks are available', () => {
    const frameworks = listFrameworks();
    const ids = frameworks.map((f) => f.id);
    expect(ids).toContain('crt');
    expect(ids).toContain('frt');
    expect(ids).toContain('prt');
    expect(ids).toContain('stt');
  });

  it('switching framework resets diagram', () => {
    const store = useDiagramStore.getState;

    // Add some nodes
    store().addNode({ x: 0, y: 0 });
    store().addNode({ x: 100, y: 0 });
    expect(store().diagram.nodes).toHaveLength(2);

    // Switch to FRT
    store().setFramework('frt');
    expect(store().framework.id).toBe('frt');
    expect(store().diagram.nodes).toHaveLength(0);
    expect(store().diagram.frameworkId).toBe('frt');
  });
});

describe('end-to-end: complex graph operations', () => {
  beforeEach(resetStore);

  it('batchApply rejects cycles in added edges', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    const n2 = store().addNode({ x: 0, y: 100 });
    store().addEdge(n1, n2);

    // Try to add a cycle via batchApply
    store().batchApply({
      addEdges: [{ source: n2, target: n1 }],
    });

    // Edge should be rejected — still only 1 edge
    expect(store().diagram.edges).toHaveLength(1);
  });

  it('batchApply removes nodes and their connected edges', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    const n2 = store().addNode({ x: 0, y: 100 });
    const n3 = store().addNode({ x: 0, y: 200 });
    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    // Remove middle node — both edges should go
    store().batchApply({ removeNodeIds: [n2] });

    expect(store().diagram.nodes).toHaveLength(2);
    expect(store().diagram.edges).toHaveLength(0);
  });

  it('multiple undo steps restore full history', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Step 1');

    const n2 = store().addNode({ x: 100, y: 0 });
    store().addEdge(n1, n2);

    store().deleteNodes([n2]);

    // Undo delete
    store().undo();
    expect(store().diagram.nodes).toHaveLength(2);
    expect(store().diagram.edges).toHaveLength(1);

    // Undo addEdge
    store().undo();
    expect(store().diagram.edges).toHaveLength(0);

    // Redo
    store().redo();
    expect(store().diagram.edges).toHaveLength(1);
  });
});
