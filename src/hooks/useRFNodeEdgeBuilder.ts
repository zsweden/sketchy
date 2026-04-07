import { useMemo } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { DEFAULT_EDGE_ROUTING_CONFIG, DEFAULT_EDGE_ROUTING_POLICY } from '../core/edge-routing';
import { useDiagramStore, useFramework } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { useSettingsStore } from '../store/settings-store';
import { getSourceHandleId, getTargetHandleId, type EdgeHandlePlacement } from '../core/graph/ports';
import { getAutomaticEdgeSides, getOptimizedEdgePlacements, getStoredOrAutomaticEdgeSides } from '../store/diagram-helpers';
import { getJunctionOptions } from '../core/framework-types';
import { getTheme } from '../styles/themes';
import { ARROW_MARKER_SIZE } from '../constants/layout';
import type { ConnectedSubgraph, NamedCausalLoop, NodeDegrees } from '../core/graph/derived';

interface BuilderResult {
  rfNodes: Node[];
  rfEdges: Edge[];
  defaultEdgeOptions: Record<string, unknown>;
  activeTheme: ReturnType<typeof getTheme>;
}

export function useRFNodeEdgeBuilder(
  highlightSets: ConnectedSubgraph | null,
  selectedLoop: NamedCausalLoop | null,
  degreesMap: Map<string, NodeDegrees>,
): BuilderResult {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const settings = useDiagramStore((s) => s.diagram.settings);
  const framework = useFramework();
  const edgeRoutingMode = settings?.edgeRoutingMode ?? 'dynamic';
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const themeId = useSettingsStore((s) => s.theme);
  const activeTheme = useMemo(() => getTheme(themeId), [themeId]);
  const edgeRoutingConfig = useMemo(() => (
    framework.allowsCycles
      ? { ...DEFAULT_EDGE_ROUTING_CONFIG, flowAlignedBonus: 0 }
      : DEFAULT_EDGE_ROUTING_CONFIG
  ), [framework.allowsCycles]);
  const optimizedPlacements = useMemo(() => {
    if (edgeRoutingMode !== 'dynamic') {
      return new Map<string, EdgeHandlePlacement>();
    }
    return getOptimizedEdgePlacements(edges, nodes, settings, DEFAULT_EDGE_ROUTING_POLICY, edgeRoutingConfig);
  }, [edges, nodes, settings, edgeRoutingMode, edgeRoutingConfig]);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: ARROW_MARKER_SIZE, height: ARROW_MARKER_SIZE, color: activeTheme.js.arrowColor },
    style: { strokeWidth: 2 },
  }), [activeTheme]);

  const activeHandlesByNode = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of edges) {
      const { sourceSide, targetSide } = edgeRoutingMode === 'fixed'
        ? getStoredOrAutomaticEdgeSides(e, nodes, settings)
        : optimizedPlacements.get(e.id) ?? getAutomaticEdgeSides(e.source, e.target, nodes, settings);
      if (!map.has(e.source)) map.set(e.source, new Set());
      map.get(e.source)!.add(`source-${sourceSide}`);
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.target)!.add(`target-${targetSide}`);
    }
    return map;
  }, [edges, nodes, settings, edgeRoutingMode, optimizedPlacements]);

  const searchLower = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => {
        let highlightState: 'highlighted' | 'dimmed' | 'none' = 'none';

        if (searchLower) {
          const matches = n.data.label.toLowerCase().includes(searchLower);
          highlightState = matches ? 'highlighted' : 'dimmed';
        } else if (highlightSets) {
          const inHighlightedSet = highlightSets.nodeIds.has(n.id);

          if (selectedLoop || (selectedEdgeIds.length === 1 && selectedNodeIds.length === 0)) {
            highlightState = inHighlightedSet ? 'highlighted' : 'dimmed';
          } else if (selectedNodeIds.length === 1) {
            if (n.id === selectedNodeIds[0]) {
              highlightState = 'highlighted';
            } else if (!inHighlightedSet) {
              highlightState = 'dimmed';
            }
          }
        }

        return {
          id: n.id,
          type: n.type,
          position: n.position,
          draggable: !n.data.locked,
          data: {
            ...n.data,
            degreesMap,
            activeHandles: activeHandlesByNode.get(n.id),
            highlightState,
            loopKind: selectedLoop && highlightSets?.nodeIds.has(n.id)
              ? selectedLoop.kind
              : undefined,
          },
        };
      }),
    [nodes, degreesMap, activeHandlesByNode, highlightSets, selectedLoop, selectedEdgeIds, selectedNodeIds, searchLower],
  );

  const rfEdges: Edge[] = useMemo(
    () => {
      return edges.map((e) => {
        const { sourceSide, targetSide } = edgeRoutingMode === 'fixed'
          ? getStoredOrAutomaticEdgeSides(e, nodes, settings)
          : optimizedPlacements.get(e.id) ?? getAutomaticEdgeSides(e.source, e.target, nodes, settings);

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: [
            framework.supportsEdgePolarity
              ? (() => {
                  const isMath = getJunctionOptions(framework).some((o) => o.id === 'add' || o.id === 'multiply');
                  if (!isMath) return e.polarity === 'negative' ? '-' : '+';
                  const targetNode = nodes.find((n) => n.id === e.target);
                  const isMultiply = targetNode?.data.junctionType === 'multiply';
                  if (e.polarity === 'negative') return isMultiply ? '÷' : '-';
                  return isMultiply ? '×' : '+';
                })()
              : null,
            framework.supportsEdgeDelay && e.delay ? 'D' : null,
            e.edgeTag ? framework.edgeTags?.find((t) => t.id === e.edgeTag)?.shortName ?? null : null,
          ].filter(Boolean).join(' '),
          labelShowBg: framework.supportsEdgePolarity || (framework.supportsEdgeDelay && e.delay) || !!e.edgeTag,
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 0,
          labelBgStyle: {
            fill: activeTheme.js.edgeLabelBg,
            stroke: 'var(--border)',
            strokeWidth: 1,
          },
          labelStyle: {
            fill: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 700,
          },
          sourceHandle: getSourceHandleId(sourceSide),
          targetHandle: getTargetHandleId(targetSide),
          pathOptions: { borderRadius: 100 },
          ...((selectedEdgeIds.includes(e.id) || highlightSets?.edgeIds.has(e.id)) && {
            markerEnd: { type: MarkerType.ArrowClosed, width: ARROW_MARKER_SIZE, height: ARROW_MARKER_SIZE, color: activeTheme.js.arrowColorSelected },
          }),
          className: [
            `edge-confidence-${e.confidence ?? 'high'}`,
            highlightSets
              ? highlightSets.edgeIds.has(e.id) ? 'edge-highlighted' : 'edge-dimmed'
              : '',
            selectedLoop && highlightSets?.edgeIds.has(e.id)
              ? `edge-loop-${selectedLoop.kind}`
              : '',
            selectedEdgeIds.includes(e.id) ? 'edge-selected-animated' : '',
          ].join(' '),
        };
      });
    },
    [edges, nodes, settings, edgeRoutingMode, framework, highlightSets, selectedLoop, selectedEdgeIds, activeTheme, optimizedPlacements],
  );

  return { rfNodes, rfEdges, defaultEdgeOptions, activeTheme };
}
