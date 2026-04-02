export interface PositionedItem {
  id: string;
  position: { x: number; y: number };
}

export interface SizedPositionedItem extends PositionedItem {
  width: number;
  height: number;
}

export interface PositionUpdate {
  id: string;
  position: { x: number; y: number };
}

export function alignHorizontal(items: SizedPositionedItem[]): PositionUpdate[] {
  const avgCenterY = items.reduce((sum, n) => sum + n.position.y + n.height / 2, 0) / items.length;
  return items.map((n) => ({
    id: n.id,
    position: { x: n.position.x, y: avgCenterY - n.height / 2 },
  }));
}

export function alignVertical(items: SizedPositionedItem[]): PositionUpdate[] {
  const avgCenterX = items.reduce((sum, n) => sum + n.position.x + n.width / 2, 0) / items.length;
  return items.map((n) => ({
    id: n.id,
    position: { x: avgCenterX - n.width / 2, y: n.position.y },
  }));
}

export function distributeHorizontal(items: PositionedItem[]): PositionUpdate[] {
  const sorted = [...items].sort((a, b) => a.position.x - b.position.x);
  const minX = sorted[0].position.x;
  const maxX = sorted[sorted.length - 1].position.x;
  const step = (maxX - minX) / (sorted.length - 1);
  return sorted.map((n, i) => ({ id: n.id, position: { x: minX + step * i, y: n.position.y } }));
}

export function distributeVertical(items: PositionedItem[]): PositionUpdate[] {
  const sorted = [...items].sort((a, b) => a.position.y - b.position.y);
  const minY = sorted[0].position.y;
  const maxY = sorted[sorted.length - 1].position.y;
  const step = (maxY - minY) / (sorted.length - 1);
  return sorted.map((n, i) => ({ id: n.id, position: { x: n.position.x, y: minY + step * i } }));
}
