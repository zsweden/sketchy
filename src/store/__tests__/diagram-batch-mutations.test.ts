import { describe, it, expect } from 'vitest';
import {
  batchAddNodes,
  batchUpdateNodes,
  batchRemoveNodes,
  batchAddEdges,
  batchUpdateEdges,
  batchRemoveEdges,
} from '../diagram-batch-mutations';
import { getFramework } from '../../frameworks/registry';
import type { DiagramEdge, DiagramNode, DiagramSettings } from '../../core/types';
import type { Framework } from '../../core/framework-types';

const settings: DiagramSettings = {
  layoutDirection: 'BT',
  showGrid: true,
  snapToGrid: false,
  edgeRoutingMode: 'fixed',
};

function crt(): Framework {
  return getFramework('crt')!;
}

function cld(): Framework {
  return getFramework('cld')!;
}

function makeNode(id: string, overrides: Partial<DiagramNode['data']> = {}): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'or', ...overrides },
  };
}

describe('batchAddNodes', () => {
  it('assigns a real UUID to each new node and remembers the temp→real mapping', () => {
    const idMap = new Map<string, string>();
    const nodes = batchAddNodes(
      { addNodes: [{ id: 'tmp_1', label: 'A' }, { id: 'tmp_2', label: 'B' }] },
      idMap,
      [],
      crt(),
    );

    expect(nodes).toHaveLength(2);
    expect(idMap.get('tmp_1')).toBe(nodes[0].id);
    expect(idMap.get('tmp_2')).toBe(nodes[1].id);
    expect(nodes[0].id).not.toBe('tmp_1');
    expect(nodes[1].id).not.toBe('tmp_2');
    expect(nodes[0].id).not.toBe(nodes[1].id);
  });

  it('overwrites the idMap entry when temp ids collide (last wins)', () => {
    const idMap = new Map<string, string>();
    const nodes = batchAddNodes(
      { addNodes: [{ id: 'dup', label: 'first' }, { id: 'dup', label: 'second' }] },
      idMap,
      [],
      crt(),
    );

    expect(nodes).toHaveLength(2);
    expect(idMap.size).toBe(1);
    expect(idMap.get('dup')).toBe(nodes[1].id);
    expect(nodes[0].id).not.toBe(nodes[1].id);
  });

  it('backfills junctionType from framework default when omitted', () => {
    const idMap = new Map<string, string>();
    const nodes = batchAddNodes(
      { addNodes: [{ id: 'a', label: 'A' }] },
      idMap,
      [],
      crt(),
    );
    expect(nodes[0].data.junctionType).toBe('or');
  });

  it('respects an explicit junctionType', () => {
    const idMap = new Map<string, string>();
    const nodes = batchAddNodes(
      { addNodes: [{ id: 'a', label: 'A', junctionType: 'and' }] },
      idMap,
      [],
      crt(),
    );
    expect(nodes[0].data.junctionType).toBe('and');
  });

  it('only sets optional fields when present (omits undefined keys)', () => {
    const idMap = new Map<string, string>();
    const nodes = batchAddNodes(
      {
        addNodes: [
          { id: 'full', label: 'F', notes: 'n', value: 1, unit: 'kg', color: '#fff', textColor: '#000' },
          { id: 'empty', label: 'E' },
        ],
      },
      idMap,
      [],
      crt(),
    );

    expect(nodes[0].data).toMatchObject({
      notes: 'n',
      value: 1,
      unit: 'kg',
      color: '#fff',
      textColor: '#000',
    });
    expect(nodes[1].data.notes).toBeUndefined();
    expect(nodes[1].data.value).toBeUndefined();
    expect(nodes[1].data.unit).toBeUndefined();
    expect(nodes[1].data.color).toBeUndefined();
    expect(nodes[1].data.textColor).toBeUndefined();
  });

  it('returns the unchanged input array when addNodes is missing', () => {
    const existing = [makeNode('keep')];
    const result = batchAddNodes({}, new Map(), existing, crt());
    expect(result).toBe(existing);
  });
});

