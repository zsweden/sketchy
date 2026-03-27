import { describe, it, expect } from 'vitest';
import { computeNodeDegrees, getDerivedIndicators } from '../derived';
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
