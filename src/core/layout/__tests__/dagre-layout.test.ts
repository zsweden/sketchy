import { describe, it, expect } from 'vitest';
import { autoLayout } from '../dagre-layout';
import type { DiagramEdge, DiagramNode } from '../../types';

function node(id: string, pinned = false): DiagramNode {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    pinned,
    data: { label: id, tags: [], junctionType: 'and' },
  };
}

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('autoLayout', () => {
  it('positions chain top-to-bottom', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = autoLayout(nodes, edges, {
      direction: 'TB',
      respectPinned: false,
    });

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    expect(posMap['a'].y).toBeLessThan(posMap['b'].y);
    expect(posMap['b'].y).toBeLessThan(posMap['c'].y);
  });

  it('positions chain bottom-to-top', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = autoLayout(nodes, edges, {
      direction: 'BT',
      respectPinned: false,
    });

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    expect(posMap['a'].y).toBeGreaterThan(posMap['b'].y);
    expect(posMap['b'].y).toBeGreaterThan(posMap['c'].y);
  });

  it('skips pinned nodes when respectPinned is true', () => {
    const nodes = [node('a'), node('b', true), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = autoLayout(nodes, edges, {
      direction: 'TB',
      respectPinned: true,
    });

    const ids = updates.map((u) => u.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
    expect(ids).toContain('c');
  });

  it('includes pinned nodes when respectPinned is false', () => {
    const nodes = [node('a'), node('b', true), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const updates = autoLayout(nodes, edges, {
      direction: 'TB',
      respectPinned: false,
    });

    const ids = updates.map((u) => u.id);
    expect(ids).toContain('b');
  });

  it('handles diamond shape without overlap', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
    const updates = autoLayout(nodes, edges, {
      direction: 'TB',
      respectPinned: false,
    });

    const posMap = Object.fromEntries(updates.map((u) => [u.id, u.position]));
    // b and c should be at the same rank (similar y) but different x
    expect(Math.abs(posMap['b'].y - posMap['c'].y)).toBeLessThan(10);
    expect(posMap['b'].x).not.toBe(posMap['c'].x);
  });
});