describe('batchUpdateNodes', () => {
  it('updates nodes by their post-remap real id', () => {
    const idMap = new Map([['tmp_1', 'real_1']]);
    const nodes = [makeNode('real_1', { label: 'before' })];
    const updated = batchUpdateNodes(
      { updateNodes: [{ id: 'tmp_1', label: 'after' }] },
      idMap,
      nodes,
    );
    expect(updated[0].data.label).toBe('after');
  });

  it('falls back to the original id when the id is not in the map', () => {
    const idMap = new Map<string, string>();
    const nodes = [makeNode('real_1', { label: 'before' })];
    const updated = batchUpdateNodes(
      { updateNodes: [{ id: 'real_1', label: 'after' }] },
      idMap,
      nodes,
    );
    expect(updated[0].data.label).toBe('after');
  });

  it('clears optional string fields when given empty string', () => {
    const nodes = [makeNode('a', { notes: 'old', unit: 'kg', color: '#fff' })];
    const updated = batchUpdateNodes(
      { updateNodes: [{ id: 'a', notes: '', unit: '', color: '' }] },
      new Map(),
      nodes,
    );
    expect(updated[0].data.notes).toBeUndefined();
    expect(updated[0].data.unit).toBeUndefined();
    expect(updated[0].data.color).toBeUndefined();
  });

  it('clears value when null is passed', () => {
    const nodes = [makeNode('a', { value: 42 })];
    const updated = batchUpdateNodes(
      { updateNodes: [{ id: 'a', value: null }] },
      new Map(),
      nodes,
    );
    expect(updated[0].data.value).toBeUndefined();
  });

  it('does not alter unrelated fields', () => {
    const nodes = [makeNode('a', { label: 'L', tags: ['ude'], notes: 'n' })];
    const updated = batchUpdateNodes(
      { updateNodes: [{ id: 'a', notes: 'new' }] },
      new Map(),
      nodes,
    );
    expect(updated[0].data.label).toBe('L');
    expect(updated[0].data.tags).toEqual(['ude']);
    expect(updated[0].data.notes).toBe('new');
  });

  it('silently skips updates that target a nonexistent node', () => {
    const nodes = [makeNode('a')];
    const updated = batchUpdateNodes(
      { updateNodes: [{ id: 'ghost', label: 'x' }] },
      new Map(),
      nodes,
    );
    expect(updated).toEqual(nodes);
  });
});

describe('batchRemoveNodes', () => {
  it('cascades edge deletion when source or target is removed', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'a', target: 'c' },
    ];

    const result = batchRemoveNodes(
      { removeNodeIds: ['b'] },
      new Map(),
      nodes,
      edges,
    );

    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(result.edges.map((e) => e.id)).toEqual(['e3']);
  });

  it('uses the idMap to resolve temp ids when removing', () => {
    const nodes = [makeNode('real_1'), makeNode('real_2')];
    const edges: DiagramEdge[] = [{ id: 'e1', source: 'real_1', target: 'real_2' }];

    const result = batchRemoveNodes(
      { removeNodeIds: ['tmp_1'] },
      new Map([['tmp_1', 'real_1']]),
      nodes,
      edges,
    );

    expect(result.nodes.map((n) => n.id)).toEqual(['real_2']);
    expect(result.edges).toEqual([]);
  });

  it('returns the same arrays unchanged when removeNodeIds is empty or missing', () => {
    const nodes = [makeNode('a')];
    const edges: DiagramEdge[] = [];
    const result = batchRemoveNodes({}, new Map(), nodes, edges);
    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });
});

