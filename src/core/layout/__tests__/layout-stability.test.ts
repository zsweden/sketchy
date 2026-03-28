import { describe, it, expect } from 'vitest';
import { autoLayout, elkEngine } from '..';
import type { DiagramNode, DiagramEdge } from '../../types';

const fourBoxNodes: DiagramNode[] = [
  {
    id: '3468c4d9',
    type: 'entity',
    position: { x: 370.09, y: -321.26 },
    data: { label: '', tags: [], junctionType: 'and' },
  },
  {
    id: 'c3d07979',
    type: 'entity',
    position: { x: 644.69, y: -502.33 },
    data: { label: '', tags: [], junctionType: 'and' },
  },
  {
    id: '3b81899f',
    type: 'entity',
    position: { x: 363.0, y: -500.82 },
    data: { label: '', tags: [], junctionType: 'and' },
  },
  {
    id: '5ae91b55',
    type: 'entity',
    position: { x: 645.25, y: -319.73 },
    data: { label: '', tags: [], junctionType: 'and' },
  },
];

const fourBoxEdges: DiagramEdge[] = [
  { id: 'e1', source: '3b81899f', target: '5ae91b55' },
  { id: 'e2', source: 'c3d07979', target: '3468c4d9' },
];

function computeBounds(nodes: DiagramNode[]) {
  const NODE_WIDTH = 240;
  const NODE_HEIGHT = 48;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function applyUpdates(
  nodes: DiagramNode[],
  updates: { id: string; position: { x: number; y: number } }[],
): DiagramNode[] {
  const updateMap = new Map(updates.map((u) => [u.id, u.position]));
  return nodes.map((n) => {
    const pos = updateMap.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

describe('layout stability (4BoxLayout.sky)', () => {
  it('auto-layout produces deterministic positions', async () => {
    const updates1 = await autoLayout(fourBoxNodes, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const updates2 = await autoLayout(fourBoxNodes, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);

    expect(updates1.length).toBe(updates2.length);
    for (let i = 0; i < updates1.length; i++) {
      expect(updates1[i].id).toBe(updates2[i].id);
      expect(updates1[i].position.x).toBeCloseTo(updates2[i].position.x, 10);
      expect(updates1[i].position.y).toBeCloseTo(updates2[i].position.y, 10);
    }
  });

  it('running auto-layout twice produces the same bounding box (same zoom)', async () => {
    const updates1 = await autoLayout(fourBoxNodes, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const nodesAfterFirst = applyUpdates(fourBoxNodes, updates1);
    const bounds1 = computeBounds(nodesAfterFirst);

    const updates2 = await autoLayout(nodesAfterFirst, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const nodesAfterSecond = applyUpdates(nodesAfterFirst, updates2);
    const bounds2 = computeBounds(nodesAfterSecond);

    expect(bounds2.width).toBeCloseTo(bounds1.width, 5);
    expect(bounds2.height).toBeCloseTo(bounds1.height, 5);
    expect(bounds2.minX).toBeCloseTo(bounds1.minX, 5);
    expect(bounds2.minY).toBeCloseTo(bounds1.minY, 5);
  });

  it('node positions are identical after first and second auto-layout', async () => {
    const updates1 = await autoLayout(fourBoxNodes, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const nodesAfterFirst = applyUpdates(fourBoxNodes, updates1);

    const updates2 = await autoLayout(nodesAfterFirst, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const nodesAfterSecond = applyUpdates(nodesAfterFirst, updates2);

    for (const node of nodesAfterFirst) {
      const same = nodesAfterSecond.find((n) => n.id === node.id)!;
      expect(same.position.x).toBeCloseTo(node.position.x, 5);
      expect(same.position.y).toBeCloseTo(node.position.y, 5);
    }
  });

  it('auto-layout produces same bounds on second run', async () => {
    const clearUpdates = await autoLayout(fourBoxNodes, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const nodesCleared = applyUpdates(fourBoxNodes, clearUpdates);
    const boundsClear = computeBounds(nodesCleared);

    const rerunUpdates = await autoLayout(nodesCleared, fourBoxEdges, {
      direction: 'TB',
    }, elkEngine);
    const nodesRerun = applyUpdates(nodesCleared, rerunUpdates);
    const boundsRerun = computeBounds(nodesRerun);

    expect(boundsRerun.width).toBeCloseTo(boundsClear.width, 5);
    expect(boundsRerun.height).toBeCloseTo(boundsClear.height, 5);
  });
});
