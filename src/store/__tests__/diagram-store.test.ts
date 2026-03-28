import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';

function resetStore() {
  useDiagramStore.getState().newDiagram();
  // Clear undo history by making a fresh start
}

describe('diagram store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addNode', () => {
    it('creates a node at the given position', () => {
      const id = useDiagramStore.getState().addNode({ x: 100, y: 200 });
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(id);
      expect(nodes[0].position).toEqual({ x: 100, y: 200 });
      expect(nodes[0].data.label).toBe('');
      expect(nodes[0].data.tags).toEqual([]);

    });

    it('enables undo after adding a node', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('addEdge', () => {
    it('creates a valid edge', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      const result = useDiagramStore.getState().addEdge(id1, id2);

      expect(result.success).toBe(true);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
    });

    it('rejects self-loop', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const result = useDiagramStore.getState().addEdge(id1, id1);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('itself');
    });

    it('rejects duplicate edge', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(id1, id2);
      const result = useDiagramStore.getState().addEdge(id1, id2);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('already exists');
    });

    it('rejects cycle', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      const id3 = useDiagramStore.getState().addNode({ x: 0, y: 200 });
      useDiagramStore.getState().addEdge(id1, id2);
      useDiagramStore.getState().addEdge(id2, id3);
      const result = useDiagramStore.getState().addEdge(id3, id1);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('cycle');
    });

    it('defaults junction to OR when second edge arrives', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 100, y: 0 });
      const id3 = useDiagramStore.getState().addNode({ x: 50, y: 100 });

      useDiagramStore.getState().addEdge(id1, id3);
      useDiagramStore.getState().addEdge(id2, id3);

      const node3 = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id3);
      expect(node3?.data.junctionType).toBe('or');
    });
  });

  describe('deleteNodes', () => {
    it('removes nodes and connected edges', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(id1, id2);

      useDiagramStore.getState().deleteNodes([id1]);

      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });
  });

  describe('undo/redo', () => {
    it('undoes addNode', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);

      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('redoes after undo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().undo();
      useDiagramStore.getState().redo();

      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    });

    it('deleteNodes restores both nodes and edges on undo', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(id1, id2);
      useDiagramStore.getState().deleteNodes([id1]);

      useDiagramStore.getState().undo();

      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
    });
  });

  describe('tags and junction', () => {
    it('updates node tags', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeTags(id, ['ude']);

      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id);
      expect(node?.data.tags).toEqual(['ude']);
    });

    it('toggles junction type', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeJunction(id, 'or');

      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id);
      expect(node?.data.junctionType).toBe('or');
    });
  });

  describe('data changes produce new node references', () => {
    // Regression: node data changes (text, tags) must produce new object
    // references in diagram.nodes so that React detects the change.
    // Previously the canvas sync only checked node count/IDs, so data
    // edits were invisible until a full refresh.

    it('updateNodeText produces a new nodes array reference', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const nodesBefore = useDiagramStore.getState().diagram.nodes;

      useDiagramStore.getState().updateNodeText(id, 'changed');
      const nodesAfter = useDiagramStore.getState().diagram.nodes;

      expect(nodesAfter).not.toBe(nodesBefore);
      expect(nodesAfter.find((n) => n.id === id)?.data.label).toBe('changed');
    });

    it('updateNodeTags produces a new nodes array reference', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const nodesBefore = useDiagramStore.getState().diagram.nodes;

      useDiagramStore.getState().updateNodeTags(id, ['ude']);
      const nodesAfter = useDiagramStore.getState().diagram.nodes;

      expect(nodesAfter).not.toBe(nodesBefore);
      expect(nodesAfter.find((n) => n.id === id)?.data.tags).toEqual(['ude']);
    });

    it('updateNodeJunction produces a new nodes array reference', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const nodesBefore = useDiagramStore.getState().diagram.nodes;

      useDiagramStore.getState().updateNodeJunction(id, 'or');
      const nodesAfter = useDiagramStore.getState().diagram.nodes;

      expect(nodesAfter).not.toBe(nodesBefore);
      expect(nodesAfter.find((n) => n.id === id)?.data.junctionType).toBe('or');
    });

    it('produces new node object reference, not mutation', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const nodeBefore = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id);

      useDiagramStore.getState().updateNodeTags(id, ['ude']);
      const nodeAfter = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id);

      expect(nodeAfter).not.toBe(nodeBefore);
      expect(nodeBefore?.data.tags).toEqual([]); // original unchanged
      expect(nodeAfter?.data.tags).toEqual(['ude']);
    });
  });

  describe('settings', () => {
    it('updates layout direction', () => {
      useDiagramStore.getState().updateSettings({ layoutDirection: 'BT' });
      expect(useDiagramStore.getState().diagram.settings.layoutDirection).toBe('BT');
    });

    it('toggles grid', () => {
      useDiagramStore.getState().updateSettings({ showGrid: false });
      expect(useDiagramStore.getState().diagram.settings.showGrid).toBe(false);
    });
  });
});