describe('batchAddEdges', () => {
  it('skips edges referencing missing source or target', () => {
    const nodes = [
      makeNode('a', { label: 'A' }),
      makeNode('b', { label: 'B' }),
    ];
    nodes[0].position = { x: 0, y: 0 };
    nodes[1].position = { x: 200, y: 0 };

    const result = batchAddEdges(
      {
        addEdges: [
          { source: 'a', target: 'ghost' },
          { source: 'ghost', target: 'b' },
          { source: 'a', target: 'b' },
        ],
      },
      new Map(),
      nodes,
      [],
      crt(),
      settings,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('a');
    expect(result.edges[0].target).toBe('b');
  });

  it('rejects cycles in non-cyclic frameworks but accepts them in cyclic ones', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 200, y: 0 } },
    ];
    const seedEdges: DiagramEdge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    const crtResult = batchAddEdges(
      { addEdges: [{ source: 'b', target: 'a' }] },
      new Map(),
      nodes,
      [...seedEdges],
      crt(),
      settings,
    );
    expect(crtResult.edges).toHaveLength(1);

    const cldResult = batchAddEdges(
      { addEdges: [{ source: 'b', target: 'a' }] },
      new Map(),
      nodes,
      [...seedEdges],
      cld(),
      settings,
    );
    expect(cldResult.edges).toHaveLength(2);
  });

  it('backfills junctionType on the target when it gains a second incoming edge', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 0, y: 100 } },
      {
        ...makeNode('target', { junctionType: 'and' }),
        position: { x: 200, y: 50 },
      },
    ];

    const result = batchAddEdges(
      {
        addEdges: [
          { source: 'a', target: 'target' },
          { source: 'b', target: 'target' },
        ],
      },
      new Map(),
      nodes,
      [],
      crt(),
      settings,
    );

    const target = result.nodes.find((n) => n.id === 'target')!;
    expect(target.data.junctionType).toBe('or');
  });

  it('does not backfill junction on frameworks that disable junctions', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 0, y: 100 } },
      {
        ...makeNode('target', { junctionType: 'and' }),
        position: { x: 200, y: 50 },
      },
    ];

    const result = batchAddEdges(
      {
        addEdges: [
          { source: 'a', target: 'target' },
          { source: 'b', target: 'target' },
        ],
      },
      new Map(),
      nodes,
      [],
      cld(),
      settings,
    );

    const target = result.nodes.find((n) => n.id === 'target')!;
    expect(target.data.junctionType).toBe('and');
  });

  it('passes confidence through only when below "high"', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 200, y: 0 } },
      { ...makeNode('c'), position: { x: 400, y: 0 } },
    ];
    const result = batchAddEdges(
      {
        addEdges: [
          { source: 'a', target: 'b', confidence: 'high' },
          { source: 'a', target: 'c', confidence: 'low' },
        ],
      },
      new Map(),
      nodes,
      [],
      crt(),
      settings,
    );

    const e1 = result.edges.find((e) => e.target === 'b')!;
    const e2 = result.edges.find((e) => e.target === 'c')!;
    expect(e1.confidence).toBeUndefined();
    expect(e2.confidence).toBe('low');
  });

  it('only applies polarity for frameworks that support it', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 200, y: 0 } },
    ];
    const cldResult = batchAddEdges(
      { addEdges: [{ source: 'a', target: 'b', polarity: 'negative' }] },
      new Map(),
      nodes,
      [],
      cld(),
      settings,
    );
    expect(cldResult.edges[0].polarity).toBe('negative');

    const crtResult = batchAddEdges(
      { addEdges: [{ source: 'a', target: 'b', polarity: 'negative' }] },
      new Map(),
      nodes,
      [],
      crt(),
      settings,
    );
    expect(crtResult.edges[0].polarity).toBeUndefined();
  });

  it('defaults polarity to positive on edge-polarity frameworks when omitted', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 200, y: 0 } },
    ];
    const result = batchAddEdges(
      { addEdges: [{ source: 'a', target: 'b' }] },
      new Map(),
      nodes,
      [],
      cld(),
      settings,
    );
    expect(result.edges[0].polarity).toBe('positive');
  });

  it('only applies delay when the framework supports it and a value is given', () => {
    const nodes = [
      { ...makeNode('a'), position: { x: 0, y: 0 } },
      { ...makeNode('b'), position: { x: 200, y: 0 } },
    ];
    const cldDelay = batchAddEdges(
      { addEdges: [{ source: 'a', target: 'b', delay: true }] },
      new Map(),
      nodes,
      [],
      cld(),
      settings,
    );
    expect(cldDelay.edges[0].delay).toBe(true);

    const crtDelay = batchAddEdges(
      { addEdges: [{ source: 'a', target: 'b', delay: true }] },
      new Map(),
      nodes,
      [],
      crt(),
      settings,
    );
    expect(crtDelay.edges[0].delay).toBeUndefined();
  });

  it('resolves source/target through the idMap before checking existence', () => {
    const nodes = [
      { ...makeNode('real_a'), position: { x: 0, y: 0 } },
      { ...makeNode('real_b'), position: { x: 200, y: 0 } },
    ];
    const idMap = new Map([
      ['tmp_a', 'real_a'],
      ['tmp_b', 'real_b'],
    ]);

    const result = batchAddEdges(
      { addEdges: [{ source: 'tmp_a', target: 'tmp_b' }] },
      idMap,
      nodes,
      [],
      crt(),
      settings,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('real_a');
    expect(result.edges[0].target).toBe('real_b');
  });
});

