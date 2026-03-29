import type { LayoutDirection } from '../framework-types';
import type { EdgeHandleSide as HandleSide } from '../types';

interface Point {
  x: number;
  y: number;
}

export interface EdgeHandlePlacement {
  sourceSide: HandleSide;
  targetSide: HandleSide;
}

function opposite(side: HandleSide): HandleSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
  }
}

function defaultPlacement(direction: LayoutDirection): EdgeHandlePlacement {
  const sourceSide = direction === 'TB' ? 'bottom' : 'top';
  return {
    sourceSide,
    targetSide: opposite(sourceSide),
  };
}

export function getEdgeHandlePlacement(
  sourcePosition: Point | undefined,
  targetPosition: Point | undefined,
  direction: LayoutDirection,
): EdgeHandlePlacement {
  if (!sourcePosition || !targetPosition) {
    return defaultPlacement(direction);
  }

  const dx = targetPosition.x - sourcePosition.x;
  const dy = targetPosition.y - sourcePosition.y;

  if (dx === 0 && dy === 0) {
    return defaultPlacement(direction);
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  }

  return dy > 0
    ? { sourceSide: 'bottom', targetSide: 'top' }
    : { sourceSide: 'top', targetSide: 'bottom' };
}

export function getSourceHandleId(side: HandleSide): string {
  return `source-${side}`;
}

export function getTargetHandleId(side: HandleSide): string {
  return `target-${side}`;
}

export function getSideFromHandleId(
  handleId: string | null | undefined,
  kind: 'source' | 'target',
): HandleSide | undefined {
  if (!handleId) return undefined;
  const prefix = `${kind}-`;
  if (!handleId.startsWith(prefix)) return undefined;
  const side = handleId.slice(prefix.length);
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left'
    ? side
    : undefined;
}
