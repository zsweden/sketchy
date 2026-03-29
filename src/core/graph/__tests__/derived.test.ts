import { describe, it, expect } from 'vitest';
import {
  computeNodeDegrees,
  findCausalLoops,
  findStronglyConnectedComponents,
  getDerivedIndicators,
  getConnectedSubgraph,
  summarizeCausalLoops,
} from '../derived';
import { crtFramework } from '../../../frameworks/crt';
import type { DiagramEdge } from '../../types';

function edge(source: string, target: string): DiagramEdge {
  return { id: `${source}-${target}`, source, target };
}

describe('computeNodeDegrees', () => {
  it('returns empty map for no edges', () => {
    const degrees = computeNodeDegrees([]);
    expect(degrees.size).toBe(0);
  });

  it('computes degrees for a chain', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const degrees = computeNodeDegrees(edges);

    expect(degrees.get('a')).toEqual({ indegree: 0, outdegree: 1 });
    expect(degrees.get('b')).toEqual({ indegree: 1, outdegree: 1 });
    expect(degrees.get('c')).toEqual({ indegree: 1, outdegree: 0 });
  });

  it('computes degrees for diamond', () => {
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
    const degrees = computeNodeDegrees(edges);

    expect(degrees.get('a')!.outdegree).toBe(2);
    expect(degrees.get('d')!.indegree).toBe(2);
  });
});

describe('getDerivedIndicators', () => {
  const indicators = crtFramework.derivedIndicators;

  it('returns root-cause for node with indegree=0', () => {
    const edges = [edge('a', 'b')];
    const degrees = computeNodeDegrees(edges);
    const result = getDerivedIndicators('a', degrees, indicators);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('root-cause');
  });

  it('returns intermediate for node with both in and out', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const degrees = computeNodeDegrees(edges);
    const result = getDerivedIndicators('b', degrees, indicators);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('intermediate');
  });

  it('returns root-cause for isolated node (not in edges)', () => {
    const degrees = computeNodeDegrees([]);
    const result = getDerivedIndicators('x', degrees, indicators);

    // indegree=0 → root-cause
    expect(result.some((i) => i.id === 'root-cause')).toBe(true);
  });

  it('returns no CRT indicators for leaf node (only indegree)', () => {
    const edges = [edge('a', 'b')];
    const degrees = computeNodeDegrees(edges);
    const result = getDerivedIndicators('b', degrees, indicators);

    // CRT doesn't define a 'leaf' indicator
    expect(result).toHaveLength(0);
  });
});

describe('getConnectedSubgraph', () => {
  it('returns only selected node when no edges', () => {
    const result = getConnectedSubgraph([], 'a');
    expect(result.nodeIds).toEqual(new Set(['a']));
    expect(result.edgeIds.size).toBe(0);
  });

  it('finds upstream and downstream in a chain (select middle)', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const result = getConnectedSubgraph(edges, 'b');
    expect(result.nodeIds).toEqual(new Set(['a', 'b', 'c']));
    expect(result.edgeIds).toEqual(new Set(['a-b', 'b-c']));
  });

  it('finds multiple inputs in a diamond (select merge node)', () => {
    const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
    const result = getConnectedSubgraph(edges, 'd');
    expect(result.nodeIds).toEqual(new Set(['b', 'c', 'd']));
    expect(result.edgeIds).toEqual(new Set(['b-d', 'c-d']));
  });

  it('finds only downstream for root node', () => {
    const edges = [edge('a', 'b'), edge('a', 'c')];
    const result = getConnectedSubgraph(edges, 'a');
    expect(result.nodeIds).toEqual(new Set(['a', 'b', 'c']));
    expect(result.edgeIds).toEqual(new Set(['a-b', 'a-c']));
  });

  it('finds only upstream for leaf node', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const result = getConnectedSubgraph(edges, 'c');
    expect(result.nodeIds).toEqual(new Set(['b', 'c']));
    expect(result.edgeIds).toEqual(new Set(['b-c']));
  });

  it('returns only selected node when isolated', () => {
    const edges = [edge('a', 'b')];
    const result = getConnectedSubgraph(edges, 'x');
    expect(result.nodeIds).toEqual(new Set(['x']));
    expect(result.edgeIds.size).toBe(0);
  });
});

describe('findStronglyConnectedComponents', () => {
  it('finds cyclic components separately from singletons', () => {
    const edges = [
      edge('a', 'b'),
      edge('b', 'a'),
      edge('c', 'd'),
    ];

    const components = findStronglyConnectedComponents(['a', 'b', 'c', 'd'], edges);
    expect(components).toContainEqual(['a', 'b']);
    expect(components).toContainEqual(['c']);
    expect(components).toContainEqual(['d']);
  });
});

describe('findCausalLoops', () => {
  it('detects reinforcing loops', () => {
    const edges = [
      { ...edge('a', 'b'), polarity: 'positive' as const },
      { ...edge('b', 'c'), polarity: 'positive' as const },
      { ...edge('c', 'a'), polarity: 'positive' as const },
    ];

    const loops = findCausalLoops(edges);
    expect(loops).toHaveLength(1);
    expect(loops[0].kind).toBe('reinforcing');
    expect(loops[0].nodeIds).toEqual(['a', 'b', 'c']);
  });

  it('detects balancing loops with an odd number of negative edges', () => {
    const edges = [
      { ...edge('a', 'b'), polarity: 'positive' as const },
      { ...edge('b', 'c'), polarity: 'negative' as const },
      { ...edge('c', 'a'), polarity: 'positive' as const },
    ];

    const loops = findCausalLoops(edges);
    expect(loops).toHaveLength(1);
    expect(loops[0].kind).toBe('balancing');
    expect(loops[0].negativeEdgeCount).toBe(1);
  });

  it('deduplicates the same loop discovered from different start nodes', () => {
    const edges = [
      { ...edge('a', 'b'), polarity: 'positive' as const },
      { ...edge('b', 'c'), polarity: 'positive' as const },
      { ...edge('c', 'a'), polarity: 'positive' as const },
    ];

    const loops = findCausalLoops(edges);
    expect(loops).toHaveLength(1);
  });
});

describe('summarizeCausalLoops', () => {
  it('counts reinforcing, balancing, and delayed loops', () => {
    const loops = [
      {
        nodeIds: ['a', 'b'],
        edgeIds: ['e1', 'e2'],
        kind: 'reinforcing' as const,
        negativeEdgeCount: 0,
        delayedEdgeCount: 0,
      },
      {
        nodeIds: ['c', 'd'],
        edgeIds: ['e3', 'e4'],
        kind: 'balancing' as const,
        negativeEdgeCount: 1,
        delayedEdgeCount: 1,
      },
    ];

    expect(summarizeCausalLoops(loops)).toEqual({
      totalLoops: 2,
      reinforcingLoops: 1,
      balancingLoops: 1,
      delayedLoops: 1,
    });
  });
});
