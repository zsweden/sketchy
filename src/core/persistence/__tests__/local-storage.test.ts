import { describe, it, expect, beforeEach } from 'vitest';
import { saveDiagram, loadDiagram, clearDiagram } from '../local-storage';
import { createEmptyDiagram } from '../../types';

/**
 * Node.js 25+ ships a native `localStorage` global that shadows jsdom's.
 * The native version has no methods when `--localstorage-file` is absent.
 * We replace it with a simple in-memory implementation so that both the
 * source module and tests share the same working Storage.
 */
function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

const memoryLocalStorage = createMemoryStorage();

// Patch globalThis.localStorage so the source module's bare `localStorage`
// references resolve to our working implementation.
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryLocalStorage,
  configurable: true,
  writable: true,
});

describe('local-storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('save and load round-trip', () => {
    it('saves and loads a valid diagram', () => {
      const diagram = createEmptyDiagram('crt');
      saveDiagram(diagram);

      const result = loadDiagram();
      expect(result.diagram).toEqual(diagram);
      expect(result.error).toBeUndefined();
    });
  });

  describe('loadDiagram', () => {
    it('returns null when nothing is saved', () => {
      const result = loadDiagram();
      expect(result.diagram).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('handles corrupted JSON (returns error, backs up to localStorage)', () => {
      sessionStorage.setItem('sketchy_diagram', '{not valid json!!!');

      const result = loadDiagram();
      expect(result.diagram).toBeNull();
      expect(result.error).toBe(
        'Saved data was corrupted and could not be loaded',
      );

      // Should have backed up raw data to localStorage
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sketchy_backup_')) keys.push(k);
      }
      expect(keys.length).toBe(1);
      expect(localStorage.getItem(keys[0])).toBe('{not valid json!!!');
    });

    it('handles invalid diagram shape (returns error, backs up)', () => {
      // Valid JSON but missing required diagram fields
      const invalidDiagram = JSON.stringify({ foo: 'bar' });
      sessionStorage.setItem('sketchy_diagram', invalidDiagram);

      const result = loadDiagram();
      expect(result.diagram).toBeNull();
      expect(result.error).toBe(
        'Saved data was corrupted and could not be loaded',
      );

      // Should have backed up
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sketchy_backup_')) keys.push(k);
      }
      expect(keys.length).toBe(1);
      expect(localStorage.getItem(keys[0])).toBe(invalidDiagram);
    });

    it('sanitizes dangling edges and returns warnings', () => {
      const diagram = createEmptyDiagram('crt');
      diagram.nodes = [
        {
          id: 'n1',
          type: 'entity',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1', tags: [], junctionType: 'or' },
        },
        {
          id: 'n2',
          type: 'entity',
          position: { x: 0, y: 100 },
          data: { label: 'Node 2', tags: [], junctionType: 'or' },
        },
      ];
      diagram.edges = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n1', target: 'ghost' },
      ];

      saveDiagram(diagram);
      const result = loadDiagram();

      expect(result.diagram).not.toBeNull();
      expect(result.diagram!.edges).toHaveLength(1);
      expect(result.diagram!.edges[0].id).toBe('e1');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain('errors and was sanitized');
    });
  });

  describe('clearDiagram', () => {
    it('removes the saved data', () => {
      const diagram = createEmptyDiagram('crt');
      saveDiagram(diagram);
      expect(sessionStorage.getItem('sketchy_diagram')).not.toBeNull();

      clearDiagram();
      expect(sessionStorage.getItem('sketchy_diagram')).toBeNull();

      const result = loadDiagram();
      expect(result.diagram).toBeNull();
    });
  });

  describe('saveDiagram', () => {
    it('silently fails when storage is unavailable', () => {
      const diagram = createEmptyDiagram('crt');

      // Mock sessionStorage.setItem to throw
      const original = sessionStorage.setItem.bind(sessionStorage);
      sessionStorage.setItem = () => {
        throw new DOMException('QuotaExceededError');
      };

      // Should not throw
      expect(() => saveDiagram(diagram)).not.toThrow();

      sessionStorage.setItem = original;
    });
  });
});
