import { describe, it, expect } from 'vitest';
import { validateDiagramShape, migrate } from '../schema';
import { SCHEMA_VERSION } from '../../types';

describe('validateDiagramShape', () => {
  it('accepts valid diagram', () => {
    expect(
      validateDiagramShape({
        schemaVersion: 1,
        id: 'test',
        name: 'Test',
        frameworkId: 'crt',
        settings: { layoutDirection: 'TB', showGrid: true },
        nodes: [],
        edges: [],
      }),
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(validateDiagramShape(null)).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(validateDiagramShape({ schemaVersion: 1 })).toBe(false);
    expect(validateDiagramShape({ id: 'test' })).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validateDiagramShape('string')).toBe(false);
    expect(validateDiagramShape(42)).toBe(false);
  });
});

describe('migrate', () => {
  it('passes through current version unchanged', () => {
    const data = {
      schemaVersion: SCHEMA_VERSION,
      id: 'test',
      frameworkId: 'crt',
      nodes: [],
      edges: [],
    };
    const result = migrate(data);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('throws on future version', () => {
    expect(() =>
      migrate({ schemaVersion: SCHEMA_VERSION + 1 }),
    ).toThrow('newer than supported');
  });

  it('normalizes malformed current-version node, edge, and annotation fields', () => {
    const result = migrate({
      schemaVersion: SCHEMA_VERSION,
      id: 'test',
      frameworkId: 'crt',
      settings: { layoutDirection: 'sideways', showGrid: 'yes' },
      nodes: [
        {
          id: 'n1',
          type: 'unknown',
          position: { x: 10, y: 'bad' },
          size: { width: 180, height: 90 },
          data: {
            label: 123,
            tags: ['ude', 'ude', 7],
            junctionType: 'xor',
            value: Number.NaN,
            locked: 'true',
          },
        },
        { id: 7, data: {} },
      ],
      edges: [
        {
          id: '',
          source: 'n1',
          target: 'n2',
          sourceSide: 'not-a-side',
          confidence: 'certain',
          delay: true,
          notes: 'edge note',
        },
        { id: 'bad', source: null, target: 'n1' },
      ],
      annotations: [
        {
          id: '',
          kind: 'triangle',
          position: { x: 'bad', y: 12 },
          size: { width: 100, height: 40 },
          data: { text: 'note', strokeWidth: -1, fontSize: 14, flipped: true },
        },
        { id: 'bad-size', kind: 'rect', size: { width: 0, height: 10 } },
      ],
    });

    expect(result.settings).toMatchObject({ layoutDirection: 'BT', showGrid: true });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: 'n1',
      type: 'entity',
      position: { x: 10, y: 0 },
      size: { width: 180, height: 90 },
      data: { label: '', tags: ['ude'], junctionType: 'or' },
    });
    expect(result.nodes[0].data.locked).toBeUndefined();
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: 'edge-1',
      source: 'n1',
      target: 'n2',
      delay: true,
      notes: 'edge note',
    });
    expect(result.edges[0].sourceSide).toBeUndefined();
    expect(result.edges[0].confidence).toBeUndefined();
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toMatchObject({
      id: 'annotation-1',
      kind: 'rect',
      position: { x: 0, y: 12 },
      size: { width: 100, height: 40 },
      data: { text: 'note', fontSize: 14, flipped: true },
    });
    expect(result.annotations[0].data.strokeWidth).toBeUndefined();
  });
});
