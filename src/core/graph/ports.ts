import { isVerticalLayoutDirection, type LayoutDirection } from '../framework-types';
import type { CardinalHandleSide, EdgeHandleSide as HandleSide } from '../types';

interface Point {
  x: number;
  y: number;
}

export interface EdgeHandlePlacement {
  sourceSide: HandleSide;
  targetSide: HandleSide;
}

export type LegacyCornerHandleSide = 'topleft' | 'topright' | 'bottomleft' | 'bottomright';

interface BoxLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const HANDLE_CORNER_OFFSET = 8;

export const VISIBLE_HANDLE_SIDES = [
  'top',
  'right',
  'bottom',
  'left',
  'topleft-top',
  'topleft-left',
  'topright-top',
  'topright-right',
  'bottomright-right',
  'bottomright-bottom',
  'bottomleft-bottom',
  'bottomleft-left',
] as const satisfies readonly HandleSide[];

export function getBaseHandleSide(side: HandleSide): CardinalHandleSide {
  switch (side) {
    case 'top':
    case 'topleft-top':
    case 'topright-top':
      return 'top';
    case 'right':
    case 'topright-right':
    case 'bottomright-right':
      return 'right';
    case 'bottom':
    case 'bottomleft-bottom':
    case 'bottomright-bottom':
      return 'bottom';
    case 'left':
    case 'topleft-left':
    case 'bottomleft-left':
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

export function isHorizontalCardinalSide(side: CardinalHandleSide): boolean {
  return side === 'left' || side === 'right';
}

function getDirectionalHandleSide(baseSide: CardinalHandleSide, dx: number, dy: number): HandleSide {
  switch (baseSide) {
    case 'top':
      return dx < 0 ? 'topleft-top' : dx > 0 ? 'topright-top' : 'top';
    case 'right':
      return dy < 0 ? 'topright-right' : dy > 0 ? 'bottomright-right' : 'right';
    case 'bottom':
      return dx < 0 ? 'bottomleft-bottom' : dx > 0 ? 'bottomright-bottom' : 'bottom';
    case 'left':
      return dy < 0 ? 'topleft-left' : dy > 0 ? 'bottomleft-left' : 'left';
  }
}

export function getPrimaryFlowSides(direction: LayoutDirection): {
  sourceSide: CardinalHandleSide;
  targetSide: CardinalHandleSide;
} {
  switch (direction) {
    case 'TB':
      return { sourceSide: 'bottom', targetSide: 'top' };
    case 'BT':
      return { sourceSide: 'top', targetSide: 'bottom' };
    case 'LR':
      return { sourceSide: 'right', targetSide: 'left' };
    case 'RL':
      return { sourceSide: 'left', targetSide: 'right' };
  }
}

function defaultPlacement(direction: LayoutDirection): EdgeHandlePlacement {
  return getPrimaryFlowSides(direction);
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

  if (!isVerticalLayoutDirection(direction) && Math.abs(dx) === Math.abs(dy)) {
    const sourceBaseSide = dx >= 0 ? 'right' : 'left';
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
    || side === 'topleft-top'
    || side === 'topleft-left'
    || side === 'topright-top'
    || side === 'topright-right'
    || side === 'bottomleft-bottom'
    || side === 'bottomleft-left'
    || side === 'bottomright-bottom'
    || side === 'bottomright-right';
}

export function isLegacyCornerHandleSide(side: string): side is LegacyCornerHandleSide {
  return side === 'topleft'
    || side === 'topright'
    || side === 'bottomleft'
    || side === 'bottomright';
}

export function isCornerHandleSide(side: HandleSide): boolean {
  return side !== 'top' && side !== 'right' && side !== 'bottom' && side !== 'left';
}

export function normalizeLegacyHandleSide(
  side: HandleSide | LegacyCornerHandleSide | null | undefined,
  dx: number,
  dy: number,
): HandleSide | undefined {
  if (!side) return undefined;
  if (isHandleSide(side)) return side;

  const horizontalDominant = Math.abs(dx) > Math.abs(dy);

  switch (side) {
    case 'topleft':
      return horizontalDominant ? 'topleft-left' : 'topleft-top';
    case 'topright':
      return horizontalDominant ? 'topright-right' : 'topright-top';
    case 'bottomleft':
      return horizontalDominant ? 'bottomleft-left' : 'bottomleft-bottom';
    case 'bottomright':
      return horizontalDominant ? 'bottomright-right' : 'bottomright-bottom';
  }
}

export function getHandlePoint(box: BoxLike, side: HandleSide): Point {
  const width = box.right - box.left;
  const height = box.bottom - box.top;

  switch (side) {
    case 'top':
      return { x: box.left + width * 0.5, y: box.top };
    case 'topleft-top':
      return { x: box.left + HANDLE_CORNER_OFFSET, y: box.top };
    case 'topleft-left':
      return { x: box.left, y: box.top + HANDLE_CORNER_OFFSET };
    case 'topright-top':
      return { x: box.right - HANDLE_CORNER_OFFSET, y: box.top };
    case 'topright-right':
      return { x: box.right, y: box.top + HANDLE_CORNER_OFFSET };
    case 'right':
      return { x: box.right, y: box.top + height * 0.5 };
    case 'bottomright-right':
      return { x: box.right, y: box.bottom - HANDLE_CORNER_OFFSET };
    case 'bottom':
      return { x: box.left + width * 0.5, y: box.bottom };
    case 'bottomright-bottom':
      return { x: box.right - HANDLE_CORNER_OFFSET, y: box.bottom };
    case 'bottomleft-bottom':
      return { x: box.left + HANDLE_CORNER_OFFSET, y: box.bottom };
    case 'left':
      return { x: box.left, y: box.top + height * 0.5 };
    case 'bottomleft-left':
      return { x: box.left, y: box.bottom - HANDLE_CORNER_OFFSET };
  }
}
