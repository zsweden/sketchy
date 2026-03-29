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

  it('circularizes strongly connected components when cyclic mode is enabled', async () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'TB',
      cyclic: true,
    }, elkEngine);

    const positions = updates.map((update) => update.position);
    const centerX = positions.reduce((sum, position) => sum + position.x, 0) / positions.length;
    const centerY = positions.reduce((sum, position) => sum + position.y, 0) / positions.length;
    const distances = positions.map((position) =>
      Math.hypot(position.x - centerX, position.y - centerY),
    );
    const maxDistance = Math.max(...distances);
    const minDistance = Math.min(...distances);

    expect(maxDistance - minDistance).toBeLessThan(60);
  });
});
