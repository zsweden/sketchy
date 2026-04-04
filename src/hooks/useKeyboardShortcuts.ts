import { useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDiagramStore } from '../store/diagram-store';
import { useUIStore } from '../store/ui-store';

export function useKeyboardShortcuts() {
  const spaceHeldRef = useRef(false);
  const modeBeforeSpaceRef = useRef<'select' | 'pan'>('select');

  // Undo — works even inside form fields
  useHotkeys('mod+z', (e) => {
    e.preventDefault();
    useDiagramStore.getState().undo();
  }, { enableOnFormTags: true });

  // Redo — works even inside form fields
  useHotkeys('mod+shift+z, mod+y', (e) => {
    e.preventDefault();
    useDiagramStore.getState().redo();
  }, { enableOnFormTags: true });

  // V for select tool
  useHotkeys('v', () => useUIStore.getState().setInteractionMode('select'));

  // H for hand/pan tool
  useHotkeys('h', () => useUIStore.getState().setInteractionMode('pan'));

  // Escape to clear selection
  useHotkeys('escape', () => useUIStore.getState().requestClearSelection());

  // Space hold to pan, release to restore
  useHotkeys('space', (e) => {
    e.preventDefault();
    if (spaceHeldRef.current) return;
    spaceHeldRef.current = true;
    modeBeforeSpaceRef.current = useUIStore.getState().interactionMode;
    useUIStore.getState().setInteractionMode('pan');
  }, { keydown: true });

  useHotkeys('space', () => {
    if (!spaceHeldRef.current) return;
    spaceHeldRef.current = false;
    useUIStore.getState().setInteractionMode(modeBeforeSpaceRef.current);
  }, { keyup: true, keydown: false });
}