describe('batchUpdateEdges', () => {
  const baseEdge: DiagramEdge = { id: 'e1', source: 'a', target: 'b' };

  it('updates confidence', () => {
    const updated = batchUpdateEdges(
      { updateEdges: [{ id: 'e1', confidence: 'low' }] },
      [baseEdge],
      crt(),
    );
    expect(updated[0].confidence).toBe('low');
  });

  it('skips polarity updates for frameworks without polarity support', () => {
    const updated = batchUpdateEdges(
      { updateEdges: [{ id: 'e1', polarity: 'negative' }] },
      [baseEdge],
      crt(),
    );
    expect(updated[0].polarity).toBeUndefined();
  });

  it('applies polarity when framework supports it', () => {
    const updated = batchUpdateEdges(
      { updateEdges: [{ id: 'e1', polarity: 'negative' }] },
      [baseEdge],
      cld(),
    );
    expect(updated[0].polarity).toBe('negative');
  });

  it('skips delay updates for frameworks without delay support', () => {
    const updated = batchUpdateEdges(
      { updateEdges: [{ id: 'e1', delay: true }] },
      [baseEdge],
      crt(),
    );
    expect(updated[0].delay).toBeUndefined();
  });

  it('clears notes when given empty string', () => {
    const updated = batchUpdateEdges(
      { updateEdges: [{ id: 'e1', notes: '' }] },
      [{ ...baseEdge, notes: 'old' }],
      crt(),
    );
    expect(updated[0].notes).toBeUndefined();
  });

  it('returns the same array reference when no fields actually change', () => {
    const edges = [baseEdge];
    const updated = batchUpdateEdges(
      { updateEdges: [{ id: 'e1' }] },
      edges,
      crt(),
    );
    expect(updated).toBe(edges);
  });
});

describe('batchRemoveEdges', () => {
  it('removes only the listed edges', () => {
    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'a', target: 'c' },
    ];
    const result = batchRemoveEdges({ removeEdgeIds: ['e1', 'e3'] }, edges);
    expect(result.map((e) => e.id)).toEqual(['e2']);
  });

  it('returns the same array reference when removeEdgeIds is empty or missing', () => {
    const edges: DiagramEdge[] = [{ id: 'e1', source: 'a', target: 'b' }];
    expect(batchRemoveEdges({}, edges)).toBe(edges);
    expect(batchRemoveEdges({ removeEdgeIds: [] }, edges)).toBe(edges);
  });
});
