import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDiagramStore } from '../../store/diagram-store';
import { useUIStore } from '../../store/ui-store';

// Simulate the keyboard shortcut logic directly (no React rendering needed)
// since the hook just adds document event listeners.

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  document.dispatchEvent(event);
}

function fireKeyUp(key: string) {
  const event = new KeyboardEvent('keyup', { key, bubbles: true });
  document.dispatchEvent(event);
}

// Minimal reimplementation of the shortcut handler for unit testing
// (avoids React hook rendering complexity)
function installShortcuts() {
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

    if (isMod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      useDiagramStore.getState().undo();
      return;
    }
    if (isMod && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      useDiagramStore.getState().redo();
      return;
    }
    if (isMod && e.key === 'y') {
      e.preventDefault();
      useDiagramStore.getState().redo();
      return;
    }
    if (isEditing) return;
    if (e.key === ' ' && !e.repeat && !spaceHeld) {
      e.preventDefault();
      spaceHeld = true;
      modeBeforeSpace = useUIStore.getState().interactionMode;
      useUIStore.getState().setInteractionMode('pan');
      return;
    }
    if (e.key === 'v' || e.key === 'V') {
      useUIStore.getState().setInteractionMode('select');
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      useUIStore.getState().setInteractionMode('pan');
      return;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
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
}

describe('keyboard shortcuts', () => {
  let cleanup: () => void;

  beforeEach(() => {
    useDiagramStore.getState().newDiagram();
    useUIStore.setState({ interactionMode: 'select' });
    cleanup = installShortcuts();
  });

  afterEach(() => {
    cleanup();
  });

  describe('undo/redo', () => {
    it('Cmd+Z triggers undo', () => {
      const id = useDiagramStore.getState().addNode({ x: 0, y: 0 });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);

      fireKey('z', { metaKey: true });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('Ctrl+Z triggers undo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { ctrlKey: true });
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);
    });

    it('Cmd+Shift+Z triggers redo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { metaKey: true }); // undo
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(0);

      fireKey('z', { metaKey: true, shiftKey: true }); // redo
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    });

    it('Cmd+Y triggers redo', () => {
      useDiagramStore.getState().addNode({ x: 0, y: 0 });
      fireKey('z', { metaKey: true }); // undo
      fireKey('y', { metaKey: true }); // redo
      expect(useDiagramStore.getState().diagram.nodes).toHaveLength(1);
    });
  });

  describe('tool shortcuts', () => {
    it('V switches to select mode', () => {
      useUIStore.setState({ interactionMode: 'pan' });
      fireKey('v');
      expect(useUIStore.getState().interactionMode).toBe('select');
    });

    it('H switches to pan mode', () => {
      fireKey('h');
      expect(useUIStore.getState().interactionMode).toBe('pan');
    });

    it('Space hold toggles to pan, release restores', () => {
      expect(useUIStore.getState().interactionMode).toBe('select');

      fireKey(' ');
      expect(useUIStore.getState().interactionMode).toBe('pan');

      fireKeyUp(' ');
      expect(useUIStore.getState().interactionMode).toBe('select');
    });

    it('Space restores pan mode if already panning', () => {
      useUIStore.setState({ interactionMode: 'pan' });

      fireKey(' ');
      expect(useUIStore.getState().interactionMode).toBe('pan');

      fireKeyUp(' ');
      expect(useUIStore.getState().interactionMode).toBe('pan');
    });
  });
});
