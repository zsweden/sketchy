import { describe, it, expect } from 'vitest';
import { isCausalJson, convertCausalJson } from '../causal-json';

const minimal = {
  nodes: [
    { id: 'n1', label: 'Root cause' },
    { id: 'n2', label: 'Effect', isUDE: true },
  ],
  edges: [{ source: 'n1', target: 'n2' }],
};

describe('isCausalJson', () => {
  it('detects valid causal JSON', () => {
    expect(isCausalJson(minimal)).toBe(true);
  });

  it('rejects null / non-objects', () => {
    expect(isCausalJson(null)).toBe(false);
    expect(isCausalJson('string')).toBe(false);
    expect(isCausalJson(42)).toBe(false);
  });

  it('rejects objects without nodes array', () => {
    expect(isCausalJson({ edges: [] })).toBe(false);
  });

  it('rejects objects without edges array', () => {
    expect(isCausalJson({ nodes: [{ id: 'n1', label: 'A' }] })).toBe(false);
  });

  it('rejects nodes missing label (looks like a regular diagram)', () => {
    expect(
      isCausalJson({
        nodes: [{ id: 'n1', data: { label: 'A' } }],
        edges: [],
      }),
    ).toBe(false);
  });

  it('rejects data that has schemaVersion (full diagram format)', () => {
    expect(
      isCausalJson({ ...minimal, schemaVersion: 1, id: 'x', frameworkId: 'crt' }),
    ).toBe(false);
  });
});

describe('convertCausalJson', () => {
  it('converts nodes with correct structure', () => {
    const diagram = convertCausalJson(minimal);

    expect(diagram.nodes).toHaveLength(2);
    const n1 = diagram.nodes.find((n) => n.id === 'n1')!;
    expect(n1.type).toBe('entity');
    expect(n1.data.label).toBe('Root cause');
    expect(n1.data.tags).toEqual([]);
    expect(n1.pinned).toBe(false);
  });

  it('maps isUDE to ude tag', () => {
    const diagram = convertCausalJson(minimal);

    const n2 = diagram.nodes.find((n) => n.id === 'n2')!;
    expect(n2.data.tags).toEqual(['ude']);
  });

  it('generates edge IDs', () => {
    const diagram = convertCausalJson(minimal);

    expect(diagram.edges).toHaveLength(1);
    expect(diagram.edges[0].source).toBe('n1');
    expect(diagram.edges[0].target).toBe('n2');
    expect(diagram.edges[0].id).toBeTruthy();
  });

  it('defaults to CRT framework', () => {
    const diagram = convertCausalJson(minimal);
    expect(diagram.frameworkId).toBe('crt');
  });

  it('sets schemaVersion and generates id', () => {
    const diagram = convertCausalJson(minimal);
    expect(diagram.schemaVersion).toBe(1);
    expect(diagram.id).toBeTruthy();
  });

  it('defaults junctionType to or', () => {
    const diagram = convertCausalJson(minimal);

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
      junctions: [{ target: 'n3', type: 'and', sources: ['n1', 'n2'] }],
    };

    const diagram = convertCausalJson(data);
    const n3 = diagram.nodes.find((n) => n.id === 'n3')!;
    expect(n3.data.junctionType).toBe('and');
  });

  it('handles missing junctions array gracefully', () => {
    const data = {
      nodes: [{ id: 'n1', label: 'A' }],
      edges: [],
    };

    const diagram = convertCausalJson(data);
    expect(diagram.nodes[0].data.junctionType).toBe('or');
  });

  it('converts the full scenario1 format', () => {
    const scenario = {
      nodes: [
        { id: 'n1', label: 'Monolithic legacy architecture' },
        { id: 'n2', label: 'High technical debt' },
        { id: 'n5', label: 'Slow release cycles', isUDE: true },
        { id: 'n6', label: 'Tests tied to implementation details' },
        { id: 'n7', label: 'Underpowered CI infrastructure' },
        { id: 'n8', label: 'Unreliable test suite' },
      ],
      edges: [
        { source: 'n1', target: 'n2' },
        { source: 'n6', target: 'n8' },
        { source: 'n7', target: 'n8' },
      ],
      junctions: [
        { target: 'n8', type: 'and', sources: ['n6', 'n7'] },
      ],
    };

    const diagram = convertCausalJson(scenario);

    expect(diagram.nodes).toHaveLength(6);
    expect(diagram.edges).toHaveLength(3);

    const n5 = diagram.nodes.find((n) => n.id === 'n5')!;
    expect(n5.data.tags).toEqual(['ude']);

    const n8 = diagram.nodes.find((n) => n.id === 'n8')!;
    expect(n8.data.junctionType).toBe('and');

    const n1 = diagram.nodes.find((n) => n.id === 'n1')!;
    expect(n1.data.tags).toEqual([]);
    expect(n1.data.junctionType).toBe('or');
  });
});
