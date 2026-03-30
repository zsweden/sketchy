import { useMemo } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { useSettingsStore } from '../store/settings-store';
import { getSourceHandleId, getTargetHandleId } from '../core/graph/ports';
import { getAutomaticEdgeSides, getStoredOrAutomaticEdgeSides } from '../store/diagram-helpers';
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
  const diagram = useDiagramStore((s) => s.diagram);
  const framework = useDiagramStore((s) => s.framework);
  const edgeRoutingMode = useDiagramStore((s) => s.diagram.settings.edgeRoutingMode);
  const selectedEdgeIds = useUIStore((s) => s.selectedEdgeIds);
  const themeId = useSettingsStore((s) => s.theme);
  const activeTheme = useMemo(() => getTheme(themeId), [themeId]);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: ARROW_MARKER_SIZE, height: ARROW_MARKER_SIZE, color: activeTheme.js.arrowColor },
    style: { strokeWidth: 2 },
  }), [activeTheme]);

  const rfNodes: Node[] = useMemo(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        draggable: !n.data.locked,
        data: {
          ...n.data,
          degreesMap,
          highlightState: highlightSets
            ? highlightSets.nodeIds.has(n.id) ? 'highlighted' : 'dimmed'
            : 'none',
          loopKind: selectedLoop && highlightSets?.nodeIds.has(n.id)
            ? selectedLoop.kind
            : undefined,
        },
      })),
    [diagram.nodes, degreesMap, highlightSets, selectedLoop],
  );

  const rfEdges: Edge[] = useMemo(
    () => {
      return diagram.edges.map((e) => {
        const { sourceSide, targetSide } = edgeRoutingMode === 'fixed'
          ? getStoredOrAutomaticEdgeSides(e, diagram.nodes, diagram.settings)
          : getAutomaticEdgeSides(e.source, e.target, diagram.nodes, diagram.settings);

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
    [diagram.edges, diagram.nodes, diagram.settings, edgeRoutingMode, framework, highlightSets, selectedLoop, selectedEdgeIds, activeTheme],
  );

  return { rfNodes, rfEdges, defaultEdgeOptions, activeTheme };
}
