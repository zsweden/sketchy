import { describe, it, expect } from 'vitest';
import { UndoRedoManager } from '../undo-redo';

describe('UndoRedoManager', () => {
  it('starts with nothing to undo/redo', () => {
    const mgr = new UndoRedoManager<number>();
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it('can undo after push', () => {
    const mgr = new UndoRedoManager<number>();
    mgr.push(1);
    expect(mgr.canUndo).toBe(true);
  });

  it('undo returns previous state', () => {
    const mgr = new UndoRedoManager<number>();
    mgr.push(1);
    mgr.push(2);
    const result = mgr.undo(3);
    expect(result).toBe(2);
  });

  it('redo returns next state after undo', () => {
    const mgr = new UndoRedoManager<number>();
    mgr.push(1);
    mgr.push(2);
    mgr.undo(3);
    const result = mgr.redo(2);
    expect(result).toBe(3);
  });

  it('undo past beginning returns null', () => {
    const mgr = new UndoRedoManager<number>();
    mgr.push(1);
    mgr.undo(2);
    const result = mgr.undo(1);
    expect(result).toBeNull();
  });

  it('push after undo clears redo stack', () => {
    const mgr = new UndoRedoManager<number>();
    mgr.push(1);
    mgr.push(2);
    mgr.undo(3);
    expect(mgr.canRedo).toBe(true);

    mgr.push(4);
    expect(mgr.canRedo).toBe(false);
  });

  it('caps stack at 50 entries', () => {
    const mgr = new UndoRedoManager<number>();
    for (let i = 0; i < 55; i++) {
      mgr.push(i);
    }

    let count = 0;
    while (mgr.canUndo) {
      mgr.undo(999);
      count++;
    }
    expect(count).toBe(50);
  });

  it('clear removes all history', () => {
    const mgr = new UndoRedoManager<number>();
    mgr.push(1);
    mgr.push(2);
    mgr.clear();
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it('deep clones objects to prevent mutation', () => {
    const mgr = new UndoRedoManager<{ value: number }>();
    const obj = { value: 1 };
    mgr.push(obj);

    obj.value = 99;

    const restored = mgr.undo({ value: 2 });
    expect(restored!.value).toBe(1);
  });
});
