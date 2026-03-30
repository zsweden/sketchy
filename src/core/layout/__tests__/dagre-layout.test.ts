import { describe, it, expect } from 'vitest';
import { autoLayout, elkEngine } from '..';
import type { DiagramEdge, DiagramNode } from '../../types';

function node(id: string): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: { label: id, tags: [], junctionType: 'and' },
  };
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('autoLayout', () => {
  it('positions chain top-to-bottom', async () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'TB',
    }, elkEngine);

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    expect(posMap['a'].y).toBeLessThan(posMap['b'].y);
    expect(posMap['b'].y).toBeLessThan(posMap['c'].y);
  });

  it('positions chain bottom-to-top', async () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'BT',
    }, elkEngine);

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    expect(posMap['a'].y).toBeGreaterThan(posMap['b'].y);
    expect(posMap['b'].y).toBeGreaterThan(posMap['c'].y);
  });

  it('handles diamond shape without overlap', async () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'TB',
    }, elkEngine);

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    // b and c should be at the same rank (similar y) but different x
    expect(Math.abs(posMap['b'].y - posMap['c'].y)).toBeLessThan(10);
    expect(posMap['b'].x).not.toBe(posMap['c'].x);
  });

  it('spreads strongly connected components without overlapping when cyclic mode is enabled', async () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'a'), edge('a', 'c')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'TB',
      cyclic: true,
    }, elkEngine);

    const positions = updates.map((update) => ({ id: update.id, ...update.position }));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const overlapsX = Math.abs(a.x - b.x) < 220;
        const overlapsY = Math.abs(a.y - b.y) < 44;
        expect(overlapsX && overlapsY).toBe(false);
      }
    }

    const uniqueX = new Set(positions.map((position) => Math.round(position.x / 10)));
    const uniqueY = new Set(positions.map((position) => Math.round(position.y / 10)));
    expect(uniqueX.size).toBeGreaterThan(1);
    expect(uniqueY.size).toBeGreaterThan(1);

    const minX = Math.min(...positions.map((position) => position.x));
    const maxX = Math.max(...positions.map((position) => position.x));
    const minY = Math.min(...positions.map((position) => position.y));
    const maxY = Math.max(...positions.map((position) => position.y));
    expect(maxX - minX).toBeLessThan(420);
    expect(maxY - minY).toBeLessThan(265);
  });
});
