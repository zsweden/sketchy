import type { LayoutDirection } from '../framework-types';
import type { CardinalHandleSide, EdgeHandleSide as HandleSide } from '../types';

interface Point {
  x: number;
  y: number;
}

export interface EdgeHandlePlacement {
  sourceSide: HandleSide;
  targetSide: HandleSide;
}

interface BoxLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const VISIBLE_HANDLE_SIDES = [
  'top',
  'right',
  'bottom',
  'left',
  'topleft',
  'topright',
  'bottomright',
  'bottomleft',
] as const satisfies readonly HandleSide[];

export function getBaseHandleSide(side: HandleSide): CardinalHandleSide {
  switch (side) {
    case 'top':
    case 'topleft':
    case 'topright':
      return 'top';
    case 'right':
      return 'right';
    case 'bottom':
    case 'bottomleft':
    case 'bottomright':
      return 'bottom';
    case 'left':
      return 'left';
  }
}

function opposite(side: CardinalHandleSide): CardinalHandleSide {
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

export function getOppositeHandleSide(side: HandleSide): HandleSide {
  switch (side) {
    case 'top':
    case 'right':
    case 'bottom':
    case 'left':
      return opposite(side);
    case 'topleft':
      return 'bottomleft';
    case 'topright':
      return 'bottomright';
    case 'bottomleft':
      return 'topleft';
    case 'bottomright':
      return 'topright';
  }
}

export function isHorizontalCardinalSide(side: CardinalHandleSide): boolean {
  return side === 'left' || side === 'right';
}

function getDirectionalHandleSide(baseSide: CardinalHandleSide, dx: number, dy: number): HandleSide {
  switch (baseSide) {
    case 'top':
      return dx < 0 ? 'topleft' : dx > 0 ? 'topright' : 'top';
    case 'right':
      return dy < 0 ? 'topright' : dy > 0 ? 'bottomright' : 'right';
    case 'bottom':
      return dx < 0 ? 'bottomleft' : dx > 0 ? 'bottomright' : 'bottom';
    case 'left':
      return dy < 0 ? 'topleft' : dy > 0 ? 'bottomleft' : 'left';
  }
}

function defaultPlacement(direction: LayoutDirection): EdgeHandlePlacement {
  const sourceSide = direction === 'TB' ? 'bottom' : 'top';
  return {
    sourceSide,
    targetSide: getOppositeHandleSide(sourceSide),
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
    const sourceBaseSide = dx > 0 ? 'right' : 'left';
    const targetBaseSide = opposite(sourceBaseSide);
    return {
      sourceSide: getDirectionalHandleSide(sourceBaseSide, dx, dy),
      targetSide: getDirectionalHandleSide(targetBaseSide, -dx, -dy),
    };
  }

  const sourceBaseSide = dy > 0 ? 'bottom' : 'top';
  const targetBaseSide = opposite(sourceBaseSide);
  return {
    sourceSide: getDirectionalHandleSide(sourceBaseSide, dx, dy),
    targetSide: getDirectionalHandleSide(targetBaseSide, -dx, -dy),
  };
}

export function getEffectiveHandleSide(side: HandleSide, dx: number, dy: number): CardinalHandleSide {
  switch (side) {
    case 'top':
    case 'right':
    case 'bottom':
    case 'left':
      return side;
    case 'topleft':
      return Math.abs(dx) > Math.abs(dy) ? 'left' : 'top';
    case 'topright':
      return Math.abs(dx) > Math.abs(dy) ? 'right' : 'top';
    case 'bottomleft':
      return Math.abs(dx) > Math.abs(dy) ? 'left' : 'bottom';
    case 'bottomright':
      return Math.abs(dx) > Math.abs(dy) ? 'right' : 'bottom';
  }
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
  return isHandleSide(side) ? side : undefined;
}

export function isHandleSide(side: string): side is HandleSide {
  return side === 'top'
    || side === 'right'
    || side === 'bottom'
    || side === 'left'
    || side === 'topleft'
    || side === 'topright'
    || side === 'bottomleft'
    || side === 'bottomright';
}

export function getHandlePoint(box: BoxLike, side: HandleSide): Point {
  const width = box.right - box.left;
  const height = box.bottom - box.top;

  switch (side) {
    case 'top':
      return { x: box.left + width * 0.5, y: box.top };
    case 'topleft':
      return { x: box.left, y: box.top };
    case 'topright':
      return { x: box.right, y: box.top };
    case 'right':
      return { x: box.right, y: box.top + height * 0.5 };
    case 'bottom':
      return { x: box.left + width * 0.5, y: box.bottom };
    case 'bottomleft':
      return { x: box.left, y: box.bottom };
    case 'bottomright':
      return { x: box.right, y: box.bottom };
    case 'left':
      return { x: box.left, y: box.top + height * 0.5 };
  }
}
