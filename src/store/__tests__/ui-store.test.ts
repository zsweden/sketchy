import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUIStore } from '../ui-store';
import { uiEvents } from '../ui-events';

function resetStore() {
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
    sidePanelOpen: true,
    chatPanelMode: 'shared',
    interactionMode: 'select',
  });
}

describe('ui store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('selection', () => {
    it('sets selected node ids', () => {
      useUIStore.getState().setSelectedNodes(['n1', 'n2']);
      expect(useUIStore.getState().selectedNodeIds).toEqual(['n1', 'n2']);
    });

    it('replaces previous node selection', () => {
      useUIStore.getState().setSelectedNodes(['n1']);
      useUIStore.getState().setSelectedNodes(['n2', 'n3']);
      expect(useUIStore.getState().selectedNodeIds).toEqual(['n2', 'n3']);
    });

    it('clears node selection with empty array', () => {
      useUIStore.getState().setSelectedNodes(['n1']);
      useUIStore.getState().setSelectedNodes([]);
      expect(useUIStore.getState().selectedNodeIds).toEqual([]);
    });

    it('sets selected edge ids', () => {
      useUIStore.getState().setSelectedEdges(['e1', 'e2']);
      expect(useUIStore.getState().selectedEdgeIds).toEqual(['e1', 'e2']);
    });

    it('replaces previous edge selection', () => {
      useUIStore.getState().setSelectedEdges(['e1']);
      useUIStore.getState().setSelectedEdges(['e2']);
      expect(useUIStore.getState().selectedEdgeIds).toEqual(['e2']);
    });

    it('clears edge selection with empty array', () => {
      useUIStore.getState().setSelectedEdges(['e1']);
      useUIStore.getState().setSelectedEdges([]);
      expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
    });

    it('node and edge selections are independent', () => {
      useUIStore.getState().setSelectedNodes(['n1']);
      useUIStore.getState().setSelectedEdges(['e1']);
      expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
      expect(useUIStore.getState().selectedEdgeIds).toEqual(['e1']);
    });

    it('selectGraphObject selects only the target node', () => {
      useUIStore.getState().setSelectedEdges(['e1']);
      useUIStore.getState().setSelectedLoop('loop-1');
      useUIStore.getState().selectGraphObject({ kind: 'node', id: 'n1' });
      expect(useUIStore.getState().selectedNodeIds).toEqual(['n1']);
      expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
      expect(useUIStore.getState().selectedLoopId).toBeNull();
    });

    it('selectGraphObject selects only the target edge', () => {
      useUIStore.getState().setSelectedNodes(['n1']);
      useUIStore.getState().setSelectedLoop('loop-1');
      useUIStore.getState().selectGraphObject({ kind: 'edge', id: 'e1' });
      expect(useUIStore.getState().selectedNodeIds).toEqual([]);
      expect(useUIStore.getState().selectedEdgeIds).toEqual(['e1']);
      expect(useUIStore.getState().selectedLoopId).toBeNull();
    });

    it('selectGraphObject selects only the target loop', () => {
      useUIStore.getState().setSelectedNodes(['n1']);
      useUIStore.getState().setSelectedEdges(['e1']);
      useUIStore.getState().selectGraphObject({ kind: 'loop', id: 'loop-1' });
      expect(useUIStore.getState().selectedNodeIds).toEqual([]);
      expect(useUIStore.getState().selectedEdgeIds).toEqual([]);
      expect(useUIStore.getState().selectedLoopId).toBe('loop-1');
    });
  });

  describe('context menu', () => {
    it('opens context menu with node target', () => {
      useUIStore.getState().openContextMenu(100, 200, 'n1');
      const menu = useUIStore.getState().contextMenu;
      expect(menu).toEqual({ x: 100, y: 200, nodeId: 'n1', edgeId: undefined });
    });

    it('opens context menu with edge target', () => {
      useUIStore.getState().openContextMenu(50, 75, undefined, 'e1');
      const menu = useUIStore.getState().contextMenu;
      expect(menu).toEqual({ x: 50, y: 75, nodeId: undefined, edgeId: 'e1' });
    });

    it('opens context menu with no target (canvas)', () => {
      useUIStore.getState().openContextMenu(10, 20);
      const menu = useUIStore.getState().contextMenu;
      expect(menu).toEqual({ x: 10, y: 20, nodeId: undefined, edgeId: undefined });
    });

    it('closes context menu', () => {
      useUIStore.getState().openContextMenu(100, 200, 'n1');
      useUIStore.getState().closeContextMenu();
      expect(useUIStore.getState().contextMenu).toBeNull();
    });

    it('opening a new context menu replaces the previous one', () => {
      useUIStore.getState().openContextMenu(100, 200, 'n1');
      useUIStore.getState().openContextMenu(300, 400, undefined, 'e2');
      const menu = useUIStore.getState().contextMenu;
      expect(menu).toEqual({ x: 300, y: 400, nodeId: undefined, edgeId: 'e2' });
    });
  });

  describe('side panel', () => {
    it('defaults to open', () => {
      expect(useUIStore.getState().sidePanelOpen).toBe(true);
    });

    it('defaults chat panel mode to shared', () => {
      expect(useUIStore.getState().chatPanelMode).toBe('shared');
    });

    it('toggles from open to closed', () => {
      useUIStore.getState().toggleSidePanel();
      expect(useUIStore.getState().sidePanelOpen).toBe(false);
    });

    it('toggles back to open', () => {
      useUIStore.getState().toggleSidePanel();
      useUIStore.getState().toggleSidePanel();
      expect(useUIStore.getState().sidePanelOpen).toBe(true);
    });

    it('sets chat panel mode explicitly', () => {
      useUIStore.getState().setChatPanelMode('max');
      expect(useUIStore.getState().chatPanelMode).toBe('max');
    });
  });

  describe('interaction mode', () => {
    it('defaults to select', () => {
      expect(useUIStore.getState().interactionMode).toBe('select');
    });

    it('switches to pan', () => {
      useUIStore.getState().setInteractionMode('pan');
      expect(useUIStore.getState().interactionMode).toBe('pan');
    });

    it('switches back to select', () => {
      useUIStore.getState().setInteractionMode('pan');
      useUIStore.getState().setInteractionMode('select');
      expect(useUIStore.getState().interactionMode).toBe('select');
    });
  });

  describe('fit view event', () => {
    let fitViewHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fitViewHandler = vi.fn();
      uiEvents.on('fitView', fitViewHandler);
    });

    afterEach(() => {
      uiEvents.off('fitView', fitViewHandler);
    });

    it('emits fitView on requestFitView', () => {
      useUIStore.getState().requestFitView();
      expect(fitViewHandler).toHaveBeenCalledTimes(1);
    });

    it('emits fitView each time requestFitView is called', () => {
      useUIStore.getState().requestFitView();
      useUIStore.getState().requestFitView();
      useUIStore.getState().requestFitView();
      expect(fitViewHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('viewport focus event', () => {
    let focusHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      focusHandler = vi.fn();
      uiEvents.on('viewportFocus', focusHandler);
    });

    afterEach(() => {
      uiEvents.off('viewportFocus', focusHandler);
    });

    it('emits viewportFocus with the target on focusGraphObject', () => {
      useUIStore.getState().focusGraphObject({ kind: 'node', id: 'n1' });

      expect(focusHandler).toHaveBeenCalledTimes(1);
      expect(focusHandler).toHaveBeenCalledWith({ kind: 'node', id: 'n1' });
    });

    it('emits viewportFocus on repeated focusGraphObject calls', () => {
      useUIStore.getState().focusGraphObject({ kind: 'edge', id: 'e1' });
      useUIStore.getState().focusGraphObject({ kind: 'edge', id: 'e1' });

      expect(focusHandler).toHaveBeenCalledTimes(2);
    });
  });
});
