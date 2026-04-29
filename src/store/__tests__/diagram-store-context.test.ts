import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { useUIStore } from '../ui-store';
import type { DiagramNode } from '../../core/types';

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [] } }));
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    toasts: [],
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
  });
}

function seedNode(id: string, x: number, y: number): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x, y },
    data: { label: '', tags: [], junctionType: 'or' },
  };
}

describe('diagram-store-context', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('moveNodes', () => {
    it('moves a node without pushing additional history', () => {
      useDiagramStore.setState((s) => ({
        diagram: { ...s.diagram, nodes: [seedNode('n1', 0, 0)] },
      }));
      const canUndoBefore = useDiagramStore.getState().canUndo;

      useDiagramStore.getState().moveNodes([{ id: 'n1', position: { x: 50, y: 75 } }]);

      expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 50, y: 75 });
      // moveNodes should not change undo state (no history push)
      expect(useDiagramStore.getState().canUndo).toBe(canUndoBefore);
    });

    it('moves multiple nodes at once', () => {
      useDiagramStore.setState((s) => ({
        diagram: {
          ...s.diagram,
          nodes: [seedNode('n1', 0, 0), seedNode('n2', 100, 100)],
        },
      }));

      useDiagramStore.getState().moveNodes([
        { id: 'n1', position: { x: 10, y: 20 } },
        { id: 'n2', position: { x: 110, y: 120 } },
      ]);

      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes[0].position).toEqual({ x: 10, y: 20 });
      expect(nodes[1].position).toEqual({ x: 110, y: 120 });
    });

    it('ignores changes for non-existent node ids', () => {
      useDiagramStore.setState((s) => ({
        diagram: { ...s.diagram, nodes: [seedNode('n1', 0, 0)] },
      }));

      useDiagramStore.getState().moveNodes([{ id: 'missing', position: { x: 50, y: 50 } }]);

      expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('dragNodes / commitDraggedNodes', () => {
    it('captures snapshot only on the first drag call', () => {
      useDiagramStore.setState((s) => ({
        diagram: { ...s.diagram, nodes: [seedNode('n1', 0, 0)] },
      }));

      // First drag — captures position {0,0}
      useDiagramStore.getState().dragNodes([{ id: 'n1', position: { x: 10, y: 10 } }]);
      // Second drag — position updates but snapshot stays at {0,0}
      useDiagramStore.getState().dragNodes([{ id: 'n1', position: { x: 50, y: 50 } }]);
      useDiagramStore.getState().commitDraggedNodes();

      expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 50, y: 50 });

      // Undo should restore to the original position, not the intermediate one
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 0, y: 0 });
    });

    it('is a no-op when there is no pending drag', () => {
      useDiagramStore.setState((s) => ({
        diagram: { ...s.diagram, nodes: [seedNode('n1', 0, 0)] },
        canUndo: false,
      }));

      useDiagramStore.getState().commitDraggedNodes();

      expect(useDiagramStore.getState().canUndo).toBe(false);
    });

    it('skips empty drag changes', () => {
      useDiagramStore.setState((s) => ({
        diagram: { ...s.diagram, nodes: [seedNode('n1', 0, 0)] },
        canUndo: false,
      }));

      useDiagramStore.getState().dragNodes([]);

      // No snapshot should have been captured
      useDiagramStore.getState().commitDraggedNodes();
      expect(useDiagramStore.getState().canUndo).toBe(false);
    });
  });

  describe('interaction transactions', () => {
    it('commits multiple transient annotation updates as one undo entry', () => {
      useDiagramStore.setState((s) => ({
        diagram: {
          ...s.diagram,
          annotations: [{
            id: 'line-1',
            kind: 'line',
            start: { x: 0, y: 0 },
            end: { x: 100, y: 100 },
            data: {},
          }],
        },
      }));

      useDiagramStore.getState().beginInteraction();
      useDiagramStore.getState().updateLineAnnotationEndpoint(
        'line-1',
        'end',
        { x: 150, y: 150 },
        { trackHistory: false },
      );
      useDiagramStore.getState().updateLineAnnotationEndpoint(
        'line-1',
        'end',
        { x: 200, y: 200 },
        { trackHistory: false },
      );
      useDiagramStore.getState().commitInteraction();

      expect(useDiagramStore.getState().diagram.annotations[0]).toMatchObject({
        end: { x: 200, y: 200 },
      });

      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.annotations[0]).toMatchObject({
        end: { x: 100, y: 100 },
      });
    });

    it('can cancel a transient interaction without pushing history', () => {
      useDiagramStore.setState((s) => ({
        diagram: {
          ...s.diagram,
          nodes: [seedNode('n1', 0, 0)],
        },
        canUndo: false,
      }));

      useDiagramStore.getState().beginInteraction();
      useDiagramStore.getState().moveNodes([{ id: 'n1', position: { x: 20, y: 30 } }]);
      useDiagramStore.getState().cancelInteraction();
      useDiagramStore.getState().commitInteraction();

      expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual({ x: 20, y: 30 });
      expect(useDiagramStore.getState().canUndo).toBe(false);
    });
  });

  describe('alignNodesHorizontally / alignNodesVertically', () => {
    it('aligns nodes horizontally by center and tracks history', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().addNode({ x: 200, y: 100 });

      // Need to provide sized items — these go through applyNodePositionTransform
      const items = useDiagramStore.getState().diagram.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        width: 150,
        height: 60,
      }));

      useDiagramStore.getState().alignNodesHorizontally(items);

      // Both nodes should have the same vertical center
      const nodes = useDiagramStore.getState().diagram.nodes;
      const center0 = nodes[0].position.y + 30; // half of height 60
      const center1 = nodes[1].position.y + 30;
      expect(center0).toBe(center1);

      // Should be undoable
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });

    it('aligns nodes vertically by center and tracks history', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().addNode({ x: 200, y: 100 });

      const items = useDiagramStore.getState().diagram.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        width: 150,
        height: 60,
      }));

      useDiagramStore.getState().alignNodesVertically(items);

      const nodes = useDiagramStore.getState().diagram.nodes;
      const center0 = nodes[0].position.x + 75; // half of width 150
      const center1 = nodes[1].position.x + 75;
      expect(center0).toBe(center1);
    });
  });

  describe('distributeNodesHorizontally / distributeNodesVertically', () => {
    it('distributes three nodes horizontally', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 500, y: 0 });
      const id3 = useDiagramStore.getState().addNode({ x: 100, y: 0 });

      useDiagramStore.getState().distributeNodesHorizontally([id1, id2, id3]);

      const nodes = useDiagramStore.getState().diagram.nodes;
      // Nodes should be evenly spaced after distribution
      const xs = nodes.map((n) => n.position.x).sort((a, b) => a - b);
      const gap1 = xs[1] - xs[0];
      const gap2 = xs[2] - xs[1];
      expect(Math.abs(gap1 - gap2)).toBeLessThan(1);
    });

    it('is a no-op with fewer than 2 nodes', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const posBefore = useDiagramStore.getState().diagram.nodes[0].position;
      useDiagramStore.setState({ canUndo: false });

      useDiagramStore.getState().distributeNodesHorizontally([id1]);

      expect(useDiagramStore.getState().diagram.nodes[0].position).toEqual(posBefore);
      expect(useDiagramStore.getState().canUndo).toBe(false);
    });
  });
});
