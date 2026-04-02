import { describe, expect, it } from 'vitest';
import { alignHorizontal, alignVertical } from '../align-distribute';

describe('align-distribute', () => {
  it('aligns horizontal centers when nodes have different heights', () => {
    const result = alignHorizontal([
      { id: 'a', position: { x: 0, y: 0 }, width: 160, height: 60 },
      { id: 'b', position: { x: 240, y: 100 }, width: 160, height: 140 },
    ]);

    const centerY = result.map((item, index) => item.position.y + [60, 140][index] / 2);
    expect(centerY[0]).toBeCloseTo(centerY[1]);
  });

  it('aligns vertical centers when nodes have different widths', () => {
    const result = alignVertical([
      { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 60 },
      { id: 'b', position: { x: 240, y: 100 }, width: 220, height: 60 },
    ]);

    const centerX = result.map((item, index) => item.position.x + [100, 220][index] / 2);
    expect(centerX[0]).toBeCloseTo(centerX[1]);
  });

  it('matches the previous behavior for equal-size nodes', () => {
    const result = alignHorizontal([
      { id: 'a', position: { x: 0, y: 0 }, width: 160, height: 60 },
      { id: 'b', position: { x: 240, y: 120 }, width: 160, height: 60 },
    ]);

    expect(result).toEqual([
      { id: 'a', position: { x: 0, y: 60 } },
      { id: 'b', position: { x: 240, y: 60 } },
    ]);
  });
});
