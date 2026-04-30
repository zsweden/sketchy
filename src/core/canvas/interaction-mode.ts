type CanvasInteractionMode = 'select' | 'pan';

interface CanvasInteractionInput {
  interactionMode: CanvasInteractionMode;
  isPlacingAnnotation: boolean;
}

interface ReactFlowInteractionConfig {
  className: string;
  selectionOnDrag: boolean;
  panOnDrag: boolean | number[];
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  elementsSelectable: boolean;
}

export function getReactFlowInteractionConfig({
  interactionMode,
  isPlacingAnnotation,
}: CanvasInteractionInput): ReactFlowInteractionConfig {
  const isPanMode = interactionMode === 'pan';
  const className = [
    isPanMode ? 'pan-mode' : '',
    isPlacingAnnotation ? 'placement-mode' : '',
  ].filter(Boolean).join(' ');

  return {
    className,
    selectionOnDrag: !isPanMode && !isPlacingAnnotation,
    panOnDrag: isPlacingAnnotation ? false : isPanMode ? [0, 1, 2] : [1, 2],
    nodesDraggable: !isPanMode && !isPlacingAnnotation,
    nodesConnectable: !isPanMode && !isPlacingAnnotation,
    elementsSelectable: !isPanMode && !isPlacingAnnotation,
  };
}

export function shouldSuppressMouseForPlacement(isPlacingAnnotation: boolean): boolean {
  return isPlacingAnnotation;
}
