import { describe, it, expect } from 'vitest';
import { migrations } from '../migrations';
import { migrate } from '../schema';

describe('migrations', () => {
  describe('v1 → v2', () => {
    const v1Base = {
      schemaVersion: 1,
      id: 'test',
      name: 'Test',
      frameworkId: 'crt',
      settings: { layoutDirection: 'BT', showGrid: true },
      nodes: [],
    };

    it('adds confidence="high" to edges without it', () => {
      const data = {
        ...v1Base,
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      };

      const result = migrations[1](data);
      const edges = result.edges as Array<Record<string, unknown>>;
      expect(edges[0].confidence).toBe('high');
      expect(edges[1].confidence).toBe('high');
    });

    it('preserves existing confidence values', () => {
      const data = {
        ...v1Base,
        edges: [
          { id: 'e1', source: 'a', target: 'b', confidence: 'low' },
          { id: 'e2', source: 'b', target: 'c', confidence: 'medium' },
        ],
      };

      const result = migrations[1](data);
      const edges = result.edges as Array<Record<string, unknown>>;
      expect(edges[0].confidence).toBe('low');
      expect(edges[1].confidence).toBe('medium');
    });

    it('handles empty edges array', () => {
      const data = { ...v1Base, edges: [] };

      const result = migrations[1](data);
      const edges = result.edges as Array<Record<string, unknown>>;
      expect(edges).toEqual([]);
    });

    it('updates schemaVersion to 2', () => {
      const data = { ...v1Base, edges: [] };

      const result = migrations[1](data);
      expect(result.schemaVersion).toBe(2);
    });
  });

  describe('migrate() integration', () => {
    it('migrates v1 data through to current version', () => {
      const v1Data = {
        schemaVersion: 1,
        id: 'test',
        name: 'Test',
        frameworkId: 'crt',
        settings: { layoutDirection: 'BT', showGrid: true },
        nodes: [],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      };

      const result = migrate(v1Data);
      expect(result.schemaVersion).toBe(3);
      expect(result.settings).toMatchObject({ edgeRoutingMode: 'dynamic' });
      expect(result.edges[0]).toMatchObject({ confidence: 'high' });
    });
  });
});
