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
});
