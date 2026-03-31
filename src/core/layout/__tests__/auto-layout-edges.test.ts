import { describe, it, expect } from 'vitest';
import { autoLayout, elkEngine } from '..';
import type { DiagramEdge, DiagramNode } from '../../types';

function node(id: string, overrides?: Partial<DiagramNode>): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'or' },
    ...overrides,
  };
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('autoLayout edge cases', () => {
  it('preserves position of locked nodes', async () => {
    const lockedPos = { x: 999, y: 777 };
    const nodes = [
      node('a'),
      node('locked', { position: lockedPos, data: { label: 'locked', tags: [], junctionType: 'or', locked: true } }),
      node('c'),
    ];
    const edges = [edge('a', 'locked'), edge('locked', 'c')];

    const updates = await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);
    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));

    expect(posMap['locked']).toEqual(lockedPos);
    // Other nodes should still get laid out
    expect(posMap['a']).toBeDefined();
    expect(posMap['c']).toBeDefined();
  });

  it('moves unlocked nodes while keeping multiple locked nodes fixed', async () => {
    const nodes = [
      node('a', { position: { x: 0, y: 0 }, data: { label: 'a', tags: [], junctionType: 'or', locked: true } }),
      node('b'),
      node('c', { position: { x: 500, y: 500 }, data: { label: 'c', tags: [], junctionType: 'or', locked: true } }),
    ];
    const edges = [edge('a', 'b'), edge('b', 'c')];

    const updates = await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);
    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));

    expect(posMap['a']).toEqual({ x: 0, y: 0 });
    expect(posMap['c']).toEqual({ x: 500, y: 500 });
    expect(posMap['b']).toBeDefined();
  });

  it('skips spine tightening for a 2-node chain (too short)', async () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('a', 'b')];

    const updates = await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);
    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));

    // Layout should still work — nodes are ordered
    expect(posMap['a'].y).toBeLessThan(posMap['b'].y);
  });

  it('skips spine tightening when there are multiple roots', async () => {
    // Two separate roots — findTopSpine returns empty
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [edge('a', 'c'), edge('b', 'd')];

    const updates = await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);

    expect(updates).toHaveLength(4);
    for (const update of updates) {
      expect(Number.isFinite(update.position.x)).toBe(true);
      expect(Number.isFinite(update.position.y)).toBe(true);
    }
  });

  it('skips spine tightening in cyclic mode', async () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')];

    const updates = await autoLayout(nodes, edges, { direction: 'TB', cyclic: true }, elkEngine);

    expect(updates).toHaveLength(3);
    for (const update of updates) {
      expect(Number.isFinite(update.position.x)).toBe(true);
      expect(Number.isFinite(update.position.y)).toBe(true);
    }
  });

  it('returns a position update for every input node', async () => {
    const nodes = [node('a'), node('b'), node('c'), node('orphan')];
    const edges = [edge('a', 'b'), edge('b', 'c')];

    const updates = await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);
    const ids = new Set(updates.map((u) => u.id));

    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
    expect(ids.has('c')).toBe(true);
    expect(ids.has('orphan')).toBe(true);
  });

  it('handles empty graph', async () => {
    const updates = await autoLayout([], [], { direction: 'TB' }, elkEngine);
    expect(updates).toEqual([]);
  });

  it('handles single node with no edges', async () => {
    const updates = await autoLayout([node('solo')], [], { direction: 'TB' }, elkEngine);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('solo');
    expect(Number.isFinite(updates[0].position.x)).toBe(true);
    expect(Number.isFinite(updates[0].position.y)).toBe(true);
  });
});
