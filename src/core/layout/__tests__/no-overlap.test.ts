import { describe, it, expect } from 'vitest';
import { autoLayout, elkEngine } from '..';
import type { DiagramNode, DiagramEdge } from '../../types';
import { NODE_WIDTH, MIN_NODE_HEIGHT } from '../layout-engine';

function n(id: string, x: number, y: number, pinned = false): DiagramNode {
  return {
    id, type: 'entity', position: { x, y }, pinned,
    data: { label: '', tags: [], junctionType: 'and' },
  };
}

function e(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target };
}

// --- Fixtures extracted from .sky test files ---

const fixtures: Record<string, { nodes: DiagramNode[]; edges: DiagramEdge[] }> = {
  '4BoxLayout': {
    nodes: [
      n('3468', 370.09, -321.26),
      n('c3d0', 644.69, -502.33, true),
      n('3b81', 363.0, -500.82, true),
      n('5ae9', 645.25, -319.73),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
    ],
  },

  '4BoxLayoutv2 (cross-edge)': {
    nodes: [
      n('3468', 643.5, -368.9),
      n('c3d0', 644.7, -502.3, true),
      n('3b81', 363.0, -500.8, true),
      n('5ae9', 363.7, -370.8),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
      e('e3', '3b81', '3468'),
    ],
  },

  '6BoxLayout': {
    nodes: [
      n('3468', 311.28, 126.14),
      n('c3d0', 2.56, 1.28, true),
      n('3b81', 280, 0, true),
      n('5ae9', -4.72, 131.14),
      n('7f0d', 22.95, 228.22),
      n('b747', 288.52, 223.77),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
      e('e3', '3468', '7f0d'),
      e('e4', '5ae9', 'b747'),
    ],
  },

  '9BoxLayout': {
    nodes: [
      n('3468', 710.65, 133.57),
      n('c3d0', 2.56, 1.28, true),
      n('3b81', 280, 0, true),
      n('5ae9', 287.13, 130.61),
      n('7f0d', 1.28, 256.64),
      n('b747', 421.28, 256.64),
      n('c06d', -0.72, 370.64),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
      e('e3', '3468', '7f0d'),
      e('e4', '5ae9', 'b747'),
      e('e5', 'c06d', '5ae9'),
      e('e6', 'c3d0', '5ae9'),
      e('e7', '5ae9', '7f0d'),
    ],
  },

  '9BoxLayoutv2': {
    nodes: [
      n('3468', 136.28, 128.64),
      n('c3d0', 51.12, -0.007, true),
      n('3b81', 160.10, 354.05, true),
      n('5ae9', 416.28, 128.64),
      n('7f0d', 136.28, 256.64),
      n('b747', 436.28, 256.64),
      n('c06d', 566.28, 0.64),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
      e('e3', '3468', '7f0d'),
      e('e4', '5ae9', 'b747'),
      e('e5', 'c06d', '5ae9'),
      e('e6', 'c3d0', '5ae9'),
      e('e7', '5ae9', '7f0d'),
    ],
  },

  '4BoxLayoutv3 (offset pins)': {
    nodes: [
      n('3468', 564.99, -366.24),
      n('c3d0', 746.02, -418.33, true),
      n('3b81', 382.33, -402.15, true),
      n('5ae9', 530.51, -170.24),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
    ],
  },

  '9BoxLayoutv3 (no pins)': {
    nodes: [
      n('3468', 140, 128),
      n('c3d0', 59.01, 3.10),
      n('3b81', 326.33, 0.78),
      n('5ae9', 420, 128),
      n('7f0d', 140, 256),
      n('b747', 440, 256),
      n('c06d', 570, 0),
    ],
    edges: [
      e('e1', '3b81', '5ae9'),
      e('e2', 'c3d0', '3468'),
      e('e3', '3468', '7f0d'),
      e('e4', '5ae9', 'b747'),
      e('e5', 'c06d', '5ae9'),
      e('e6', 'c3d0', '5ae9'),
      e('e7', '5ae9', '7f0d'),
    ],
  },
};

/** Check that no two nodes overlap (bounding boxes don't intersect). */
function assertNoOverlap(allPositions: { id: string; x: number; y: number }[]) {
  for (let i = 0; i < allPositions.length; i++) {
    for (let j = i + 1; j < allPositions.length; j++) {
      const a = allPositions[i];
      const b = allPositions[j];
      const hOverlap = a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH;
      const vOverlap = a.y < b.y + MIN_NODE_HEIGHT && b.y < a.y + MIN_NODE_HEIGHT;
      if (hOverlap && vOverlap) {
        throw new Error(
          `Overlap: ${a.id} (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) and ` +
          `${b.id} (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`,
        );
      }
    }
  }
}

describe('no-overlap on .sky fixtures', () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    it(`${name} — respectPinned=true`, async () => {
      const updates = await autoLayout(
        fixture.nodes, fixture.edges,
        { direction: 'TB', respectPinned: true },
        elkEngine,
      );

      const updateMap = new Map(updates.map((u) => [u.id, u.position]));
      const allPositions = fixture.nodes.map((n) => ({
        id: n.id,
        ...(updateMap.get(n.id) ?? n.position),
      }));

      assertNoOverlap(allPositions);
    });

    it(`${name} — respectPinned=false`, async () => {
      const updates = await autoLayout(
        fixture.nodes, fixture.edges,
        { direction: 'TB', respectPinned: false },
        elkEngine,
      );

      const allPositions = updates.map((u) => ({
        id: u.id, x: u.position.x, y: u.position.y,
      }));

      assertNoOverlap(allPositions);
    });
  }
});
