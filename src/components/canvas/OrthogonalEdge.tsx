import { BaseEdge, Position, type EdgeProps } from '@xyflow/react';
import { buildOrthogonalEdgePoints, getPolylineLength } from '../../core/edge-routing';
import type { CardinalHandleSide } from '../../core/types';

function toCardinalHandleSide(position: Position): CardinalHandleSide {
  switch (position) {
    case Position.Top:
      return 'top';
    case Position.Right:
      return 'right';
    case Position.Bottom:
      return 'bottom';
    case Position.Left:
      return 'left';
  }
}

function toSvgPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join('');
}

function getLabelCoordinates(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const totalLength = getPolylineLength(points);
  if (totalLength === 0) {
    return points[0];
  }

  const midpointDistance = totalLength / 2;
  let traversed = 0;

  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    const segmentLength = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

    if (traversed + segmentLength >= midpointDistance) {
      const remaining = midpointDistance - traversed;
      if (from.x === to.x) {
        return {
          x: from.x,
          y: from.y + Math.sign(to.y - from.y) * remaining,
        };
      }

      return {
        x: from.x + Math.sign(to.x - from.x) * remaining,
        y: from.y,
      };
    }

    traversed += segmentLength;
  }

  return points[points.length - 1];
}

export default function OrthogonalEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  markerEnd,
  interactionWidth,
}: EdgeProps) {
  const points = buildOrthogonalEdgePoints(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    toCardinalHandleSide(sourcePosition),
    toCardinalHandleSide(targetPosition),
  );
  const path = toSvgPath(points);
  const labelCoordinates = getLabelCoordinates(points);

  return (
    <BaseEdge
      path={path}
      label={label}
      labelX={labelCoordinates.x}
      labelY={labelCoordinates.y}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={style}
      markerEnd={markerEnd}
      interactionWidth={interactionWidth}
    />
  );
}
