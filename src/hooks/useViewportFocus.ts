import { useCallback, useRef } from 'react';
import { useReactFlow, type Rect } from '@xyflow/react';
import { useDiagramStore } from '../store/diagram-store';
import { useUIEvent } from '../store/ui-events';
import { findCausalLoops } from '../core/graph/derived';
import { FIT_VIEW_OPTIONS } from '../core/layout/fit-view-options';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../constants/layout';
import type { GraphObjectTarget } from '../store/ui-store';

function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
  );
}

function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Manages viewport focus (pan-to-object) and fit-view triggers.
 * Returns a `pendingFitView` ref that onNodesChange can check
 * to trigger fitView after dimension measurements arrive.
 */
export function useViewportFocus(canvasRef: React.RefObject<HTMLDivElement | null>) {
  const { getInternalNode, getViewport, setCenter, viewportInitialized, fitView } = useReactFlow();
  const pendingFitView = useRef(false);

  // Pan to focused graph object when off-screen
  useUIEvent('viewportFocus', (target) => {
    if (!viewportInitialized) return;

    const currentDiagram = useDiagramStore.getState().diagram;
    const getNodeRect = (nodeId: string): Rect | null => {
      const node = currentDiagram.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return null;

      const internalNode = getInternalNode(nodeId);
      const width = internalNode?.measured?.width ?? internalNode?.width ?? DEFAULT_NODE_WIDTH;
      const height = internalNode?.measured?.height ?? internalNode?.height ?? DEFAULT_NODE_HEIGHT;

      return {
        x: node.position.x,
        y: node.position.y,
        width,
        height,
      };
    };

    const getObjectRect = (focusTarget: GraphObjectTarget): Rect | null => {
      if (focusTarget.kind === 'node') {
        return getNodeRect(focusTarget.id);
      }

      if (focusTarget.kind === 'edge') {
        const edge = currentDiagram.edges.find((candidate) => candidate.id === focusTarget.id);
        if (!edge) return null;

        const rects = [getNodeRect(edge.source), getNodeRect(edge.target)]
          .filter((rect): rect is Rect => rect != null);
        return unionRects(rects);
      }

      const loop = findCausalLoops(currentDiagram.edges)
        .find((candidate) => candidate.id === focusTarget.id);
      if (!loop) return null;

      const rects = loop.nodeIds
        .map((nodeId) => getNodeRect(nodeId))
        .filter((rect): rect is Rect => rect != null);
      return unionRects(rects);
    };

    const targetRect = getObjectRect(target);
    if (!targetRect) return;

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const viewportWidth = canvasBounds?.width || canvasRef.current?.clientWidth || window.innerWidth;
    const viewportHeight = canvasBounds?.height || canvasRef.current?.clientHeight || window.innerHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) return;

    const viewport = getViewport();
    const visibleRect: Rect = {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      width: viewportWidth / viewport.zoom,
      height: viewportHeight / viewport.zoom,
    };

    const isVisible = target.kind === 'loop'
      ? rectContains(visibleRect, targetRect)
      : rectsIntersect(targetRect, visibleRect);
    if (isVisible) return;

    const centerX = targetRect.x + targetRect.width / 2;
    const centerY = targetRect.y + targetRect.height / 2;
    void setCenter(centerX, centerY, { zoom: viewport.zoom });
  });

  // Fit view when requested (after layout, etc.)
  useUIEvent('fitView', () => {
    pendingFitView.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pendingFitView.current) {
          pendingFitView.current = false;
          fitView(FIT_VIEW_OPTIONS);
        }
      });
    });
  });

  const tryFitViewOnDimensions = useCallback(() => {
    if (pendingFitView.current) {
      pendingFitView.current = false;
      requestAnimationFrame(() => fitView(FIT_VIEW_OPTIONS));
    }
  }, [fitView]);

  return { pendingFitView, tryFitViewOnDimensions };
}
