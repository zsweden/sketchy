import type { Annotation, AnnotationKind, LineAnnotation, Point } from '../types';

export const DEFAULT_ANNOTATION_SIZE: Record<AnnotationKind, { width: number; height: number }> = {
  text: { width: 180, height: 40 },
  rect: { width: 160, height: 100 },
  ellipse: { width: 160, height: 100 },
  line: { width: 200, height: 120 },
};

const LINE_NODE_PADDING = 12;
const MIN_DRAW_SIZE = 20;

interface LineNodeGeometry {
  position: Point;
  size: { width: number; height: number };
  localStart: Point;
  localEnd: Point;
}

export function createAnnotation(kind: AnnotationKind, position: Point, id: string): Annotation {
  const size = DEFAULT_ANNOTATION_SIZE[kind];
  if (kind === 'line') {
    return {
      id,
      kind,
      start: position,
      end: { x: position.x + size.width, y: position.y + size.height },
      data: {},
    };
  }

  return {
    id,
    kind,
    position,
    size: { ...size },
    data: {},
  };
}

export function getLineNodeGeometry(line: LineAnnotation): LineNodeGeometry {
  const x = Math.min(line.start.x, line.end.x) - LINE_NODE_PADDING;
  const y = Math.min(line.start.y, line.end.y) - LINE_NODE_PADDING;
  const width = Math.abs(line.end.x - line.start.x) + LINE_NODE_PADDING * 2;
  const height = Math.abs(line.end.y - line.start.y) + LINE_NODE_PADDING * 2;

  return {
    position: { x, y },
    size: { width, height },
    localStart: { x: line.start.x - x, y: line.start.y - y },
    localEnd: { x: line.end.x - x, y: line.end.y - y },
  };
}

export function moveLineToNodePosition(line: LineAnnotation, position: Point): LineAnnotation {
  const current = getLineNodeGeometry(line).position;
  const dx = position.x - current.x;
  const dy = position.y - current.y;

  return {
    ...line,
    start: { x: line.start.x + dx, y: line.start.y + dy },
    end: { x: line.end.x + dx, y: line.end.y + dy },
  };
}

export function getDragResizePatch(start: Point, current: Point) {
  const width = Math.max(MIN_DRAW_SIZE, Math.abs(current.x - start.x));
  const height = Math.max(MIN_DRAW_SIZE, Math.abs(current.y - start.y));
  return {
    size: { width, height },
    position: {
      x: current.x < start.x ? start.x - width : start.x,
      y: current.y < start.y ? start.y - height : start.y,
    },
  };
}

export function getClickPlacementPatch(kind: AnnotationKind, center: Point) {
  const size = DEFAULT_ANNOTATION_SIZE[kind];
  return {
    size,
    position: {
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
    },
  };
}
