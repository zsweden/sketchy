import { useEffect } from 'react';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';

export function useKeyboardShortcuts() {
  useEffect(() => {
    let spaceHeld = false;
    let modeBeforeSpace: 'select' | 'pan' = 'select';

    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Undo
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useDiagramStore.getState().undo();
        return;
      }

      // Redo
      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useDiagramStore.getState().redo();
        return;
      }

      // Redo (alternative)
      if (isMod && e.key === 'y') {
        e.preventDefault();
        useDiagramStore.getState().redo();
        return;
      }

      // Skip remaining shortcuts when editing text
      if (isEditing) return;

      // Space hold to pan
      if (e.key === ' ' && !e.repeat && !spaceHeld) {
        e.preventDefault();
        spaceHeld = true;
        modeBeforeSpace = useUIStore.getState().interactionMode;
        useUIStore.getState().setInteractionMode('pan');
        return;
      }

      // V for select tool
      if (e.key === 'v' || e.key === 'V') {
        useUIStore.getState().setInteractionMode('select');
        return;
      }

      // H for hand/pan tool
      if (e.key === 'h' || e.key === 'H') {
        useUIStore.getState().setInteractionMode('pan');
        return;
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        useUIStore.getState().requestClearSelection();
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Release space returns to previous mode
      if (e.key === ' ' && spaceHeld) {
        spaceHeld = false;
        useUIStore.getState().setInteractionMode(modeBeforeSpace);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
