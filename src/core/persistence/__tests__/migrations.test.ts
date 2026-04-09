import { describe, it, expect } from 'vitest';
import { migrations } from '../migrations';
import { migrate } from '../schema';
import { SCHEMA_VERSION } from '../../types';

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

  describe('v5 → v6', () => {
    it('bumps schemaVersion to 6 without altering nodes', () => {
      const data = {
        schemaVersion: 5,
        id: 'test',
        name: 'Test',
        frameworkId: 'vdt',
        settings: {
          layoutDirection: 'BT',
          showGrid: true,
          snapToGrid: false,
          edgeRoutingMode: 'fixed',
        },
        nodes: [
          { id: 'n1', type: 'entity', position: { x: 0, y: 0 }, data: { label: 'Revenue', tags: [], junctionType: 'add' } },
        ],
        edges: [],
      };

      const result = migrations[5](data);
      expect(result.schemaVersion).toBe(6);
      const nodes = result.nodes as Array<Record<string, unknown>>;
      expect(nodes).toHaveLength(1);
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
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result.settings).toMatchObject({ edgeRoutingMode: 'dynamic' });
      expect(result.edges[0]).toMatchObject({ confidence: 'high' });
    });

    it('normalizes legacy corner handles to explicit directional handles', () => {
      const v3Data = {
        schemaVersion: 3,
        id: 'test',
        name: 'Test',
        frameworkId: 'crt',
        settings: { layoutDirection: 'BT', showGrid: true, snapToGrid: false, edgeRoutingMode: 'fixed' },
        nodes: [
          { id: 'a', type: 'entity', position: { x: 0, y: 100 }, data: { label: 'A', tags: [], junctionType: 'or' } },
          { id: 'b', type: 'entity', position: { x: 300, y: 0 }, data: { label: 'B', tags: [], junctionType: 'or' } },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b', sourceSide: 'topright', targetSide: 'topleft' }],
      };

      const result = migrate(v3Data);
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result.edges[0]).toMatchObject({
        sourceSide: 'topright-right',
        targetSide: 'topleft-left',
      });
    });
  });
});
