import { describe, expect, it } from 'vitest';
import { distributeHorizontal, distributeVertical } from '../align-distribute';

describe('distributeHorizontal', () => {
  it('distributes three nodes evenly by x position', () => {
    const result = distributeHorizontal([
      { id: 'a', position: { x: 0, y: 10 } },
      { id: 'c', position: { x: 200, y: 30 } },
      { id: 'b', position: { x: 50, y: 20 } },
    ]);

    expect(result).toEqual([
      { id: 'a', position: { x: 0, y: 10 } },
      { id: 'b', position: { x: 100, y: 20 } },
      { id: 'c', position: { x: 200, y: 30 } },
    ]);
  });

  it('preserves y positions', () => {
    const result = distributeHorizontal([
      { id: 'a', position: { x: 0, y: 50 } },
      { id: 'b', position: { x: 100, y: 200 } },
      { id: 'c', position: { x: 300, y: 75 } },
    ]);

    expect(result[0].position.y).toBe(50);
    expect(result[1].position.y).toBe(200);
    expect(result[2].position.y).toBe(75);
  });

  it('handles two items at same position', () => {
    const result = distributeHorizontal([
      { id: 'a', position: { x: 100, y: 0 } },
      { id: 'b', position: { x: 100, y: 0 } },
    ]);

    expect(result[0].position.x).toBe(100);
    expect(result[1].position.x).toBe(100);
  });

  it('handles four items with uneven spacing', () => {
    const result = distributeHorizontal([
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 10, y: 0 } },
      { id: 'c', position: { x: 20, y: 0 } },
      { id: 'd', position: { x: 300, y: 0 } },
    ]);

    expect(result[0].position.x).toBe(0);
    expect(result[1].position.x).toBe(100);
    expect(result[2].position.x).toBe(200);
    expect(result[3].position.x).toBe(300);
  });
});

describe('distributeVertical', () => {
  it('distributes three nodes evenly by y position', () => {
    const result = distributeVertical([
      { id: 'a', position: { x: 10, y: 0 } },
      { id: 'c', position: { x: 30, y: 200 } },
      { id: 'b', position: { x: 20, y: 50 } },
    ]);

    expect(result).toEqual([
      { id: 'a', position: { x: 10, y: 0 } },
      { id: 'b', position: { x: 20, y: 100 } },
      { id: 'c', position: { x: 30, y: 200 } },
    ]);
  });

  it('preserves x positions', () => {
    const result = distributeVertical([
      { id: 'a', position: { x: 50, y: 0 } },
      { id: 'b', position: { x: 200, y: 100 } },
      { id: 'c', position: { x: 75, y: 300 } },
    ]);

    expect(result[0].position.x).toBe(50);
    expect(result[1].position.x).toBe(200);
    expect(result[2].position.x).toBe(75);
  });

  it('handles two items at same position', () => {
    const result = distributeVertical([
      { id: 'a', position: { x: 0, y: 100 } },
      { id: 'b', position: { x: 0, y: 100 } },
    ]);

    expect(result[0].position.y).toBe(100);
    expect(result[1].position.y).toBe(100);
  });
});
