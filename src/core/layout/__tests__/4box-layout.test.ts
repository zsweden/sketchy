import { describe, it, expect } from 'vitest';
import { autoLayout } from '../auto-layout';
import { elkEngine } from '../elk-engine';
import type { DiagramNode, DiagramEdge } from '../../types';

// Fixture from 4BoxLayout — two disconnected chains (TB direction)
const nodes: DiagramNode[] = [
  {
    id: '3468c4d9',
    type: 'entity',
    position: { x: 370, y: -321 },
    data: { label: 'Box A2', tags: [], junctionType: 'and' },
  },
  {
    id: 'c3d07979',
    type: 'entity',
    position: { x: 644, y: -502 },
    data: { label: 'Box B1', tags: [], junctionType: 'and' },
  },
  {
    id: '3b81899f',
    type: 'entity',
    position: { x: 362, y: -500 },
    data: { label: 'Box A1', tags: [], junctionType: 'and' },
  },
  {
    id: '5ae91b55',
    type: 'entity',
    position: { x: 645, y: -319 },
    data: { label: 'Box B2', tags: [], junctionType: 'and' },
  },
];

// Two disconnected edges: A1→B2 and B1→A2
const edges: DiagramEdge[] = [
  { id: 'e1', source: '3b81899f', target: '5ae91b55' },
  { id: 'e2', source: 'c3d07979', target: '3468c4d9' },
];

describe('4BoxLayout — disconnected components', () => {
  it('places two disconnected chains side by side, not stacked', async () => {
    const results = await autoLayout(nodes, edges, { direction: 'TB' }, elkEngine);

    // Build a position map
    const pos = new Map(results.map((r) => [r.id, r.position]));

    // Chain A: 3b81899f → 5ae91b55
    const a1 = pos.get('3b81899f')!;
    const a2 = pos.get('5ae91b55')!;

    // Chain B: c3d07979 → 3468c4d9
    const b1 = pos.get('c3d07979')!;
    const b2 = pos.get('3468c4d9')!;

    // Within each chain, source should be above target (TB direction)
    expect(a1.y).toBeLessThan(a2.y);
    expect(b1.y).toBeLessThan(b2.y);

    // The two chains should be horizontally separated (side by side)
    // Compute the horizontal center of each chain
    const centerAx = (a1.x + a2.x) / 2;
    const centerBx = (b1.x + b2.x) / 2;
    const horizontalGap = Math.abs(centerAx - centerBx);

    // They should NOT overlap horizontally — expect meaningful separation
    expect(horizontalGap).toBeGreaterThan(100);
  });
});
