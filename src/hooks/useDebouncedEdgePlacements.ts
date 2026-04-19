import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiagramEdge, DiagramNode, DiagramSettings } from '../core/types';
import type { EdgeHandlePlacement } from '../core/graph/ports';
import type { EdgeRoutingConfig, EdgeRoutingPolicy } from '../core/edge-routing';
import { getOptimizedEdgePlacements } from '../store/diagram-helpers';

export const EDGE_PLACEMENTS_DEBOUNCE_MS = 120;

const EMPTY_PLACEMENTS: ReadonlyMap<string, EdgeHandlePlacement> = new Map();

function computeTopologyKey(edges: readonly DiagramEdge[]): string {
  let key = '';
  for (const e of edges) {
    key += `${e.id}:${e.source}:${e.target}|`;
  }
  return key;
}

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
  const topologyKey = useMemo(() => computeTopologyKey(edges), [edges]);

  const [placements, setPlacements] = useState<Map<string, EdgeHandlePlacement>>(
    () => (enabled
      ? getOptimizedEdgePlacements(edges, nodes, settings, policy, config)
      : new Map()),
  );

  const firstRenderRef = useRef(true);
  const lastTopologyKeyRef = useRef(topologyKey);
  const lastSettingsRef = useRef(settings);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (!enabled) return;

    const topologyChanged = lastTopologyKeyRef.current !== topologyKey;
    const settingsChanged = lastSettingsRef.current !== settings;
    lastTopologyKeyRef.current = topologyKey;
    lastSettingsRef.current = settings;

    if (topologyChanged || settingsChanged) {
      // Structural changes — edge added/removed, layout direction flipped —
      // need to be visible immediately so the user sees the new edge in its
      // final position. Only node-position changes (drags) get debounced.
      setPlacements(getOptimizedEdgePlacements(edges, nodes, settings, policy, config));
      return;
    }

    const handle = setTimeout(() => {
      setPlacements(getOptimizedEdgePlacements(edges, nodes, settings, policy, config));
    }, EDGE_PLACEMENTS_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [topologyKey, edges, nodes, settings, policy, config, enabled]);

  return enabled ? placements : (EMPTY_PLACEMENTS as Map<string, EdgeHandlePlacement>);
}
