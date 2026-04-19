import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedEdgePlacements, EDGE_PLACEMENTS_DEBOUNCE_MS } from '../useDebouncedEdgePlacements';
import { buildChain } from '../../test/layout-benchmark-fixtures';
import { createEmptyDiagram } from '../../core/types';
import { DEFAULT_EDGE_ROUTING_CONFIG, DEFAULT_EDGE_ROUTING_POLICY } from '../../core/edge-routing';
import * as diagramHelpers from '../../store/diagram-helpers';

describe('useDebouncedEdgePlacements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns placements synchronously on first render', () => {
    const { nodes, edges } = buildChain(10);
    const settings = createEmptyDiagram('crt').settings;

    const { result } = renderHook(() =>
      useDebouncedEdgePlacements(
        edges,
        nodes,
        settings,
        DEFAULT_EDGE_ROUTING_POLICY,
        DEFAULT_EDGE_ROUTING_CONFIG,
        true,
      ),
    );

    expect(result.current.size).toBe(edges.length);
  });

  it('returns an empty map when disabled', () => {
    const { nodes, edges } = buildChain(10);
    const settings = createEmptyDiagram('crt').settings;

    const { result } = renderHook(() =>
      useDebouncedEdgePlacements(
        edges,
        nodes,
        settings,
        DEFAULT_EDGE_ROUTING_POLICY,
        DEFAULT_EDGE_ROUTING_CONFIG,
        false,
      ),
    );

    expect(result.current.size).toBe(0);
  });

  it('does not recompute placements synchronously when nodes change rapidly', () => {
    const { nodes, edges } = buildChain(10);
    const settings = createEmptyDiagram('crt').settings;

    const spy = vi.spyOn(diagramHelpers, 'getOptimizedEdgePlacements');

    const { result, rerender } = renderHook(
      ({ n }) =>
        useDebouncedEdgePlacements(
          edges,
          n,
          settings,
          DEFAULT_EDGE_ROUTING_POLICY,
          DEFAULT_EDGE_ROUTING_CONFIG,
          true,
        ),
      { initialProps: { n: nodes } },
    );

    const initialPlacements = result.current;
    const initialCallCount = spy.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0); // sync initial compute

    // Simulate 30 drag frames, each only 10ms apart (well below debounce)
    for (let frame = 0; frame < 30; frame++) {
      const dragged = nodes.map((node) => ({
        ...node,
        position: { x: node.position.x + frame, y: node.position.y },
      }));
      act(() => {
        rerender({ n: dragged });
        vi.advanceTimersByTime(10);
      });
    }

    // During rapid updates, placements ref must be stable (no recompute fired yet)
    expect(result.current).toBe(initialPlacements);
    // And no additional synchronous compute occurred beyond the initial one
    expect(spy.mock.calls.length).toBe(initialCallCount);
  });

  it('recomputes placements after inputs stabilize for debounce window', () => {
    const { nodes, edges } = buildChain(10);
    const settings = createEmptyDiagram('crt').settings;

    const spy = vi.spyOn(diagramHelpers, 'getOptimizedEdgePlacements');

    const dragged = nodes.map((node) => ({
      ...node,
      position: { x: node.position.x + 100, y: node.position.y + 100 },
    }));

    const { result, rerender } = renderHook(
      ({ n }) =>
        useDebouncedEdgePlacements(
          edges,
          n,
          settings,
          DEFAULT_EDGE_ROUTING_POLICY,
          DEFAULT_EDGE_ROUTING_CONFIG,
          true,
        ),
      { initialProps: { n: nodes } },
    );

    const initialPlacements = result.current;
    const callsAfterInit = spy.mock.calls.length;

    act(() => {
      rerender({ n: dragged });
    });

    // Still using the initial placements — the effect is scheduled, not fired.
    expect(result.current).toBe(initialPlacements);

    act(() => {
      vi.advanceTimersByTime(EDGE_PLACEMENTS_DEBOUNCE_MS + 5);
    });

    // After the debounce window, the hook computes with the new nodes.
    expect(spy.mock.calls.length).toBe(callsAfterInit + 1);
  });

  it('resets debounce timer on each rapid input change', () => {
    const { nodes, edges } = buildChain(10);
    const settings = createEmptyDiagram('crt').settings;

    const spy = vi.spyOn(diagramHelpers, 'getOptimizedEdgePlacements');

    const { rerender } = renderHook(
      ({ n }) =>
        useDebouncedEdgePlacements(
          edges,
          n,
          settings,
          DEFAULT_EDGE_ROUTING_POLICY,
          DEFAULT_EDGE_ROUTING_CONFIG,
          true,
        ),
      { initialProps: { n: nodes } },
    );

    const callsAfterInit = spy.mock.calls.length;

    // 10 rapid updates, each spaced half the debounce window apart.
    // The timer should keep resetting and never fire.
    const halfWindow = Math.floor(EDGE_PLACEMENTS_DEBOUNCE_MS / 2);
    for (let i = 0; i < 10; i++) {
      const dragged = nodes.map((node) => ({
        ...node,
        position: { x: node.position.x + i, y: node.position.y },
      }));
      act(() => {
        rerender({ n: dragged });
        vi.advanceTimersByTime(halfWindow);
      });
    }

    // No new compute should have fired — only the initial one.
    expect(spy.mock.calls.length).toBe(callsAfterInit);

    // Let the timer finish
    act(() => {
      vi.advanceTimersByTime(EDGE_PLACEMENTS_DEBOUNCE_MS + 5);
    });

    // Exactly one new compute for the most recent inputs.
    expect(spy.mock.calls.length).toBe(callsAfterInit + 1);
  });
});
