import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as derived from '../../core/graph/derived';
import { useGraphDerivations } from '../useGraphDerivations';
import type { DiagramEdge } from '../../core/types';

function edge(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target, type: 'causal' };
}

describe('useGraphDerivations', () => {
  it('memoizes degreesMap and labeledLoops across rerenders with same edges', () => {
    const edges: DiagramEdge[] = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];
    const degSpy = vi.spyOn(derived, 'computeNodeDegrees');
    const loopSpy = vi.spyOn(derived, 'findCausalLoops');

    const { result, rerender } = renderHook(
      ({ edges, allow }) => useGraphDerivations(edges, allow),
      { initialProps: { edges, allow: true } },
    );

    const firstDegrees = result.current.degreesMap;
    const firstLoops = result.current.labeledLoops;
    const degCallsAfterMount = degSpy.mock.calls.length;
    const loopCallsAfterMount = loopSpy.mock.calls.length;

    rerender({ edges, allow: true });
    rerender({ edges, allow: true });

    expect(degSpy.mock.calls.length).toBe(degCallsAfterMount);
    expect(loopSpy.mock.calls.length).toBe(loopCallsAfterMount);
    expect(result.current.degreesMap).toBe(firstDegrees);
    expect(result.current.labeledLoops).toBe(firstLoops);

    degSpy.mockRestore();
    loopSpy.mockRestore();
  });

  it('recomputes when edges change', () => {
    const edges1: DiagramEdge[] = [edge('e1', 'a', 'b')];
    const edges2: DiagramEdge[] = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];

    const { result, rerender } = renderHook(
      ({ edges, allow }) => useGraphDerivations(edges, allow),
      { initialProps: { edges: edges1, allow: true } },
    );
    const firstDegrees = result.current.degreesMap;
    rerender({ edges: edges2, allow: true });
    expect(result.current.degreesMap).not.toBe(firstDegrees);
    expect(result.current.degreesMap.get('c')).toEqual({ indegree: 1, outdegree: 0 });
  });

  it('returns empty loops when allowsCycles is false', () => {
    const edges: DiagramEdge[] = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];
    const { result } = renderHook(() => useGraphDerivations(edges, false));
    expect(result.current.labeledLoops).toEqual([]);
  });
});
