import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { getOptimizedEdgePlacements } from '../diagram-helpers';

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  // Clear undo history by making a fresh start
}

function getPlacementSnapshot() {
  const { diagram } = useDiagramStore.getState();
  const placements = getOptimizedEdgePlacements(diagram.edges, diagram.nodes, diagram.settings);
  return new Map(
    diagram.edges.map((edge) => {
      const placement = placements.get(edge.id);
      return [edge.id, placement ? `${placement.sourceSide}:${placement.targetSide}` : null];
    }),
  );
}

function getStoredSnapshot() {
  const { diagram } = useDiagramStore.getState();
  return new Map(
    diagram.edges.map((edge) => [edge.id, `${edge.sourceSide}:${edge.targetSide}`]),
  );
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

    it('allows cycles for CLD and defaults polarity to positive', () => {
      useDiagramStore.getState().setFramework('cld');
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      const id3 = useDiagramStore.getState().addNode({ x: 0, y: 200 });

      useDiagramStore.getState().addEdge(id1, id2);
      useDiagramStore.getState().addEdge(id2, id3);
      const result = useDiagramStore.getState().addEdge(id3, id1);

      expect(result.success).toBe(true);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(3);
      expect(useDiagramStore.getState().diagram.edges[0].polarity).toBe('positive');
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

    it('does not enable undo until a dragged move is committed', () => {
      const id = 'drag-node';
      useDiagramStore.setState((state) => ({
        diagram: {
          ...state.diagram,
          nodes: [
            {
              id,
              type: 'entity',
              position: { x: 0, y: 0 },
              data: { label: '', tags: [], junctionType: 'or' },
            },
          ],
        },
      }));
      const canUndoBefore = useDiagramStore.getState().canUndo;

      useDiagramStore.getState().dragNodes([{ id, position: { x: 80, y: 120 } }]);

      expect(useDiagramStore.getState().diagram.nodes[0]?.position).toEqual({ x: 80, y: 120 });
      expect(useDiagramStore.getState().canUndo).toBe(canUndoBefore);
    });

    it('restores the previous node position when a dragged move is undone', () => {
      const id = 'drag-node';
      useDiagramStore.setState((state) => ({
        diagram: {
          ...state.diagram,
          nodes: [
            {
              id,
              type: 'entity',
              position: { x: 0, y: 0 },
              data: { label: '', tags: [], junctionType: 'or' },
            },
          ],
        },
      }));

      useDiagramStore.getState().dragNodes([{ id, position: { x: 80, y: 120 } }]);
      useDiagramStore.getState().commitDraggedNodes();

      expect(useDiagramStore.getState().canUndo).toBe(true);

      useDiagramStore.getState().undo();

      expect(useDiagramStore.getState().diagram.nodes[0]?.position).toEqual({ x: 0, y: 0 });
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

    it('freezes current edge sides when routing mode switches to fixed', () => {
      const leftId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const rightId = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(leftId, rightId);

      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });

      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(useDiagramStore.getState().diagram.settings.edgeRoutingMode).toBe('fixed');
      expect(edge.sourceSide).toBe('right');
      expect(edge.targetSide).toBe('left');
    });

    it('captures the final dynamic edge state when switching back to fixed', () => {
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 200, y: 0 });

      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      useDiagramStore.getState().addEdge(sourceId, targetId);

      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });
      useDiagramStore.getState().moveNodes([{ id: targetId, position: { x: 0, y: 200 } }]);
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });

      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('bottom');
      expect(edge.targetSide).toBe('top');
    });

    it('preserves stored fixed edge sides when loading a fixed diagram', () => {
      useDiagramStore.getState().loadDiagram({
        schemaVersion: 3,
        id: 'diagram-1',
        name: 'Loaded Diagram',
        frameworkId: 'crt',
        settings: {
          layoutDirection: 'BT',
          showGrid: true,
          snapToGrid: false,
          edgeRoutingMode: 'fixed',
        },
        nodes: [
          {
            id: 'n1',
            type: 'entity',
            position: { x: 0, y: 0 },
            data: { label: 'A', tags: [], junctionType: 'or' },
          },
          {
            id: 'n2',
            type: 'entity',
            position: { x: 0, y: 200 },
            data: { label: 'B', tags: [], junctionType: 'or' },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            sourceSide: 'left',
            targetSide: 'right',
          },
        ],
      });

      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('left');
      expect(edge.targetSide).toBe('right');
    });

    it('preserves explicit handle sides for new edges in fixed mode', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 200 });

      const result = useDiagramStore.getState().addEdge(id1, id2, {
        sourceHandleId: 'source-left',
        targetHandleId: 'target-right',
      });

      expect(result.success).toBe(true);
      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('left');
      expect(edge.targetSide).toBe('right');
    });

    it('blocks edge anchor move in dynamic mode and returns sentinel', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(id1, id2);

      // Try to reconnect to different anchors
      const result = useDiagramStore.getState().addEdge(id1, id2, {
        sourceHandleId: 'source-top',
        targetHandleId: 'target-bottom',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('dynamic-edge-move');
      // Edge should remain unchanged
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
    });

    it('allows edge anchor move in fixed mode', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(id1, id2);

      const result = useDiagramStore.getState().addEdge(id1, id2, {
        sourceHandleId: 'source-top',
        targetHandleId: 'target-bottom',
      });

      expect(result.success).toBe(true);
      expect(result.reason).toBe('Edge moved');
      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('top');
      expect(edge.targetSide).toBe('bottom');
    });

    it('auto edges persists the canonical fresh routing result', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      useDiagramStore.getState().moveNodes([{ id: targetId, position: { x: 0, y: 200 } }]);

      const expectedPlacements = getPlacementSnapshot();

      const optimized = useDiagramStore.getState().optimizeEdges();

      expect(optimized).toBe(true);
      expect(getStoredSnapshot()).toEqual(expectedPlacements);
    });

    it('does not optimize edges while routing is set to dynamic', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });
      useDiagramStore.getState().moveNodes([{ id: targetId, position: { x: 0, y: 200 } }]);

      const optimized = useDiagramStore.getState().optimizeEdges();

      expect(optimized).toBe(false);
      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('right');
      expect(edge.targetSide).toBe('left');
    });

    it('auto edges overwrites manual anchors with the fresh solver result', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 0, y: 200 });
      useDiagramStore.getState().addEdge(sourceId, targetId, {
        sourceHandleId: 'source-left',
        targetHandleId: 'target-right',
      });

      const optimized = useDiagramStore.getState().optimizeEdges();

      expect(optimized).toBe(true);
      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('bottom');
      expect(edge.targetSide).toBe('top');
    });

    it('switching to dynamic after auto edges keeps the same placements', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });

      const edge1Source = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const edge1Target = useDiagramStore.getState().addNode({ x: -200, y: -200 });
      useDiagramStore.getState().addEdge(edge1Source, edge1Target, {
        sourceHandleId: 'source-bottom',
        targetHandleId: 'target-top',
      });

      const edge2Source = useDiagramStore.getState().addNode({ x: -200, y: 0 });
      const edge2Target = useDiagramStore.getState().addNode({ x: 0, y: -200 });
      useDiagramStore.getState().addEdge(edge2Source, edge2Target, {
        sourceHandleId: 'source-top',
        targetHandleId: 'target-bottom',
      });

      const optimized = useDiagramStore.getState().optimizeEdges();
      expect(optimized).toBe(true);
      const fixedPlacements = getStoredSnapshot();

      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'dynamic' });

      expect(getPlacementSnapshot()).toEqual(fixedPlacements);
    });

    it('optimizeEdgesAfterLayout updates edges without pushing history', () => {
      useDiagramStore.getState().updateSettings({ edgeRoutingMode: 'fixed' });
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 200, y: 0 });
      useDiagramStore.getState().addEdge(sourceId, targetId);
      useDiagramStore.getState().moveNodes([{ id: targetId, position: { x: 0, y: 200 } }]);

      // Snapshot history length before
      useDiagramStore.getState().commitToHistory();
      const canUndoBefore = useDiagramStore.getState().canUndo;

      useDiagramStore.getState().optimizeEdgesAfterLayout();

      // canUndo should not have changed (no extra history push)
      expect(useDiagramStore.getState().canUndo).toBe(canUndoBefore);

      // Edges should be optimized
      const edge = useDiagramStore.getState().diagram.edges[0];
      expect(edge.sourceSide).toBe('bottom');
      expect(edge.targetSide).toBe('top');
    });

    it('optimizeEdgesAfterLayout is a no-op in dynamic mode', () => {
      const sourceId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const targetId = useDiagramStore.getState().addNode({ x: 0, y: 200 });
      useDiagramStore.getState().addEdge(sourceId, targetId);

      const edgeBefore = useDiagramStore.getState().diagram.edges[0];

      useDiagramStore.getState().optimizeEdgesAfterLayout();

      const edgeAfter = useDiagramStore.getState().diagram.edges[0];
      expect(edgeAfter.sourceSide).toBe(edgeBefore.sourceSide);
      expect(edgeAfter.targetSide).toBe(edgeBefore.targetSide);
    });
  });
});
