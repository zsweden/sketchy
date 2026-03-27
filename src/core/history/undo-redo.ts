const MAX_STACK_SIZE = 50;

export class UndoRedoManager<S> {
  private undoStack: S[] = [];
  private redoStack: S[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(state: S): void {
    this.undoStack.push(structuredClone(state));
    this.redoStack = [];
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift();
    }
  }

  undo(currentState: S): S | null {
    if (!this.canUndo) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(structuredClone(currentState));
    return previous;
  }

  redo(currentState: S): S | null {
    if (!this.canRedo) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(structuredClone(currentState));
    return next;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
