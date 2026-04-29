import { describe, expect, it } from 'vitest';
import {
  getReactFlowInteractionConfig,
  shouldSuppressMouseForPlacement,
} from '../interaction-mode';

describe('canvas interaction mode', () => {
  it('enables normal selection and node interactions in select mode', () => {
    expect(getReactFlowInteractionConfig({
      interactionMode: 'select',
      isPlacingAnnotation: false,
    })).toEqual({
      className: '',
      selectionOnDrag: true,
      panOnDrag: [1, 2],
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
    });
  });

  it('routes all mouse buttons to panning in pan mode', () => {
    expect(getReactFlowInteractionConfig({
      interactionMode: 'pan',
      isPlacingAnnotation: false,
    })).toEqual({
      className: 'pan-mode',
      selectionOnDrag: false,
      panOnDrag: [0, 1, 2],
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
    });
  });

  it('disables React Flow interactions while placing annotations', () => {
    expect(getReactFlowInteractionConfig({
      interactionMode: 'select',
      isPlacingAnnotation: true,
    })).toEqual({
      className: 'placement-mode',
      selectionOnDrag: false,
      panOnDrag: false,
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
    });
  });

  it('suppresses mouse events only during placement', () => {
    expect(shouldSuppressMouseForPlacement(true)).toBe(true);
    expect(shouldSuppressMouseForPlacement(false)).toBe(false);
  });
});
