interface PositionedItem {
  id: string;
  position: { x: number; y: number };
}

export interface SizedPositionedItem extends PositionedItem {
  width: number;
  height: number;
}

interface PositionUpdate {
  id: string;
  position: { x: number; y: number };
}

type Axis = 'x' | 'y';

const SIZE: Record<Axis, 'width' | 'height'> = { x: 'width', y: 'height' };

function align(items: SizedPositionedItem[], axis: Axis): PositionUpdate[] {
  const size = SIZE[axis];
  const avgCenter =
    items.reduce((sum, n) => sum + n.position[axis] + n[size] / 2, 0) / items.length;
  return items.map((n) => ({
    id: n.id,
    position: { ...n.position, [axis]: avgCenter - n[size] / 2 },
  }));
}

function distribute(items: PositionedItem[], axis: Axis): PositionUpdate[] {
  const sorted = [...items].sort((a, b) => a.position[axis] - b.position[axis]);
  const min = sorted[0].position[axis];
  const max = sorted[sorted.length - 1].position[axis];
  const step = (max - min) / (sorted.length - 1);
  return sorted.map((n, i) => ({
    id: n.id,
    position: { ...n.position, [axis]: min + step * i },
  }));
}

export const alignHorizontal = (items: SizedPositionedItem[]) => align(items, 'y');
export const alignVertical = (items: SizedPositionedItem[]) => align(items, 'x');
export const distributeHorizontal = (items: PositionedItem[]) => distribute(items, 'x');
export const distributeVertical = (items: PositionedItem[]) => distribute(items, 'y');
