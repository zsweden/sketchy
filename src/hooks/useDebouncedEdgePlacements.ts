import { useEffect, useRef, useState } from 'react';
import type { DiagramEdge, DiagramNode, DiagramSettings } from '../core/types';
import type { EdgeHandlePlacement } from '../core/graph/ports';
import type { EdgeRoutingConfig, EdgeRoutingPolicy } from '../core/edge-routing';
import { getOptimizedEdgePlacements } from '../store/diagram-helpers';

export const EDGE_PLACEMENTS_DEBOUNCE_MS = 120;

const EMPTY_PLACEMENTS: ReadonlyMap<string, EdgeHandlePlacement> = new Map();

// Edge routing optimization is O(E² + E×N) with ~8–16 candidates per edge and
// 2 passes. On a 100-node dense graph this takes ~5s per call (see
// `perf-baseline/baseline.json`). Running it on every drag frame pegs the main
// thread. This hook computes once synchronously (so initial render has placements),
// then defers recomputes to an idle window — so rapid position changes during a
// drag never block a frame. Edges fall back to `getAutomaticEdgeSides` when a
// placement isn't in the map, which keeps new edges rendered correctly during
// the debounce gap.
export function useDebouncedEdgePlacements(
  edges: DiagramEdge[],
  nodes: DiagramNode[],
  settings: DiagramSettings,
  policy: EdgeRoutingPolicy,
  config: EdgeRoutingConfig,
  enabled: boolean,
): Map<string, EdgeHandlePlacement> {
  const [placements, setPlacements] = useState<Map<string, EdgeHandlePlacement>>(
    () => (enabled
      ? getOptimizedEdgePlacements(edges, nodes, settings, policy, config)
      : new Map()),
  );

  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (!enabled) return;

    const handle = setTimeout(() => {
      setPlacements(getOptimizedEdgePlacements(edges, nodes, settings, policy, config));
    }, EDGE_PLACEMENTS_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [edges, nodes, settings, policy, config, enabled]);

  return enabled ? placements : (EMPTY_PLACEMENTS as Map<string, EdgeHandlePlacement>);
}
