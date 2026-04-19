import { describe, it, expect } from 'vitest';
import snapshots from './__fixtures__/placement-snapshots.json';
import { computeEdgeRoutingPlacements, DEFAULT_EDGE_ROUTING_CONFIG, DEFAULT_EDGE_ROUTING_POLICY } from '../index';
import type { EdgeRoutingPlacement } from '../types';
import { buildChain, buildCyclicGraph, buildDenseGraph, buildTree } from '../../../test/layout-benchmark-fixtures';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../../../constants/layout';
import type { DiagramNode } from '../../types';

type SnapshotEntry = {
  name: string;
  placements: Record<string, EdgeRoutingPlacement>;
};

const fixtureBuilders: Record<string, () => { nodes: DiagramNode[]; edges: { id: string; source: string; target: string }[] }> = {
  'chain-10': () => buildChain(10),
  'chain-30': () => buildChain(30),
  'tree-depth-5': () => buildTree(5, 2),
  'tree-depth-6': () => buildTree(6, 3),
  'cyclic-20-4': () => buildCyclicGraph(20, 4),
  'dense-30-3': () => buildDenseGraph(30, 3),
  'dense-50-3': () => buildDenseGraph(50, 3),
};

function getNodeBoxes(nodes: DiagramNode[]) {
  return new Map(nodes.map((node) => [
    node.id,
    {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + DEFAULT_NODE_WIDTH,
      bottom: node.position.y + DEFAULT_NODE_HEIGHT,
    },
  ]));
}

describe('edge routing placement consistency', () => {
  for (const entry of snapshots as SnapshotEntry[]) {
    it(`produces bitwise-identical placements for ${entry.name}`, { timeout: 30_000 }, () => {
      const builder = fixtureBuilders[entry.name];
      expect(builder, `missing fixture for ${entry.name}`).toBeDefined();
      const { nodes, edges } = builder();

      const placements = computeEdgeRoutingPlacements({
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        nodeBoxes: getNodeBoxes(nodes),
        layoutDirection: 'TB',
        policy: DEFAULT_EDGE_ROUTING_POLICY,
        config: DEFAULT_EDGE_ROUTING_CONFIG,
      });

      const actual: Record<string, EdgeRoutingPlacement> = {};
      for (const [id, p] of placements) actual[id] = p;

      expect(actual).toEqual(entry.placements);
    });
  }
});
