import { useMemo } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { DEFAULT_EDGE_ROUTING_CONFIG, DEFAULT_EDGE_ROUTING_POLICY } from '../core/edge-routing';
import { useDiagramStore, useFramework } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';
import { useSettingsStore } from '../store/settings-store';
import { getSourceHandleId, getTargetHandleId } from '../core/graph/ports';
import {
  getAutomaticEdgeSides,
  getStoredOrAutomaticEdgeSides,
} from '../store/diagram-edge-routing';
import { computeNodeHighlightState, computeEdgeLabel } from '../core/graph/rendering';
import { getTheme } from '../styles/themes';
import { ARROW_MARKER_SIZE } from '../constants/layout';
import type { ConnectedSubgraph, NamedCausalLoop, NodeDegrees } from '../core/graph/derived';
import { useDebouncedEdgePlacements } from './useDebouncedEdgePlacements';
import type { Annotation } from '../core/types';

const LINE_NODE_PADDING = 12;

interface BuilderResult {
  rfNodes: Node[];
  rfEdges: Edge[];
  defaultEdgeOptions: Record<string, unknown>;
  activeTheme: ReturnType<typeof getTheme>;
}

function annotationToRFNode(a: Annotation): Node {
  if (a.kind !== 'line') {
    return {
      id: a.id,
      type: `annotation-${a.kind}`,
      position: a.position,
      width: a.size.width,
      height: a.size.height,
      zIndex: -1,
      data: { ...a.data, kind: a.kind, size: a.size },
    };
  }

  const x = Math.min(a.start.x, a.end.x) - LINE_NODE_PADDING;
  const y = Math.min(a.start.y, a.end.y) - LINE_NODE_PADDING;
  const width = Math.abs(a.end.x - a.start.x) + LINE_NODE_PADDING * 2;
  const height = Math.abs(a.end.y - a.start.y) + LINE_NODE_PADDING * 2;

  return {
    id: a.id,
    type: 'annotation-line',
    position: { x, y },
    width,
    height,
    draggable: false,
    zIndex: -1,
    data: {
      ...a.data,
      kind: a.kind,
      start: a.start,
      end: a.end,
      localStart: { x: a.start.x - x, y: a.start.y - y },
      localEnd: { x: a.end.x - x, y: a.end.y - y },
      size: { width, height },
    },
  };
}

export function useRFNodeEdgeBuilder(
  highlightSets: ConnectedSubgraph | null,
  selectedLoop: NamedCausalLoop | null,
  degreesMap: Map<string, NodeDegrees>,
): BuilderResult {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const annotations = useDiagramStore((s) => s.diagram.annotations);
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
  const optimizedPlacements = useDebouncedEdgePlacements(
    edges,
    nodes,
    settings,
    DEFAULT_EDGE_ROUTING_POLICY,
    edgeRoutingConfig,
    edgeRoutingMode === 'dynamic',
  );

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: ARROW_MARKER_SIZE, height: ARROW_MARKER_SIZE, color: activeTheme.js.arrowColor },
    style: { strokeWidth: 2 },
  }), [activeTheme]);

  const searchLower = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

  const highlightCtx = useMemo(() => ({
    searchLower,
    highlightSets,
    selectedNodeIds,
    selectedEdgeIds,
    selectedLoopId: selectedLoop?.id ?? null,
  }), [searchLower, highlightSets, selectedNodeIds, selectedEdgeIds, selectedLoop]);

  const rfNodes: Node[] = useMemo(
    () => [
      ...annotations.map(annotationToRFNode),
      ...nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        draggable: !n.data.locked,
        data: {
          ...n.data,
          degreesMap,
          highlightState: computeNodeHighlightState(n.id, n.data.label, highlightCtx),
          loopKind: selectedLoop && highlightSets?.nodeIds.has(n.id)
            ? selectedLoop.kind
            : undefined,
        },
      })),
    ],
    [nodes, annotations, degreesMap, highlightSets, selectedLoop, highlightCtx],
  );

  const rfEdges: Edge[] = useMemo(
    () => {
      return edges.map((e) => {
        const { sourceSide, targetSide } = edgeRoutingMode === 'fixed'
          ? getStoredOrAutomaticEdgeSides(e, nodes, settings)
          : optimizedPlacements.get(e.id) ?? getAutomaticEdgeSides(e.source, e.target, nodes, settings);

        const targetNode = nodes.find((n) => n.id === e.target);
        const edgeLabel = computeEdgeLabel(e, framework, targetNode?.data.junctionType);

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: edgeLabel.label,
          labelShowBg: edgeLabel.showBg,
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
