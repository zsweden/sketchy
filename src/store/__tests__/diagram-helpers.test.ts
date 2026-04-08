import { describe, it, expect } from 'vitest';
import {
  resolveFramework,
  getDefaultEdgeFields,
  createDiagramForFramework,
  snapshot,
  batchAddNodes,
  batchUpdateNodes,
  batchRemoveNodes,
  batchAddEdges,
  batchUpdateEdges,
  batchRemoveEdges,
} from '../diagram-helpers';
import { mockFrameworkCRT, mockFrameworkCLD } from '../../test/fixtures';
import { createEmptyDiagram } from '../../core/types';
import type { DiagramNode, DiagramEdge, DiagramSettings } from '../../core/types';

function makeNode(id: string, label = ''): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label, tags: [], junctionType: 'or' },
  };
}

function makeEdge(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target };
}

const defaultSettings: DiagramSettings = {
  layoutDirection: 'BT',
  showGrid: true,
  snapToGrid: false,
  edgeRoutingMode: 'fixed',
  showActiveAttachments: true,
};

describe('diagram-helpers', () => {
  describe('resolveFramework', () => {
    it('returns a known framework by ID', () => {
      const fw = resolveFramework('crt');
      expect(fw.id).toBe('crt');
    });

    it('falls back to default framework for unknown ID', () => {
      const fw = resolveFramework('nonexistent-fw');
      expect(fw).toBeDefined();
      expect(fw.id).toBeTruthy();
    });
  });

  describe('getDefaultEdgeFields', () => {
    it('returns polarity for CLD framework', () => {
      const fields = getDefaultEdgeFields(mockFrameworkCLD);
      expect(fields.polarity).toBe('positive');
      expect(fields.delay).toBe(false);
    });

    it('returns empty fields for CRT framework (no polarity/delay)', () => {
      const fields = getDefaultEdgeFields(mockFrameworkCRT);
      expect(fields.polarity).toBeUndefined();
      expect(fields.delay).toBeUndefined();
    });
  });

  describe('createDiagramForFramework', () => {
    it('creates a diagram with the framework ID and default direction', () => {
      const diagram = createDiagramForFramework(mockFrameworkCLD);
      expect(diagram.frameworkId).toBe('cld');
      expect(diagram.settings.layoutDirection).toBe('TB');
    });

    it('uses BT direction for CRT', () => {
      const diagram = createDiagramForFramework(mockFrameworkCRT);
      expect(diagram.settings.layoutDirection).toBe('BT');
    });
  });

  describe('snapshot', () => {
    it('extracts nodes and edges from diagram state', () => {
      const diagram = createEmptyDiagram('crt');
      diagram.nodes = [makeNode('n1')];
      diagram.edges = [makeEdge('e1', 'n1', 'n2')];

      const result = snapshot({ diagram });
      expect(result.nodes).toBe(diagram.nodes);
      expect(result.edges).toBe(diagram.edges);
    });
  });

  describe('batchAddNodes', () => {
    it('adds nodes with generated IDs and maps temp IDs', () => {
      const idMap = new Map<string, string>();
      const nodes: DiagramNode[] = [];
      const mutations = {
        addNodes: [
          { id: 'temp_1', label: 'Node A', tags: ['ude'] },
          { id: 'temp_2', label: 'Node B' },
        ],
      };

      batchAddNodes(mutations, idMap, nodes, mockFrameworkCRT);

      expect(nodes).toHaveLength(2);
      expect(idMap.has('temp_1')).toBe(true);
      expect(idMap.has('temp_2')).toBe(true);
      expect(nodes[0].data.label).toBe('Node A');
      expect(nodes[0].data.tags).toEqual(['ude']);
      expect(nodes[1].data.label).toBe('Node B');
      // Real IDs should differ from temp IDs
      expect(nodes[0].id).not.toBe('temp_1');
    });

    it('preserves optional fields (notes, value, unit, color, textColor)', () => {
      const idMap = new Map<string, string>();
      const nodes: DiagramNode[] = [];
      const mutations = {
        addNodes: [{
          id: 'temp_1',
          label: 'Rich',
          notes: 'important',
          value: 42,
          unit: 'kg',
          color: '#FF0000',
          textColor: '#00FF00',
        }],
      };

      batchAddNodes(mutations, idMap, nodes, mockFrameworkCRT);

      expect(nodes[0].data.notes).toBe('important');
      expect(nodes[0].data.value).toBe(42);
      expect(nodes[0].data.unit).toBe('kg');
      expect(nodes[0].data.color).toBe('#FF0000');
      expect(nodes[0].data.textColor).toBe('#00FF00');
    });

    it('is a no-op when addNodes is empty', () => {
      const idMap = new Map<string, string>();
      const nodes: DiagramNode[] = [];

      batchAddNodes({}, idMap, nodes, mockFrameworkCRT);

      expect(nodes).toHaveLength(0);
    });
  });

  describe('batchUpdateNodes', () => {
    it('updates label and tags on existing nodes', () => {
      const idMap = new Map<string, string>();
      let nodes = [makeNode('n1', 'Old')];
      const mutations = {
        updateNodes: [{ id: 'n1', label: 'New', tags: ['ude'] }],
      };

      nodes = batchUpdateNodes(mutations, idMap, nodes);

      expect(nodes[0].data.label).toBe('New');
      expect(nodes[0].data.tags).toEqual(['ude']);
    });

    it('resolves temp IDs via idMap', () => {
      const idMap = new Map([['temp_1', 'real_1']]);
      let nodes = [makeNode('real_1', 'Original')];

      nodes = batchUpdateNodes(
        { updateNodes: [{ id: 'temp_1', label: 'Updated' }] },
        idMap,
        nodes,
      );

      expect(nodes[0].data.label).toBe('Updated');
    });

    it('clears optional fields when set to empty/null', () => {
      const idMap = new Map<string, string>();
      let nodes: DiagramNode[] = [{
        ...makeNode('n1'),
        data: { ...makeNode('n1').data, notes: 'keep', color: '#FF0000' },
      }];

      nodes = batchUpdateNodes(
        { updateNodes: [{ id: 'n1', notes: '', color: null }] },
        idMap,
        nodes,
      );

      expect(nodes[0].data.notes).toBeUndefined();
      expect(nodes[0].data.color).toBeUndefined();
    });
  });

  describe('batchRemoveNodes', () => {
    it('removes nodes and their connected edges', () => {
      const idMap = new Map<string, string>();
      const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
      const edges = [makeEdge('e1', 'n1', 'n2'), makeEdge('e2', 'n2', 'n3')];

      const result = batchRemoveNodes(
        { removeNodeIds: ['n2'] },
        idMap,
        nodes,
        edges,
      );

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.find((n) => n.id === 'n2')).toBeUndefined();
      expect(result.edges).toHaveLength(0); // both edges touch n2
    });

    it('resolves temp IDs via idMap', () => {
      const idMap = new Map([['temp_1', 'n1']]);
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges: DiagramEdge[] = [];

      const result = batchRemoveNodes(
        { removeNodeIds: ['temp_1'] },
        idMap,
        nodes,
        edges,
      );

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('n2');
    });

    it('is a no-op with empty removeNodeIds', () => {
      const nodes = [makeNode('n1')];
      const edges: DiagramEdge[] = [];

      const result = batchRemoveNodes({}, new Map(), nodes, edges);

      expect(result.nodes).toBe(nodes);
      expect(result.edges).toBe(edges);
    });
  });

  describe('batchAddEdges', () => {
    it('adds valid edges', () => {
      const idMap = new Map<string, string>();
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges: DiagramEdge[] = [];

      const result = batchAddEdges(
        { addEdges: [{ source: 'n1', target: 'n2' }] },
        idMap,
        nodes,
        edges,
        mockFrameworkCRT,
        defaultSettings,
      );

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('n1');
      expect(result.edges[0].target).toBe('n2');
    });

    it('skips edges referencing non-existent nodes', () => {
      const idMap = new Map<string, string>();
      const nodes = [makeNode('n1')];
      const edges: DiagramEdge[] = [];

      const result = batchAddEdges(
        { addEdges: [{ source: 'n1', target: 'missing' }] },
        idMap,
        nodes,
        edges,
        mockFrameworkCRT,
        defaultSettings,
      );

      expect(result.edges).toHaveLength(0);
    });

    it('skips self-loop and duplicate edges', () => {
      const idMap = new Map<string, string>();
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges: DiagramEdge[] = [];

      const result = batchAddEdges(
        {
          addEdges: [
            { source: 'n1', target: 'n1' }, // self-loop
            { source: 'n1', target: 'n2' },
            { source: 'n1', target: 'n2' }, // duplicate
          ],
        },
        idMap,
        nodes,
        edges,
        mockFrameworkCRT,
        defaultSettings,
      );

      expect(result.edges).toHaveLength(1);
    });

    it('resolves temp IDs for edges', () => {
      const idMap = new Map([['temp_1', 'n1'], ['temp_2', 'n2']]);
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges: DiagramEdge[] = [];

      const result = batchAddEdges(
        { addEdges: [{ source: 'temp_1', target: 'temp_2' }] },
        idMap,
        nodes,
        edges,
        mockFrameworkCRT,
        defaultSettings,
      );

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('n1');
      expect(result.edges[0].target).toBe('n2');
    });

    it('adds polarity for CLD edges', () => {
      const idMap = new Map<string, string>();
      const nodes = [makeNode('n1'), makeNode('n2')];
      const edges: DiagramEdge[] = [];

      const result = batchAddEdges(
        { addEdges: [{ source: 'n1', target: 'n2', polarity: 'negative' }] },
        idMap,
        nodes,
        edges,
        mockFrameworkCLD,
        defaultSettings,
      );

      expect(result.edges[0].polarity).toBe('negative');
    });

    it('sets default junction when second edge arrives at a target', () => {
      const idMap = new Map<string, string>();
      let nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
      let edges: DiagramEdge[] = [];

      const result1 = batchAddEdges(
        { addEdges: [{ source: 'n1', target: 'n3' }] },
        idMap,
        nodes,
        edges,
        mockFrameworkCRT,
        defaultSettings,
      );
      nodes = result1.nodes;
      edges = result1.edges;

      const result2 = batchAddEdges(
        { addEdges: [{ source: 'n2', target: 'n3' }] },
        idMap,
        nodes,
        edges,
        mockFrameworkCRT,
        defaultSettings,
      );

      const target = result2.nodes.find((n) => n.id === 'n3');
      expect(target?.data.junctionType).toBe('or');
    });
  });

  describe('batchUpdateEdges', () => {
    it('updates confidence on an edge', () => {
      let edges = [makeEdge('e1', 'n1', 'n2')];

      edges = batchUpdateEdges(
        { updateEdges: [{ id: 'e1', confidence: 'low' }] },
        edges,
        mockFrameworkCRT,
      );

      expect(edges[0].confidence).toBe('low');
    });

    it('updates polarity and delay for CLD edges', () => {
      let edges: DiagramEdge[] = [{ ...makeEdge('e1', 'n1', 'n2'), polarity: 'positive' as const }];

      edges = batchUpdateEdges(
        { updateEdges: [{ id: 'e1', polarity: 'negative', delay: true }] },
        edges,
        mockFrameworkCLD,
      );

      expect(edges[0].polarity).toBe('negative');
      expect(edges[0].delay).toBe(true);
    });

    it('updates notes on an edge', () => {
      let edges = [makeEdge('e1', 'n1', 'n2')];

      edges = batchUpdateEdges(
        { updateEdges: [{ id: 'e1', notes: 'Critical path' }] },
        edges,
        mockFrameworkCRT,
      );

      expect(edges[0].notes).toBe('Critical path');
    });

    it('clears notes when set to empty string', () => {
      let edges: DiagramEdge[] = [{ ...makeEdge('e1', 'n1', 'n2'), notes: 'old' }];

      edges = batchUpdateEdges(
        { updateEdges: [{ id: 'e1', notes: '' }] },
        edges,
        mockFrameworkCRT,
      );

      expect(edges[0].notes).toBeUndefined();
    });
  });

  describe('batchRemoveEdges', () => {
    it('removes edges by ID', () => {
      const edges = [makeEdge('e1', 'n1', 'n2'), makeEdge('e2', 'n2', 'n3')];

      const result = batchRemoveEdges({ removeEdgeIds: ['e1'] }, edges);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e2');
    });

    it('is a no-op with empty removeEdgeIds', () => {
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = batchRemoveEdges({}, edges);

      expect(result).toBe(edges);
    });
  });
});
