import { useMemo, useRef } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { DEFAULT_EDGE_ROUTING_POLICY } from '../core/edge-routing';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { useSettingsStore } from '../store/settings-store';
import { getSourceHandleId, getTargetHandleId, type EdgeHandlePlacement } from '../core/graph/ports';
import { getAutomaticEdgeSides, getOptimizedEdgePlacements, getStoredOrAutomaticEdgeSides } from '../store/diagram-helpers';
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
  freezeDynamicRouting = false,
): BuilderResult {
  const diagram = useDiagramStore((s) => s.diagram);
  const framework = useDiagramStore((s) => s.framework);
  const edgeRoutingMode = useDiagramStore((s) => s.diagram.settings.edgeRoutingMode);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const themeId = useSettingsStore((s) => s.theme);
  const edgeRenderMode = useSettingsStore((s) => s.edgeRenderMode);
  const activeTheme = useMemo(() => getTheme(themeId), [themeId]);
  const cachedOptimizedPlacements = useRef<Map<string, EdgeHandlePlacement>>(new Map());

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: ARROW_MARKER_SIZE, height: ARROW_MARKER_SIZE, color: activeTheme.js.arrowColor },
    style: { strokeWidth: 2 },
  }), [activeTheme]);

  const optimizedPlacements = useMemo(
    () => {
      if (edgeRoutingMode !== 'dynamic') {
        return cachedOptimizedPlacements.current;
      }
      if (freezeDynamicRouting) {
        return cachedOptimizedPlacements.current;
      }

      const placements = getOptimizedEdgePlacements(
        diagram.edges,
        diagram.nodes,
        diagram.settings,
        DEFAULT_EDGE_ROUTING_POLICY,
      );
      cachedOptimizedPlacements.current = placements;
      return placements;
    },
    [diagram.edges, diagram.nodes, diagram.settings, edgeRoutingMode, freezeDynamicRouting],
  );

  const rfNodes: Node[] = useMemo(
    () =>
      diagram.nodes.map((n) => {
        let highlightState: 'highlighted' | 'dimmed' | 'none' = 'none';

        if (highlightSets) {
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
            highlightState,
            loopKind: selectedLoop && highlightSets?.nodeIds.has(n.id)
              ? selectedLoop.kind
              : undefined,
          },
        };
      }),
    [diagram.nodes, degreesMap, highlightSets, selectedLoop, selectedEdgeIds, selectedNodeIds],
  );

  const rfEdges: Edge[] = useMemo(
    () => {
      return diagram.edges.map((e) => {
        const { sourceSide, targetSide } = edgeRoutingMode === 'fixed'
          ? getStoredOrAutomaticEdgeSides(e, diagram.nodes, diagram.settings)
          : optimizedPlacements.get(e.id) ?? getAutomaticEdgeSides(e.source, e.target, diagram.nodes, diagram.settings);

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: [
            framework.supportsEdgePolarity
              ? e.polarity === 'negative' ? '-' : '+'
              : null,
            framework.supportsEdgeDelay && e.delay ? 'D' : null,
          ].filter(Boolean).join(' '),
          labelShowBg: framework.supportsEdgePolarity || (framework.supportsEdgeDelay && e.delay),
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
          ...(edgeRenderMode === 'new' ? { type: 'orthogonal' } : {}),
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
    [diagram.edges, diagram.nodes, diagram.settings, edgeRoutingMode, framework, highlightSets, selectedLoop, selectedEdgeIds, activeTheme, optimizedPlacements, edgeRenderMode],
  );

  return { rfNodes, rfEdges, defaultEdgeOptions, activeTheme };
}
