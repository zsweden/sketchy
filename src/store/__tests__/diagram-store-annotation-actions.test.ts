import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../diagram-store';
import { useUIStore } from '../ui-store';

function resetStore() {
  useDiagramStore.getState().setFramework('crt');
  useDiagramStore.getState().newDiagram();
  useDiagramStore.setState((s) => ({
    diagram: { ...s.diagram, nodes: [], edges: [], annotations: [] },
  }));
  useUIStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedLoopId: null,
    contextMenu: null,
  });
}

describe('annotation actions', () => {
  beforeEach(resetStore);

  describe('addAnnotation', () => {
    it('creates a text annotation with default size at the given position', () => {
      const id = useDiagramStore.getState().addAnnotation('text', { x: 40, y: 60 });
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id);
      expect(ann).toBeDefined();
      expect(ann!.kind).toBe('text');
      expect(ann!.position).toEqual({ x: 40, y: 60 });
      expect(ann!.size.width).toBeGreaterThan(0);
      expect(ann!.size.height).toBeGreaterThan(0);
    });

    it('creates annotations of each kind', () => {
      const text = useDiagramStore.getState().addAnnotation('text', { x: 0, y: 0 });
      const rect = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      const ellipse = useDiagramStore.getState().addAnnotation('ellipse', { x: 0, y: 0 });
      const line = useDiagramStore.getState().addAnnotation('line', { x: 0, y: 0 });
      const kinds = useDiagramStore
        .getState()
        .diagram.annotations
        .filter((a) => [text, rect, ellipse, line].includes(a.id))
        .map((a) => a.kind)
        .sort();
      expect(kinds).toEqual(['ellipse', 'line', 'rect', 'text']);
    });

    it('tracks history', () => {
      useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      expect(useDiagramStore.getState().canUndo).toBe(true);
    });

    it('does not affect the nodes array', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const before = useDiagramStore.getState().diagram.nodes.length;
      useDiagramStore.getState().addAnnotation('rect', { x: 100, y: 100 });
      expect(useDiagramStore.getState().diagram.nodes.length).toBe(before);
    });
  });

  describe('updateAnnotationData', () => {
    it('merges partial data without history', () => {
      const id = useDiagramStore.getState().addAnnotation('text', { x: 0, y: 0 });
      const undoCountBefore = useDiagramStore.getState().canUndo;
      useDiagramStore.getState().updateAnnotationData(id, { text: 'hello' });
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(ann.data.text).toBe('hello');
      // addAnnotation tracked history; updateAnnotationData should not add more.
      expect(useDiagramStore.getState().canUndo).toBe(undoCountBefore);
    });

    it('preserves unrelated data fields on merge', () => {
      const id = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      useDiagramStore.getState().updateAnnotationData(id, { fill: '#ff0000' });
      useDiagramStore.getState().updateAnnotationData(id, { stroke: '#00ff00' });
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(ann.data.fill).toBe('#ff0000');
      expect(ann.data.stroke).toBe('#00ff00');
    });
  });

  describe('commitAnnotationData', () => {
    it('merges data and tracks history', () => {
      const id = useDiagramStore.getState().addAnnotation('text', { x: 0, y: 0 });
      useDiagramStore.getState().commitAnnotationData(id, { text: 'final' });
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(ann.data.text).toBe('final');
      // Undo the text commit → text should revert to whatever it was before commit
      useDiagramStore.getState().undo();
      const after = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(after.data.text).not.toBe('final');
    });
  });

  describe('resizeAnnotation', () => {
    it('updates size and tracks history', () => {
      const id = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      useDiagramStore.getState().resizeAnnotation(id, {
        size: { width: 300, height: 200 },
      });
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(ann.size).toEqual({ width: 300, height: 200 });
    });

    it('applies optional position update (for top-left resize)', () => {
      const id = useDiagramStore.getState().addAnnotation('rect', { x: 100, y: 100 });
      useDiagramStore.getState().resizeAnnotation(id, {
        size: { width: 50, height: 50 },
        position: { x: 80, y: 80 },
      });
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(ann.position).toEqual({ x: 80, y: 80 });
      expect(ann.size).toEqual({ width: 50, height: 50 });
    });
  });

  describe('deleteAnnotations', () => {
    it('removes annotations by id', () => {
      const a = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      const b = useDiagramStore.getState().addAnnotation('ellipse', { x: 0, y: 0 });
      useDiagramStore.getState().deleteAnnotations([a]);
      const anns = useDiagramStore.getState().diagram.annotations;
      expect(anns).toHaveLength(1);
      expect(anns[0].id).toBe(b);
    });

    it('leaves nodes and edges untouched', () => {
      const n1 = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const n2 = useDiagramStore.getState().addNode({ x: 0, y: 100 });
      useDiagramStore.getState().addEdge(n1, n2);
      const a = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      useDiagramStore.getState().deleteAnnotations([a]);
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
      expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
    });

    it('is a no-op for empty id list', () => {
      useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      const undoBefore = useDiagramStore.getState().canUndo;
      useDiagramStore.getState().deleteAnnotations([]);
      // State unchanged; no new history entry.
      expect(useDiagramStore.getState().diagram.annotations).toHaveLength(1);
      expect(useDiagramStore.getState().canUndo).toBe(undoBefore);
    });

    it('tracks history', () => {
      const a = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      useDiagramStore.getState().deleteAnnotations([a]);
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().diagram.annotations).toHaveLength(1);
    });
  });

  describe('drag integration (shared with node drag)', () => {
    it('moves an annotation via dragNodes and commits a single history entry', () => {
      const id = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      useDiagramStore.getState().dragNodes([{ id, position: { x: 50, y: 50 } }]);
      useDiagramStore.getState().dragNodes([{ id, position: { x: 100, y: 100 } }]);
      useDiagramStore.getState().commitDraggedNodes();
      const ann = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(ann.position).toEqual({ x: 100, y: 100 });

      useDiagramStore.getState().undo();
      const reverted = useDiagramStore.getState().diagram.annotations.find((a) => a.id === id)!;
      expect(reverted.position).toEqual({ x: 0, y: 0 });
    });

    it('handles a mixed drag (entity node + annotation) as one history entry', () => {
      const nodeId = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      const annId = useDiagramStore.getState().addAnnotation('rect', { x: 0, y: 0 });
      useDiagramStore.getState().dragNodes([
        { id: nodeId, position: { x: 10, y: 10 } },
        { id: annId, position: { x: 20, y: 20 } },
      ]);
      useDiagramStore.getState().commitDraggedNodes();

      useDiagramStore.getState().undo();
      const n = useDiagramStore.getState().diagram.nodes.find((x) => x.id === nodeId)!;
      const a = useDiagramStore.getState().diagram.annotations.find((x) => x.id === annId)!;
      expect(n.position).toEqual({ x: 0, y: 0 });
      expect(a.position).toEqual({ x: 0, y: 0 });
    });
  });
});
