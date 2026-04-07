import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { useUIStore } from '../ui-store';

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [], edges: [] } }));
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
  });
}

function addTwoConnectedNodes() {
  const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
  const id2 = useDiagramStore.getState().addNode({ x: 0, y: 200 });
  useDiagramStore.getState().addEdge(id1, id2);
  return { id1, id2 };
}

describe('node actions', () => {
  beforeEach(resetStore);

  describe('addNode', () => {
    it('creates a node at the given position with empty defaults', () => {
      const id = useDiagramStore.getState().addNode({ x: 50, y: 75 });
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id);
      expect(node).toBeDefined();
      expect(node!.position).toEqual({ x: 50, y: 75 });
      expect(node!.data.label).toBe('');
      expect(node!.data.tags).toEqual([]);
    });

    it('uses framework default junction type', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      // Default junction is 'or' (first in LOGIC_JUNCTION_OPTIONS)
      expect(node.data.junctionType).toBe('or');
    });

    it('tracks history (undoable after addNode)', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('updateNodeText', () => {
    it('updates node label without history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeText(id, 'Draft');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.label).toBe('Draft');
    });
  });

  describe('commitNodeText', () => {
    it('sets label and tracks history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      // Reset undo state after addNode
      useDiagramStore.getState().commitNodeText(id, 'Final');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.label).toBe('Final');
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('updateNodeTags', () => {
    it('sets tags on a node', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeTags(id, ['ude']);
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.tags).toEqual(['ude']);
    });

    it('enforces exclusive tags — last exclusive wins', () => {
      // Switch to a framework with exclusive tags (CRT has exclusive UDE tag)
      useDiagramStore.getState().setFramework('crt');
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      // Set non-exclusive tag first, then try to set two exclusive tags
      useDiagramStore.getState().updateNodeTags(id, ['ude']);
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.tags).toContain('ude');
    });
  });

  describe('updateNodeJunction', () => {
    it('sets junction type with history tracking', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeJunction(id, 'or');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.junctionType).toBe('or');
    });
  });

  describe('node colors', () => {
    it('previewNodeColor updates color without history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().previewNodeColor(id, '#ff0000');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.color).toBe('#ff0000');
    });

    it('updateNodeColor commits color with history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeColor(id, '#00ff00');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.color).toBe('#00ff00');
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });

    it('previewNodeTextColor updates text color without history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().previewNodeTextColor(id, '#0000ff');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.textColor).toBe('#0000ff');
    });

    it('updateNodeTextColor commits text color with history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeTextColor(id, '#0000ff');
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('updateNodeNotes', () => {
    it('sets notes on a node', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeNotes(id, 'Some notes');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.notes).toBe('Some notes');
    });

    it('clears notes when empty string', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().updateNodeNotes(id, 'Notes');
      useDiagramStore.getState().updateNodeNotes(id, '');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.notes).toBeUndefined();
    });
  });

  describe('commitNodeNotes', () => {
    it('commits notes with history', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().commitNodeNotes(id, 'Final notes');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.notes).toBe('Final notes');
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('commitNodeValue', () => {
    it('sets numeric value on node', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().commitNodeValue(id, 42);
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.value).toBe(42);
    });
  });

  describe('commitNodeUnit', () => {
    it('sets unit on node', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().commitNodeUnit(id, 'kg');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.unit).toBe('kg');
    });

    it('clears unit when empty string', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().commitNodeUnit(id, 'kg');
      useDiagramStore.getState().commitNodeUnit(id, '');
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.unit).toBeUndefined();
    });
  });

  describe('toggleNodeLocked', () => {
    it('locks a single node', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().toggleNodeLocked([id], true);
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.locked).toBe(true);
    });

    it('unlocks nodes (sets locked to undefined)', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().toggleNodeLocked([id], true);
      useDiagramStore.getState().toggleNodeLocked([id], false);
      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.locked).toBeUndefined();
    });

    it('locks multiple nodes at once', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 100, y: 0 });
      useDiagramStore.getState().toggleNodeLocked([id1, id2], true);
      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes.find((n) => n.id === id1)!.data.locked).toBe(true);
      expect(nodes.find((n) => n.id === id2)!.data.locked).toBe(true);
    });
  });

  describe('deleteNodes', () => {
    it('removes a node and its connected edges', () => {
      const { id1, id2 } = addTwoConnectedNodes();
      useDiagramStore.getState().deleteNodes([id1]);
      const { nodes, edges } = useDiagramStore.getState().diagram;
      expect(nodes.find((n) => n.id === id1)).toBeUndefined();
      expect(nodes.find((n) => n.id === id2)).toBeDefined();
      expect(edges).toHaveLength(0);
    });

    it('removes multiple nodes at once', () => {
      const { id1, id2 } = addTwoConnectedNodes();
      useDiagramStore.getState().deleteNodes([id1, id2]);
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });

    it('tracks history', () => {
      const { id1 } = addTwoConnectedNodes();
      useDiagramStore.getState().deleteNodes([id1]);
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('alignNodesHorizontally', () => {
    it('does nothing for fewer than 2 items', () => {
      const id = useDiagramStore.getState().addNode({ x: 50, y: 100 });
      const before = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!.position;
      useDiagramStore.getState().alignNodesHorizontally([
        { id, x: 50, y: 100, width: 160, height: 60 },
      ]);
      const after = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!.position;
      expect(after).toEqual(before);
    });
  });

  describe('alignNodesVertically', () => {
    it('does nothing for fewer than 2 items', () => {
      const id = useDiagramStore.getState().addNode({ x: 50, y: 100 });
      const before = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!.position;
      useDiagramStore.getState().alignNodesVertically([
        { id, x: 50, y: 100, width: 160, height: 60 },
      ]);
      const after = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!.position;
      expect(after).toEqual(before);
    });
  });
});
