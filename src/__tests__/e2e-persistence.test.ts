/**
 * E2E tests for persistence workflows:
 * sessionStorage auto-save, .sky file round-trips, migration paths
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../store/diagram-store';
import { saveDiagram, loadDiagram, clearDiagram } from '../core/persistence/local-storage';
import { diagramToSkyJson, convertSkyJson } from '../core/persistence/causal-json';
import { createEmptyDiagram, SCHEMA_VERSION } from '../core/types';
import { migrate } from '../core/persistence/schema';

describe('e2e: sessionStorage persistence', () => {
  beforeEach(() => {
    sessionStorage.removeItem('sketchy_diagram');
    useDiagramStore.getState().newDiagram();
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
  });

  it('save → load round-trip preserves full diagram state', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 10, y: 20 });
    store().updateNodeText(n1, 'Root cause');
    store().updateNodeTags(n1, ['ude']);

    const n2 = store().addNode({ x: 100, y: 200 });
    store().updateNodeText(n2, 'Effect');
    store().updateNodeNotes(n2, 'This is important');

    store().addEdge(n1, n2);
    store().setEdgeConfidence(store().diagram.edges[0].id, 'medium');

    // Save
    saveDiagram(store().diagram);

    // Load
    const result = loadDiagram();
    expect(result.error).toBeUndefined();
    expect(result.diagram).not.toBeNull();

    const loaded = result.diagram!;
    expect(loaded.nodes).toHaveLength(2);
    expect(loaded.edges).toHaveLength(1);
    expect(loaded.nodes.find((n) => n.id === n1)?.data.label).toBe('Root cause');
    expect(loaded.nodes.find((n) => n.id === n1)?.data.tags).toEqual(['ude']);
    expect(loaded.nodes.find((n) => n.id === n2)?.data.notes).toBe('This is important');
    expect(loaded.edges[0].confidence).toBe('medium');
  });

  it('clearDiagram removes saved state', () => {
    saveDiagram(createEmptyDiagram('crt'));
    expect(loadDiagram().diagram).not.toBeNull();

    clearDiagram();
    expect(loadDiagram().diagram).toBeNull();
  });

  it('corrupted storage returns error', () => {
    sessionStorage.setItem('sketchy_diagram', 'not valid json {{{');

    const result = loadDiagram();
    expect(result.diagram).toBeNull();
    expect(result.error).toContain('corrupted');
  });

  it('invalid diagram shape returns error', () => {
    sessionStorage.setItem('sketchy_diagram', JSON.stringify({ foo: 'bar' }));

    const result = loadDiagram();
    expect(result.diagram).toBeNull();
    expect(result.error).toContain('corrupted');
  });
});

describe('e2e: .sky format round-trips', () => {
  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
  });

  it('large diagram (50 nodes) survives round-trip', () => {
    const store = useDiagramStore.getState;
    const nodeIds: string[] = [];

    // Create 50 nodes
    for (let i = 0; i < 50; i++) {
      const id = store().addNode({ x: i * 10, y: i * 20 });
      useDiagramStore.getState().updateNodeText(id, `Node ${i}`);
      nodeIds.push(id);
    }

    // Create chain edges
    for (let i = 0; i < 49; i++) {
      useDiagramStore.getState().addEdge(nodeIds[i], nodeIds[i + 1]);
    }

    expect(store().diagram.nodes).toHaveLength(50);
    expect(store().diagram.edges).toHaveLength(49);

    // Round-trip through .sky
    const sky = diagramToSkyJson(store().diagram);
    const { diagram: loaded } = convertSkyJson(sky);

    expect(loaded.nodes).toHaveLength(50);
    expect(loaded.edges).toHaveLength(49);
    expect(loaded.nodes[25].data.label).toBe('Node 25');
  });

  it('FRT diagram preserves framework and structure through round-trip', () => {
    useDiagramStore.getState().setFramework('frt');
    useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Injection node');

    const n2 = store().addNode({ x: 0, y: 100 });
    store().updateNodeText(n2, 'Intermediate');

    const n3 = store().addNode({ x: 0, y: 200 });
    store().updateNodeText(n3, 'Desirable effect');

    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.framework).toBe('frt');
    expect(sky.nodes).toHaveLength(3);
    expect(sky.edges).toHaveLength(2);

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.frameworkId).toBe('frt');
    expect(loaded.nodes).toHaveLength(3);
    expect(loaded.edges).toHaveLength(2);
  });

  it('generic framework tags survive .sky round-trip', () => {
    useDiagramStore.getState().setFramework('prt');
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Blocked by missing documentation');
    store().updateNodeTags(n1, ['obstacle']);

    const n2 = store().addNode({ x: 0, y: 100 });
    store().updateNodeText(n2, 'Write setup guide');
    store().updateNodeTags(n2, ['io']);

    store().addEdge(n1, n2);

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.framework).toBe('prt');
    expect(sky.nodes.find((n) => n.id === n1)?.tags).toEqual(['obstacle']);
    expect(sky.nodes.find((n) => n.id === n2)?.tags).toEqual(['io']);

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.frameworkId).toBe('prt');
    expect(loaded.nodes.find((n) => n.id === n1)?.data.tags).toEqual(['obstacle']);
    expect(loaded.nodes.find((n) => n.id === n2)?.data.tags).toEqual(['io']);
  });

  it('UDE tags survive .sky round-trip (CRT)', () => {
    const store = useDiagramStore.getState;
    const n1 = store().addNode({ x: 0, y: 0 });
    store().updateNodeText(n1, 'Bad thing');
    store().updateNodeTags(n1, ['ude']);

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.nodes[0].isUDE).toBe(true);

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.nodes[0].data.tags).toEqual(['ude']);
  });

  it('mixed confidence edges round-trip', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 0, y: 0 });
    const n2 = store().addNode({ x: 0, y: 100 });
    const n3 = store().addNode({ x: 0, y: 200 });
    store().addEdge(n1, n2);
    store().addEdge(n2, n3);

    const edges = store().diagram.edges;
    store().setEdgeConfidence(edges[0].id, 'medium');
    store().setEdgeConfidence(edges[1].id, 'low');

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.edges[0].confidence).toBe('medium');
    expect(sky.edges[1].confidence).toBe('low');

    const { diagram: loaded } = convertSkyJson(sky);
    expect(loaded.edges[0].confidence).toBe('medium');
    expect(loaded.edges[1].confidence).toBe('low');
  });

  it('positions are preserved through save/load', () => {
    const store = useDiagramStore.getState;

    const n1 = store().addNode({ x: 123.45, y: 678.9 });
    store().updateNodeText(n1, 'Positioned');

    const sky = diagramToSkyJson(store().diagram);
    expect(sky.nodes[0].x).toBe(123.45);
    expect(sky.nodes[0].y).toBe(678.9);

    const { diagram: loaded, needsLayout } = convertSkyJson(sky);
    expect(needsLayout).toBe(false);
    expect(loaded.nodes[0].position.x).toBe(123.45);
    expect(loaded.nodes[0].position.y).toBe(678.9);
  });
});

describe('e2e: schema migration path', () => {
  it('v1 diagram migrates edges to have confidence', () => {
    const v1Data: Record<string, unknown> = {
      schemaVersion: 1,
      id: 'test',
      name: 'Test',
      frameworkId: 'crt',
      settings: { layoutDirection: 'BT', showGrid: true },
      nodes: [
        { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
        { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'B', tags: [], junctionType: 'or' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
      ],
    };

    const migrated = migrate(v1Data);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.settings.edgeRoutingMode).toBe('dynamic');
    expect(migrated.edges[0].confidence).toBe('high');
  });

  it('v1 diagram preserves existing confidence if present', () => {
    const v1Data: Record<string, unknown> = {
      schemaVersion: 1,
      id: 'test',
      name: 'Test',
      frameworkId: 'crt',
      settings: { layoutDirection: 'BT', showGrid: true },
      nodes: [],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', confidence: 'low' },
      ],
    };

    const migrated = migrate(v1Data);
    expect(migrated.edges[0].confidence).toBe('low');
  });
});
