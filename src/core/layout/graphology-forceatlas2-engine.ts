import { DirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import { NODE_SEP } from './layout-engine';
import type { LayoutEngine, LayoutInput, LayoutResult } from './layout-engine';

type GraphNodeAttributes = {
  x: number;
  y: number;
  size: number;
};

function hasDistinctPositions(nodes: LayoutInput[]) {
  const seen = new Set(
    nodes.map((node) => {
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;
      return `${Math.round(x)}:${Math.round(y)}`;
    }),
  );

  return seen.size > 1;
}

function seedNodeCenters(nodes: LayoutInput[]): Map<string, { x: number; y: number }> {
  if (hasDistinctPositions(nodes)) {
    return new Map(
      nodes.map((node) => [
        node.id,
        {
          x: (node.position?.x ?? 0) + node.width / 2,
          y: (node.position?.y ?? 0) + node.height / 2,
        },
      ]),
    );
  }

  const radius = Math.max(180, nodes.length * 26);
  const angleStep = (Math.PI * 2) / Math.max(nodes.length, 1);
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

  return new Map(
    sorted.map((node, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      return [
        node.id,
        {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        },
      ];
    }),
  );
}

function toTopLeftPositions(
  nodes: LayoutInput[],
  positions: Record<string, { x: number; y: number }>,
): LayoutResult[] {
  return nodes.map((node) => {
    const position = positions[node.id];
    const centerX = position?.x ?? 0;
    const centerY = position?.y ?? 0;

    return {
      id: node.id,
      x: centerX - node.width / 2,
      y: centerY - node.height / 2,
    };
  });
}

export const graphologyForceAtlas2Engine: LayoutEngine = async (nodes, edges) => {
  const graph = new DirectedGraph<GraphNodeAttributes>();
  const seededCenters = seedNodeCenters(nodes);

  for (const node of nodes) {
    const seed = seededCenters.get(node.id) ?? { x: 0, y: 0 };
    graph.addNode(node.id, {
      x: seed.x,
      y: seed.y,
      size: Math.max(node.width, node.height) / 2,
    });
  }

  edges.forEach((edge, index) => {
    graph.addDirectedEdgeWithKey(`e${index}`, edge.source, edge.target, {});
  });

  const inferredSettings = forceAtlas2.inferSettings(graph);
  const positions = forceAtlas2(graph, {
    iterations: nodes.length >= 300 ? 70 : nodes.length >= 100 ? 120 : 160,
    settings: {
      ...inferredSettings,
      adjustSizes: true,
      barnesHutOptimize: nodes.length >= 50,
      slowDown: Math.max(inferredSettings.slowDown ?? 1, nodes.length >= 100 ? 4 : 2),
      scalingRatio: Math.max(inferredSettings.scalingRatio ?? 1, 6),
    },
  });

  for (const node of nodes) {
    const position = positions[node.id];
    if (!position) continue;
    graph.replaceNodeAttributes(node.id, {
      x: position.x,
      y: position.y,
      size: Math.max(node.width, node.height) / 2,
    });
  }

  const separated = noverlap(graph, {
    maxIterations: nodes.length >= 300 ? 90 : 70,
    settings: {
      margin: Math.round(NODE_SEP * 0.6),
      ratio: 1.2,
      speed: 3,
      expansion: 1.1,
      gridSize: Math.max(1, Math.round(Math.sqrt(nodes.length))),
    },
  });

  return toTopLeftPositions(nodes, separated);
};
