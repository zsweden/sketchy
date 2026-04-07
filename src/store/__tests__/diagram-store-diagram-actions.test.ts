import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { useUIStore } from '../ui-store';
import { getFramework } from '../../frameworks/registry';

vi.mock('../../core/layout/run-elk-auto-layout', () => ({
  runElkAutoLayout: vi.fn().mockResolvedValue([
    { id: 'n1', position: { x: 10, y: 20 } },
  ]),
}));

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({ diagram: { ...s.diagram, nodes: [], edges: [] } }));
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    fitViewTrigger: 0,
    viewportFocusTarget: null,
    viewportFocusTrigger: 0,
  });
}

describe('diagram actions', () => {
  beforeEach(resetStore);

  describe('batchApply', () => {
    it('adds nodes via batch mutations', () => {
      const idMap = useDiagramStore.getState().batchApply({
        addNodes: [
          { id: 'temp_1', label: 'Node A' },
          { id: 'temp_2', label: 'Node B' },
        ],
      });

      const nodes = useDiagramStore.getState().diagram.nodes;
      expect(nodes).toHaveLength(2);
      expect(idMap.size).toBe(2);
      // Temp IDs are remapped to real UUIDs
      expect(idMap.get('temp_1')).not.toBe('temp_1');
      expect(nodes.find((n) => n.id === idMap.get('temp_1'))!.data.label).toBe('Node A');
    });

    it('adds edges between newly added nodes using id map', () => {
      useDiagramStore.getState().batchApply({
        addNodes: [
          { id: 'temp_1', label: 'A' },
          { id: 'temp_2', label: 'B' },
        ],
        addEdges: [
          { source: 'temp_1', target: 'temp_2' },
        ],
      });

      const { edges } = useDiagramStore.getState().diagram;
      expect(edges).toHaveLength(1);
    });

    it('updates existing nodes', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().batchApply({
        updateNodes: [{ id, label: 'Updated' }],
      });

      const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === id)!;
      expect(node.data.label).toBe('Updated');
    });

    it('removes nodes and their connected edges', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 200 });
      useDiagramStore.getState().addEdge(id1, id2);

      useDiagramStore.getState().batchApply({
        removeNodeIds: [id1],
      });

      const { nodes, edges } = useDiagramStore.getState().diagram;
      expect(nodes).toHaveLength(1);
      expect(edges).toHaveLength(0);
    });

    it('removes edges by id', () => {
      const id1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const id2 = useDiagramStore.getState().addNode({ x: 0, y: 200 });
      useDiagramStore.getState().addEdge(id1, id2);
      const edgeId = useDiagramStore.getState().diagram.edges[0].id;

      useDiagramStore.getState().batchApply({
        removeEdgeIds: [edgeId],
      });

      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });

    it('skips invalid edges (missing nodes)', () => {
      useDiagramStore.getState().batchApply({
        addEdges: [{ source: 'nonexistent', target: 'also-missing' }],
      });
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    });
  });

  describe('setFramework', () => {
    it('switches framework and clears diagram', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().setFramework('cld');
      expect(useDiagramStore.getState().diagram.frameworkId).toBe('cld');
      // New diagram is created (existing nodes cleared)
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('does nothing for unknown framework', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().setFramework('nonexistent');
      // Should still be on CRT with the node
      expect(useDiagramStore.getState().diagram.frameworkId).toBe('crt');
    });

    it('uses the framework default layout direction', () => {
      useDiagramStore.getState().setFramework('cld');
      const cldFramework = getFramework('cld')!;
      expect(useDiagramStore.getState().diagram.settings.layoutDirection)
        .toBe(cldFramework.defaultLayoutDirection);
    });

    it('tracks history (undoable)', () => {
      useDiagramStore.getState().setFramework('frt');
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('updateSettings', () => {
    it('merges partial settings', () => {
      useDiagramStore.getState().updateSettings({ snapToGrid: true });
      expect(useDiagramStore.getState().diagram.settings.snapToGrid).toBe(true);
      // Other settings remain unchanged
      expect(useDiagramStore.getState().diagram.settings.showGrid).toBeDefined();
    });

    it('changes layout direction', () => {
      useDiagramStore.getState().updateSettings({ layoutDirection: 'LR' });
      expect(useDiagramStore.getState().diagram.settings.layoutDirection).toBe('LR');
    });
  });

  describe('loadDiagram', () => {
    it('loads a full diagram replacing current state', () => {
      const diagram = {
        ...useDiagramStore.getState().diagram,
        name: 'Loaded',
        nodes: [
          { id: 'ln1', type: 'entity' as const, position: { x: 10, y: 20 }, data: { label: 'Loaded Node', tags: [], junctionType: 'or' as const } },
        ],
        edges: [],
        settings: {
          layoutDirection: 'LR' as const,
          showGrid: false,
          snapToGrid: false,
        },
      };

      useDiagramStore.getState().loadDiagram(diagram);
      const loaded = useDiagramStore.getState().diagram;
      expect(loaded.name).toBe('Loaded');
      expect(loaded.nodes).toHaveLength(1);
      expect(loaded.settings.layoutDirection).toBe('LR');
    });

    it('tracks history (undoable)', () => {
      const diagram = {
        ...useDiagramStore.getState().diagram,
        nodes: [],
        edges: [],
        settings: useDiagramStore.getState().diagram.settings,
      };
      useDiagramStore.getState().loadDiagram(diagram);
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });

  describe('newDiagram', () => {
    it('creates empty diagram for current framework', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      useDiagramStore.getState().newDiagram();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
      expect(useDiagramStore.getState().diagram.frameworkId).toBe('crt');
    });
  });

  describe('setDiagramName', () => {
    it('updates diagram name', () => {
      useDiagramStore.getState().setDiagramName('My Diagram');
      expect(useDiagramStore.getState().diagram.name).toBe('My Diagram');
    });
  });

  describe('undo / redo', () => {
    it('undoes the last operation', () => {
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

    it('undo does nothing when no history', () => {
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });
  });

  describe('commitToHistory', () => {
    it('pushes a snapshot and enables undo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      // Manually push state
      useDiagramStore.getState().commitToHistory();
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });
  });
});
