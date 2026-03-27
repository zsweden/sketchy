import { useEffect } from 'react';
import { useDiagramStore } from '../store/diagram-store';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
