import { describe, it, expect } from 'vitest';
import { migrateDiagramShape, normalizeLoadedDiagram } from '../load-helpers';
import { createEmptyDiagram, SCHEMA_VERSION } from '../../types';

describe('migrateDiagramShape', () => {
  it('returns a migrated diagram for valid input', () => {
    const raw = createEmptyDiagram('crt');
    const result = migrateDiagramShape(raw);

    expect(result).not.toBeNull();
    expect(result!.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result!.frameworkId).toBe('crt');
  });

  it('returns null for non-object input', () => {
    expect(migrateDiagramShape(null)).toBeNull();
    expect(migrateDiagramShape(undefined)).toBeNull();
    expect(migrateDiagramShape('string')).toBeNull();
    expect(migrateDiagramShape(42)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(migrateDiagramShape({})).toBeNull();
    expect(migrateDiagramShape({ schemaVersion: 1 })).toBeNull();
    expect(migrateDiagramShape({ schemaVersion: 1, id: 'x' })).toBeNull();
    expect(migrateDiagramShape({ schemaVersion: 1, id: 'x', frameworkId: 'crt' })).toBeNull();
  });

  it('returns null when schemaVersion is not a number', () => {
    const raw = { ...createEmptyDiagram('crt'), schemaVersion: 'bad' };
    expect(migrateDiagramShape(raw)).toBeNull();
  });

  it('returns null when nodes is not an array', () => {
    const raw = { ...createEmptyDiagram('crt'), nodes: 'not-an-array' };
    expect(migrateDiagramShape(raw)).toBeNull();
  });

  it('returns null when edges is not an array', () => {
    const raw = { ...createEmptyDiagram('crt'), edges: 'not-an-array' };
    expect(migrateDiagramShape(raw)).toBeNull();
  });
});

describe('normalizeLoadedDiagram', () => {
  const warningFn = (count: number) => `Dropped ${count} invalid connection(s)`;

  it('returns the diagram unchanged when valid', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'B', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.diagram).toBe(diagram);
    expect(result.framework).not.toBeNull();
    expect(result.framework!.id).toBe('crt');
    expect(result.warnings).toEqual([]);
  });

  it('warns about unknown framework but still returns diagram', () => {
    const diagram = createEmptyDiagram('nonexistent-fw');

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.framework).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Unknown framework');
    expect(result.warnings[0]).toContain('nonexistent-fw');
  });

  it('drops edges referencing non-existent nodes', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [{ id: 'e1', source: 'n1', target: 'n-missing' }];

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.diagram.edges).toHaveLength(0);
    expect(result.warnings).toContain('Dropped 1 invalid connection(s)');
  });

  it('drops self-loop edges', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [{ id: 'e1', source: 'n1', target: 'n1' }];

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.diagram.edges).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('Dropped 1'))).toBe(true);
  });

  it('drops duplicate edges', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'B', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n2' },
    ];

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.diagram.edges).toHaveLength(1);
    expect(result.diagram.edges[0].id).toBe('e1');
  });

  it('drops cycle-creating edges in DAG frameworks', () => {
    const diagram = createEmptyDiagram('crt');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'B', tags: [], junctionType: 'or' } },
      { id: 'n3', type: 'entity', position: { x: 0, y: 200 }, data: { label: 'C', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n1' }, // creates cycle
    ];

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.diagram.edges).toHaveLength(2);
    expect(result.diagram.edges.find((e) => e.id === 'e3')).toBeUndefined();
  });

  it('preserves cycles in CLD framework', () => {
    const diagram = createEmptyDiagram('cld');
    diagram.nodes = [
      { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'A', tags: [], junctionType: 'or' } },
      { id: 'n2', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'B', tags: [], junctionType: 'or' } },
      { id: 'n3', type: 'entity', position: { x: 0, y: 200 }, data: { label: 'C', tags: [], junctionType: 'or' } },
    ];
    diagram.edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n1' },
    ];

    const result = normalizeLoadedDiagram(diagram, warningFn);

    expect(result.diagram.edges).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });
});
