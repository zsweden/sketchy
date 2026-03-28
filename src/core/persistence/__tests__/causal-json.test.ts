import { describe, it, expect } from 'vitest';
import { isSkyJson, convertSkyJson, diagramToSkyJson } from '../causal-json';
import { createEmptyDiagram } from '../../types';

const minimal = {
  nodes: [
    { id: 'n1', label: 'Root cause' },
    { id: 'n2', label: 'Effect', isUDE: true },
  ],
  edges: [{ source: 'n1', target: 'n2' }],
};

describe('isSkyJson', () => {
  it('detects valid sky JSON', () => {
    expect(isSkyJson(minimal)).toBe(true);
  });

  it('rejects null / non-objects', () => {
    expect(isSkyJson(null)).toBe(false);
    expect(isSkyJson('string')).toBe(false);
    expect(isSkyJson(42)).toBe(false);
  });

  it('rejects objects without nodes array', () => {
    expect(isSkyJson({ edges: [] })).toBe(false);
  });

  it('rejects objects without edges array', () => {
    expect(isSkyJson({ nodes: [{ id: 'n1', label: 'A' }] })).toBe(false);
  });

  it('rejects nodes missing label (looks like a regular diagram)', () => {
    expect(
      isSkyJson({
        nodes: [{ id: 'n1', data: { label: 'A' } }],
        edges: [],
      }),
    ).toBe(false);
  });

  it('rejects data that has schemaVersion (full diagram format)', () => {
    expect(
      isSkyJson({ ...minimal, schemaVersion: 1, id: 'x', frameworkId: 'crt' }),
    ).toBe(false);
  });

  it('accepts format with optional top-level fields', () => {
    expect(isSkyJson({ ...minimal, name: 'My Diagram', direction: 'TB' })).toBe(true);
  });
});

describe('convertSkyJson', () => {
  it('converts nodes with correct structure', () => {
    const { diagram } = convertSkyJson(minimal);

    expect(diagram.nodes).toHaveLength(2);
    const n1 = diagram.nodes.find((n) => n.id === 'n1')!;
    expect(n1.type).toBe('entity');
    expect(n1.data.label).toBe('Root cause');
    expect(n1.data.tags).toEqual([]);
  });

  it('maps isUDE to ude tag', () => {
    const { diagram } = convertSkyJson(minimal);
    const n2 = diagram.nodes.find((n) => n.id === 'n2')!;
    expect(n2.data.tags).toEqual(['ude']);
  });

  it('generates edge IDs', () => {
    const { diagram } = convertSkyJson(minimal);
    expect(diagram.edges).toHaveLength(1);
    expect(diagram.edges[0].source).toBe('n1');
    expect(diagram.edges[0].target).toBe('n2');
    expect(diagram.edges[0].id).toBeTruthy();
  });

  it('defaults to CRT framework', () => {
    const { diagram } = convertSkyJson(minimal);
    expect(diagram.frameworkId).toBe('crt');
  });

  it('uses optional top-level fields', () => {
    const { diagram } = convertSkyJson({
      ...minimal,
      name: 'My Tree',
      framework: 'crt',
      direction: 'TB',
      showGrid: false,
    });
    expect(diagram.name).toBe('My Tree');
    expect(diagram.settings.layoutDirection).toBe('TB');
    expect(diagram.settings.showGrid).toBe(false);
  });

  it('defaults junctionType to or', () => {
    const { diagram } = convertSkyJson(minimal);
    for (const node of diagram.nodes) {
      expect(node.data.junctionType).toBe('or');
    }
  });

  it('applies AND junctions from junctions array', () => {
    const data = {
      nodes: [
        { id: 'n1', label: 'Cause A' },
        { id: 'n2', label: 'Cause B' },
        { id: 'n3', label: 'Combined effect' },
      ],
      edges: [
        { source: 'n1', target: 'n3' },
        { source: 'n2', target: 'n3' },
      ],
      junctions: [{ target: 'n3', type: 'and' as const, sources: ['n1', 'n2'] }],
    };

    const { diagram } = convertSkyJson(data);
    const n3 = diagram.nodes.find((n) => n.id === 'n3')!;
    expect(n3.data.junctionType).toBe('and');
  });

  it('needs layout when no positions', () => {
    const { needsLayout } = convertSkyJson(minimal);
    expect(needsLayout).toBe(true);
  });

  it('skips layout when all nodes have positions', () => {
    const { needsLayout } = convertSkyJson({
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0 },
        { id: 'n2', label: 'B', x: 100, y: 100 },
      ],
      edges: [{ source: 'n1', target: 'n2' }],
    });
    expect(needsLayout).toBe(false);
  });

  it('needs layout when some nodes missing positions', () => {
    const { needsLayout } = convertSkyJson({
      nodes: [
        { id: 'n1', label: 'A', x: 0, y: 0 },
        { id: 'n2', label: 'B' },
      ],
      edges: [{ source: 'n1', target: 'n2' }],
    });
    expect(needsLayout).toBe(true);
  });

  it('preserves notes', () => {
    const { diagram } = convertSkyJson({
      nodes: [{ id: 'n1', label: 'A', notes: 'some note' }],
      edges: [],
    });
    expect(diagram.nodes[0].data.notes).toBe('some note');
  });
});

describe('diagramToSkyJson', () => {
  it('round-trips a diagram', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 10, y: 20 }, data: { label: 'Root', tags: ['ude'], junctionType: 'or', notes: 'a note' } },
      { id: 'n2', type: 'entity', position: { x: 30, y: 40 }, data: { label: 'Effect', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

    const skyJson = diagramToSkyJson(diagram);

    expect(skyJson.nodes).toHaveLength(2);
    expect(skyJson.nodes[0].label).toBe('Root');
    expect(skyJson.nodes[0].isUDE).toBe(true);
    expect(skyJson.nodes[0].x).toBe(10);
    expect(skyJson.nodes[0].y).toBe(20);
    expect(skyJson.nodes[0].notes).toBe('a note');
    expect(skyJson.edges).toHaveLength(1);
    expect(skyJson.edges[0].source).toBe('n1');
  });

  it('includes junctions for AND nodes with 2+ incoming', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'B', tags: [], junctionType: 'or' } },
      { id: 'n3', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'C', tags: [], junctionType: 'and' } },
    ];
    diagram.edges = [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ];

    const skyJson = diagramToSkyJson(diagram);
    expect(skyJson.junctions).toHaveLength(1);
    expect(skyJson.junctions![0].target).toBe('n3');
    expect(skyJson.junctions![0].sources).toContain('n1');
    expect(skyJson.junctions![0].sources).toContain('n2');
  });

  it('omits junctions when none exist', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [];

    const skyJson = diagramToSkyJson(diagram);
    expect(skyJson.junctions).toBeUndefined();
  });
});
