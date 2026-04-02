import { describe, it, expect } from 'vitest';
import { autoLayout } from '../auto-layout';
import { elkEngine } from '../elk-engine';
import type { LayoutEngine } from '../layout-engine';
import type { DiagramEdge, DiagramNode } from '../../types';
import { NODE_WIDTH, estimateHeight } from '../layout-engine';
import { computeLayoutMetrics } from '../layout-metrics';

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

function computeNodeHeights(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): Map<string, number> {
  const degrees = new Map<string, { indegree: number; outdegree: number }>();
  for (const current of nodes) {
    degrees.set(current.id, { indegree: 0, outdegree: 0 });
  }
  for (const current of edges) {
    const source = degrees.get(current.source);
    const target = degrees.get(current.target);
    if (source) source.outdegree++;
    if (target) target.indegree++;
  }

  const heights = new Map<string, number>();
  for (const current of nodes) {
    const degree = degrees.get(current.id) ?? { indegree: 0, outdegree: 0 };
    const hasBadges = current.data.tags.length > 0
      || (degree.indegree === 0 && degree.outdegree > 0)
      || (degree.indegree > 0 && degree.outdegree > 0);
    heights.set(current.id, estimateHeight(current.data.label, hasBadges));
  }
  return heights;
}

describe('autoLayout (ELK)', () => {
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

  it('positions chain left-to-right', async () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'LR',
    }, elkEngine);

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    expect(posMap['a'].x).toBeLessThan(posMap['b'].x);
    expect(posMap['b'].x).toBeLessThan(posMap['c'].x);
  });

  it('tightens the unique leading spine before the first branch in LR trees', async () => {
    const nodes = [node('a'), node('b'), node('c'), node('d'), node('e')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('c', 'e')];
    const updates = await autoLayout(nodes, edges, {
      direction: 'LR',
    }, elkEngine);

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    const gap = (left: string, right: string) =>
      posMap[right].x - (posMap[left].x + NODE_WIDTH);

    expect(gap('a', 'b')).toBe(gap('b', 'c'));
    expect(gap('b', 'c')).toBeLessThan(gap('c', 'd'));
  });

  it('tightens the unique top spine before the first branch in BT trees', async () => {
    const nodes = [node('a'), node('b'), node('c'), node('d'), node('e')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('d', 'a'), edge('e', 'a')];
    const heights = computeNodeHeights(nodes, edges);
    const updates = await autoLayout(nodes, edges, {
      direction: 'BT',
    }, elkEngine);

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    const gap = (upper: string, lower: string) =>
      posMap[lower].y - (posMap[upper].y + (heights.get(upper) ?? 48));

    expect(gap('c', 'b')).toBe(gap('b', 'a'));
    expect(gap('b', 'a')).toBeLessThan(gap('a', 'd'));
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
    expect(maxY - minY).toBeLessThan(620);
  });

  it('keeps dense cyclic SCCs from routing straight through peer nodes', async () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map(node);
    const edges = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'd'),
      edge('d', 'e'),
      edge('e', 'f'),
      edge('f', 'a'),
      edge('a', 'd'),
      edge('b', 'e'),
      edge('c', 'f'),
      edge('f', 'c'),
    ];

    const updates = await autoLayout(nodes, edges, {
      direction: 'TB',
      cyclic: true,
    }, elkEngine);

    const heights = computeNodeHeights(nodes, edges);
    const layoutNodes = nodes.map((current) => ({
      id: current.id,
      width: NODE_WIDTH,
      height: heights.get(current.id) ?? 48,
    }));
    const layoutEdges = edges.map((current) => ({ source: current.source, target: current.target }));
    const positions = new Map(updates.map((update) => [update.id, update.position]));
    const metrics = computeLayoutMetrics(layoutNodes, layoutEdges, positions);

    expect(metrics.nodeOverlaps).toBe(0);
    expect(metrics.edgeNodeOverlaps).toBeLessThanOrEqual(4);
  });

  it('wraps layout engine errors with a descriptive message', async () => {
    const failingEngine: LayoutEngine = async () => {
      throw new Error('java.lang.NullPointerException');
    };

    const nodes = [node('a'), node('b')];
    const edges = [edge('a', 'b')];

    await expect(
      autoLayout(nodes, edges, { direction: 'TB' }, failingEngine),
    ).rejects.toThrow('java.lang.NullPointerException');
  });
});
